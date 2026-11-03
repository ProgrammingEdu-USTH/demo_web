'use client';

// Tab "Lộ trình của tôi" của /courses — viết lại bằng React + ui/*, thay LegacyHub + roadmap.js + roadmap.css.
// Chức năng giữ nguyên: 26 lộ trình nghề nghiệp (mạch tuyến tính), ghim/bỏ ghim tab (localStorage v4),
// tiến độ chặng (chặng gắn khoá học tự suy từ /api/enrolled; chặng khác tự đánh dấu, lưu localStorage
// và đẩy "done" lên /api/roadmap), tab "Lộ trình của tôi" sinh từ khảo sát (/api/me/roadmap),
// tab "Tùy chỉnh" (canvas kéo-thả, RoadmapCanvas), khám phá lộ trình, ngăn chi tiết chặng.
import { Check, Compass, Pencil, Plus, Target } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import RoadmapCanvas from '@/components/roadmap/RoadmapCanvas';
import { BrowseSheet, STATUS_BADGE, StageSheet } from '@/components/roadmap/RoadmapSheets';
import { Badge, Button, Card, EmptyState, ErrorState, ProgressBar, Skeleton, cn } from '@/components/ui';
import { fetchJson, sendJson, useRemote, type Remote } from '@/lib/fetch-json';
import {
  CUSTOM_TAB, LS_SEEN_GENERATED, MY_TAB, STATUS_LABEL, listMeta, loadActive, loadOverrides, loadPinned,
  saveActive, saveOverrides, savePinned, stagesOf, stagesOfMine,
  type EnrolledCourse, type MyRoadmap, type Overrides, type Stage, type Status,
} from '@/lib/roadmap-state';

const tabCls = (on: boolean) =>
  cn(
    'ui-focus-ring inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-solid px-4 text-sm font-semibold transition-colors duration-fast sm:min-h-9 sm:px-3',
    on ? 'border-transparent bg-primary text-primary-fg' : 'border-border bg-surface text-fg hover:border-border-strong hover:bg-surface-2',
  );

