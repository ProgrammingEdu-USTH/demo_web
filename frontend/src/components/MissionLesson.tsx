'use client';

// Bài học dạng "nhiệm vụ kéo-thả" (Java, HTML/CSS) — một bố cục chung bằng token + components/ui,
// thay hai trang legacy (markup 1:1 + lesson_*.inline.js). Khác biệt giữa hai khoá chỉ nằm ở `MissionConfig`.
// Vì sao có thêm "chạm để chọn rồi chạm ô": HTML5 drag-and-drop KHÔNG chạy trên màn hình cảm ứng,
// bản cũ vì vậy không dùng được trên điện thoại. Kéo-thả chuột vẫn giữ nguyên.
import { useCallback, useState } from 'react';

import LessonShell from '@/components/lesson/LessonShell';
import { Button, Dialog, cn } from '@/components/ui';
import { apiFetch } from '@/lib/api';

export type MissionBlock = { id: string; kind: 'cond' | 'act'; label: string; value: string };

export type MissionConfig = {
  /** Mã nhiệm vụ gửi lên POST /api/mission/complete (trùng mã khoá). */
  missionId: string;
  title: string;
  intro: string;
  /** Tên "cửa sổ" của cột code (vd. "Java 21 JVM"). */
  windowLabel: string;
  /** Các dòng code phía trên chỗ trống; `{cond}`/`{act}` là vị trí ô trống. */
  codeLines: { text: string; indent?: boolean; slot?: 'cond' | 'act' }[];
  elseLine: string;
  blocks: MissionBlock[];
  firstHint: string;
  wrongHint: string;
  okOutput: string;
  doneMessage: string;
};

type Result = { ok: boolean; msg: string } | null;
type Slots = { cond: MissionBlock | null; act: MissionBlock | null };

const EMPTY = '________';

