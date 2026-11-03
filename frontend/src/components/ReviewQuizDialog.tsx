'use client';

// Hộp thoại ôn tập bằng ui/Dialog — thay edu-review-quiz.js (JS legacy gắn vào DOM của LegacyHub).
// Giữ đúng hợp đồng API cũ:
//   POST /api/quiz/generate-review | /api/quiz/generate-today  → { quiz_id, questions[{index,question,options}] }
//   POST /api/quizzes/:id/submit  { answers }  — answers là MẢNG THEO VỊ TRÍ, null = bỏ trống
//   → { score, total, detail[{question,given,correct,is_correct,explanation}] }
// Backend chặn bằng 400 + câu tiếng Việt (đã ôn hôm nay / chưa đủ câu) → hiện nguyên văn.
import { CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Alert, Badge, Button, Dialog, EmptyState, ProgressBar, Skeleton, buttonVariants, cn } from '@/components/ui';
import { ApiError, sendJson } from '@/lib/fetch-json';

// course = quiz ôn tập của MỘT khoá (trang chi tiết khoá, cần `courseId`); review/today = đề hằng ngày ở dashboard.
export type QuizMode = 'review' | 'today' | 'course';

type Opt = string | { id?: string | number; text?: string; label?: string; value?: string };
type Question = { index?: number; question: string; options?: Opt[] };
type Detail = { question: string; given?: unknown; correct?: unknown; is_correct?: boolean; explanation?: string };
type Result = { score?: number; total?: number; detail?: Detail[] };

type QuizState = { phase: 'quiz' | 'grading'; quizId: string | number; questions: Question[]; picked: (number | null)[]; at: number };
type State =
  | { phase: 'loading' }
  | { phase: 'message'; text: string; retry?: boolean }
  | QuizState
  | { phase: 'result'; questions: Question[]; result: Result };

// Nội dung bài do quản trị nhập: options có thể là chuỗi hoặc {id,text}.
const optLabel = (o: Opt | undefined): string =>
  o && typeof o === 'object' ? String(o.text ?? o.label ?? o.value ?? '') : String(o ?? '');
// Đề có thể chứa HTML (<strong>, <code>): bóc thẻ thành chữ thuần khi hiển thị (an toàn, không cần innerHTML).
const plain = (s: string): string =>
  s.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
// Giá trị gửi chấm: option object có id thì dùng id, còn lại gửi CHỈ SỐ (xem quizzes.service.spec.ts).
const answerValue = (o: Opt | undefined, idx: number) => (o && typeof o === 'object' && o.id != null ? o.id : idx);

// given/correct trả về đúng dạng đã lưu (chỉ số/id/nguyên văn) → đổi lại nhãn đọc được.
function labelOf(options: Opt[] | undefined, v: unknown): string {
  const opts = options ?? [];
  const s = String(v);
  const byText = opts.find((o) => optLabel(o) === s);
  if (byText !== undefined) return optLabel(byText);
  const byId = opts.find((o) => o && typeof o === 'object' && o.id != null && String(o.id) === s);
  if (byId !== undefined) return optLabel(byId);
  const n = Number(v);
  if (!Number.isNaN(n) && String(n) === s.trim() && opts[n] !== undefined) return optLabel(opts[n]);
  return s;
}

