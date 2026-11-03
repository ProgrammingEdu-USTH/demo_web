'use client';

import { ArrowLeft, FlaskConical, FolderOpen, Play, RotateCcw, Save, Square } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button, Dialog, ErrorState, Field, Input, Select, Skeleton, Tab, TabList, Tabs, buttonVariants, MAIN_CONTENT_ID, SkipLink, cn, useToast } from '@/components/ui';
import {
  AuthRequired,
  buildSampleHarness,
  createSnippet,
  deleteSnippet,
  docToSnippet,
  fetchProblem,
  listSnippets,
  snippetToDoc,
  updateSnippet,
  type PlaygroundProblem,
  type Snippet,
} from '@/lib/playground-api';
import {
  DEFAULT_DOC,
  LANGS,
  SAMPLES,
  WEB_FILES,
  loadDoc,
  saveDoc,
  type PlaygroundDoc,
  type PlaygroundLang,
  type WebFile,
  STORAGE_KEY,
} from '@/lib/playground-samples';

import { KEY_TIP_STORAGE, RUN_ARIA_SHORTCUTS, modKeyLabel } from '@/lib/playground-keys';

import OutputPane, { type ConsoleLine } from './OutputPane';
import ProblemPanel, { type ProblemState } from './ProblemPanel';
import SnippetsDialog from './SnippetsDialog';

