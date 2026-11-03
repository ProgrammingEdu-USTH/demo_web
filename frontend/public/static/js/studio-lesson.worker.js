/*
 * Generic grader for imported lessons (studio-lesson/v1).
 *
 * Unlike python-studio.worker.js — which hard-codes the List & Mutability
 * cases — this one takes its cases from the lesson's content_json:
 *   { code, tests: [{ name, call, expect }], forbid: ["...", ...], files: [{ name, content }] }
 * `call` and `expect` are both Python expressions evaluated in the learner's
 * own namespace, so a lesson can assert on anything it can express.
 *
 * The grading loop itself lives in studio-harness.py (same folder) so that
 * scripts/pe-v3/check-pyodide.mjs can run the very same code under Node. It
 * adds what PE v3 needs: re-running a whole script with other data, fixture
 * files (data.txt…), and simulated threading / os.fork — Pyodide has neither.
 *
 * Python still runs in a disposable browser worker, never in the NestJS process.
 */
/* global importScripts, loadPyodide */
self.onmessage = async ({ data }) => {
  try {
    const tests = Array.isArray(data.tests) ? data.tests : [];
    const forbid = Array.isArray(data.forbid) ? data.forbid : [];
    const files = Array.isArray(data.files) ? data.files : [];

    // Cheap source check first: no point booting a 10 MB runtime to reject this.
    const banned = forbid.filter((token) => String(data.code).includes(token));
    if (banned.length) {
      self.postMessage({
        type: 'result',
        tests: [],
        output: '',
        error: `Bài này không cho phép dùng: ${banned.join(', ')}`,
        duration: 0,
        version: '',
      });
      return;
    }

    importScripts('/static/vendor/pyodide/pyodide.js');
    // Print nào lọt ra ngoài bộ chấm (hiếm) vẫn được giữ lại để hiện cho học viên.
    let stray = '';
    const write = (line) => {
      if (stray.length < 4000) stray += line.slice(0, 4000 - stray.length) + '\n';
    };
    const [py, harness] = await Promise.all([
      loadPyodide({
        indexURL: '/static/vendor/pyodide/',
        stdout: write,
        stderr: write,
      }),
      // no-cache = vẫn dùng bản trong cache nhưng hỏi lại server (ETag), để bộ
      // chấm luôn khớp với ca kiểm thử vừa nạp vào bài.
      fetch('/static/js/studio-harness.py', { cache: 'no-cache' }).then((r) => {
        if (!r.ok) throw new Error(`không tải được bộ chấm (${r.status})`);
        return r.text();
      }),
    ]);
    self.postMessage({ type: 'ready' });
    const started = performance.now();
    await py.runPythonAsync(harness);
    const grade = py.globals.get('_studio_main');
    const result = JSON.parse(grade(String(data.code), JSON.stringify(tests), JSON.stringify(files)));
    grade.destroy();
    self.postMessage({
      type: 'result',
      ...result,
      output: (result.output || '') + stray,
      duration: Math.round(performance.now() - started),
    });
  } catch (error) {
    self.postMessage({
      type: 'result',
      tests: [],
      output: '',
      error: `Không chạy được Python: ${error.message}`,
      duration: 0,
      version: '',
    });
  }
};