export default function ReviewQuizDialog({
  open,
  onOpenChange,
  mode = 'review',
  courseId,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: QuizMode;
  courseId?: string;
  /** Gọi sau khi nộp thành công (làm mới thẻ ôn tập ở nền). */
  onSubmitted?: () => void;
}) {
  const [state, setState] = useState<State>({ phase: 'loading' });

  useEffect(() => {
    if (!open) return;
    // Mỗi lần mở là một đề mới; `alive` chống kết quả của lần mở cũ ghi đè lần mới.
    let alive = true;
    const path = mode === 'course' ? `/api/courses/${courseId}/quiz/generate` : mode === 'today' ? '/api/quiz/generate-today' : '/api/quiz/generate-review';
    sendJson<{ quiz_id: string | number; questions?: Question[] }>(path, 'POST').then(
      (d) => {
        if (!alive) return;
        const qs = d.questions ?? [];
        if (!qs.length) setState({ phase: 'message', text: 'Đề trả về không có câu hỏi nào.' });
        else setState({ phase: 'quiz', quizId: d.quiz_id, questions: qs, picked: qs.map(() => null), at: 0 });
      },
      (e: unknown) => {
        if (!alive) return;
        const net = e instanceof ApiError && e.status === 0;
        setState({
          phase: 'message',
          text: e instanceof ApiError ? e.message : 'Chưa tạo được bài ôn. Thử lại sau nhé.',
          retry: net,
        });
      },
    );
    return () => { alive = false; };
  }, [open, mode, courseId]);

  // Khi đóng/mở lại: về trạng thái tải trước khi đề mới về (tránh nháy đề cũ).
  const handleOpenChange = (v: boolean) => {
    if (v) setState({ phase: 'loading' });
    onOpenChange(v);
  };

  const retry = () => { setState({ phase: 'loading' }); onOpenChange(false); setTimeout(() => onOpenChange(true), 0); };

  async function submit(s: QuizState) {
    setState({ ...s, phase: 'grading' });
    const answers = s.picked.map((idx, i) => (idx == null ? null : answerValue(s.questions[i].options?.[idx], idx)));
    try {
      const result = await sendJson<Result>(`/api/quizzes/${s.quizId}/submit`, 'POST', { answers });
      setState({ phase: 'result', questions: s.questions, result });
      onSubmitted?.();
    } catch (e) {
      setState({ phase: 'message', text: e instanceof ApiError ? e.message : 'Nộp bài thất bại.' });
    }
  }

  const title = mode === 'course' ? 'Quiz ôn tập khoá học' : mode === 'today' ? 'Ôn lại bài hôm nay' : 'Ôn tập hôm nay';
  let body: React.ReactNode;
  let footer: React.ReactNode;

  if (state.phase === 'loading') {
    body = (
      <div role="status" aria-label="Đang soạn bài ôn" className="flex flex-col gap-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    );
  } else if (state.phase === 'message') {
    body = <EmptyState compact title={state.text} />;
    footer = (
      <>
        {state.retry ? <Button variant="secondary" onClick={retry}>Thử lại</Button> : null}
        <Link href="/courses" onClick={() => onOpenChange(false)} className={buttonVariants({ variant: 'secondary' })}>Tới khoá học</Link>
        <Button variant="primary" onClick={() => onOpenChange(false)}>Đóng</Button>
      </>
    );
  } else if (state.phase === 'result') {
    const { score = 0, detail = [] } = state.result;
    const total = state.result.total || detail.length || 0;
    const pct = total ? Math.round((score / total) * 100) : 0;
    body = (
      <div className="flex flex-col gap-3">
        <div role="status" className="flex flex-col items-center gap-1 rounded-lg bg-surface-2 p-4 text-center">
          <p className="text-4xl font-bold">{score}/{total}</p>
          <Badge variant={pct >= 50 ? 'success' : 'warning'}>{pct}% đúng</Badge>
          <p className="text-sm text-fg-muted">
            {pct >= 80 ? 'Quá tốt! Kiến thức vẫn còn chắc.' : pct >= 50 ? 'Khá ổn — xem lại mấy câu sai là chắc bài.' : 'Cần ôn lại phần này thêm một lượt nhé.'}
          </p>
        </div>
        {detail.map((r, i) => {
          const opts = state.questions[i]?.options;
          return (
            <div key={i} className={cn('rounded-md border p-3', r.is_correct ? 'border-success/50' : 'border-danger/50')}>
              <p className="flex items-start gap-2 text-base font-semibold">
                {r.is_correct
                  ? <CheckCircle2 aria-label="Đúng" className="mt-0.5 size-5 shrink-0 text-success" />
                  : <XCircle aria-label="Sai" className="mt-0.5 size-5 shrink-0 text-danger" />}
                <span>{i + 1}. {plain(r.question)}</span>
              </p>
              <p className="mt-2 text-sm">Bạn chọn: <b>{r.given != null ? plain(labelOf(opts, r.given)) : '(bỏ trống)'}</b></p>
              {r.is_correct ? null : <p className="text-sm">Đáp án đúng: <b>{plain(labelOf(opts, r.correct))}</b></p>}
              {r.explanation ? <p className="mt-1 text-sm text-fg-muted">{r.explanation}</p> : null}
            </div>
          );
        })}
      </div>
    );
    footer = (
      <>
        <Link href="/profile?tab=skills" onClick={() => onOpenChange(false)} className={buttonVariants({ variant: 'secondary' })}>Xem kỹ năng</Link>
        <Button variant="primary" onClick={() => onOpenChange(false)}>Xong</Button>
      </>
    );
  } else {
    const { questions, picked, at } = state;
    const q = questions[at];
    const last = at === questions.length - 1;
    const busy = state.phase === 'grading';
    const empty = picked.filter((p) => p == null).length;
    const set = (patch: Partial<QuizState>) => setState({ ...state, ...patch });
    body = (
      <div className="flex flex-col gap-4">
        <ProgressBar value={at} max={questions.length} label={`Câu ${at + 1}/${questions.length}`} showValue size="sm" />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-base font-semibold">{plain(q.question)}</legend>
          {(q.options ?? []).map((opt, oi) => (
            <label
              key={oi}
              className="ui-focus-ring flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-border px-3 py-2.5 text-base transition-colors duration-fast hover:bg-surface-2 has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:text-primary-soft-fg"
            >
              <input
                type="radio"
                name={`rq-${at}`}
                className="mt-1 size-4 accent-primary"
                checked={picked[at] === oi}
                disabled={busy}
                onChange={() => set({ picked: picked.map((p, k) => (k === at ? oi : p)) })}
              />
              <span>{plain(optLabel(opt))}</span>
            </label>
          ))}
        </fieldset>
        {last && empty > 0 ? <Alert variant="warning">Còn {empty} câu chưa trả lời — các câu này tính là sai.</Alert> : null}
      </div>
    );
    footer = (
      <>
        {at > 0 ? <Button variant="ghost" disabled={busy} onClick={() => set({ at: at - 1 })}>Quay lại</Button> : null}
        {last ? (
          <Button variant="primary" loading={busy} disabled={picked[at] == null} onClick={() => submit(state)}>
            {busy ? 'Đang chấm…' : 'Nộp bài'}
          </Button>
        ) : (
          <Button variant="primary" disabled={picked[at] == null} onClick={() => set({ at: at + 1 })}>Tiếp tục</Button>
        )}
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} title={title} size="lg" dismissible={state.phase !== 'quiz' && state.phase !== 'grading'} footer={footer}>
      {body}
    </Dialog>
  );
}