// CodeMirror chỉ được nạp ở trang này, và chỉ ở trình duyệt (không SSR) để trang tải nhanh.
const CodeEditor = dynamic(() => import('./CodeEditor'), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

const WORKER_URL = '/static/js/playground-python.worker.js';
const PY_TIMEOUT_MS = 10_000; // quá hạn → terminate worker (vòng lặp vô hạn)
const MAX_OUTPUT_CHARS = 50_000;

type PyStatus = 'idle' | 'loading' | 'running';

export default function PlaygroundApp() {
  const [doc, setDoc] = useState<PlaygroundDoc>(DEFAULT_DOC);
  const [hydrated, setHydrated] = useState(false);
  const [webFile, setWebFile] = useState<WebFile>('html');
  const [pane, setPane] = useState<'code' | 'result' | 'problem'>('code');
  // Hộp thoại xác nhận/đặt tên (thay window.prompt/confirm).
  const [ask, setAsk] = useState<null | { kind: 'name' } | { kind: 'reset' } | { kind: 'delete'; sn: Snippet }>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const [pyStatus, setPyStatus] = useState<PyStatus>('idle');
  const [frameKey, setFrameKey] = useState(0); // 0 = chưa chạy / đã dừng
  const [meta, setMeta] = useState('');
  const [saved, setSaved] = useState(true);
  const { toast } = useToast();
  // ?problem=<id>: 'none' = chế độ thường; các trạng thái khác xem ProblemPanel.
  const [problem, setProblem] = useState<ProblemState>({ status: 'none' });
  // Snippet trên tài khoản. loggedIn=null: chưa biết.
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [snippetId, setSnippetId] = useState<number | null>(null);
  const [snippets, setSnippets] = useState<Snippet[] | null | 'error'>(null);
  const [listOpen, setListOpen] = useState(false);
  const [cloudBusy, setCloudBusy] = useState<number | 'save' | null>(null);

  const worker = useRef<Worker | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outChars = useRef(0);
  const docRef = useRef(doc);
  const problemRef = useRef<PlaygroundProblem | null>(null);
  useEffect(() => {
    docRef.current = doc;
    problemRef.current = problem.status === 'ready' ? problem.problem : null;
  });

  // Đọc bản nháp sau khi hydrate (localStorage không có lúc SSR). Nếu URL có ?problem=<id> thì
  // lấy đề từ backend và nạp code mẫu; mỗi đề có bản nháp riêng để không đè bản nháp chung.
  useEffect(() => {
    let cancelled = false;
    const id = new URLSearchParams(window.location.search).get('problem');
    const t = setTimeout(() => {
      setDoc(loadDoc());
      setHydrated(true);
      if (id) {
        setProblem({ status: 'loading' });
        setPane('problem');
      }
    }, 0);
    if (id) {
      fetchProblem(id).then((p) => {
        if (cancelled) return;
        if (!p) {
          setProblem({ status: 'error' });
          setPane('code');
          return;
        }
        let draft: string | null = null;
        try {
          draft = localStorage.getItem(`${STORAGE_KEY}:problem:${p.id}`);
        } catch {
          /* private mode */
        }
        setProblem({ status: 'ready', problem: p });
        setDoc((d) => ({ ...d, lang: 'python', python: draft ?? p.starterCode }));
      });
    }
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  // Biết đã đăng nhập chưa để nút Lưu chọn gọi API hay dẫn tới trang đăng nhập.
  useEffect(() => {
    // Khách chưa có phiên thì khỏi gọi API (tránh 401 thừa trong console) — cùng cách đoán với lib/api.ts.
    let maybeLoggedIn = false;
    try {
      maybeLoggedIn = !!localStorage.getItem('pe_access') || document.cookie.includes('pe_has_session=1');
    } catch {
      /* private mode */
    }
    (maybeLoggedIn ? listSnippets() : Promise.reject(new AuthRequired('Chưa đăng nhập'))).then(
      (l) => {
        setLoggedIn(true);
        setSnippets(l);
      },
      (e) => {
        setLoggedIn(e instanceof AuthRequired ? false : null);
        if (!(e instanceof AuthRequired)) setSnippets('error');
      },
    );
  }, []);

  // Lưu cục bộ có debounce.
  useEffect(() => {
    if (!hydrated) return;
    // Đang tải đề thì chưa lưu (tránh ghi code Python mặc định vào bản nháp chung).
    if (problem.status === 'loading') return;
    const t = setTimeout(() => {
      if (problem.status === 'ready') {
        try {
          localStorage.setItem(`${STORAGE_KEY}:problem:${problem.problem.id}`, doc.python);
          setSaved(true);
        } catch {
          setSaved(false);
        }
      } else setSaved(saveDoc(doc));
    }, 500);
    return () => clearTimeout(t);
  }, [doc, hydrated, problem]);

  const push = useCallback((line: ConsoleLine) => {
    outChars.current += line.text.length;
    if (outChars.current > MAX_OUTPUT_CHARS) {
      if (outChars.current - line.text.length <= MAX_OUTPUT_CHARS)
        setLines((l) => [...l, { stream: 'system', text: 'Đầu ra quá dài, phần còn lại bị cắt.' }]);
      return;
    }
    setLines((l) => [...l, line]);
  }, []);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const killWorker = useCallback(() => {
    clearTimer();
    worker.current?.terminate();
    worker.current = null;
  }, []);

  const ensureWorker = useCallback((): Worker => {
    if (worker.current) return worker.current;
    const w = new Worker(WORKER_URL);
    w.onmessage = ({ data }) => {
      if (data.type === 'out') push({ stream: data.stream, text: data.text });
      else if (data.type === 'started') {
        setPyStatus('running');
        clearTimer();
        timer.current = setTimeout(() => {
          killWorker();
          setPyStatus('idle');
          push({
            stream: 'stderr',
            text: `Dừng vì chạy quá ${PY_TIMEOUT_MS / 1000} giây — có thể có vòng lặp vô hạn.`,
          });
        }, PY_TIMEOUT_MS);
      } else if (data.type === 'done') {
        clearTimer();
        setPyStatus('idle');
        if (data.error) push({ stream: 'stderr', text: data.error });
        if (data.duration) setMeta(`${data.duration} ms`);
      }
    };
    w.onerror = () => {
      killWorker();
      setPyStatus('idle');
      push({ stream: 'stderr', text: 'Không tải được trình chạy Python. Hãy thử lại.' });
    };
    worker.current = w;
    return w;
  }, [push, killWorker]);

  // Không nạp Pyodide (~6 MB) khi mở trang: người học có thể chỉ viết HTML hoặc chỉ đọc đề.
  // Worker được tạo và nạp ở lần Chạy đầu (trạng thái "Đang chuẩn bị Python…"); rê chuột/focus
  // vào nút Chạy thì nạp trước để cảm giác nhanh hơn mà không tốn băng thông cho người không chạy.
  const warmPython = useCallback(() => {
    if (docRef.current.lang === 'python') ensureWorker().postMessage({ type: 'warm' });
  }, [ensureWorker]);

  // Nhãn phím theo hệ điều hành + mẹo phím tắt (đọc sau hydrate để không lệch SSR).
  const [modKey, setModKey] = useState<'⌘' | 'Ctrl'>('Ctrl');
  const [tipHidden, setTipHidden] = useState(true);
  useEffect(() => {
    // setTimeout giống effect hydrate ở trên: tránh setState đồng bộ trong effect.
    const t = setTimeout(() => {
      setModKey(modKeyLabel());
      try {
        setTipHidden(localStorage.getItem(KEY_TIP_STORAGE) === '1');
      } catch {
        setTipHidden(false);
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const hideTip = useCallback(() => {
    setTipHidden(true);
    try {
      localStorage.setItem(KEY_TIP_STORAGE, '1');
    } catch {
      /* không lưu được thì mẹo hiện lại lần sau, không sao */
    }
  }, []);

  useEffect(() => killWorker, [killWorker]);

  const stop = useCallback(() => {
    if (docRef.current.lang === 'python') {
      killWorker();
      setPyStatus('idle');
      push({ stream: 'system', text: 'Đã dừng.' });
    } else {
      setFrameKey(0);
    }
  }, [killWorker, push]);

  const run = useCallback((withTests = false) => {
    const d = docRef.current;
    outChars.current = 0;
    hideTip();
    setLines([]);
    setMeta('');
    setPane('result');
    if (d.lang === 'python') {
      setPyStatus('loading');
      const prob = problemRef.current;
      const harness = withTests === true && prob ? buildSampleHarness(prob) : '';
      ensureWorker().postMessage({ type: 'run', code: d.python + harness });
    } else {
      // Dựng iframe mới mỗi lần chạy: trạng thái/timer của lần trước biến mất hẳn.
      setFrameKey((k) => k + 1);
    }
  }, [ensureWorker, hideTip]);

  const busy = pyStatus !== 'idle';
  const isPython = doc.lang === 'python';
  const editorKey = isPython ? 'python' : webFile;
  const editorValue = isPython ? doc.python : doc[webFile];

  const onEdit = (value: string) =>
    setDoc((d) => ({ ...d, [d.lang === 'python' ? 'python' : webFile]: value.slice(0, 50_000) }));

  const changeLang = (lang: PlaygroundLang) => {
    if (lang === docRef.current.lang) return;
    if (problem.status === 'ready') return; // đề Arena chỉ dùng Python
    if (lang === 'web') killWorker();
    setPyStatus('idle');
    setFrameKey(0);
    setLines([]);
    setMeta('');
    setPane('code');
    setDoc((d) => ({ ...d, lang }));
  };

  const loadSample = (id: string) => {
    const s = SAMPLES.find((x) => x.id === id);
    if (!s) return;
    setDoc((d) => ({ ...d, ...s.files }));
    setSnippetId(null);
  };

  const redirectToLogin = () =>
    window.location.assign('/login?next=' + encodeURIComponent(window.location.pathname + window.location.search));

  const refreshList = () => {
    setSnippets(null);
    listSnippets().then(setSnippets, () => setSnippets('error'));
  };

  const saveCloud = () => {
    if (loggedIn === false) return redirectToLogin();
    const prob = problemRef.current;
    const current = snippetId && Array.isArray(snippets) ? snippets.find((x) => x.id === snippetId) : undefined;
    const title = current?.title || (prob ? `Đề: ${prob.title}` : '');
    // Chưa có tên → hỏi bằng Dialog (thay window.prompt: không theo design system, bị chặn trong vài trình duyệt).
    if (!title) {
      setNameDraft('Code của tôi');
      setAsk({ kind: 'name' });
      return;
    }
    void doSave(title);
  };

  const doSave = async (title: string) => {
    setCloudBusy('save');
    try {
      const body = { ...docToSnippet(docRef.current), title };
      const sn = snippetId ? await updateSnippet(snippetId, body) : await createSnippet(body);
      setSnippetId(sn.id);
      setLoggedIn(true);
      toast({ variant: 'success', title: 'Đã lưu lên tài khoản' });
      refreshList();
    } catch (e) {
      if (e instanceof AuthRequired) redirectToLogin();
      else toast({ variant: 'danger', title: 'Không lưu được', description: e instanceof Error ? e.message : undefined });
    } finally {
      setCloudBusy(null);
    }
  };

  const openList = () => {
    if (loggedIn === false) return redirectToLogin();
    setListOpen(true);
    if (snippets === 'error') refreshList();
  };

  const openSnippet = (sn: Snippet) => {
    const next = snippetToDoc(sn, docRef.current);
    if (!next) {
      toast({ variant: 'danger', title: 'Không mở được', description: 'Loại code này Playground chưa hỗ trợ.' });
      return;
    }
    killWorker();
    setPyStatus('idle');
    setFrameKey(0);
    setLines([]);
    setDoc(next);
    setSnippetId(sn.id);
    setListOpen(false);
    setPane('code');
  };

  const removeSnippet = (sn: Snippet) => setAsk({ kind: 'delete', sn });

  const doRemove = async (sn: Snippet) => {
    setCloudBusy(sn.id);
    try {
      await deleteSnippet(sn.id);
      if (snippetId === sn.id) setSnippetId(null);
      refreshList();
    } catch (e) {
      toast({ variant: 'danger', title: 'Không xoá được', description: e instanceof Error ? e.message : undefined });
    } finally {
      setCloudBusy(null);
    }
  };

  const reset = () => setAsk({ kind: 'reset' });

  const doReset = () => setDoc((d) => ({ ...DEFAULT_DOC, lang: d.lang }));

  const closeAsk = () => setAsk(null);

  const confirmAsk = () => {
    const a = ask;
    setAsk(null);
    if (!a) return;
    if (a.kind === 'reset') doReset();
    else if (a.kind === 'delete') void doRemove(a.sn);
    else {
      const t = nameDraft.trim().slice(0, 120);
      if (t) void doSave(t);
    }
  };

  const hasProblem = problem.status === 'loading' || problem.status === 'ready';
  const samples = SAMPLES.filter((s) => s.lang === doc.lang);

  return (
    <div className="ui-scope flex h-dvh flex-col bg-bg font-sans text-fg">
      <SkipLink />
      {/* Chế độ tập trung: thanh trên gọn, không sidebar / bottom-nav. */}
      <header className="flex h-12 shrink-0 items-center gap-1 overflow-x-auto sm:gap-2 border-0 border-b border-solid border-border bg-surface px-2 sm:px-3">
        <Link
          href="/dashboard"
          aria-label="Quay lại"
          title="Quay lại"
          className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'px-2 max-sm:min-w-11' })}
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
        </Link>
        <h1 className="mr-1 text-base font-bold tracking-tight max-sm:hidden">Playground</h1>
        <Select
          aria-label="Ngôn ngữ"
          value={doc.lang}
          onChange={(e) => changeLang(e.target.value as PlaygroundLang)}
          // Đề Arena chỉ dùng Python → ẩn chọn ngôn ngữ trên mobile để nút "Chạy ví dụ" không tràn.
          className={cn('w-auto min-w-0 max-w-[4.5rem] text-sm sm:max-w-[10rem]', hasProblem && 'max-sm:hidden')}
        >
          {LANGS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </Select>
        {/* Mobile: chọn mẫu nằm ở hàng riêng bên dưới thanh trên (xem bên dưới). */}
        <div className="max-sm:hidden"><Select
          aria-label="Mẫu code"
          value=""
          onChange={(e) => loadSample(e.target.value)}
          className="w-auto min-w-0 max-w-[11rem] text-sm"
        >
          <option value="" disabled>
            Mẫu code…
          </option>
          {samples.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select></div>
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <span className="text-xs text-fg-muted max-md:hidden" role="status">
            {saved ? 'Đã lưu trên máy' : 'Không lưu được trên máy'}
          </span>
          <Button variant="ghost" size="sm" className="max-sm:min-w-11" onClick={openList} title="Code đã lưu trên tài khoản">
            <FolderOpen aria-hidden="true" className="size-4" />
            <span className="max-md:sr-only">Của tôi</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="max-sm:min-w-11"
            onClick={saveCloud}
            disabled={!hydrated || cloudBusy === 'save'}
            title={loggedIn === false ? 'Đăng nhập để lưu' : 'Lưu lên tài khoản'}
          >
            <Save aria-hidden="true" className="size-4" />
            <span className="max-sm:sr-only">Lưu</span>
          </Button>
          <Button variant="ghost" size="sm" className="max-sm:min-w-11" onClick={reset} aria-label="Đặt lại mã mẫu" title="Đặt lại mã mẫu">
            <RotateCcw aria-hidden="true" className="size-4" />
          </Button>
          {!isPython && frameKey > 0 && (
            // Mobile không đủ chỗ → ẩn (nút Chạy bị cắt); HTML/JS dừng bằng cách chạy lại.
            <Button variant="secondary" size="sm" onClick={stop} className="max-sm:hidden">
              <Square aria-hidden="true" className="size-4" />
              <span className="max-sm:sr-only">Dừng</span>
            </Button>
          )}
          {busy ? (
            <Button variant="danger" size="sm" onClick={stop}>
              <Square aria-hidden="true" className="size-4" />
              Dừng
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => run()}
              onPointerEnter={warmPython}
              onFocus={warmPython}
              disabled={!hydrated}
              title={`Chạy (${modKey}+Enter)`}
              aria-keyshortcuts={RUN_ARIA_SHORTCUTS}
            >
              <Play aria-hidden="true" className="size-4" />
              Chạy
            </Button>
          )}
          {problem.status === 'ready' && !busy && (
            <Button variant="secondary" size="sm" className="max-sm:min-w-11" onClick={() => run(true)} title="Chạy với các ví dụ mẫu của đề">
              <FlaskConical aria-hidden="true" className="size-4" />
              <span className="max-sm:sr-only">Chạy ví dụ</span>
            </Button>
          )}
        </div>
      </header>

      <div className="flex shrink-0 items-center border-0 border-b border-solid border-border bg-surface px-2 py-1 sm:hidden">
        <Select
          aria-label="Mẫu code"
          value=""
          onChange={(e) => loadSample(e.target.value)}
          className="w-full min-w-0 text-sm"
        >
          <option value="" disabled>
            Mẫu code…
          </option>
          {samples.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>

      {problem.status === 'error' && (
        <div role="status" className="shrink-0 border-0 border-b border-solid border-border bg-surface">
          <ErrorState
            compact
            title="Không tải được đề này"
            description="Sai mã đề hoặc bạn chưa đăng nhập. Playground vẫn dùng bình thường được."
            action={
              <Link href="/arena/problems" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                Về kho đề
              </Link>
            }
          />
        </div>
      )}

      <Dialog
        size="sm"
        open={ask !== null}
        onOpenChange={(o) => {
          if (!o) closeAsk();
        }}
        title={ask?.kind === 'name' ? 'Đặt tên cho đoạn code' : ask?.kind === 'delete' ? 'Xoá đoạn code?' : 'Đặt lại mã mẫu?'}
        description={
          ask?.kind === 'delete'
            ? `“${ask.sn.title}” sẽ bị xoá và không hoàn tác được.`
            : ask?.kind === 'reset'
              ? 'Code hiện tại sẽ mất và quay về mã mẫu ban đầu.'
              : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={closeAsk}>
              Huỷ
            </Button>
            <Button
              variant={ask?.kind === 'name' ? 'primary' : 'danger'}
              onClick={confirmAsk}
              disabled={ask?.kind === 'name' && !nameDraft.trim()}
            >
              {ask?.kind === 'name' ? 'Lưu' : ask?.kind === 'delete' ? 'Xoá' : 'Đặt lại'}
            </Button>
          </>
        }
      >
        {ask?.kind === 'name' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              confirmAsk();
            }}
          >
            <Field label="Tên" required>
              <Input value={nameDraft} maxLength={120} autoFocus onChange={(e) => setNameDraft(e.target.value)} />
            </Field>
          </form>
        )}
      </Dialog>

      {/* Mobile: Code | Kết quả chuyển tab. Từ lg: hai khung song song. */}
      <Tabs value={pane} onValueChange={(v) => setPane(v as 'code' | 'result' | 'problem')} className="shrink-0 lg:hidden">
        <TabList label="Khung hiển thị" className="mx-0 px-2">
          {hasProblem && <Tab value="problem">Đề bài</Tab>}
          <Tab value="code">Code</Tab>
          <Tab value="result">Kết quả{busy ? ' …' : ''}</Tab>
        </TabList>
      </Tabs>

      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className={cn(
          'grid min-h-0 flex-1 grid-cols-1 outline-none',
          hasProblem ? 'lg:grid-cols-[minmax(16rem,22rem)_1fr_1fr]' : 'lg:grid-cols-2',
        )}
      >
        {hasProblem && (
          <section
            aria-label="Đề bài"
            className={cn(
              'min-h-0 overflow-auto border-0 border-solid border-border bg-surface lg:border-r',
              pane !== 'problem' && 'max-lg:hidden',
            )}
          >
            <ProblemPanel state={problem} />
          </section>
        )}
        <section
          aria-label="Trình soạn code"
          className={cn('flex min-h-0 flex-col border-0 border-solid border-border bg-surface lg:border-r', pane !== 'code' && 'max-lg:hidden')}
        >
          {!isPython && (
            <div role="group" aria-label="Tệp" className="flex shrink-0 gap-1 border-0 border-b border-solid border-border px-2 py-1">
              {WEB_FILES.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={webFile === f.id}
                  onClick={() => setWebFile(f.id)}
                  className={cn(
                    'ui-focus-ring min-h-11 rounded-sm border-0 px-3 font-mono text-sm font-semibold sm:min-h-8',
                    webFile === f.id ? 'bg-primary-soft text-primary-soft-fg' : 'bg-transparent text-fg-muted hover:bg-surface-2',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
          <div className="min-h-0 flex-1">
            {hydrated ? (
              <CodeEditor
                value={editorValue}
                language={isPython ? 'python' : webFile}
                docKey={editorKey}
                onChange={onEdit}
                onRun={() => run()}
                label={isPython ? 'Code Python' : `Code ${webFile.toUpperCase()}`}
              />
            ) : (
              <Skeleton className="h-full w-full rounded-none" />
            )}
          </div>
          {hydrated && !tipHidden && (
            <p className="m-0 shrink-0 border-0 border-t border-solid border-border bg-surface px-3 py-1.5 text-xs text-fg-muted max-sm:hidden">
              Mẹo: nhấn <kbd className="font-mono font-semibold">{modKey}+Enter</kbd> để chạy code.
            </p>
          )}
        </section>

        <section
          aria-label="Kết quả"
          className={cn('flex min-h-0 flex-col bg-bg', pane !== 'result' && 'max-lg:hidden')}
        >
          <OutputPane
            mode={doc.lang}
            lines={lines}
            pyStatus={pyStatus}
            meta={meta}
            frameKey={frameKey}
            files={{ html: doc.html, css: doc.css, js: doc.js }}
            onFrameLine={push}
            modKey={modKey}
          />
        </section>
      </main>

      <SnippetsDialog
        open={listOpen}
        onOpenChange={setListOpen}
        items={snippets}
        currentId={snippetId}
        busyId={typeof cloudBusy === 'number' ? cloudBusy : null}
        onOpenItem={openSnippet}
        onDelete={removeSnippet}
        onRetry={refreshList}
      />
    </div>
  );
}
