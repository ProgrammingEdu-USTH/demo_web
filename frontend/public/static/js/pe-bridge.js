/**
 * pe-bridge.js — cầu nối duy nhất giữa 17 file JS legacy (giữ nguyên byte) và
 * kiến trúc mới (Next.js khác origin + Django JWT). PHẢI load TRƯỚC mọi file
 * legacy khác (main.js tự wrap window.fetch lúc load — nó sẽ wrap bản fetch
 * đã được bridge này thay, chuỗi hoạt động đúng thứ tự).
 *
 * Nhiệm vụ:
 * 1. Rewrite URL tương đối /api/* và /auth/* sang proxy backend /backend (layout
 *    bơm vào window.__PE_API_ORIGIN trước khi file này chạy; src/proxy.ts chuyển
 *    tiếp sang backend thật).
 * 2. Đính "Authorization: Bearer <access>" vào mọi request tới backend.
 * 3. Tự BẮT access/refresh token từ response /auth/login và /auth/register
 *    (main.js không phải sửa gì — nó chỉ đọc {ok, name, needs_questionnaire}).
 * 4. Khi 401: thử refresh token 1 lần rồi phát lại request; refresh hỏng →
 *    xóa token + đưa về /login (khớp hành vi session hết hạn của bản Flask).
 * 5. Vá DOMContentLoaded: script legacy được nạp SAU khi DOM sẵn sàng (React
 *    mount xong) nên listener DOMContentLoaded đăng ký muộn sẽ không bao giờ
 *    chạy — bridge gọi ngay handler khi readyState đã qua 'loading'.
 * 6. CSP shim: CSP của trang (src/proxy.ts) không còn 'unsafe-inline', nên mọi
 *    handler nội tuyến onclick="…" trong HTML do JS legacy sinh ra bị trình
 *    duyệt chặn. Shim gỡ các thuộc tính on* ngay khi phần tử vào DOM và tự xử
 *    lý sự kiện — xem khối "CSP shim" ở cuối file.
 */