export default function RoadmapView() {
  // Component chỉ chạy ở trình duyệt (HubRoute nạp bằng dynamic ssr:false) nên đọc localStorage ngay khi khởi tạo được.
  const [pinned, setPinned] = useState<string[]>(loadPinned);
  const [active, setActive] = useState(() => loadActive(loadPinned()));
  const [overrides, setOverrides] = useState<Overrides>(loadOverrides);
  const [serverDone, setServerDone] = useState<Record<string, string[]>>({});
  const [openStage, setOpenStage] = useState<string | null>(null);
  const [browse, setBrowse] = useState(false);
  const [myRes, setMyRes] = useState<Remote<MyRoadmap>>({ state: 'loading' });
  const requested = useRef(new Set<string>());
  const pushChain = useRef<Record<string, Promise<unknown>>>({});

  const [enrolledRes] = useRemote(async () => {
    const d = await fetchJson<{ enrolled?: EnrolledCourse[] } | EnrolledCourse[]>('/api/enrolled');
    return Array.isArray(d) ? d : (d.enrolled ?? []);
  });
  const enrolled = useMemo(() => (enrolledRes.state === 'ok' ? enrolledRes.data : []), [enrolledRes]);
  const my = myRes.state === 'ok' && myRes.data.mermaid_def ? myRes.data : null;

  const select = useCallback((id: string) => {
    setActive(id);
    saveActive(id);
  }, []);

  // Có lộ trình sinh từ khảo sát → ghim tab "Lộ trình của tôi"; chỉ tự nhảy vào đó ĐÚNG MỘT LẦN.
  // Làm trong callback của fetch (không phải thân effect) để không setState đồng bộ trong effect.
  useEffect(() => {
    let alive = true;
    fetchJson<MyRoadmap>('/api/me/roadmap').then(
      (data) => {
        if (!alive) return;
        setMyRes({ state: 'ok', data });
        if (!data.mermaid_def) return;
        setPinned((cur) => {
          if (cur.includes(MY_TAB)) return cur;
          const next = [MY_TAB, ...cur];
          savePinned(next);
          return next;
        });
        try {
          if (localStorage.getItem(LS_SEEN_GENERATED) !== '1') {
            localStorage.setItem(LS_SEEN_GENERATED, '1');
            select(MY_TAB);
          }
        } catch {
          /* noop */
        }
      },
      () => alive && setMyRes({ state: 'error' }),
    );
    return () => { alive = false; };
  }, [select]);

  // Nạp các chặng đã "done" lưu trên server cho lộ trình đang xem (mỗi slug một lần).
  useEffect(() => {
    if (!active || active === CUSTOM_TAB || requested.current.has(active)) return;
    requested.current.add(active);
    const slug = active;
    fetchJson<{ doneItems?: string[] }>(`/api/roadmap?roadmap_id=${encodeURIComponent(slug)}`).then(
      (d) => setServerDone((s) => ({ ...s, [slug]: d.doneItems ?? [] })),
      () => setServerDone((s) => ({ ...s, [slug]: [] })),
    );
  }, [active]);

  const stages: Stage[] = useMemo(() => {
    if (active === MY_TAB) return my ? stagesOfMine(my) : [];
    if (!active || active === CUSTOM_TAB) return [];
    return stagesOf(active);
  }, [active, my]);

  // Ưu tiên: tiến độ khoá học thật > đánh dấu tay (local) > "done" từ server.
  const statusOf = useCallback(
    (rmId: string, s: Stage): Status => {
      if (s.course) {
        const c = enrolled.find((e) => e.id === s.course);
        if (c) return (c.progress ?? 0) >= 100 ? 'done' : 'active';
      }
      const ov = overrides[`${rmId}:${s.id}`];
      if (ov) return ov;
      if (serverDone[rmId]?.includes(s.id)) return 'done';
      return 'locked';
    },
    [enrolled, overrides, serverDone],
  );

  const setStatus = (stage: Stage, status: Status) => {
    const next = { ...overrides, [`${active}:${stage.id}`]: status };
    setOverrides(next);
    saveOverrides(next);
    // Server chỉ lưu boolean done. Tuần tự hoá PUT theo từng chặng để bấm nhanh liên tiếp
    // không về server sai thứ tự (lần cuối phải thắng).
    const slug = active, key = `${slug}:${stage.id}`, done = status === 'done';
    const send = () => sendJson(`/api/roadmap/${encodeURIComponent(stage.id)}`, 'PUT', { done, roadmap_id: slug }).catch(() => undefined);
    pushChain.current[key] = (pushChain.current[key] ?? Promise.resolve()).then(send, send);
    setServerDone((s) => {
      const arr = (s[slug] ?? []).filter((x) => x !== stage.id);
      return { ...s, [slug]: done ? [...arr, stage.id] : arr };
    });
  };

  const togglePin = (id: string) => {
    const was = pinned.includes(id);
    const next = was ? pinned.filter((x) => x !== id) : [...pinned, id];
    setPinned(next);
    savePinned(next);
    // Vừa bỏ ghim đúng tab đang xem → chuyển về tab đầu còn lại.
    if (was && active === id) select(next[0] ?? CUSTOM_TAB);
  };

  const openRoadmap = (id: string) => {
    if (!pinned.includes(id)) {
      const next = [...pinned, id];
      setPinned(next);
      savePinned(next);
    }
    select(id);
    setBrowse(false);
  };

  const counts = useMemo(() => {
    const c = { done: 0, active: 0, locked: 0 };
    stages.forEach((s) => (c[statusOf(active, s)] += 1));
    return c;
  }, [stages, statusOf, active]);

  const meta = listMeta(active);
  const isMine = active === MY_TAB;
  const title = isMine ? (my?.title || 'Lộ trình của tôi') : (meta?.name ?? active);
  const stageIdx = stages.findIndex((s) => s.id === openStage);
  const sheetStage = stageIdx >= 0 ? stages[stageIdx] : null;
  const courseStages = stages.filter((s) => s.course).length;
  const pct = stages.length ? Math.round((counts.done / stages.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-4 px-4 py-4 sm:px-6">
      <p className="m-0 max-w-3xl text-sm text-fg-muted">
        <Compass aria-hidden="true" className="mr-1 inline size-4 align-text-bottom" />
        Mỗi lộ trình là một mạch thẳng, học lần lượt từ trên xuống. Chặng có nhãn <b>Khóa học</b> gắn với khóa học trên nền tảng — tiến độ tự cập nhật khi bạn học.
        Muốn lộ trình riêng? Làm <Link href="/questionaire" className="inline-block py-3 font-semibold text-primary underline underline-offset-2">bộ khảo sát</Link> hoặc tự dựng ở tab <b>Tùy chỉnh</b>.
      </p>

      {/* Thanh tab: "Tùy chỉnh" luôn đứng đầu, rồi các lộ trình đã ghim; cuộn ngang khi chật. */}
      <div role="group" aria-label="Chọn lộ trình" className="ui-no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <button type="button" aria-pressed={active === CUSTOM_TAB} onClick={() => select(CUSTOM_TAB)} className={tabCls(active === CUSTOM_TAB)}>
          <Pencil aria-hidden="true" className="size-4" /> Tùy chỉnh
        </button>
        {pinned.map((id) => {
          const m = listMeta(id);
          if (id !== MY_TAB && !m) return null;
          return (
            <button key={id} type="button" aria-pressed={active === id} onClick={() => select(id)} className={tabCls(active === id)}>
              {id === MY_TAB ? <Target aria-hidden="true" className="size-4" /> : <span aria-hidden="true">{m?.emoji}</span>}
              {id === MY_TAB ? 'Lộ trình của tôi' : m?.name}
            </button>
          );
        })}
        <button type="button" onClick={() => setBrowse(true)} aria-label="Thêm lộ trình" className={cn(tabCls(false), 'px-3')}>
          <Plus aria-hidden="true" className="size-4" />
        </button>
      </div>

      {active === CUSTOM_TAB ? (
        myRes.state === 'loading' ? (
          <Skeleton className="h-80 w-full" />
        ) : (
          <RoadmapCanvas mermaid={myRes.state === 'ok' ? (myRes.data.mermaid_def ?? null) : null} />
        )
      ) : isMine && myRes.state === 'error' ? (
        <Card><ErrorState title="Không tải được lộ trình của bạn" description="Kiểm tra kết nối rồi tải lại trang." /></Card>
      ) : isMine && myRes.state === 'loading' ? (
        <Skeleton className="h-64 w-full" />
      ) : stages.length === 0 ? (
        <Card>
          {isMine ? (
            <EmptyState
              title="Bạn chưa có chặng nào"
              description="Dùng tab Tùy chỉnh để tự dựng lộ trình của riêng bạn, hoặc làm bộ khảo sát để nhận gợi ý."
              action={<Link href="/questionaire" className="inline-block py-3 font-semibold text-primary underline">Làm bộ khảo sát</Link>}
            />
          ) : (
            <EmptyState title="Chưa có dữ liệu cho lộ trình này" description="Hãy chọn một lộ trình khác." action={<Button onClick={() => setBrowse(true)}>Khám phá lộ trình</Button>} />
          )}
        </Card>
      ) : (
        <>
          <Card className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-2xl">{isMine ? (my?.icon ?? '🎯') : (meta?.emoji ?? '🧭')}</span>
              <div className="min-w-0 flex-1">
                {isMine && <Badge variant="accent" className="mb-1">Dựa trên khảo sát của bạn</Badge>}
                <h2 className="m-0 text-xl font-semibold text-fg">{title}</h2>
                <p className="m-0 mt-1 text-sm text-fg-muted">
                  {isMine ? 'Chuỗi chặng học được gợi ý riêng cho mục tiêu bạn đã khai trong bộ khảo sát.' : meta?.desc}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{stages.length} chặng</Badge>
              {courseStages > 0 && <Badge variant="info">{courseStages} chặng có khóa học</Badge>}
            </div>
            <ProgressBar value={pct} label={`Tiến độ lộ trình ${title}`} showValue tone={pct >= 100 ? 'success' : 'primary'} />
            <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-sm text-fg-muted" role="status">
              <span><b className="text-fg">{counts.done}</b> Đã học</span>
              <span><b className="text-fg">{counts.active}</b> Đang học</span>
              <span><b className="text-fg">{counts.locked}</b> Chưa học</span>
            </p>
          </Card>

          <ol className="m-0 flex list-none flex-col gap-4 p-0" aria-label={`Các chặng của ${title}`}>
            {stages.map((s, i) => {
              const st = statusOf(active, s);
              const last = i === stages.length - 1;
              return (
                <li
                  key={s.id}
                  className={cn(
                    'relative pl-12',
                    !last && 'before:absolute before:bottom-[-1rem] before:left-[1.1rem] before:top-9 before:w-0.5 before:bg-border',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute left-0 top-3 flex size-9 items-center justify-center rounded-full border-2 border-solid text-sm font-bold',
                      st === 'done' && 'border-success bg-success-soft text-success-soft-fg',
                      st === 'active' && 'border-primary bg-primary-soft text-primary-soft-fg',
                      st === 'locked' && 'border-border bg-surface text-fg-muted',
                    )}
                  >
                    {st === 'done' ? <Check className="size-4" /> : i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpenStage(s.id)}
                    className="ui-focus-ring flex w-full flex-col gap-2 rounded-lg border border-solid border-border bg-surface p-4 text-left text-fg shadow-xs transition-colors duration-fast hover:border-border-strong"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold">{s.title}</span>
                      {s.course && <Badge variant="info">Khóa học</Badge>}
                      <Badge variant={STATUS_BADGE[st]} className="ml-auto">{STATUS_LABEL[st]}</Badge>
                    </span>
                    {s.desc && <span className="line-clamp-2 text-sm text-fg-muted">{s.desc}</span>}
                    {s.topics.length > 0 && (
                      <span className="flex flex-wrap gap-1">
                        {s.topics.slice(0, 4).map((t) => <Badge key={t}>{t}</Badge>)}
                        {s.topics.length > 4 && <Badge variant="outline">+{s.topics.length - 4}</Badge>}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </>
      )}

      <StageSheet
        open={sheetStage !== null}
        onOpenChange={(o) => { if (!o) setOpenStage(null); }}
        stage={sheetStage}
        index={stageIdx}
        total={stages.length}
        status={sheetStage ? statusOf(active, sheetStage) : 'locked'}
        enrolled={enrolled}
        onSetStatus={(st) => sheetStage && setStatus(sheetStage, st)}
      />
      <BrowseSheet open={browse} onOpenChange={setBrowse} pinned={pinned} onOpenRoadmap={openRoadmap} onTogglePin={togglePin} />
    </div>
  );
}