export default function MissionLesson({ cfg }: { cfg: MissionConfig }) {
  const [slots, setSlots] = useState<Slots>({ cond: null, act: null });
  const [picked, setPicked] = useState<string | null>(null);
  const [result, setResult] = useState<Result>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [wrong, setWrong] = useState(false);

  const place = useCallback((slot: 'cond' | 'act', block: MissionBlock | undefined) => {
    // Khối "điều kiện" chỉ vào ô điều kiện, "hành động" chỉ vào ô hành động.
    if (!block || block.kind !== slot) return;
    setSlots((s) => ({ ...s, [slot]: block }));
    setPicked(null);
    setResult(null);
  }, []);

  const byId = (id: string | null) => cfg.blocks.find((b) => b.id === id);

  const submit = async () => {
    if (!slots.cond || !slots.act) {
      setResult({ ok: false, msg: 'Bạn chưa lấp đầy các ô trống.' });
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch('/api/mission/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mission_id: cfg.missionId, condition: slots.cond.value, action: slots.act.value }),
      });
      const data = await res.json().catch(() => ({}));
      // Backend trả { ok, xp_earned, gems_earned, streak, ... } (stats.service completeMission).
      if (data.ok || data.success) {
        setResult({ ok: true, msg: cfg.okOutput });
        setWrong(false);
        setDone(true);
      } else {
        // Lỗi 400/404 của gateway có dạng data.error = { status, message, detail }: render object sẽ làm sập trang,
        // nên chỉ nhận chuỗi, còn lại dùng câu mặc định.
        const pick = [data.message, data.error?.message, data.error].find((v) => typeof v === 'string' && v);
        setResult({ ok: false, msg: (pick as string | undefined) || 'Chưa đúng, thử lại nhé!' });
        setWrong(true);
      }
    } catch {
      setResult({ ok: false, msg: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.' });
    } finally {
      setBusy(false);
    }
  };

  const slotBtn = (slot: 'cond' | 'act', placeholder: string) => {
    const block = slots[slot];
    return (
      <button
        type="button"
        onClick={() => place(slot, byId(picked))}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => place(slot, byId(e.dataTransfer.getData('text/plain')))}
        aria-label={block ? `Ô ${slot === 'cond' ? 'điều kiện' : 'hành động'}: ${block.label}` : placeholder}
        className={cn(
          'ui-focus-ring inline-flex min-h-11 min-w-36 items-center justify-center rounded-md border-2 px-3 text-sm font-semibold transition-colors',
          block ? 'border-solid border-primary bg-primary-soft text-primary-soft-fg' : 'border-dashed border-border-strong text-fg-muted',
          picked && byId(picked)?.kind === slot && 'border-primary bg-primary-soft/50',
        )}
      >
        {block ? block.label : placeholder}
      </button>
    );
  };

  const codeSlot = (slot: 'cond' | 'act') => (
    <span
      className={cn('rounded-sm border border-solid px-2 py-0.5', slots[slot] ? 'border-primary/40 bg-primary-soft text-primary-soft-fg' : 'border-border text-fg-muted')}
    >
      {slots[slot]?.value ?? EMPTY}
    </span>
  );

  // Vỏ chung (thanh trên, ⋯, chatbot) do LessonShell lo; bài lẻ nên "Sau" = về khoá học.
  return (
    <LessonShell courseId={cfg.missionId} title={cfg.title} layout="wide" next={{ href: `/courses/${cfg.missionId}`, label: 'Về khoá học' }}>
      {/* pb-24 trên mobile: thanh "Về khoá học" cố định đáy không che cuối ô code */}
      <div className="grid gap-4 pb-24 lg:grid-cols-2 lg:gap-6 lg:pb-0">
        <section aria-label="Bài tập" className="mx-auto w-full max-w-xl space-y-4">
          <p className="text-fg-muted">{cfg.intro}</p>

          <div className="space-y-3 rounded-lg border border-solid border-border bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-fg-muted">NẾU</span>
              {slotBtn('cond', 'Chọn điều kiện')}
              <span className="font-bold text-fg-muted">:</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 pl-6">
              <span className="font-bold text-primary">THÌ</span>
              {slotBtn('act', 'Chọn hành động')}
            </div>
            <div className="font-bold text-fg-muted">NGƯỢC LẠI:</div>
            <div className="flex items-center gap-2 pl-6">
              <span className="font-bold text-fg-muted">THÌ</span>
              <code className="rounded-md bg-surface-2 px-3 py-2 text-sm text-fg-muted">{cfg.elseLine}</code>
            </div>
          </div>

          <div role="group" aria-label="Túi đồ" className="rounded-lg border border-dashed border-border-strong p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-muted">Túi đồ — kéo thả, hoặc chạm khối rồi chạm ô</p>
            <div className="flex flex-wrap gap-2">
              {cfg.blocks.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  draggable
                  aria-pressed={picked === b.id}
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', b.id)}
                  onClick={() => setPicked(picked === b.id ? null : b.id)}
                  className={cn(
                    'ui-focus-ring min-h-11 cursor-grab rounded-md border border-solid px-3 text-sm font-semibold',
                    b.kind === 'cond' ? 'border-warning/40 bg-warning-soft text-warning-soft-fg' : 'border-info/40 bg-info-soft text-info-soft-fg',
                    picked === b.id && 'ring-2 ring-primary',
                  )}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section aria-label={cfg.windowLabel} className="mx-auto flex w-full max-w-xl flex-col overflow-hidden rounded-lg border border-solid border-border bg-surface-2">
          <div className="border-b border-solid border-border px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wide text-fg-muted">
            {cfg.windowLabel}
          </div>
          <div className="flex-1 space-y-2 p-4 font-mono text-sm leading-relaxed">
            {cfg.codeLines.map((l, i) => (
              <div key={i} className={cn('flex flex-wrap items-center gap-2', l.indent && 'pl-6')}>
                {l.slot ? (
                  <>
                    {l.text.split('{slot}')[0]}
                    {codeSlot(l.slot)}
                    {l.text.split('{slot}')[1]}
                  </>
                ) : (
                  l.text
                )}
              </div>
            ))}
            <div role="status" aria-live="polite" className="mt-4 border-t border-solid border-border pt-3 text-sm">
              {result ? (
                <span className={result.ok ? 'font-semibold text-success' : 'text-danger'}>{result.ok ? '✓ ' : '✗ '}{result.msg}</span>
              ) : (
                <span className="italic text-fg-muted">Đang đợi lệnh từ bạn…</span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-solid border-border bg-surface p-3">
            <p className={cn('text-xs', wrong ? 'text-danger' : 'text-fg-muted')}>{wrong ? cfg.wrongHint : cfg.firstHint}</p>
            <Button variant="primary" onClick={submit} loading={busy}>Kiểm tra</Button>
          </div>
        </section>
      </div>

      <Dialog
        open={done}
        onOpenChange={setDone}
        title="Quá đỉnh! 🎉"
        description={cfg.doneMessage}
        footer={<Button variant="primary" onClick={() => setDone(false)}>Tiếp tục</Button>}
      />
    </LessonShell>
  );
}