(function () {
  'use strict';

  var ORIGIN = window.__PE_API_ORIGIN || '';
  var LS_ACCESS = 'pe_access';
  /* Refresh token giờ nằm trong cookie httpOnly do backend đặt (JS không đọc
   * được). Key localStorage cũ chỉ còn đọc MỘT lần để chuyển phiên đang đăng
   * nhập sang cookie, sau đó bị xoá. */
  var LS_LEGACY_REFRESH = 'pe_refresh';

  function getAccess() { try { return localStorage.getItem(LS_ACCESS); } catch (e) { return null; } }
  function getLegacyRefresh() { try { return localStorage.getItem(LS_LEGACY_REFRESH); } catch (e) { return null; } }
  function dropLegacyRefresh() { try { localStorage.removeItem(LS_LEGACY_REFRESH); } catch (e) {} }
  /* Cookie CỜ (không chứa token) để proxy.ts của Next đọc được trạng thái
   * "có phiên" từ server — localStorage server không đọc được. max-age khớp
   * hạn refresh token (8h), được gia hạn mỗi lần login/refresh. */
  function setSessionCookie() {
    try { document.cookie = 'pe_has_session=1; path=/; max-age=28800; SameSite=Lax'; } catch (e) {}
  }
  function clearSessionCookie() {
    try { document.cookie = 'pe_has_session=; path=/; max-age=0; SameSite=Lax'; } catch (e) {}
  }
  function setTokens(access) {
    try {
      if (access) localStorage.setItem(LS_ACCESS, access);
    } catch (e) { /* private mode */ }
    dropLegacyRefresh();
    if (access) setSessionCookie();
  }
  function clearTokens() {
    try { localStorage.removeItem(LS_ACCESS); } catch (e) {}
    dropLegacyRefresh();
    clearSessionCookie();
  }
  window.__PE_setTokens = setTokens;
  window.__PE_clearTokens = clearTokens;

  /* credentials:'include' bắt buộc: backend khác origin, thiếu nó trình duyệt
   * không gửi cookie refresh lên và cũng bỏ qua Set-Cookie trả về. */
  function callRefresh() {
    var legacy = getLegacyRefresh();
    return _origFetch(ORIGIN + '/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(legacy ? { refresh: legacy } : {}),
    });
  }

  /* Refresh access token — DÙNG CHUNG cho retry-401 của fetch và SSE.
   * Dedupe bằng 1 promise đang bay trong tab. Hai TAB cùng refresh thì tab
   * chậm hơn gửi cookie cũ và nhận 401 — thử lại đúng 1 lần sau chút ít, lúc
   * đó trình duyệt đã nhận cookie mới từ tab kia. */
  /* Khách chưa đăng nhập thì không có cookie refresh — khỏi gọi mạng. */
  function maybeLoggedIn() {
    return !!(getAccess() || getLegacyRefresh() ||
      document.cookie.indexOf('pe_has_session=1') !== -1);
  }

  var _refreshing = null;
  function refreshAccess() {
    if (_refreshing) return _refreshing;
    if (!maybeLoggedIn()) return Promise.resolve(null);
    _refreshing = callRefresh().then(function (r) {
      if (r.status !== 401) return r;
      return new Promise(function (ok) { setTimeout(ok, 400); }).then(callRefresh);
    }).then(function (r) {
      if (r.status === 401 || r.status === 403) { clearTokens(); return null; }
      if (!r.ok) return null;  // lỗi mạng/5xx: giữ token, thử lại sau
      return r.json().then(function (d) {
        setTokens(d.access);
        return d.access;
      });
    }).catch(function () { return null; });
    _refreshing.then(function () { _refreshing = null; },
                     function () { _refreshing = null; });
    return _refreshing;
  }
  window.__PE_refreshAccess = refreshAccess;

  /* Body lỗi backend có 2 dạng: {error: 'chuỗi'} và {error: {status, message,
   * detail}} (400/404/429/500). Legacy JS alert(res.error) thẳng → object sẽ
   * hiện "[object Object]" — helper này rút message dùng được cho cả hai. */
  window.__PE_errMsg = function (e) {
    if (e && typeof e === 'object') return e.message || JSON.stringify(e);
    return e;
  };

  function isBackendPath(url) {
    return typeof url === 'string' && (url.indexOf('/api/') === 0 || url.indexOf('/api') === 0 && (url === '/api' || url[4] === '/' || url[4] === '?')
      || url.indexOf('/auth/') === 0 || url.indexOf('/health') === 0);
  }

  var _origFetch = window.fetch.bind(window);

  function doFetch(url, opts, triedRefresh) {
    var finalUrl = url;
    var toBackend = false;
    if (isBackendPath(url)) {
      finalUrl = ORIGIN + url;
      toBackend = true;
    } else if (typeof url === 'string' && ORIGIN && url.indexOf(ORIGIN) === 0) {
      toBackend = true;
    }
    opts = opts || {};
    if (toBackend) {
      var headers = new Headers(opts.headers || {});
      var access = getAccess();
      // KHÔNG đính token vào login/register/refresh: đây là endpoint công khai,
      // token cũ hỏng (backend restart đổi SECRET_KEY dev) sẽ làm JWTAuthentication
      // chặn 401 "Chưa đăng nhập" TRƯỚC khi view kịp xét email/mật khẩu.
      var isPublicAuth = url.indexOf('/auth/login') === 0 ||
                         url.indexOf('/auth/register') === 0 ||
                         url.indexOf('/auth/refresh') === 0;
      if (access && !isPublicAuth && !headers.has('Authorization')) {
        headers.set('Authorization', 'Bearer ' + access);
      }
      opts = Object.assign({}, opts, { headers: headers });
      // /auth/*: phải gửi/nhận cookie refresh httpOnly (khác origin).
      if (url.indexOf('/auth/') === 0 || url.indexOf(ORIGIN + '/auth/') === 0) {
        opts.credentials = 'include';
      }
    }
    return _origFetch(finalUrl, opts).then(function (resp) {
      // Bắt token từ login/register (main.js không cần biết JWT tồn tại)
      if (toBackend && resp.ok &&
          (url.indexOf('/auth/login') === 0 || url.indexOf('/auth/register') === 0)) {
        resp.clone().json().then(function (data) {
          if (data && data.access) setTokens(data.access);
        }).catch(function () {});
      }
      // 401 → thử refresh 1 lần (trừ chính các call auth)
      if (toBackend && resp.status === 401 && !triedRefresh &&
          url.indexOf('/auth/') !== 0) {
        return refreshAccess().then(function (access) {
          if (!access) return resp;
          // Xóa header cũ để lần phát lại đính access MỚI (headers.has()
          // ở trên sẽ không ghi đè nếu còn token hết hạn nằm sẵn).
          if (opts.headers && opts.headers.delete) opts.headers.delete('Authorization');
          return doFetch(url, opts, true);
        });
      }
      return resp;
    });
  }

  window.fetch = function (url, opts) { return doFetch(url, opts, false); };

  // ── DOMContentLoaded compat: legacy script nạp sau khi DOM đã sẵn sàng ──
  var _addEventListener = document.addEventListener.bind(document);
  document.addEventListener = function (type, handler, options) {
    if (type === 'DOMContentLoaded' && document.readyState !== 'loading') {
      setTimeout(function () { handler.call(document, new Event('DOMContentLoaded')); }, 0);
      return;
    }
    return _addEventListener(type, handler, options);
  };

  // ── CSP shim: handler nội tuyến onclick="…" của HTML do JS legacy sinh ra ──
  //
  // CSP không có 'unsafe-inline' nên trình duyệt từ chối chạy thuộc tính on*.
  // Thay vì sửa ~90 chỗ rải trong các file legacy, shim:
  //   1. gỡ thuộc tính on* ngay khi phần tử vào DOM (MutationObserver), cất
  //      mã vào data-pe-on<sự kiện>;
  //   2. nghe sự kiện ở document và chạy mã đó bằng một bộ thông dịch NHỎ —
  //      KHÔNG eval. Chỉ hiểu đúng các dạng có trong code legacy:
  //        fn(args) | window.fn(args) | X && X(args) | event.stopPropagation()
  //        event.preventDefault() | return false | (window.)location(.href) = '…'
  //        if (event.key === 'Enter' && !event.shiftKey) { … }
  //      với args là chuỗi, số, true/false/null, this, this.value, event.
  //   3. Chỉ gọi hàm trong CALLABLE và chỉ chuyển trang trong cùng origin — nếu
  //      HTML có bị chèn mã độc, shim cũng không thành cửa vượt CSP để chạy mã
  //      tuỳ ý.
  var CALLABLE = {
    goLesson: 1, enroll: 1, unenroll: 1, navigate: 1, peGo: 1, readBellItem: 1,
    skSetFilter: 1, skSkillToggle: 1, skSetToggle: 1, toggleFollow: 1,
    forumRenderPosts: 1, forumSetReaction: 1, forumToggleComments: 1, forumSetCmtSort: 1,
    forumAddComment: 1, forumSetCmtReaction: 1, forumSetReplyReaction: 1, forumToggleReply: 1,
    forumAddReply: 1, forumOpenPost: 1,
    goToStep: 1, checkFlagshipMatch: 1, resetFlagshipMatch: 1, checkFlagshipSplit: 1,
    resetFlagshipSplit: 1, showFlagshipSplitHint: 1, checkFlagshipBugSpot: 1,
    resetFlagshipBugSpot: 1, showFlagshipBugSpotHint: 1, checkFlagshipJoin: 1, resetFlagshipJoin: 1,
    chooseSearchSuggestion: 1, toggleSearchLevel: 1, cshPick: 1, removeCourseFilter: 1,
    loadCoursesAndEnrolled: 1, editCourse: 1, delCourse: 1, editLesson: 1, delLesson: 1,
    setAnswer: 1, submitReviewQuiz: 1,
    roadmapSelectTab: 1, roadmapOpenBrowse: 1, roadmapOpenDrawer: 1, roadmapSetStatus: 1,
    roadmapGoTo: 1, roadmapTogglePin: 1,
    reload: 1 // location.reload()
  };
  var EVENTS = ['click', 'change', 'input', 'keydown', 'keyup', 'submit', 'mouseover', 'mouseout', 'focus', 'blur', 'load', 'error'];
  var NO_BUBBLE = { focus: 1, blur: 1, load: 1, error: 1 };
  var warned = {};

  function warnOnce(code, why) {
    if (warned[code]) return;
    warned[code] = 1;
    console.warn('[CSP shim] bỏ qua handler nội tuyến (' + why + '): ' + code);
  }

  /** Tách theo `sep` ở cấp ngoài cùng (bỏ qua bên trong chuỗi và ngoặc). */
  function splitTop(src, sep) {
    var out = [], depth = 0, quote = null, start = 0;
    for (var i = 0; i < src.length; i++) {
      var ch = src[i];
      if (quote) {
        if (ch === '\\') i++;
        else if (ch === quote) quote = null;
        continue;
      }
      if (ch === "'" || ch === '"' || ch === '`') quote = ch;
      else if (ch === '(' || ch === '{' || ch === '[') depth++;
      else if (ch === ')' || ch === '}' || ch === ']') depth--;
      else if (depth === 0 && src.substr(i, sep.length) === sep) {
        out.push(src.slice(start, i));
        start = i + sep.length;
        i += sep.length - 1;
      }
    }
    out.push(src.slice(start));
    return out.map(function (s) { return s.trim(); }).filter(function (s) { return s !== ''; });
  }

  function literal(tok, el, ev) {
    var m = /^(['"])([\s\S]*)\1$/.exec(tok);
    if (m) return m[2].replace(/\\(.)/g, function (_, c) { return c === 'n' ? '\n' : c; });
    if (/^-?\d+(\.\d+)?$/.test(tok)) return Number(tok);
    if (tok === 'true') return true;
    if (tok === 'false') return false;
    if (tok === 'null') return null;
    if (tok === 'this') return el;
    if (tok === 'this.value') return el.value;
    if (tok === 'this.checked') return el.checked;
    if (tok === 'event') return ev;
    throw new Error('đối số không hỗ trợ: ' + tok);
  }

  /** "window.a.b" → { ctx, fn } trên window; null nếu không có. */
  function resolve(path) {
    var parts = path.split('.');
    if (parts[0] === 'window') parts.shift();
    var ctx = window, cur = window;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return null;
      ctx = cur;
      cur = cur[parts[i]];
    }
    return { ctx: ctx, fn: cur, name: parts[parts.length - 1] };
  }

  function safeNavigate(url) {
    var target = new URL(url, window.location.href);
    if (target.origin !== window.location.origin) throw new Error('chuyển trang ra ngoài origin');
    window.location.href = target.href;
  }

  /** Chạy một câu lệnh; trả 'stop' nếu handler gọi stopPropagation. */
  function runStatement(stmt, el, ev) {
    var m;
    if (/^return\s+false$/.test(stmt)) { ev.preventDefault(); return; }
    if (stmt === 'event.preventDefault()') { ev.preventDefault(); return; }
    if (stmt === 'event.stopPropagation()') { ev.stopPropagation(); return 'stop'; }
    if ((m = /^if\s*\(([\s\S]*?)\)\s*\{([\s\S]*)\}$/.exec(stmt))) {
      var ok = splitTop(m[1], '&&').every(function (term) {
        var t;
        if ((t = /^(!?)event\.(\w+)$/.exec(term))) return t[1] ? !ev[t[2]] : !!ev[t[2]];
        if ((t = /^event\.(\w+)\s*===?\s*(.+)$/.exec(term))) return ev[t[1]] === literal(t[2], el, ev);
        throw new Error('điều kiện không hỗ trợ: ' + term);
      });
      return ok ? runCode(m[2], el, ev) : undefined;
    }
    if ((m = /^(?:window\.)?location(?:\.href)?\s*=\s*([\s\S]+)$/.exec(stmt))) {
      safeNavigate(literal(m[1].trim(), el, ev));
      return;
    }
    if ((m = /^([\w$.]+)\s*&&\s*([\s\S]+)$/.exec(stmt))) {
      var guard = resolve(m[1]);
      return guard && guard.fn ? runStatement(m[2].trim(), el, ev) : undefined;
    }
    if ((m = /^([\w$.]+)\s*\(([\s\S]*)\)$/.exec(stmt))) {
      var target = resolve(m[1]);
      if (!target || typeof target.fn !== 'function') throw new Error('không có hàm ' + m[1]);
      if (!CALLABLE[target.name]) throw new Error('hàm ngoài danh sách cho phép: ' + m[1]);
      var args = splitTop(m[2], ',').map(function (a) { return literal(a, el, ev); });
      target.fn.apply(target.ctx, args);
      return;
    }
    throw new Error('câu lệnh không hỗ trợ');
  }

  function runCode(code, el, ev) {
    var stmts = splitTop(code, ';');
    var stopped;
    for (var i = 0; i < stmts.length; i++) {
      if (runStatement(stmts[i], el, ev) === 'stop') stopped = 'stop';
    }
    return stopped;
  }

  function adopt(el) {
    for (var i = 0; i < EVENTS.length; i++) {
      var attr = 'on' + EVENTS[i];
      if (el.hasAttribute && el.hasAttribute(attr)) {
        el.setAttribute('data-pe-' + attr, el.getAttribute(attr));
        el.removeAttribute(attr);
      }
    }
  }

  var SELECTOR = EVENTS.map(function (e) { return '[on' + e + ']'; }).join(',');
  function adoptTree(root) {
    if (root.nodeType !== 1) return;
    adopt(root);
    var found = root.querySelectorAll(SELECTOR);
    for (var i = 0; i < found.length; i++) adopt(found[i]);
  }

  new MutationObserver(function (records) {
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      if (r.type === 'attributes') adopt(r.target);
      else for (var j = 0; j < r.addedNodes.length; j++) adoptTree(r.addedNodes[j]);
    }
  }).observe(document.documentElement, {
    subtree: true, childList: true, attributes: true,
    attributeFilter: EVENTS.map(function (e) { return 'on' + e; })
  });
  adoptTree(document.documentElement);

  EVENTS.forEach(function (type) {
    var key = 'data-pe-on' + type;
    _addEventListener(type, function (ev) {
      // Mô phỏng bubbling của handler nội tuyến: từ phần tử đích đi lên, mỗi
      // phần tử có handler chạy một lần; stopPropagation() dừng các tầng trên.
      var el = ev.target;
      if (NO_BUBBLE[type]) {
        if (el && el.getAttribute && el.getAttribute(key) != null) {
          try { runCode(el.getAttribute(key), el, ev); } catch (e) { warnOnce(el.getAttribute(key), e.message); }
        }
        return;
      }
      for (; el && el !== document; el = el.parentNode) {
        var code = el.getAttribute && el.getAttribute(key);
        if (code == null) continue;
        try {
          if (runCode(code, el, ev) === 'stop') break;
        } catch (e) {
          warnOnce(code, e.message);
        }
      }
    }, !!NO_BUBBLE[type]);
  });
})();
