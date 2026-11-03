/**
 * Mã worker (CommonJS, chạy bằng `new Worker(src, { eval: true, ... })`).
 * Giao thức: contracts/features.md §6. Worker KHÔNG nhận `expected`.
 * Mọi lỗi bất ngờ được báo bằng {type:'fatal'}; parent quyết định kết quả cuối.
 */
export const WORKER_SOURCE = `
const { parentPort, workerData } = require('worker_threads');
const path = require('path');
(async () => {
  try {
    const { pyodidePath, code, calls, harness } = workerData;
    const { loadPyodide } = require(path.join(pyodidePath, 'pyodide.js'));
    const py = await loadPyodide({
      indexURL: pyodidePath,
      stdout: () => {},
      stderr: () => {},
    });
    py.runPython(harness);
    const define = py.globals.get('_arena_define');
    const call = py.globals.get('_arena_call');
    parentPort.postMessage({ type: 'ready' });
    const d = JSON.parse(define(code));
    if (d.t === 'rejected') {
      parentPort.postMessage({ type: 'rejected', message: String(d.message) });
      return;
    }
    if (d.t === 'error') {
      parentPort.postMessage({ type: 'defined', error: String(d.message) });
      return;
    }
    parentPort.postMessage({ type: 'defined' });
    for (const c of calls) {
      const r = JSON.parse(call(JSON.stringify(c.args)));
      parentPort.postMessage({
        type: 'result',
        index: c.index,
        ok: r.ok === true,
        json: typeof r.json === 'string' ? r.json : undefined,
        repr: typeof r.repr === 'string' ? r.repr : undefined,
        error: typeof r.error === 'string' ? r.error : undefined,
      });
    }
    parentPort.postMessage({ type: 'done' });
  } catch (e) {
    parentPort.postMessage({ type: 'fatal', message: String((e && e.message) || e).slice(0, 200) });
  }
})();
`;
