'use client';

// Admin panel: upload a .md/.pdf lesson, review what the parser recognised, edit
// the JSON if needed, then save it into lessons.content_json. The parse step
// never writes to the database — saving goes through the existing
// POST /api/admin/lessons route.
import { Upload } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Card, CardDescription, CardHeader, CardTitle, EmptyState, Field, Input, Textarea } from '@/components/ui';
import { apiFetch } from '@/lib/api';

type Parsed = Record<string, unknown>;

const STEP_TITLES: Record<string, string> = {
  step_1: 'S1 · Hiểu & Dự đoán',
  step_2: 'S2 · Bẫy ngộ nhận',
  step_3: 'S3 · Luyện có hỗ trợ',
  step_4: 'S4 · Sandbox',
};

/** One line per block the parser filled in, so gaps are obvious at a glance. */
function summarise(key: string, step: unknown): string[] {
  if (!step || typeof step !== 'object') return [];
  const s = step as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const out: string[] = [];
  if (key === 'step_1') {
    if (s.context?.body) out.push('Ngữ cảnh');
    if (s.code?.source) out.push('Code minh hoạ');
    if (s.predict?.options) out.push(`Dự đoán: ${s.predict.options.length} lựa chọn`);
    if (s.memory) out.push('Sơ đồ bộ nhớ');
    if (s.explain?.length) out.push(`Giải thích: ${s.explain.length} ý`);
    if (s.misconception) out.push('Ngộ nhận');
  }
  if (key === 'step_2') {
    if (s.mcq?.length) out.push(`Trắc nghiệm: ${s.mcq.length} câu`);
    if (s.classify?.tokens?.length)
      out.push(
        `Phân loại: ${s.classify.tokens.length} thẻ / ${s.classify.bins.length} nhóm`,
      );
    if (s.selfExplain) out.push(`Tự giải thích: ${s.selfExplain.rubric?.length ?? 0} rubric`);
  }
  if (key === 'step_3') {
    if (s.task?.body) out.push('Nhiệm vụ');
    if (s.scaffold?.slots?.length)
      out.push(`Lắp ghép: ${s.scaffold.slots.length} slot / ${s.scaffold.bank.length} thẻ`);
    if (s.trace?.steps?.length) out.push(`Nhật ký: ${s.trace.steps.length} bước`);
    if (s.counter) out.push('Tái dự đoán');
  }
  if (key === 'step_4') {
    if (s.task?.body) out.push('Đề bài');
    if (s.starterCode) out.push('Code khởi tạo');
    if (s.solutionCode) out.push('Lời giải mẫu');
    if (s.hints?.length) out.push(`Gợi ý: ${s.hints.length} tầng`);
    if (s.tests?.length) out.push(`Test: ${s.tests.length} trường hợp`);
    if (s.forbid?.length) out.push(`Cấm: ${s.forbid.join(', ')}`);
  }
  return out;
}

