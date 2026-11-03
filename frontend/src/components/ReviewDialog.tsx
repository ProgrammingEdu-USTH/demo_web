'use client';

// Hộp thoại ôn tập ở /dashboard — thay edu-review-quiz.js (cùng API, cùng luật chấm).
//
// ── HỢP ĐỒNG DỮ LIỆU (đọc từ bản JS cũ + quizzes.service.ts) ───────────────
//  1. POST /api/quiz/generate-review (đề hằng ngày, mỗi ngày một lần) hoặc
//     POST /api/quiz/generate-today (gộp bài học trong ngày, làm lại thoải mái)
//     -> { ok, quiz_id, questions[i] = { index, question, options } }.
//     400 kèm câu tiếng Việt có nghĩa ("hôm nay đã ôn rồi" / "chưa đủ câu hỏi") → hiện nguyên văn.
//  2. POST /api/quizzes/:id/submit <- { answers }: mảng THEO VỊ TRÍ. Backend so
//     String(correct) với giá trị gửi, mà `correct` lưu là CHỈ SỐ trong options
//     (hoặc `id` nếu option là object) → gửi chỉ số/id, KHÔNG gửi nhãn.
//  3. Chấm: { ok, score, total, detail[i] = { question, given, correct, is_correct, explanation } }.
//     `given`/`correct` ở dạng đã lưu → đổi lại thành nhãn trước khi hiện.
import { Brain } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Alert, Button, buttonVariants, cn, Dialog, EmptyState, ProgressBar, Spinner } from '@/components/ui';
import { sendJson } from '@/lib/fetch-json';

export type ReviewMode = 'review' | 'today';

type Option = string | { id?: string | number; text?: string; label?: string; value?: string };
type Question = { index?: number; question: string; options?: Option[] };
type Detail = { question: string; given: string | number | null; correct: string | number; is_correct: boolean; explanation?: string | null };
type Result = { score?: number; total?: number; detail?: Detail[] };
type State =
  | { phase: 'loading'; text: string }
  | { phase: 'message'; text: string; retry: boolean }
  | { phase: 'quiz'; quizId: number; questions: Question[]; picked: (number | null)[]; at: number }
  | { phase: 'grading' }
  | { phase: 'result'; questions: Question[]; result: Result };

// Option có thể là chuỗi (dạng chuẩn) hoặc object {id,text} (dữ liệu khoá CSDL).
const optLabel = (o: Option | undefined): string =>
  o && typeof o === 'object' ? String(o.text ?? o.label ?? o.value ?? '') : String(o ?? '');
const answerValue = (o: Option | undefined, idx: number): string | number =>
  o && typeof o === 'object' && o.id != null ? o.id : idx;

/** Đổi giá trị đáp án (nguyên văn → id → chỉ số) thành nhãn đọc được; chuỗi số "1","2" không bị nhầm thành vị trí. */
function labelOf(options: Option[] | undefined, v: string | number | null): string {
  if (v == null) return '';
  const opts = options ?? [];
  const byText = opts.find((o) => optLabel(o) === String(v));
  if (byText !== undefined) return optLabel(byText);
  const byId = opts.find((o) => o && typeof o === 'object' && o.id != null && String(o.id) === String(v));
  if (byId !== undefined) return optLabel(byId);
  const n = Number(v);
  if (!Number.isNaN(n) && String(n) === String(v).trim() && opts[n] != null) return optLabel(opts[n]);
  return String(v);
}

const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

