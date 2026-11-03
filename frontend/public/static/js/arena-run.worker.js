/*
 * Chạy thử cho Arena (CHỈ tiện lợi phía client, KHÔNG phải kết quả chính thức).
 *
 * Nhận { code, examples: [{ args, expected }] } — chỉ ví dụ công khai của đề —
 * chạy hàm solve(*args) trong Pyodide rồi so JSON với expected. Server chấm lại
 * bằng bộ test đầy đủ; trang chủ ép worker.terminate() nếu quá 5 s, nên vòng lặp
 * vô hạn không treo giao diện. Nạp Pyodide giống studio-lesson.worker.js.
 *
 * Không phải sandbox bảo mật: mã chạy trong worker dùng một lần của chính trình
 * duyệt người chơi (không có đối tượng nhạy cảm nào ở đây).
 */
/* global importScripts, loadPyodide */

const CUT = 200;

const PY = `
import json, io, contextlib

def _arena_run(code, calls_json):
    calls = json.loads(calls_json)
    ns = {'__name__': 'arena_user'}
    out = io.StringIO()
    try:
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
            exec(compile(code, 'solution.py', 'exec'), ns)
    except BaseException as e:
        return json.dumps({'defError': type(e).__name__ + ': ' + str(e), 'out': out.getvalue()[:4000], 'results': []})
    fn = ns.get('solve')
    if not callable(fn):
        return json.dumps({'defError': 'Không tìm thấy hàm solve', 'out': out.getvalue()[:4000], 'results': []})
    results = []
    for args in calls:
        try:
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
                r = fn(*json.loads(json.dumps(args)))
            results.append({'ok': True, 'json': json.dumps(r), 'repr': repr(r)[:200]})
        except BaseException as e:
            results.append({'ok': False, 'error': (type(e).__name__ + ': ' + str(e))[:200]})
    return json.dumps({'defError': None, 'out': out.getvalue()[:4000], 'results': results})
`;

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  }
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}

self.onmessage = async ({ data }) => {
  try {
    const examples = Array.isArray(data.examples) ? data.examples : [];
    importScripts('/static/vendor/pyodide/pyodide.js');
    const py = await loadPyodide({ indexURL: '/static/vendor/pyodide/', stdout: () => {}, stderr: () => {} });
    self.postMessage({ type: 'ready' });
    py.runPython(PY);
    const run = py.globals.get('_arena_run');
    const raw = run(String(data.code), JSON.stringify(examples.map((e) => e.args)));
    run.destroy();
    const res = JSON.parse(raw);
    const results = examples.map((ex, i) => {
      const r = res.results[i];
      if (!r) return { index: i, passed: false };
      if (!r.ok) return { index: i, passed: false, error: r.error };
      let passed = false;
      try {
        passed = deepEqual(JSON.parse(r.json), ex.expected);
      } catch {
        passed = false;
      }
      return { index: i, passed, got: String(r.repr).slice(0, CUT) };
    });
    self.postMessage({ type: 'result', defError: res.defError, out: res.out, results });
  } catch (error) {
    self.postMessage({ type: 'fatal', message: `Không chạy được Python: ${error && error.message ? error.message : error}` });
  }
};
