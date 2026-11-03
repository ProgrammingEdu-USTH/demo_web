'use client';

// Ôn tập độc lập: chọn khoá đã đăng ký → đề random → nộp → xem đáp án.
//
// ── HỢP ĐỒNG DỮ LIỆU (giữ nguyên từ bản cũ, đã khớp review_quiz.js) ─────────
//  1. POST /api/courses/:id/quiz/generate -> { ok, quiz_id, questions }
//     questions[i] = { index (từ 0, KHÔNG phải question_no), question, options: string[] }
//     Response không có `total` — dùng questions.length.
//  2. POST /api/quizzes/:id/submit <- { answers }: mảng THEO VỊ TRÍ, answers[i] là chuỗi đã chọn
//     (backend chấm bằng answers?.[i]); câu bỏ trống gửi null. Gửi mảng object thì điểm luôn 0.
//  3. Chấm: { ok, score, total, detail[i] = { question, given, correct, is_correct, explanation } }
//     — không có percentage/your_answer: tự tính phần trăm.
// Dùng bản RANDOM (`generate`), không dùng `generate-review` (bản có trọng số của dashboard).
import { BookOpen, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import {
  Alert, Badge, Button, buttonVariants, Card, CardTitle, Container, Dialog, EmptyState, ErrorState, Field,
  LoadingRegion, PageHeader, ProgressBar, Select, Skeleton,
} from '@/components/ui';
import { apiFetch, asList } from '@/lib/api';

type Question = { index: number; question: string; options: string[]; details: (string | null)[] };
type RawOption = string | { text?: string; detail?: string | null; correct?: boolean };
type RawQuestion = { index?: number; question?: string; options?: RawOption[] };
type Detail = { question: string; given: string | null; correct: string | number; is_correct: boolean; explanation: string | null };
type Result = { score: number; total: number; detail: Detail[] };
type EnrolledCourse = { id: string; title: string };
type Phase = 'idle' | 'loading' | 'quiz' | 'grading' | 'result';

/** Lỗi backend có dạng { error: { status, message, detail }, request_id }. */
function errMessage(body: unknown, fallback: string): string {
  const e = (body as { error?: unknown } | null)?.error;
  if (e && typeof e === 'object') return (e as { message?: string }).message || fallback;
  return typeof e === 'string' && e ? e : fallback;
}

// Đề có thể chứa HTML (<code>, <strong>, &amp;): bóc thẻ thành chữ thuần, không dùng innerHTML với dữ liệu thô.
const plain = (v: unknown): string =>
  String(v ?? '').replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

// correct có thể là chỉ số hoặc nguyên văn → đổi về nội dung đáp án dễ đọc.
function correctLabel(options: string[] | undefined, v: unknown): string {
  const opts = options ?? [];
  const s = v && typeof v === 'object' ? String((v as { text?: string }).text ?? '') : String(v);
  if (opts.includes(s)) return plain(s);
  const n = Number(v);
  if (s.trim() !== '' && Number.isInteger(n) && opts[n] !== undefined) return plain(opts[n]);
  return plain(s);
}

export default function PracticeView() {
  // null = đang tải; 'error' = tải danh sách khoá thất bại
  const [courses, setCourses] = useState<EnrolledCourse[] | null | 'error'>(null);
  const [courseId, setCourseId] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [quizId, setQuizId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  // answers[i] = giá trị đã chọn của câu thứ i (null = chưa trả lời).
  const [answers, setAnswers] = useState<(string | null)[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    apiFetch('/api/enrolled')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((enrolled) => {
        if (!alive) return;
        // Backend trả dạng BỌC { ok, enrolled: [...] }, không phải mảng trần.
        const list = asList<{ id?: string | number; courseId?: string | number; title?: string }>(enrolled, 'enrolled').map((c) => ({
          id: String(c.id ?? c.courseId),
          title: c.title || String(c.id ?? c.courseId),
        }));
        setCourses(list);
        // ?course= chọn sẵn khoá (nút "Ôn tập" ở trang khoá học); không khớp khoá đã đăng ký thì lấy khoá đầu.
        const wanted = new URLSearchParams(window.location.search).get('course');
        const pick = list.find((c) => c.id === wanted) ?? list[0];
        if (pick) setCourseId(pick.id);
      })
      .catch(() => { if (alive) setCourses('error'); });
    return () => { alive = false; };
  }, [reload]);

  const start = useCallback(async () => {
    if (!courseId) return;
    setPhase('loading');
    setError('');
    setResult(null);
    try {
      const res = await apiFetch(`/api/courses/${encodeURIComponent(courseId)}/quiz/generate`, { method: 'POST' });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(errMessage(body, 'Không tạo được đề luyện tập.'));
        setPhase('idle');
        return;
      }
      // Khoá Python trả option là object {text, detail, correct}; khoá khác trả chuỗi → chuẩn hoá về chuỗi.
      const rawQs: RawQuestion[] = Array.isArray(body?.questions) ? body.questions : [];
      const qs: Question[] = rawQs.map((q, i) => ({
        index: q.index ?? i,
        question: String(q.question ?? ''),
        options: (q.options ?? []).map((o) => (typeof o === 'string' ? o : String(o?.text ?? ''))),
        details: (q.options ?? []).map((o) => (typeof o === 'string' ? null : o?.detail ?? null)),
      }));
      if (!qs.length) {
        setError('Đề trả về không có câu hỏi nào.');
        setPhase('idle');
        return;
      }
      setQuizId(body.quiz_id);
      setQuestions(qs);
      setAnswers(qs.map(() => null));
      setPhase('quiz');
    } catch {
      setError('Lỗi mạng, thử lại sau.');
      setPhase('idle');
    }
  }, [courseId]);

  const answered = answers.filter((a) => a != null).length;
  const unanswered = answers.length - answered;

  const submit = useCallback(async () => {
    if (quizId == null) return;
    setConfirmOpen(false);
    setPhase('grading');
    setError('');
    try {
      const res = await apiFetch(`/api/quizzes/${quizId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(errMessage(body, 'Nộp bài thất bại.'));
        setPhase('quiz');
        return;
      }
      setResult({ score: body.score ?? 0, total: body.total ?? questions.length, detail: body.detail || [] });
      setPhase('result');
      window.scrollTo({ top: 0 });
    } catch {
      setError('Lỗi mạng, bài chưa được nộp.');
      setPhase('quiz');
    }
  }, [quizId, answers, questions.length]);

  const pct = result && result.total ? Math.round((result.score / result.total) * 100) : 0;
  const busy = phase === 'loading' || phase === 'quiz' || phase === 'grading';

  return (
    <Container size="prose" className="pb-12">
      <PageHeader title="Ôn tập" description="Chọn một khoá đã đăng ký và ôn lại bằng đề ngẫu nhiên từ các bài bạn đã học." />

      <div className="flex flex-col gap-6 py-2">
        {courses === null ? (
          <LoadingRegion label="Đang tải danh sách khoá học…"><Skeleton className="h-24" /></LoadingRegion>
        ) : courses === 'error' ? (
          <ErrorState
            title="Không tải được danh sách khoá học"
            description="Kiểm tra kết nối rồi thử lại."
            action={<Button onClick={() => { setCourses(null); setReload((n) => n + 1); }}>Thử lại</Button>}
          />
        ) : courses.length === 0 ? (
          <EmptyState
            icon={<BookOpen aria-hidden="true" />}
            title="Bạn chưa đăng ký khoá học nào"
            description="Đăng ký một khoá để có đề luyện tập."
            action={<Link href="/courses" className={buttonVariants({ variant: 'primary' })}>Khám phá khoá học</Link>}
          />
        ) : (
          <Card className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <Field label="Khoá học" className="sm:flex-1">
              <Select value={courseId} onChange={(e) => setCourseId(e.target.value)} disabled={busy}>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </Select>
            </Field>
            <Button variant={phase === 'quiz' || phase === 'result' ? 'secondary' : 'primary'} onClick={start} loading={phase === 'loading'} disabled={!courseId || phase === 'grading'}>
              {phase === 'loading' ? 'Đang tạo đề…' : phase === 'quiz' || phase === 'result' ? 'Làm đề khác' : 'Bắt đầu'}
            </Button>
          </Card>
        )}

        {error ? (
          <Alert variant="danger" action={phase === 'idle' && courseId ? <Button size="sm" variant="secondary" onClick={start}>Thử lại</Button> : undefined}>{error}</Alert>
        ) : null}

        {(phase === 'quiz' || phase === 'grading') && (
          <section aria-label="Đề ôn tập" className="flex flex-col gap-4">
            <div className="sticky top-0 z-10 -mx-4 border-b border-border bg-bg/95 px-4 py-3 sm:mx-0 sm:rounded-md sm:border">
              <ProgressBar value={answered} max={questions.length} label="Số câu đã trả lời" showValue size="sm" />
            </div>
            {questions.map((q, i) => {
              // `index` từ backend là chuẩn; thiếu thì lấy vị trí trong mảng.
              const no = q.index != null ? q.index : i;
              return (
                <fieldset key={no} className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-surface p-4">
                  <legend className="px-1 text-base font-semibold">{no + 1}. {plain(q.question)}</legend>
                  {(q.options || []).map((opt, oi) => (
                    <label
                      key={oi}
                      className="ui-focus-ring flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-border px-3 py-2.5 text-base transition-colors duration-fast hover:bg-surface-2 has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:text-primary-soft-fg"
                    >
                      <input
                        type="radio"
                        name={`q${no}`}
                        value={opt}
                        className="mt-1 size-4 accent-primary"
                        checked={answers[i] === opt}
                        disabled={phase === 'grading'}
                        onChange={() => setAnswers((prev) => prev.map((a, k) => (k === i ? opt : a)))}
                      />
                      <span className="min-w-0 whitespace-pre-wrap break-words">{plain(opt)}</span>
                    </label>
                  ))}
                </fieldset>
              );
            })}
            <Button
              variant="primary"
              size="lg"
              block
              loading={phase === 'grading'}
              onClick={() => (unanswered ? setConfirmOpen(true) : submit())}
            >
              {phase === 'grading' ? 'Đang chấm…' : 'Nộp bài'}
            </Button>
          </section>
        )}

        {phase === 'result' && result && (
          <section aria-label="Kết quả" className="flex flex-col gap-4">
            <Card className="flex flex-col items-center gap-2 text-center" role="status">
              <p className="text-sm text-fg-muted">Điểm của bạn</p>
              <p className="text-4xl font-bold">{result.score}/{result.total}</p>
              <Badge variant={pct >= 50 ? 'success' : 'warning'}>{pct}%</Badge>
            </Card>
            {result.detail.map((r, i) => (
              <Card key={i} padding="sm" className={r.is_correct ? 'border-success/50' : 'border-danger/50'}>
                <CardTitle as="h3" className="flex items-start gap-2 text-base">
                  {r.is_correct
                    ? <CheckCircle2 aria-label="Đúng" className="mt-0.5 size-5 shrink-0 text-success" />
                    : <XCircle aria-label="Sai" className="mt-0.5 size-5 shrink-0 text-danger" />}
                  <span className="min-w-0 break-words">{i + 1}. {plain(r.question)}</span>
                </CardTitle>
                <p className="mt-2 break-words text-sm">
                  Bạn chọn: <b>{r.given != null ? plain(String(r.given)) : '(bỏ trống)'}</b>
                  {' — '}Đáp án đúng: <b>{correctLabel(questions[i]?.options, r.correct)}</b>
                </p>
                {(() => {
                  // Giải thích từ backend; thiếu thì dùng detail của đáp án đúng (khoá Python).
                  const q = questions[i];
                  const label = correctLabel(q?.options, r.correct);
                  const di = q ? q.options.findIndex((o) => plain(o) === label) : -1;
                  const text = r.explanation || (di >= 0 ? q.details[di] : null);
                  return text ? <p className="mt-1 break-words text-sm text-fg-muted">{plain(text)}</p> : null;
                })()}
              </Card>
            ))}
          </section>
        )}
      </div>

      <Dialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Nộp bài khi còn câu trống?"
        description={`Còn ${unanswered} câu chưa trả lời, các câu này sẽ tính là sai.`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Làm tiếp</Button>
            <Button variant="primary" onClick={submit}>Nộp luôn</Button>
          </>
        }
      >
        {null}
      </Dialog>
    </Container>
  );
}