export default function ReviewDialog({ mode, onClose, onSubmitted }: {
  mode: ReviewMode;
  onClose: () => void;
  /** Điểm mới có thể đổi tiến độ kỹ năng → cha tải lại thẻ "Ôn tập hôm nay". */
  onSubmitted: () => void;
}) {
  const today = mode === 'today';
  const [s, setS] = useState<State>({ phase: 'loading', text: today ? 'Đang gộp các bài bạn học hôm nay thành đề…' : 'Đang soạn bài ôn từ những gì bạn đã học…' });
  const [confirmExit, setConfirmExit] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const titleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    sendJson<{ quiz_id: number; questions?: Question[] }>(today ? '/api/quiz/generate-today' : '/api/quiz/generate-review', 'POST').then(
      (d) => {
        if (!alive) return;
        const qs = d.questions ?? [];
        if (!qs.length) setS({ phase: 'message', text: 'Đề trả về không có câu hỏi nào.', retry: false });
        else setS({ phase: 'quiz', quizId: d.quiz_id, questions: qs, picked: qs.map(() => null), at: 0 });
      },
      (e) => { if (alive) setS({ phase: 'message', text: errText(e, 'Chưa tạo được bài ôn. Thử lại sau nhé.'), retry: true }); },
    );
    return () => { alive = false; };
  }, [today, attempt]);

  const dirty = s.phase === 'quiz' && s.picked.some((a) => a != null);
  // Đang làm dở mà bấm ra ngoài thì hỏi lại — mỗi đề chỉ nộp được một lần (nộp lại backend trả 409).
  const requestClose = useCallback(() => (dirty ? setConfirmExit(true) : onClose()), [dirty, onClose]);

  const submit = async (forced = false) => {
    if (s.phase !== 'quiz') return;
    const blank = s.picked.filter((a) => a == null).length;
    if (blank && !forced) { setConfirmExit(false); setS({ ...s, at: s.questions.length - 1 }); setPendingSubmit(true); return; }
    setPendingSubmit(false);
    // Mảng THEO VỊ TRÍ; câu bỏ trống gửi null (backend coi là sai).
    const answers = s.picked.map((idx, i) => (idx == null ? null : answerValue(s.questions[i].options?.[idx], idx)));
    const prev = s;
    setS({ phase: 'grading' });
    try {
      const result = await sendJson<Result>(`/api/quizzes/${s.quizId}/submit`, 'POST', { answers });
      setS({ phase: 'result', questions: s.questions, result });
      onSubmitted();
    } catch (e) {
      // Nộp lỗi thì quay lại đề đang làm dở, không mất các câu đã chọn.
      setS(prev);
      setSubmitError(errText(e, 'Nộp bài thất bại. Thử lại nhé.'));
    }
  };
  // "Còn N câu chưa trả lời. Nộp luôn?" thay cho confirm() của trình duyệt.
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const title = today ? 'Ôn lại bài hôm nay' : 'Ôn tập hôm nay';
  let description: string | undefined;
  let body: React.ReactNode;
  let footer: React.ReactNode;

  if (s.phase === 'loading' || s.phase === 'grading') {
    const text = s.phase === 'loading' ? s.text : 'Đang chấm bài…';
    body = (
      <div role="status" className="flex flex-col items-center gap-3 py-10 text-fg-muted">
        <Spinner className="size-6" />
        <p className="text-sm">{text}</p>
      </div>
    );
  } else if (s.phase === 'message') {
    body = <EmptyState compact title="Chưa có bài ôn" description={s.text} />;
    footer = (
      <>
        <Button variant="ghost" onClick={onClose}>Đóng</Button>
        {s.retry ? (
          <Button variant="secondary" onClick={() => { setS({ phase: 'loading', text: 'Đang soạn bài ôn…' }); setAttempt((n) => n + 1); }}>Thử lại</Button>
        ) : null}
        <Link href="/courses" className={buttonVariants({ variant: 'primary' })}>Tới khoá học</Link>
      </>
    );
  } else if (s.phase === 'quiz') {
    const q = s.questions[s.at];
    const total = s.questions.length;
    const chosen = s.picked[s.at];
    const last = s.at === total - 1;
    description = `Câu ${s.at + 1}/${total} · ${today ? 'bài học hôm nay' : 'đề hôm nay'}`;
    const blank = s.picked.filter((a) => a == null).length;
    body = (
      <div className="flex flex-col gap-4">
        <ProgressBar value={s.at} max={total} label="Tiến độ làm đề" size="sm" />
        <p className="text-base font-semibold text-fg">{q.question}</p>
        <div role="group" aria-label="Các đáp án" className="flex flex-col gap-2">
          {(q.options ?? []).map((opt, i) => (
            <button
              key={i}
              type="button"
              aria-pressed={chosen === i}
              onClick={() => setS({ ...s, picked: s.picked.map((p, k) => (k === s.at ? i : p)) })}
              className={cn(
                'flex min-h-11 w-full items-center gap-3 rounded-md border border-solid px-3 py-2 text-left text-sm transition-colors',
                chosen === i ? 'border-primary bg-primary-soft text-primary-soft-fg' : 'border-border bg-surface text-fg hover:bg-surface-2',
              )}
            >
              <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full border border-solid border-border-strong text-xs font-semibold">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="min-w-0">{optLabel(opt)}</span>
            </button>
          ))}
        </div>
        {submitError ? <Alert variant="danger">{submitError}</Alert> : null}
        {pendingSubmit ? (
          <Alert variant="warning">Còn {blank} câu chưa trả lời. Bấm “Nộp luôn” để chấm với câu bỏ trống tính là sai.</Alert>
        ) : null}
        {confirmExit ? (
          <Alert variant="warning">
            <span className="flex flex-col gap-2">
              Thoát bây giờ sẽ bỏ dở bài ôn này.
              <span className="flex flex-wrap gap-2">
                <Button size="sm" variant="danger" onClick={onClose}>Thoát</Button>
                <Button size="sm" variant="secondary" onClick={() => setConfirmExit(false)}>Làm tiếp</Button>
              </span>
            </span>
          </Alert>
        ) : null}
      </div>
    );
    footer = (
      <>
        {s.at > 0 ? <Button variant="ghost" onClick={() => setS({ ...s, at: s.at - 1 })}>Quay lại</Button> : null}
        {pendingSubmit ? (
          <Button variant="primary" onClick={() => submit(true)}>Nộp luôn</Button>
        ) : last ? (
          <Button variant="primary" disabled={chosen == null && blank === 0} onClick={() => { setSubmitError(''); void submit(); }}>Nộp bài</Button>
        ) : (
          <Button variant="primary" disabled={chosen == null} onClick={() => { setSubmitError(''); setS({ ...s, at: s.at + 1 }); }}>Tiếp tục</Button>
        )}
      </>
    );
  } else {
    const detail = s.result.detail ?? [];
    const total = s.result.total || detail.length || 0;
    const score = s.result.score ?? 0;
    const pct = total ? Math.round((score / total) * 100) : 0;
    const line = pct >= 80 ? 'Quá tốt! Kiến thức vẫn còn chắc.' : pct >= 50 ? 'Khá ổn — xem lại mấy câu sai là chắc bài.' : 'Cần ôn lại phần này thêm một lượt nhé.';
    description = today ? 'Bài học hôm nay' : 'Đề ôn hôm nay';
    body = (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-4xl font-bold text-fg">{score}<span className="text-xl text-fg-muted">/{total}</span></p>
          <p className="text-sm font-semibold text-fg">{pct}% đúng</p>
          <p className="text-sm text-fg-muted">{line}</p>
        </div>
        <ol className="flex flex-col gap-3">
          {detail.map((r, i) => {
            const opts = s.questions[i]?.options;
            return (
              <li key={i} className={cn('rounded-md border border-solid p-3 text-sm', r.is_correct ? 'border-success/40 bg-success-soft text-success-soft-fg' : 'border-danger/40 bg-danger-soft text-danger-soft-fg')}>
                <p className="font-semibold">{i + 1}. {r.question} <span className="sr-only">{r.is_correct ? '(đúng)' : '(sai)'}</span></p>
                <p>Bạn chọn: <b>{r.given != null ? labelOf(opts, r.given) : '(bỏ trống)'}</b></p>
                {r.is_correct ? null : <p>Đáp án đúng: <b>{labelOf(opts, r.correct)}</b></p>}
                {r.explanation ? <p className="mt-1">{r.explanation}</p> : null}
              </li>
            );
          })}
        </ol>
      </div>
    );
    // Không có "Ôn tiếp": mỗi ngày chỉ một đề, bấm lại chỉ nhận thông báo "đã ôn rồi" từ backend.
    footer = (
      <>
        <Link href="/profile?tab=skills" className={buttonVariants({ variant: 'ghost' })}>Xem kỹ năng</Link>
        <Button variant="primary" onClick={onClose}>Xong</Button>
      </>
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => { if (!o) requestClose(); }}
      title={<span ref={titleRef} className="inline-flex items-center gap-2"><Brain aria-hidden="true" className="size-5 text-primary" />{title}</span>}
      description={description}
      footer={footer}
      size="lg"
      dismissible={!dirty}
    >
      {body}
    </Dialog>
  );
}
