// ============================================================================
// UI ORCHESTRATOR · 7 VÙNG MÀN HÌNH CHUẨN, KÉO-THẢ VẬT THỂ & NHẬP TỪ BÀN PHÍM
// Nguồn: "PE · Kế hoạch Motion Graphic bài học" (trang 2–5, 8–10)
//
// Người học có 3 cách tác động lên bài:
//  1. Gõ giá trị vào ô nhập (điền thẳng vào code) rồi Enter — cách tự do nhất
//  2. Bấm / kéo thẻ lệnh (giá trị gõ sẵn) — phím tắt 1..9
//  3. Kéo vật trong cảnh thả vào máy (bài nào có vật mang lựa chọn)
// Phím tắt: E hoặc / để gõ · Enter chạy · Esc thoát ô · ←/→ bước · Space chạy/dừng
// ============================================================================

import { base, accents, WORLDS, motion } from './tokens.js';
import {
  LESSONS_11,
  getDeterministicSnapshot,
  validateField,
  inputText,
  splitSlots,
} from './scenarios.js';
import { PixelStageRenderer } from './canvas.js';

function escapeHtml(raw = '') {
  return String(raw).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatCaptionHtml(raw = '') {
  return escapeHtml(raw)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

const PRODUCT_ICONS = {
  memory: '🏷️',
  dj: '💿',
  city: '📦',
  dungeon: '📜',
  kitchen: '🍽️',
};

export function createLessonController(mountEl, opts = {}) {
  let lessonIdx = typeof opts.index === 'number' ? Math.max(0, Math.min(10, opts.index)) : 0;
  let optionId = LESSONS_11[lessonIdx].defaultOption;
  let inputVals = {}; // giá trị đã chạy (đã chuẩn hoá), theo key của ô nhập
  let stepIdx = 0;
  let speed = 1;
  let isPlaying = true;
  let waitingForChoice = false;
  let codeOpen = true;
  let trayOpen = true;
  let timerId = null;
  let formLessonIdx = -1;
  let refocusKey = null;
  // Dải tính toán: bước nhỏ đang hiện trong step hiện tại
  let traceIdx = 0;
  let traceTimer = null;
  let traceKey = '';
  let prevVars = {};
  let contextOpen = false;
  const seenContext = new Set();
  const TRACE_MS = 1100;
  let lens = 'bridge';
  try {
    lens = localStorage.getItem('pe-motion-lens') || 'bridge';
  } catch (e) {
    /* chế độ riêng tư: dùng mặc định */
  }

  const snapAt = (i) => getDeterministicSnapshot(lessonIdx, optionId, i, inputVals);

  // Mở rộng khung chứa #lesson toàn màn hình
  mountEl.innerHTML = '';
  mountEl.style.display = 'block';
  mountEl.style.gridTemplateColumns = 'none';
  mountEl.style.width = '100%';
  mountEl.style.height = 'calc(100vh - 76px)';
  mountEl.style.minHeight = '600px';
  if (mountEl.parentElement && mountEl.parentElement.classList.contains('pg')) {
    mountEl.parentElement.style.maxWidth = 'none';
    mountEl.parentElement.style.width = '100%';
  }

  const root = document.createElement('div');
  root.className = 'pe-stage-root';
  mountEl.appendChild(root);

  function applyColorTokens(worldId) {
    const pal = accents[worldId] || accents.memory;
    const vars = {
      '--pe-ink': base.ink, '--pe-ink2': base.ink2, '--pe-shade': base.shade, '--pe-mid': base.mid,
      '--pe-lav': base.lav, '--pe-pale': base.pale, '--pe-paper': base.paper,
      '--pe-skin1': base.skin1, '--pe-skin2': base.skin2, '--pe-skin3': base.skin3,
      '--pe-wood1': base.wood1, '--pe-wood2': base.wood2, '--pe-wood3': base.wood3,
      '--pe-amber1': base.amber1, '--pe-amber2': base.amber2, '--pe-gray1': base.gray1, '--pe-gray2': base.gray2,
      '--pe-ok': base.ok, '--pe-err': base.err, '--pe-ui-bg': base.uiBg,
      '--pe-a1': pal.a1, '--pe-a2': pal.a2, '--pe-a3': pal.a3, '--pe-a4': pal.a4,
    };
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  }

  applyColorTokens(LESSONS_11[lessonIdx].world);

  root.innerHTML = `
    <!-- VÙNG 3: CẢNH PIXEL 2D TOÀN MÀN HÌNH -->
    <div class="pe-zone-scene" data-el="scene"></div>
    <div class="pe-inspect-popover" data-el="inspect-popover" style="display:none"></div>

    <!-- VÙNG 1: HUD -->
    <header class="pe-zone-hud" aria-label="Vùng 1: HUD">
      <button type="button" class="pe-hud-back" data-act="back" title="Quay về Góc học / Bản đồ">← Về bản đồ</button>
      <select class="pe-hud-select" data-el="lesson-select" aria-label="Chọn bài học trong 11 chặng"></select>
      <span class="pe-hud-world-badge" data-el="world-badge"></span>
      <span class="pe-hud-status" data-el="status-pill" data-status="running">Đang tự chạy</span>
      <span class="pe-hud-xp" data-el="xp-badge">+120 XP</span>
    </header>

    <!-- LỚP NHÌN (concreteness fading) + BỐI CẢNH -->
    <div class="pe-lens-bar" role="group" aria-label="Lớp nhìn">
      <button type="button" class="pe-ctrl-btn pe-context-btn" data-act="open-context" title="Xem lại bối cảnh & bảng ánh xạ (phím B)">📖 Bối cảnh</button>
      <span class="pe-lens-label">Lớp nhìn:</span>
      <button type="button" class="pe-lens-btn" data-lens="story" title="Chỉ câu chuyện ẩn dụ (phím V để đổi lớp)">🎭 Ẩn dụ</button>
      <button type="button" class="pe-lens-btn" data-lens="bridge" title="Ẩn dụ + nhãn code + làm nổi vật đang được tính">🔗 Cầu nối</button>
      <button type="button" class="pe-lens-btn" data-lens="abstract" title="Bỏ ẩn dụ: chỉ còn biến & giá trị">🧩 Code</button>
    </div>

    <!-- DÂY NỐI: dòng code đang tính → vật trong cảnh -->
    <svg class="pe-link-layer" data-el="link-layer" aria-hidden="true"><path data-el="link-path" d=""></path><circle data-el="link-dot" r="5"></circle></svg>

    <!-- THẺ BỐI CẢNH (pre-training): câu chuyện, câu hỏi, bảng ẩn dụ ↔ code -->
    <div class="pe-context-overlay is-hidden" data-el="context-overlay" role="dialog" aria-modal="true" aria-label="Bối cảnh bài học">
      <div class="pe-context-card">
        <div class="pe-context-kicker" data-el="ctx-kicker"></div>
        <h2 class="pe-context-title" data-el="ctx-title"></h2>
        <p class="pe-context-story" data-el="ctx-story"></p>
        <div class="pe-context-goal" data-el="ctx-goal"></div>
        <div class="pe-context-legend-title">Trong cảnh này… là … trong code</div>
        <div class="pe-context-legend" data-el="ctx-legend"></div>
        <div class="pe-context-how">
          <b>Cách xem:</b> mỗi bước, dải <span class="pe-how-chip">⚙ Python đang tính</span> dưới dòng code sẽ chạy từng phép nhỏ;
          vật liên quan trong cảnh sáng lên, dây vàng nối dòng code với vật đó. Đổi <b>Lớp nhìn</b> sang <b>🧩 Code</b> để thấy cùng cảnh đó chỉ còn biến &amp; giá trị.
        </div>
        <button type="button" class="pe-ctrl-btn is-primary pe-context-go" data-act="close-context">Bắt đầu xem ▶ <kbd>Enter</kbd></button>
      </div>
    </div>

    <!-- VÙNG 2: PANEL CODE & BẢNG BIẾN -->
    <aside class="pe-zone-code-wrapper" aria-label="Vùng 2: Panel Code và Bảng biến">
      <button type="button" class="pe-code-toggle-pill" data-el="code-pill" style="display:none">&lt;/&gt; Code</button>
      <div class="pe-zone-code-panel" data-el="code-panel">
        <div class="pe-code-header">
          <span class="pe-code-title" data-el="code-filename">py12_lesson.py</span>
          <button type="button" class="pe-code-collapse-btn" data-act="toggle-code" title="Thu gọn thành nút </> Code">Thu gọn &lt;/&gt;</button>
        </div>
        <ol class="pe-code-lines" data-el="code-lines"></ol>
        <div class="pe-vars-box">
          <div class="pe-vars-title">Bảng biến · vars</div>
          <div class="pe-vars-grid" data-el="vars-grid"></div>
        </div>
      </div>
    </aside>

    <!-- VÙNG 4 & 5: Ô NHẬP / TƯƠNG TÁC & BẢNG LỖI -->
    <div class="pe-zone-center-top">
      <section class="pe-error-box is-hidden" data-el="error-box" aria-label="Vùng 5: Bảng lỗi">
        <div class="pe-error-top">
          <span class="pe-error-name" data-el="error-name">KeyError</span>
          <span class="pe-error-line-tag" data-el="error-line">Dòng 3</span>
        </div>
        <div class="pe-error-incident" data-el="error-incident"></div>
        <div class="pe-error-hint" data-el="error-hint"></div>
        <div class="pe-error-actions" data-el="error-actions">
          <span class="pe-error-fix-label">✎ Sửa giá trị rồi Enter:</span>
          <div class="pe-error-form-slot" data-el="error-form-slot"></div>
          <button type="button" class="pe-retry-btn" data-act="retry-error">↺ Về bước chọn</button>
        </div>
      </section>

      <section class="pe-interaction-box is-hidden" data-el="interaction-box" aria-label="Vùng 4: Hộp tương tác">
        <div class="pe-interaction-head">
          <span class="pe-interaction-badge" data-el="interaction-type">Tương tác</span>
          <span class="pe-interaction-prompt" data-el="interaction-prompt"></span>
        </div>
        <div class="pe-interaction-form-slot" data-el="interaction-form-slot"></div>
      </section>
    </div>

    <!-- VÙNG 6: KHAY SẢN PHẨM -->
    <aside class="pe-zone-tray" data-el="tray-panel" aria-label="Vùng 6: Khay sản phẩm">
      <div class="pe-tray-header">
        <span class="pe-tray-title" data-el="tray-title">Khay tem (0)</span>
        <span class="pe-tray-sub" data-el="tray-machine">Máy in tem</span>
      </div>
      <div class="pe-tray-list" data-el="tray-list"></div>
    </aside>

    <!-- VÙNG 7: WORKBENCH & STORY DOCK -->
    <footer class="pe-zone-controls" aria-label="Vùng 7: Workbench & Điều khiển">
      <div class="pe-workbench-left">
        <div class="pe-story-line">
          <span class="pe-bit-speaker">🤖 BIT</span>
          <div class="pe-caption-text" data-el="caption-text"></div>
        </div>
        <div class="pe-workbench-items" data-el="workbench-items"></div>
        <div class="pe-kbd-hint" data-el="kbd-hint"></div>
      </div>

      <div class="pe-workbench-right">
        <div class="pe-transport-row">
          <button type="button" class="pe-ctrl-btn is-primary" data-act="play-pause" data-el="btn-play">⏸ Dừng</button>
          <div class="pe-step-timeline">
            <button type="button" class="pe-ctrl-btn" data-act="prev" data-el="btn-prev" title="Lùi 1 bước (←)" style="border:none;padding:2px 6px">◀</button>
            <div data-el="step-dots" style="display:inline-flex;gap:3px"></div>
            <button type="button" class="pe-ctrl-btn" data-act="next" data-el="btn-next" title="Tiếp 1 bước (→)" style="border:none;padding:2px 6px">▶</button>
            <span class="pe-step-counter" data-el="step-counter">1/6</span>
          </div>
          <button type="button" class="pe-ctrl-btn" data-act="replay" title="Xem lại từ Bước 1">↺</button>
        </div>
        <div class="pe-transport-row">
          <button type="button" class="pe-ctrl-btn" data-act="speed" data-el="btn-speed" title="Đổi tốc độ chạy">×1</button>
          <button type="button" class="pe-ctrl-btn is-active" data-act="toggle-tray" data-el="btn-tray">🏷️ Khay (0)</button>
          <button type="button" class="pe-ctrl-btn is-active" data-act="toggle-code" data-el="btn-code">&lt;/&gt; Code</button>
        </div>
      </div>
    </footer>
  `;

  const q = (s) => root.querySelector(`[data-el="${s}"]`);
  const el = {
    scene: q('scene'),
    inspectPopover: q('inspect-popover'),
    lessonSelect: q('lesson-select'),
    worldBadge: q('world-badge'),
    statusPill: q('status-pill'),
    xpBadge: q('xp-badge'),
    codePill: q('code-pill'),
    codePanel: q('code-panel'),
    codeFilename: q('code-filename'),
    codeLines: q('code-lines'),
    varsGrid: q('vars-grid'),
    interactionBox: q('interaction-box'),
    interactionType: q('interaction-type'),
    interactionPrompt: q('interaction-prompt'),
    interactionFormSlot: q('interaction-form-slot'),
    errorBox: q('error-box'),
    errorName: q('error-name'),
    errorLine: q('error-line'),
    errorIncident: q('error-incident'),
    errorHint: q('error-hint'),
    errorFormSlot: q('error-form-slot'),
    trayPanel: q('tray-panel'),
    trayTitle: q('tray-title'),
    trayMachine: q('tray-machine'),
    trayList: q('tray-list'),
    captionText: q('caption-text'),
    workbenchItems: q('workbench-items'),
    kbdHint: q('kbd-hint'),
    stepCounter: q('step-counter'),
    btnPlay: q('btn-play'),
    btnPrev: q('btn-prev'),
    btnNext: q('btn-next'),
    btnSpeed: q('btn-speed'),
    btnTray: q('btn-tray'),
    btnCode: q('btn-code'),
    stepDots: q('step-dots'),
    linkLayer: q('link-layer'),
    linkPath: q('link-path'),
    linkDot: q('link-dot'),
    contextOverlay: q('context-overlay'),
    ctxKicker: q('ctx-kicker'),
    ctxTitle: q('ctx-title'),
    ctxStory: q('ctx-story'),
    ctxGoal: q('ctx-goal'),
    ctxLegend: q('ctx-legend'),
  };
  const lensBtns = [...root.querySelectorAll('[data-lens]')];

  LESSONS_11.forEach((item, idx) => {
    const opt = document.createElement('option');
    opt.value = String(idx);
    opt.textContent = `${item.module.split('·')[0].trim()} · ${item.codeId} — ${item.title}`;
    el.lessonSelect.appendChild(opt);
  });

  // ==========================================================================
  // Ô NHẬP TỪ BÀN PHÍM (dựng lại mỗi khi đổi bài; giữ nguyên khi chỉ đổi bước
  // để người học đang gõ không bị mất con trỏ)
  // ==========================================================================
  const form = document.createElement('form');
  form.className = 'pe-input-form';
  form.noValidate = true;
  form.autocomplete = 'off';
  let fieldEls = {};
  let formMsg = null;

  function buildForm() {
    const lesson = LESSONS_11[lessonIdx];
    form.innerHTML = '';
    fieldEls = {};
    const fields = lesson.inputs || [];
    if (!fields.length) return;
    const texts = inputText(lesson, inputVals);
    fields.forEach((f) => {
      const wrap = document.createElement('label');
      wrap.className = 'pe-input-field';
      const autoQuote = f.kind === 'str' && !String(f.label || '').endsWith('"');
      const pre = document.createElement('span');
      pre.className = 'pe-input-pre';
      pre.textContent = `${f.label || f.key}${autoQuote ? ' "' : ''}`;
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'pe-input';
      inp.dataset.key = f.key;
      inp.spellcheck = false;
      inp.value = texts[f.key];
      inp.placeholder = f.placeholder || String(f.default);
      inp.setAttribute('aria-label', `${f.label || f.key} ${f.suffix || ''}`.trim());
      if (f.kind === 'int' || f.kind === 'num') inp.inputMode = 'decimal';
      // Ô co giãn theo độ dài chữ đang gõ
      const fit = () => {
        inp.style.width = `${Math.max(4, Math.min(24, (inp.value || inp.placeholder).length + 1.5))}ch`;
      };
      fit();
      inp._fit = fit;
      inp.addEventListener('input', () => {
        fit();
        const v = validateField(f, inp.value);
        inp.classList.toggle('is-invalid', !v.ok);
        setFormMsg(v.ok ? '' : v.msg, !v.ok);
      });
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          inp.blur();
        }
        e.stopPropagation(); // không để phím tắt (←, →, Space, số) chạy khi đang gõ
      });
      const suf = document.createElement('span');
      suf.className = 'pe-input-suf';
      suf.textContent = `${autoQuote ? '"' : ''}${f.suffix || ''}`;
      wrap.append(pre, inp, suf);
      form.appendChild(wrap);
      fieldEls[f.key] = inp;
    });
    const run = document.createElement('button');
    run.type = 'submit';
    run.className = 'pe-ctrl-btn is-primary pe-input-run';
    run.innerHTML = '▶ Chạy <kbd>Enter</kbd>';
    form.appendChild(run);
    formMsg = document.createElement('span');
    formMsg.className = 'pe-input-msg';
    formMsg.setAttribute('aria-live', 'polite');
    form.appendChild(formMsg);
  }

  function setFormMsg(text, isErr) {
    if (!formMsg) return;
    formMsg.textContent = text || '';
    formMsg.classList.toggle('is-err', Boolean(isErr));
  }

  function syncFormValues() {
    const lesson = LESSONS_11[lessonIdx];
    const texts = inputText(lesson, inputVals);
    for (const [key, inp] of Object.entries(fieldEls)) {
      if (document.activeElement !== inp) {
        inp.value = texts[key];
        inp.classList.remove('is-invalid');
        if (inp._fit) inp._fit();
      }
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const lesson = LESSONS_11[lessonIdx];
    const next = {};
    for (const f of lesson.inputs || []) {
      const inp = fieldEls[f.key];
      const v = validateField(f, inp ? inp.value : f.default);
      if (!v.ok) {
        inp?.classList.add('is-invalid');
        inp?.focus();
        setFormMsg(v.msg, true);
        return;
      }
      next[f.key] = v.text;
    }
    setFormMsg('');
    const active = document.activeElement;
    refocusKey = active && active.dataset && active.dataset.key ? active.dataset.key : null;
    // Mode không dùng ô nhập (vd. while True, deadlock) → gõ giá trị mới là quay về cách viết chuẩn
    const cur = lesson.interaction.options.find((o) => o.id === optionId);
    if (cur && cur.ignoresInput) optionId = lesson.defaultOption;
    inputVals = next;
    runFromInteraction();
  });

  function focusField(key) {
    const lesson = LESSONS_11[lessonIdx];
    if (!(lesson.inputs || []).length) return;
    if (stepIdx < lesson.interactionStep) goTo(lesson.interactionStep, true);
    const inp = fieldEls[key] || Object.values(fieldEls)[0];
    if (inp) {
      clearTimer();
      isPlaying = false;
      syncHudStatus(snapAt(stepIdx));
      inp.focus();
      inp.select();
    }
  }

  // ==========================================================================
  // CANVAS
  // ==========================================================================
  const controlsEl = root.querySelector('.pe-zone-controls');
  const renderer = new PixelStageRenderer(el.scene, {
    getInsets() {
      const h = controlsEl ? controlsEl.offsetHeight : 0;
      return { top: 0, bottom: h ? h + 12 : 0 };
    },
    onSelectOption(selectedOptId) {
      applyUserChoice(selectedOptId);
    },
    onInspectObject(hit, pos) {
      if (!hit || !pos) {
        el.inspectPopover.style.display = 'none';
        return;
      }
      const worldMeta = WORLDS[LESSONS_11[lessonIdx].world] || WORLDS.memory;
      const desc = hit.inspect || (hit.inside ? `Giá trị bên trong: ${hit.inside}` : `Vật thể trong cảnh: ${hit.label || hit.id}`);
      const actionBtnHtml = hit.optId
        ? `<div style="margin-top:6px"><button type="button" class="pe-ctrl-btn is-primary" data-inspect-opt="${escapeHtml(hit.optId)}" style="width:100%">▶ Đưa vào ${escapeHtml(worldMeta.machineName)} &amp; Chạy</button></div>`
        : '';
      el.inspectPopover.innerHTML = `
        <div class="pe-inspect-popover-head">
          <span>🔍 ${escapeHtml(hit.label || hit.id)}</span>
          <button type="button" class="pe-inspect-close" data-act="close-inspect">✕</button>
        </div>
        <div>${formatCaptionHtml(desc)}</div>
        ${actionBtnHtml}
      `;
      const actBtn = el.inspectPopover.querySelector('[data-inspect-opt]');
      if (actBtn) {
        actBtn.addEventListener('click', () => {
          el.inspectPopover.style.display = 'none';
          applyUserChoice(actBtn.dataset.inspectOpt);
        });
      }
      const clampedX = Math.max(150, Math.min(window.innerWidth - 150, pos.screenX));
      const clampedY = Math.max(90, pos.screenY);
      el.inspectPopover.style.left = `${clampedX}px`;
      el.inspectPopover.style.top = `${clampedY}px`;
      el.inspectPopover.style.display = 'block';
    },
  });

  renderer.setLens(lens);

  function clearTimer() {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  // ==========================================================================
  // LỚP NHÌN · THẺ BỐI CẢNH · DẢI TÍNH TOÁN · DÂY NỐI CODE ↔ CẢNH
  // ==========================================================================
  function setLens(next) {
    lens = ['story', 'bridge', 'abstract'].includes(next) ? next : 'bridge';
    renderer.setLens(lens);
    lensBtns.forEach((b) => {
      const on = b.dataset.lens === lens;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    try {
      localStorage.setItem('pe-motion-lens', lens);
    } catch (e) {
      /* bỏ qua */
    }
    applyTraceFocus();
  }

  function openContext() {
    const lesson = LESSONS_11[lessonIdx];
    const ctx = lesson.context;
    if (!ctx) return;
    const worldMeta = WORLDS[lesson.world] || WORLDS.memory;
    el.ctxKicker.textContent = `${lesson.module} · ${lesson.codeId} · Thế giới ${worldMeta.name}`;
    el.ctxTitle.textContent = lesson.title;
    el.ctxStory.textContent = ctx.story;
    el.ctxGoal.innerHTML = `❓ <b>Câu hỏi của bài:</b> ${escapeHtml(ctx.goal)}`;
    el.ctxLegend.innerHTML = ctx.legend
      .map(
        ([icon, meta, code]) =>
          `<div class="pe-legend-row"><span class="pe-legend-icon">${icon}</span><span class="pe-legend-meta">${escapeHtml(meta)}</span><span class="pe-legend-arrow">→</span><code class="pe-legend-code">${escapeHtml(code)}</code></div>`,
      )
      .join('');
    clearTimer();
    clearTraceTimer();
    isPlaying = false;
    contextOpen = true;
    seenContext.add(lessonIdx);
    el.contextOverlay.classList.remove('is-hidden');
    syncHudStatus(snapAt(stepIdx));
    requestAnimationFrame(() => root.querySelector('.pe-context-go')?.focus());
  }

  function closeContext() {
    if (!contextOpen) return;
    contextOpen = false;
    el.contextOverlay.classList.add('is-hidden');
    const snap = snapAt(stepIdx);
    if (!snap.step.error && !snap.step.isInteraction && stepIdx < snap.totalSteps - 1) {
      isPlaying = true;
      scheduleAutoAdvance();
    }
    startTraceTimer();
    syncHudStatus(snap);
  }

  function currentTrace() {
    return snapAt(stepIdx).step.trace || [];
  }

  function clearTraceTimer() {
    if (traceTimer) {
      clearTimeout(traceTimer);
      traceTimer = null;
    }
  }

  /** Lần lượt hiện từng phép tính nhỏ (segmenting + temporal contiguity) */
  function startTraceTimer() {
    clearTraceTimer();
    const tr = currentTrace();
    if (contextOpen || traceIdx >= tr.length - 1) return;
    traceTimer = setTimeout(() => {
      traceIdx += 1;
      applyTraceFocus();
      startTraceTimer();
    }, Math.round(TRACE_MS / speed));
  }

  function applyTraceFocus() {
    const tr = currentTrace();
    const item = tr[Math.min(traceIdx, tr.length - 1)];
    renderer.setFocus(item ? item.f : null);
    el.codeLines.querySelectorAll('.pe-trace-row').forEach((row, i) => {
      row.classList.toggle('is-done', i < traceIdx);
      row.classList.toggle('is-current', i === traceIdx);
      row.classList.toggle('is-pending', i > traceIdx);
    });
    const cur = el.codeLines.querySelector('.pe-trace-row.is-current');
    if (cur) {
      // Cuộn trong khung code (không cuộn cả trang)
      const box = el.codeLines;
      const top = cur.offsetTop - box.offsetTop;
      if (top < box.scrollTop || top + cur.offsetHeight > box.scrollTop + box.clientHeight) {
        box.scrollTop = Math.max(0, top - box.clientHeight / 2);
      }
    }
  }

  let linkRaf = null;
  function updateLink() {
    const hide = () => {
      el.linkLayer.classList.add('is-hidden');
    };
    if (lens === 'story' || !codeOpen || contextOpen) return hide();
    const row = el.codeLines.querySelector('.pe-trace-row.is-current');
    const tr = currentTrace();
    const item = tr[Math.min(traceIdx, tr.length - 1)];
    const fid = item ? [].concat(item.f ?? [])[0] : null;
    if (!row || !fid) return hide();
    const r = renderer.getObjectClientRect(fid);
    if (!r) return hide();
    const rootRect = root.getBoundingClientRect();
    if (!rootRect.width) return hide();
    const k = root.offsetWidth / rootRect.width;
    const rr = row.getBoundingClientRect();
    const lr = el.codeLines.getBoundingClientRect();
    const sx = (rr.left - rootRect.left) * k - 2;
    const sy = (Math.max(lr.top + 6, Math.min(lr.bottom - 6, rr.top + rr.height / 2)) - rootRect.top) * k;
    const ex = (r.left + r.width / 2 - rootRect.left) * k;
    const ey = (r.top - rootRect.top) * k - 6;
    el.linkPath.setAttribute('d', `M ${sx} ${sy} C ${sx - 90} ${sy}, ${ex} ${Math.min(ey - 60, sy + 40)}, ${ex} ${ey}`);
    el.linkDot.setAttribute('cx', ex);
    el.linkDot.setAttribute('cy', ey);
    el.linkLayer.classList.remove('is-hidden');
  }
  function linkLoop() {
    updateLink();
    linkRaf = requestAnimationFrame(linkLoop);
  }

  /** Dải "⚙ Python đang tính": chèn ngay dưới dòng code đang chạy */
  function renderTraceRows(step, activeLines) {
    const tr = step.trace || [];
    if (!tr.length) return;
    const lis = el.codeLines.querySelectorAll('.pe-code-line');
    const anchorIdx = Math.min(lis.length, Math.max(...activeLines.filter((n) => Number.isFinite(n)), 1)) - 1;
    const anchor = lis[anchorIdx];
    const box = document.createElement('li');
    box.className = 'pe-trace-box';
    const head = document.createElement('div');
    head.className = 'pe-trace-head';
    head.innerHTML = '⚙ Python đang tính <span class="pe-trace-tip">→ bước nhỏ tiếp</span>';
    box.appendChild(head);
    tr.forEach((item, i) => {
      const row = document.createElement('div');
      row.className = 'pe-trace-row';
      row.title = 'Bấm để xem bước nhỏ này';
      const num = document.createElement('span');
      num.className = 'pe-trace-num';
      num.textContent = String(i + 1);
      const code = document.createElement('code');
      code.className = 'pe-trace-code';
      code.textContent = item.t;
      row.append(num, code);
      if (item.n) {
        const note = document.createElement('span');
        note.className = 'pe-trace-note';
        note.textContent = item.n;
        row.appendChild(note);
      }
      row.addEventListener('click', (ev) => {
        ev.stopPropagation();
        traceIdx = i;
        applyTraceFocus();
        startTraceTimer();
      });
      box.appendChild(row);
    });
    if (anchor && anchor.nextSibling) el.codeLines.insertBefore(box, anchor.nextSibling);
    else el.codeLines.appendChild(box);
  }

  function scheduleAutoAdvance() {
    clearTimer();
    if (!isPlaying || document.hidden) return;
    const snap = snapAt(stepIdx);
    if (snap.step.error || waitingForChoice || stepIdx >= snap.totalSteps - 1) {
      isPlaying = false;
      syncHudStatus(snap);
      return;
    }
    // Đủ thời gian cho dải tính toán chạy hết rồi mới sang bước sau
    const trLen = (snap.step.trace || []).length;
    const delay = Math.round(Math.max(motion.stepMs, trLen * TRACE_MS + 1200) / speed);
    timerId = setTimeout(() => {
      const nextSnap = snapAt(stepIdx + 1);
      stepIdx = nextSnap.stepIdx;
      if (nextSnap.step.isInteraction) {
        isPlaying = false;
        waitingForChoice = true;
      } else if (nextSnap.step.error || stepIdx >= nextSnap.totalSteps - 1) {
        isPlaying = false;
        waitingForChoice = false;
      }
      renderAll(true);
      if (isPlaying) scheduleAutoAdvance();
    }, delay);
  }

  function syncHudStatus(snap) {
    const hasErr = Boolean(snap.step.error);
    const isLast = snap.stepIdx >= snap.totalSteps - 1;
    let statusKey = 'paused';
    let statusText = 'Tạm dừng';
    if (hasErr) {
      statusKey = 'error';
      statusText = 'Đang lỗi';
    } else if (waitingForChoice || (snap.step.isInteraction && !isPlaying)) {
      statusKey = 'waiting';
      statusText = 'Chờ bạn gõ / chọn';
    } else if (isPlaying) {
      statusKey = 'running';
      statusText = 'Đang tự chạy';
    } else if (isLast) {
      statusKey = 'done';
      statusText = 'Đã xong';
    }
    el.statusPill.dataset.status = statusKey;
    el.statusPill.textContent = statusText;
    el.btnPlay.textContent = isPlaying ? '⏸ Dừng' : '▶ Chạy';
  }

  /** Chạy tiếp từ bước ngay sau bước tương tác với lựa chọn / giá trị hiện tại */
  function runFromInteraction() {
    clearTimer();
    waitingForChoice = false;
    const lesson = LESSONS_11[lessonIdx];
    const snap = snapAt(stepIdx);
    stepIdx = Math.min(snap.totalSteps - 1, lesson.interactionStep + 1);
    const targetSnap = snapAt(stepIdx);
    isPlaying = !targetSnap.step.error && stepIdx < targetSnap.totalSteps - 1;
    renderAll(true);
    if (refocusKey && fieldEls[refocusKey]) {
      fieldEls[refocusKey].focus();
      fieldEls[refocusKey].select();
    }
    refocusKey = null;
    if (isPlaying) scheduleAutoAdvance();
  }

  /** Bấm / kéo thẻ lệnh hoặc vật trong cảnh: thẻ có preset = điền sẵn ô nhập */
  function applyUserChoice(newOptId) {
    const lesson = LESSONS_11[lessonIdx];
    const opt = lesson.interaction.options.find((o) => o.id === newOptId);
    if (!opt) return;
    optionId = newOptId;
    if (opt.preset) inputVals = { ...inputText(lesson, inputVals), ...opt.preset };
    setFormMsg('');
    runFromInteraction();
  }

  function isOptionSelected(lesson, opt) {
    if (!opt.preset) return opt.id === optionId;
    const cur = lesson.interaction.options.find((o) => o.id === optionId);
    if (cur && cur.ignoresInput) return false; // đang ở một mode riêng (vd. while True)
    // Thẻ có preset sáng lên khi giá trị đang chạy trùng đúng giá trị gõ sẵn của thẻ
    const texts = inputText(lesson, inputVals);
    const want = inputText(lesson, { ...texts, ...opt.preset });
    return Object.keys(opt.preset).every((k) => texts[k] === want[k]);
  }

  function renderWorkbenchItems(lesson, worldMeta, sceneDraggable) {
    const inter = lesson.interaction;
    el.workbenchItems.innerHTML = '';
    const hintSpan = document.createElement('span');
    hintSpan.className = 'pe-workbench-hint';
    hintSpan.textContent = sceneDraggable ? '🖐️ Kéo vật / thẻ vào máy, hoặc bấm:' : '🖐️ Thẻ lệnh (bấm / kéo vào máy):';
    el.workbenchItems.appendChild(hintSpan);

    let anySelected = false;
    inter.options.forEach((opt, i) => {
      const token = document.createElement('button');
      token.type = 'button';
      token.draggable = true;
      const selected = isOptionSelected(lesson, opt);
      anySelected = anySelected || selected;
      token.className = `pe-item-token${selected ? ' is-selected' : ''}${opt.isError ? ' is-error-token' : ''}`;
      token.title = `${opt.desc || ''} — phím ${i + 1}`;
      token.innerHTML = `<kbd class="pe-token-key">${i + 1}</kbd>${escapeHtml(opt.label)}`;
      token.addEventListener('dragstart', (ev) => ev.dataTransfer.setData('text/plain', opt.id));
      token.addEventListener('click', () => applyUserChoice(opt.id));
      el.workbenchItems.appendChild(token);
    });
    if (!anySelected && (lesson.inputs || []).length) {
      const custom = document.createElement('span');
      custom.className = 'pe-custom-pill';
      custom.textContent = '✎ đang dùng giá trị bạn tự gõ';
      el.workbenchItems.appendChild(custom);
    }
  }

  function renderKbdHint(lesson) {
    const n = lesson.interaction.options.length;
    const hasInput = (lesson.inputs || []).length > 0;
    el.kbdHint.innerHTML = [
      hasInput ? '<kbd>E</kbd> gõ giá trị · <kbd>Enter</kbd> chạy' : '',
      `<kbd>1</kbd>–<kbd>${n}</kbd> chọn thẻ`,
      '<kbd>←</kbd><kbd>→</kbd> bước',
      '<kbd>Space</kbd> chạy/dừng',
      '<kbd>B</kbd> bối cảnh · <kbd>V</kbd> lớp nhìn',
    ]
      .filter(Boolean)
      .join(' · ');
  }

  function renderAll(animateCanvas = true) {
    const snap = snapAt(stepIdx);
    const { lesson, step, codeLines, totalSteps } = snap;
    const worldMeta = WORLDS[lesson.world] || WORLDS.memory;
    const prodIcon = PRODUCT_ICONS[lesson.world] || '🏷️';

    if (formLessonIdx !== lessonIdx) {
      buildForm();
      renderKbdHint(lesson);
      formLessonIdx = lessonIdx;
    } else {
      syncFormValues();
    }

    applyColorTokens(lesson.world);
    el.inspectPopover.style.display = 'none';
    root.classList.toggle('is-error', Boolean(step.error));
    root.classList.toggle('code-collapsed', !codeOpen);

    // 1. HUD
    el.lessonSelect.value = String(lessonIdx);
    el.worldBadge.textContent = `Thế giới: ${worldMeta.name}`;
    el.xpBadge.textContent = `+${lesson.xp} XP`;
    syncHudStatus(snap);

    // 2. Panel Code (slot sửa được tô sáng) & Bảng biến
    const activeLines = Array.isArray(step.line) ? step.line : [step.line];
    const firstLine = activeLines[0] || 1;
    el.codeFilename.textContent = `${lesson.codeId.toLowerCase()}_${lesson.world}.py`;
    el.codePanel.classList.toggle('is-hidden', !codeOpen);
    el.codePill.style.display = codeOpen ? 'none' : 'inline-block';
    el.codePill.textContent = `</> Code (Dòng ${firstLine})`;
    el.btnCode.classList.toggle('is-active', codeOpen);

    el.codeLines.innerHTML = '';
    codeLines.forEach((lineText, i) => {
      const ln = i + 1;
      const isLineActive = activeLines.includes(ln);
      const isErrLine = step.error && step.error.line === ln;
      const li = document.createElement('li');
      li.className = `pe-code-line${isErrLine ? ' is-error-line' : isLineActive ? ' is-active' : ''}`;
      li.title = `Nhấn để nhảy tới bước chạy dòng ${ln}`;
      const lnEl = document.createElement('span');
      lnEl.className = 'pe-code-ln';
      lnEl.textContent = isErrLine ? '✖' : isLineActive ? '▶' : String(ln);
      const txt = document.createElement('span');
      txt.className = 'pe-code-text';
      for (const part of splitSlots(lineText)) {
        if (part.key) {
          const s = document.createElement('span');
          s.className = 'pe-code-slot';
          s.textContent = part.text;
          s.title = 'Bấm để gõ giá trị khác (phím E)';
          s.addEventListener('click', (ev) => {
            ev.stopPropagation();
            focusField(part.key);
          });
          txt.appendChild(s);
        } else {
          txt.appendChild(document.createTextNode(part.text));
        }
      }
      li.append(lnEl, txt);
      li.addEventListener('click', () => {
        const allSteps = lesson.buildSteps(optionId, snap.input).steps;
        const targetIdx = allSteps.findIndex((s) => (Array.isArray(s.line) ? s.line.includes(ln) : s.line === ln));
        if (targetIdx >= 0) goTo(targetIdx);
      });
      el.codeLines.appendChild(li);
    });

    // Dải tính toán dưới dòng code đang chạy; bước mới → chạy lại từ phép nhỏ đầu tiên
    const key = `${lessonIdx}|${optionId}|${JSON.stringify(inputVals)}|${snap.stepIdx}`;
    const stepChanged = key !== traceKey;
    if (stepChanged) {
      traceIdx = 0;
      traceKey = key;
    }
    renderTraceRows(step, activeLines);

    // Bảng biến: biến vừa đổi giá trị ở bước này được tô sáng (signaling)
    el.varsGrid.innerHTML = '';
    for (const [k, v] of Object.entries(step.vars || {})) {
      const kEl = document.createElement('div');
      kEl.className = 'pe-var-key';
      kEl.textContent = k;
      const vEl = document.createElement('div');
      const strV = String(v);
      const changed = stepChanged && prevVars[k] !== strV && snap.stepIdx > 0;
      vEl.className = `pe-var-val${strV.includes('❌') ? ' is-err' : ''}${changed ? ' is-changed' : ''}`;
      if (changed) kEl.classList.add('is-changed');
      vEl.textContent = strV;
      el.varsGrid.append(kEl, vEl);
    }
    if (stepChanged) prevVars = Object.fromEntries(Object.entries(step.vars || {}).map(([k, v]) => [k, String(v)]));

    // 3. Canvas
    renderer.setSnapshot(snap, animateCanvas);
    applyTraceFocus();
    if (stepChanged) startTraceTimer();

    // 4 & 5. Ô nhập / Bảng lỗi
    const showError = Boolean(step.error);
    const hasInputs = (lesson.inputs || []).length > 0;
    const reached = snap.stepIdx >= lesson.interactionStep;
    const showInteraction = !showError && reached;
    const sceneDraggable = (step.objects || []).some((o) => o.optId);

    el.interactionBox.classList.toggle('is-hidden', !showInteraction);
    el.interactionBox.classList.toggle('is-compact', showInteraction && !step.isInteraction);
    if (showInteraction) {
      if (step.isInteraction) {
        el.interactionType.textContent = lesson.interaction.typeLabel || 'Tương tác';
        el.interactionPrompt.innerHTML = formatCaptionHtml(lesson.interaction.prompt || '');
      } else {
        el.interactionType.textContent = hasInputs ? '✎ Thử giá trị khác' : '↺ Thử lựa chọn khác';
        el.interactionPrompt.innerHTML = hasInputs ? '' : formatCaptionHtml('Bấm thẻ lệnh ở thanh dưới (phím 1, 2, 3…).');
      }
    }

    el.errorBox.classList.toggle('is-hidden', !showError);
    if (showError) {
      el.errorName.textContent = step.error.name;
      el.errorLine.textContent = `Dòng ${step.error.line}`;
      el.errorIncident.textContent = `Sự cố trong cảnh: ${step.error.incident}`;
      el.errorHint.textContent = `💡 Gợi ý sửa: ${step.error.hint}`;
    }
    root.querySelector('.pe-error-fix-label').style.display = showError && hasInputs ? '' : 'none';

    // Đặt form vào đúng hộp (chỉ di chuyển khi khác chỗ để không mất con trỏ)
    const formHome = showError ? el.errorFormSlot : el.interactionFormSlot;
    if (hasInputs && form.parentElement !== formHome) formHome.appendChild(form);
    if (!hasInputs && form.parentElement) form.remove();

    // 6. Khay sản phẩm
    const products = step.products || [];
    if (step.justPrinted) trayOpen = true;
    el.trayPanel.classList.toggle('is-hidden', !trayOpen);
    el.trayTitle.textContent = `${worldMeta.trayName} (${products.length})`;
    el.trayMachine.textContent = `Nguồn: ${worldMeta.machineName}`;
    el.btnTray.textContent = `${prodIcon} Khay (${products.length})`;
    el.btnTray.classList.toggle('is-active', trayOpen);
    el.trayList.innerHTML = '';
    if (products.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'pe-tray-empty';
      emptyEl.textContent = `Chưa có sản phẩm. Mỗi lệnh print() chạy xong sẽ in ${worldMeta.productName.toLowerCase()} vào đây.`;
      el.trayList.appendChild(emptyEl);
    } else {
      products.forEach((p) => {
        const card = document.createElement('div');
        card.className = `pe-product-card${p.isEmpty ? ' is-empty-product' : ''}${p === step.justPrinted ? ' is-new' : ''}`;
        const t = document.createElement('div');
        t.className = 'pe-product-title';
        t.textContent = `${prodIcon} ${p.title}${p.isEmpty ? ' (mặc định/rỗng)' : ''}`;
        const r = document.createElement('div');
        r.className = 'pe-product-raw';
        r.textContent = p.raw;
        card.append(t, r);
        el.trayList.appendChild(card);
      });
    }

    // 7. Workbench & Story Dock
    el.captionText.innerHTML = formatCaptionHtml(step.caption);
    renderWorkbenchItems(lesson, worldMeta, sceneDraggable);

    el.stepCounter.textContent = `B${snap.stepIdx + 1}/${totalSteps}·D${activeLines.join(',')}`;
    el.btnPrev.disabled = snap.stepIdx <= 0;
    el.btnNext.disabled = showError || snap.stepIdx >= totalSteps - 1; // khoá Tiếp khi lỗi (trang 9)
    el.btnSpeed.textContent = `×${speed}`;

    const allSteps = lesson.buildSteps(optionId, snap.input).steps;
    el.stepDots.innerHTML = '';
    allSteps.forEach((st, idx) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = `pe-step-dot${idx === snap.stepIdx ? ' is-current' : ''}${st.isInteraction ? ' is-interaction-dot' : ''}${st.error ? ' is-error-dot' : ''}`;
      dot.textContent = String(idx + 1);
      dot.title = `Bước ${idx + 1}${st.isInteraction ? ' (Tương tác)' : ''}${st.error ? ' (Sự cố lỗi)' : ''}`;
      dot.addEventListener('click', () => goTo(idx));
      el.stepDots.appendChild(dot);
    });
    syncFooterHeight();
  }

  /** Thanh điều khiển cao/thấp theo độ dài lời thoại → đặt lại sân khấu & thanh lớp nhìn */
  let lastFooterH = -1;
  function syncFooterHeight() {
    if (!controlsEl) return;
    const fh = controlsEl.offsetHeight;
    if (fh === lastFooterH) return;
    lastFooterH = fh;
    root.style.setProperty('--pe-footer-h', `${fh}px`);
    renderer.resize();
  }

  function goTo(targetStepIdx, animate = false) {
    clearTimer();
    const snap = snapAt(targetStepIdx);
    stepIdx = snap.stepIdx;
    isPlaying = false;
    waitingForChoice = Boolean(snap.step.isInteraction);
    renderAll(animate);
  }

  function selectLesson(newIdx) {
    clearTimer();
    lessonIdx = Math.max(0, Math.min(LESSONS_11.length - 1, Number(newIdx) || 0));
    optionId = LESSONS_11[lessonIdx].defaultOption;
    inputVals = {};
    stepIdx = 0;
    waitingForChoice = false;
    isPlaying = true;
    prevVars = {};
    renderAll(false);
    scheduleAutoAdvance();
    if (!seenContext.has(lessonIdx)) openContext();
  }

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'back') {
      clearTimer();
      if (typeof opts.onBack === 'function') opts.onBack();
      else {
        const backBtn = document.querySelector('#backBtn') || document.querySelector('[data-go="room"]');
        if (backBtn) backBtn.click();
      }
    } else if (act === 'toggle-code') {
      codeOpen = !codeOpen;
      renderAll(false);
    } else if (act === 'toggle-tray') {
      trayOpen = !trayOpen;
      renderAll(false);
    } else if (act === 'close-inspect') {
      el.inspectPopover.style.display = 'none';
    } else if (act === 'play-pause') {
      const snap = snapAt(stepIdx);
      if (snap.step.error) return;
      if (stepIdx >= snap.totalSteps - 1) {
        stepIdx = 0;
        waitingForChoice = false;
        isPlaying = true;
        renderAll(false);
        scheduleAutoAdvance();
        return;
      }
      isPlaying = !isPlaying;
      if (isPlaying) waitingForChoice = false;
      syncHudStatus(snap);
      if (isPlaying) scheduleAutoAdvance();
      else clearTimer();
    } else if (act === 'prev') {
      if (stepIdx > 0) goTo(stepIdx - 1, true);
    } else if (act === 'next') {
      stepForward();
    } else if (act === 'replay') {
      clearTimer();
      stepIdx = 0;
      waitingForChoice = false;
      isPlaying = true;
      renderAll(false);
      scheduleAutoAdvance();
    } else if (act === 'retry-error') {
      goTo(LESSONS_11[lessonIdx].interactionStep, true);
    } else if (act === 'speed') {
      const idx = motion.speeds.indexOf(speed);
      speed = motion.speeds[(idx + 1) % motion.speeds.length];
      renderer.setSpeed(speed);
      renderAll(false);
      startTraceTimer();
      if (isPlaying) scheduleAutoAdvance();
    } else if (act === 'open-context') {
      openContext();
    } else if (act === 'close-context') {
      closeContext();
    }
  });

  lensBtns.forEach((b) => b.addEventListener('click', () => setLens(b.dataset.lens)));
  el.contextOverlay.addEventListener('click', (e) => {
    if (e.target === el.contextOverlay) closeContext();
  });

  /** → : chạy hết các phép nhỏ của bước hiện tại trước, rồi mới sang bước sau */
  function stepForward() {
    const snap = snapAt(stepIdx);
    const tr = snap.step.trace || [];
    if (traceIdx < tr.length - 1) {
      clearTimer();
      isPlaying = false;
      traceIdx += 1;
      applyTraceFocus();
      startTraceTimer();
      syncHudStatus(snap);
      return;
    }
    if (!snap.step.error && stepIdx < snap.totalSteps - 1) goTo(stepIdx + 1, true);
  }

  el.codePill.addEventListener('click', () => {
    codeOpen = true;
    renderAll(false);
  });

  el.lessonSelect.addEventListener('change', () => selectLesson(Number(el.lessonSelect.value)));

  function onKeyDown(e) {
    // Chỉ nhận phím khi màn hình bài học đang hiển thị (getClientRects đúng cả với position: fixed)
    if (!mountEl.isConnected || !mountEl.getClientRects().length) return;
    const tag = document.activeElement?.tagName;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (contextOpen) {
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
        e.preventDefault();
        closeContext();
      }
      return;
    }
    const snap = snapAt(stepIdx);
    const lesson = snap.lesson;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (stepIdx > 0) goTo(stepIdx - 1, true);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      stepForward();
    } else if (e.key === 'b' || e.key === 'B') {
      e.preventDefault();
      openContext();
    } else if (e.key === 'v' || e.key === 'V') {
      e.preventDefault();
      const order = ['story', 'bridge', 'abstract'];
      setLens(order[(order.indexOf(lens) + 1) % order.length]);
    } else if (e.key === ' ') {
      e.preventDefault();
      el.btnPlay.click();
    } else if (/^[1-9]$/.test(e.key)) {
      const opt = lesson.interaction.options[Number(e.key) - 1];
      if (opt) {
        e.preventDefault();
        applyUserChoice(opt.id);
      }
    } else if (e.key === 'e' || e.key === 'E' || e.key === '/' || e.key === 'Enter') {
      if ((lesson.inputs || []).length) {
        e.preventDefault();
        focusField(lesson.inputs[0].key);
      }
    }
  }

  function onVisibilityChange() {
    if (document.hidden) clearTimer();
    else if (isPlaying) scheduleAutoAdvance();
  }

  window.addEventListener('keydown', onKeyDown);
  document.addEventListener('visibilitychange', onVisibilityChange);

  renderAll(false);
  setLens(lens);
  requestAnimationFrame(() => renderer.resize());
  scheduleAutoAdvance();
  linkLoop();
  // Pre-training: lần đầu mở bài → thẻ bối cảnh & bảng ẩn dụ ↔ code
  if (opts.showContext !== false) openContext();

  return {
    goTo,
    selectLesson,
    setOption(newOptId) {
      applyUserChoice(newOptId);
    },
    /** Gõ giá trị bằng code (test tự động): setInput({ mon: 'táo' }) */
    setInput(vals) {
      inputVals = { ...inputText(LESSONS_11[lessonIdx], inputVals), ...vals };
      syncFormValues();
      runFromInteraction();
    },
    getState() {
      return snapAt(stepIdx);
    },
    /** Ép vẽ 1 khung ngay (test tự động / khi tab bị ẩn rAF tạm dừng) */
    renderNow(t = performance.now()) {
      renderer.renderFrame(t);
    },
    setLens,
    openContext,
    closeContext,
    destroy() {
      clearTimer();
      clearTraceTimer();
      if (linkRaf) cancelAnimationFrame(linkRaf);
      renderer.destroy();
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      mountEl.innerHTML = '';
    },
  };
}