// onSaved: để trang cha làm mới danh sách khoá/bài sau khi lưu.
export default function LessonImport({ onSaved }: { onSaved?: () => void } = {}) {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [draft, setDraft] = useState('');
  const [parser, setParser] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [courseId, setCourseId] = useState('python');
  const [sortOrder, setSortOrder] = useState('');
  const [moduleName, setModuleName] = useState('');
  const [xpReward, setXpReward] = useState('50');

  function applyParsed(lesson: Parsed, usedParser: string) {
    setParsed(lesson);
    setDraft(JSON.stringify(lesson, null, 2));
    setParser(usedParser);
  }

  async function runImport() {
    if (!file) {
      setStatus('Hãy chọn một file .md hoặc .pdf trước.');
      return;
    }
    setBusy(true);
    setStatus('Đang đọc và nhận diện nội dung…');
    setErrors([]);
    try {
      const form = new FormData();
      form.append('file', file);
      // Không tự đặt Content-Type: trình duyệt phải tự sinh boundary cho multipart.
      const res = await apiFetch('/api/admin/lessons/import', {
        method: 'POST',
        body: form,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        // 400 kèm bản nháp: vẫn cho admin sửa tay thay vì vứt kết quả đi.
        const detail = body.message ?? body;
        if (detail?.lesson) {
          applyParsed(detail.lesson, detail.parser ?? '');
          setErrors(detail.errors ?? []);
          setStatus('Nhận diện được nhưng chưa hợp lệ — sửa các lỗi bên dưới rồi lưu.');
          return;
        }
        throw new Error(
          typeof detail === 'string'
            ? detail
            : detail?.message || 'Không nhập được file.',
        );
      }
      applyParsed(body.lesson, body.parser);
      setStatus(
        body.parser === 'template'
          ? 'Đã nhận diện theo mẫu template. Kiểm tra lại rồi lưu.'
          : 'Mẫu template không khớp nên đã dùng Gemini. HÃY KIỂM TRA KỸ trước khi lưu.',
      );
      if (!sortOrder) setStatus((prev) => `${prev} Nhớ điền số thứ tự bài.`);
    } catch (error) {
      setStatus((error as Error).message);
      setParsed(null);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!draft.trim()) {
      setStatus('Chưa có nội dung để lưu.');
      return;
    }
    const order = Number(sortOrder);
    if (!Number.isInteger(order) || order < 1) {
      setStatus('Số thứ tự bài phải là số nguyên từ 1 trở lên.');
      return;
    }
    let content: Parsed;
    try {
      content = JSON.parse(draft);
    } catch (error) {
      setStatus(`JSON không hợp lệ: ${(error as Error).message}`);
      return;
    }
    setBusy(true);
    setStatus('Đang lưu…');
    try {
      const res = await apiFetch('/api/admin/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: courseId,
          sort_order: order,
          title: String(content.title ?? '') || undefined,
          module: moduleName || undefined,
          xp_reward: Number(xpReward) || 0,
          // parseLessonContent() ở backend nhận chuỗi JSON và lưu nguyên cấu trúc.
          content: JSON.stringify(content),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          Array.isArray(body.message)
            ? body.message.join(', ')
            : body.message || body.error || 'Không lưu được bài học.',
        );
      }
      setStatus(
        `Đã lưu bài ${order} vào khoá "${courseId}". Mở /lesson/python?lesson=${order - 1} để xem.`,
      );
      setErrors([]);
      onSaved?.();
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <CardHeader>
        <CardTitle>Nhập bài học từ PDF / Markdown</CardTitle>
        <CardDescription>
          Tải file lên, hệ thống nhận diện thành 4 bước S1–S4 rồi bạn duyệt trước khi lưu. Xem đúng mẫu
          heading trong LESSON-IMPORT-FORMAT.md.
        </CardDescription>
      </CardHeader>

      <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border-strong bg-surface-2 p-4">
        {/* Chưa chọn file: nói rõ cần gì (trạng thái rỗng) thay vì chỉ để ô chọn file trống */}
        {!file ? <EmptyState compact icon={<Upload aria-hidden="true" />} title="Chọn file bài học" description="Hỗ trợ .md, .markdown, .txt hoặc .pdf." /> : null}
        <input
          type="file"
          accept=".md,.markdown,.txt,.pdf"
          aria-label="Chọn file .md hoặc .pdf"
          className="max-w-full text-sm text-fg"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setStatus('');
          }}
        />
        <Button variant="primary" loading={busy} onClick={() => void runImport()}>
          {busy ? 'Đang xử lý…' : 'Đọc file & nhận diện'}
        </Button>
      </div>

      {status && (
        <p role="status" className="text-sm text-fg-muted">
          {status}
        </p>
      )}

      {errors.length > 0 && (
        <ul role="alert" className="m-0 flex list-none flex-col gap-1 rounded-md bg-danger-soft p-3 text-sm text-danger-soft-fg">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      {parsed && (
        <>
          <p className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
            Nhận diện bằng: <Badge variant={parser === 'gemini' ? 'warning' : 'info'}>{parser || '—'}</Badge>
            {parser === 'gemini' && 'Kết quả từ AI có thể sai hoặc thiếu — đọc kỹ từng bước.'}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {Object.keys(STEP_TITLES).map((key) => {
              const rows = summarise(key, parsed[key]);
              return (
                <div
                  key={key}
                  className={`rounded-lg border border-solid border-border p-3 ${rows.length ? 'bg-surface' : 'bg-surface-2 opacity-70'}`}
                >
                  <h4 className="m-0 mb-1 text-sm font-semibold text-fg">{STEP_TITLES[key]}</h4>
                  {rows.length ? (
                    <ul className="m-0 list-disc pl-5 text-sm text-fg-muted">
                      {rows.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  ) : (
                    <small className="text-fg-muted">Không có dữ liệu — bước này sẽ bị ẩn.</small>
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mã khoá học">
              <Input value={courseId} onChange={(e) => setCourseId(e.target.value)} />
            </Field>
            <Field label="Số thứ tự bài" hint="sort_order, bắt đầu từ 1">
              <Input type="number" min={1} value={sortOrder} placeholder="vd: 10" onChange={(e) => setSortOrder(e.target.value)} />
            </Field>
            <Field label="Module">
              <Input value={moduleName} placeholder="vd: Module 2: Cú pháp cơ bản" onChange={(e) => setModuleName(e.target.value)} />
            </Field>
            <Field label="XP thưởng">
              <Input type="number" value={xpReward} onChange={(e) => setXpReward(e.target.value)} />
            </Field>
          </div>

          <Field label="Nội dung JSON" hint="Sửa được — ví dụ thêm sơ đồ bộ nhớ cho S1.">
            <Textarea
              rows={16}
              className="font-mono text-xs"
              value={draft}
              spellCheck={false}
              onChange={(e) => setDraft(e.target.value)}
            />
          </Field>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              onClick={() => {
                setParsed(null);
                setDraft('');
                setErrors([]);
                setStatus('');
              }}
            >
              Huỷ
            </Button>
            <Button variant="primary" loading={busy} onClick={() => void save()}>
              Lưu vào khoá học
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
