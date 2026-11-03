/* Playground: Python chạy trong Worker dùng một lần, không bao giờ chạy trong trang chính. */
/* global importScripts, loadPyodide */
// Worker giữ Pyodide đã nạp qua nhiều lần chạy (nạp lại mất vài giây). Vòng lặp vô hạn thì trang
// chính terminate() worker này rồi tạo cái mới — nên không cần tự canh giờ ở đây.
let pyodide = null;
let loading = null;

function post(msg) {
  self.postMessage(msg);
}

async function boot() {
  importScripts('/static/vendor/pyodide/pyodide.js');
  pyodide = await loadPyodide({
    indexURL: '/static/vendor/pyodide/',
    stdout: (text) => post({ type: 'out', stream: 'stdout', text }),
    stderr: (text) => post({ type: 'out', stream: 'stderr', text }),
    // Không có bàn phím trong worker: input() nhận EOF thay vì treo.
    stdin: () => null,
  });
  post({ type: 'ready' });
}

// Bỏ các khung traceback nội bộ của Pyodide, chỉ giữ phần của người học (main.py).
function cleanTraceback(text) {
  const lines = String(text).split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^\s+File "\/lib\/|^\s+File "<exec>"/.test(lines[i])) {
      while (i + 1 < lines.length && /^\s{4}/.test(lines[i + 1])) i++;
      continue;
    }
    out.push(lines[i]);
  }
  return out.join('\n').trim();
}

self.onmessage = async ({ data }) => {
  if (data.type === 'warm') {
    // Trang yêu cầu nạp sẵn Pyodide trong lúc người học đang gõ code.
    loading = loading || boot().catch(() => {
      loading = null;
    });
    return;
  }
  if (data.type !== 'run') return;
  try {
    loading = loading || boot();
    await loading;
    post({ type: 'started' });
    const t0 = performance.now();
    // Mỗi lần chạy một namespace mới: biến của lần trước không rò sang lần sau.
    const ns = pyodide.globals.get('dict')();
    let error = '';
    try {
      await pyodide.runPythonAsync(data.code, { globals: ns, filename: 'main.py' });
    } catch (e) {
      error = cleanTraceback(e && e.message ? e.message : e);
    } finally {
      ns.destroy();
    }
    post({ type: 'done', error, duration: Math.round(performance.now() - t0) });
  } catch (e) {
    loading = null;
    post({
      type: 'done',
      error: 'Không khởi động được Python: ' + (e && e.message ? e.message : e),
      duration: 0,
    });
  }
};
