/* Worker chấm bài Arena (Pyodide). Chuyển từ demo_web/src/arena/grader/worker-source.ts
 * (bản gốc chạy trong worker_threads của Node; ở đây là Web Worker của trình duyệt).
 *
 * Giao thức:
 *   main → {type:'init', indexURL, harness}     worker nạp Pyodide + harness rồi báo {type:'ready'}
 *   main → {type:'grade', code, calls:[{index,args}]}
 *   worker → {type:'rejected', message} | {type:'defined', error?} | {type:'result', index, ok, json?, repr?, error?}… | {type:'done'}
 *   worker → {type:'fatal', message} khi có lỗi bất ngờ.
 * Worker KHÔNG nhận `expected`; trang chủ đếm giờ, so kết quả và terminate() khi quá giờ.
 * Mỗi worker chỉ chấm MỘT bài (harness đã gỡ pyodide/js khỏi sys.modules), xong là bỏ.
 */
/* global importScripts, loadPyodide */
let py = null;
let used = false;

self.onmessage = async ({ data }) => {
  if (!data || typeof data !== 'object') return;
  if (data.type === 'init') {
    try {
      importScripts(data.indexURL + 'pyodide.js');
      py = await loadPyodide({ indexURL: data.indexURL, stdout: () => {}, stderr: () => {} });
      py.runPython(data.harness);
      self.postMessage({ type: 'ready' });
    } catch (e) {
      self.postMessage({ type: 'fatal', message: String((e && e.message) || e).slice(0, 200) });
    }
    return;
  }
  if (data.type === 'grade') {
    if (!py || used) { self.postMessage({ type: 'fatal', message: 'worker chưa sẵn sàng' }); return; }
    used = true;
    try {
      const define = py.globals.get('_arena_define');
      const call = py.globals.get('_arena_call');
      const d = JSON.parse(define(String(data.code)));
      if (d.t === 'rejected') { self.postMessage({ type: 'rejected', message: String(d.message) }); return; }
      if (d.t === 'error') { self.postMessage({ type: 'defined', error: String(d.message) }); return; }
      self.postMessage({ type: 'defined' });
      for (const c of data.calls) {
        const r = JSON.parse(call(JSON.stringify(c.args)));
        self.postMessage({
          type: 'result',
          index: c.index,
          ok: r.ok === true,
          json: typeof r.json === 'string' ? r.json : undefined,
          repr: typeof r.repr === 'string' ? r.repr : undefined,
          error: typeof r.error === 'string' ? r.error : undefined,
        });
      }
      self.postMessage({ type: 'done' });
    } catch (e) {
      self.postMessage({ type: 'fatal', message: String((e && e.message) || e).slice(0, 200) });
    }
  }
};
