'use client';

// Tab "Tùy chỉnh" của Lộ trình: canvas kéo-thả tự dựng lộ trình (thay cho main.js + roadmap.css cũ).
// Vẽ bằng SVG thuần: vị trí/kích thước đi qua thuộc tính (transform, x, y), KHÔNG dùng style nội tuyến
// (CSP bỏ 'unsafe-inline'). Kéo bằng Pointer Events nên chuột và cảm ứng dùng chung một đường code.
import { Link2, Minus, Pencil, Plus, RotateCcw, Save, Sparkles, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

import { Badge, Button, Card, Dialog, IconButton, Input, cn, useToast } from '@/components/ui';
import { ApiError, sendJson } from '@/lib/fetch-json';
import {
  COLOR_COUNT, DEFAULT_GRAPH, NODE_H, edgePath, fromMermaid, nodeWidth, toMermaid,
  type VGraph, type VNode,
} from '@/lib/roadmap-canvas';

// 6 màu node lấy từ token (đủ chuỗi class đầy đủ để Tailwind quét được).
const NODE_TONE = [
  'fill-primary-soft stroke-primary',
  'fill-success-soft stroke-success',
  'fill-accent-soft stroke-accent',
  'fill-info-soft stroke-info',
  'fill-warning-soft stroke-warning',
  'fill-danger-soft stroke-danger',
];

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2.5;
const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100));

type Mode = 'normal' | 'connect';

export default function RoadmapCanvas({ mermaid }: { mermaid: string | null }) {
  const { toast } = useToast();
  // Khởi tạo một lần từ dữ liệu đã tải; không có/parse hỏng → sơ đồ mẫu 4 bước như bản cũ.
  const [graph, setGraph] = useState<VGraph>(() => fromMermaid(mermaid) ?? DEFAULT_GRAPH);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('normal');
  const [connectSrc, setConnectSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [renaming, setRenaming] = useState<VNode | null>(null);
  const [renameText, setRenameText] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(null);
  // Sau khi kéo, sự kiện click kế tiếp không được tính là "chọn node".
  const justDragged = useRef(false);

  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);

  // Ctrl+cuộn để thu phóng: cần listener gốc non-passive thì mới preventDefault được.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom((z) => clampZoom(z + (e.deltaY > 0 ? -0.1 : 0.1)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const patchNode = useCallback((id: string, patch: Partial<VNode>) => {
    setGraph((g) => ({ ...g, nodes: g.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }));
  }, []);

  const addNode = () => {
    const el = scrollRef.current;
    const cx = el ? (el.scrollLeft + el.clientWidth / 2) / zoom : 220;
    const cy = el ? (el.scrollTop + el.clientHeight / 2) / zoom : 220;
    const offset = (graph.nodes.length % 5) * 28;
    const node: VNode = {
      id: `vn_${graph.nextId}`, x: Math.max(80, cx + offset - 60), y: Math.max(40, cy + offset - 60),
      label: `Node ${graph.nodes.length}`, color: graph.nodes.length % COLOR_COUNT,
    };
    setGraph((g) => ({ ...g, nodes: [...g.nodes, node], nextId: g.nextId + 1 }));
    setSelected(node.id);
    // Mở đổi tên ngay: node mới gần như luôn cần đặt tên.
    setRenaming(node);
    setRenameText(node.label);
  };

  const deleteNode = (id: string) => {
    setGraph((g) => ({ ...g, nodes: g.nodes.filter((n) => n.id !== id), edges: g.edges.filter((e) => e.from !== id && e.to !== id) }));
    setSelected((s) => (s === id ? null : s));
    setConnectSrc((s) => (s === id ? null : s));
  };

  const deleteEdge = (idx: number) => setGraph((g) => ({ ...g, edges: g.edges.filter((_, i) => i !== idx) }));

  const toggleConnect = () => {
    setMode((m) => (m === 'connect' ? 'normal' : 'connect'));
    setConnectSrc(null);
  };

  const onNodeClick = (id: string) => {
    if (justDragged.current) {
      justDragged.current = false;
      return;
    }
    if (mode === 'connect') {
      if (!connectSrc) return setConnectSrc(id);
      if (connectSrc === id) return setConnectSrc(null);
      // Nối lại cặp đã có = gỡ mũi tên: cách xoá mũi tên không cần chuột chính xác (mobile/bàn phím).
      setGraph((g) => {
        const has = g.edges.some((e) => e.from === connectSrc && e.to === id);
        return { ...g, edges: has ? g.edges.filter((e) => !(e.from === connectSrc && e.to === id)) : [...g.edges, { from: connectSrc, to: id }] };
      });
      setConnectSrc(null);
      return;
    }
    setSelected((s) => (s === id ? null : id));
  };

  const onPointerDown = (e: PointerEvent<SVGGElement>, n: VNode) => {
    if (e.button !== 0) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: n.id, dx: (e.clientX - rect.left) / zoom - n.x, dy: (e.clientY - rect.top) / zoom - n.y, sx: e.clientX, sy: e.clientY, moved: false };
  };
  const onPointerMove = (e: PointerEvent<SVGGElement>) => {
    const d = drag.current;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!d || !rect) return;
    // Ngưỡng 5px để một cú chạm/bấm không bị coi là kéo.
    if (!d.moved && Math.abs(e.clientX - d.sx) < 5 && Math.abs(e.clientY - d.sy) < 5) return;
    d.moved = true;
    patchNode(d.id, { x: Math.max(0, (e.clientX - rect.left) / zoom - d.dx), y: Math.max(0, (e.clientY - rect.top) / zoom - d.dy) });
  };
  const onPointerUp = () => {
    if (drag.current?.moved) justDragged.current = true;
    drag.current = null;
  };

  const onNodeKey = (e: KeyboardEvent<SVGGElement>, n: VNode) => {
    const step = e.shiftKey ? 40 : 10;
    const move: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (move[e.key]) {
      e.preventDefault();
      patchNode(n.id, { x: Math.max(0, n.x + move[e.key][0]), y: Math.max(0, n.y + move[e.key][1]) });
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onNodeClick(n.id);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      deleteNode(n.id);
    } else if (e.key === 'F2') {
      e.preventDefault();
      openRename(n);
    }
  };

  const openRename = (n: VNode) => {
    setRenaming(n);
    setRenameText(n.label);
  };
  const submitRename = () => {
    if (renaming) patchNode(renaming.id, { label: renameText.trim() || renaming.label });
    setRenaming(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      await sendJson('/api/me/roadmap', 'POST', { mermaid_def: toMermaid(graph) });
      toast({ title: 'Đã lưu lộ trình', variant: 'success', duration: 1800 });
    } catch (err) {
      toast({ title: 'Chưa lưu được lộ trình', description: err instanceof ApiError ? err.message : 'Thử lại sau ít phút.', variant: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  const askAi = async () => {
    try {
      await sendJson('/api/me/roadmap/ai', 'POST');
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) toast({ title: 'Tạo bằng AI chỉ dành cho tài khoản Premium', variant: 'info' });
      else toast({ title: 'Không gọi được tính năng AI', description: 'Thử lại sau ít phút.', variant: 'danger' });
    }
  };

  const maxX = Math.max(320, ...graph.nodes.map((n) => n.x + nodeWidth(n.label) / 2 + 40));
  const maxY = Math.max(280, ...graph.nodes.map((n) => n.y + NODE_H / 2 + 60));
  const selNode = selected ? byId.get(selected) : undefined;

  const hint = !graph.nodes.length
    ? 'Bấm "Thêm node" để bắt đầu.'
    : mode === 'connect'
      ? connectSrc ? 'Chọn node đích. Chọn lại cặp đã nối để gỡ mũi tên.' : 'Chọn node nguồn.'
      : 'Kéo node để di chuyển, chạm một lần để chọn. Chạm mũi tên để xoá.';

  return (
    <div className="flex flex-col gap-3">
      <Card className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-fg">Lộ trình tùy chỉnh của tôi</h2>
            <p className="text-sm text-fg-muted">Tự dựng các chặng và nối chúng thành mạch học riêng.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={askAi}>
              <Sparkles aria-hidden="true" className="size-4" /> Tạo bằng AI <Badge variant="accent">Premium</Badge>
            </Button>
            <Button onClick={save} loading={saving}>
              <Save aria-hidden="true" className="size-4" /> Lưu lộ trình
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={addNode}><Plus aria-hidden="true" className="size-4" /> Thêm node</Button>
          <Button variant={mode === 'connect' ? 'primary' : 'secondary'} size="sm" aria-pressed={mode === 'connect'} onClick={toggleConnect}>
            <Link2 aria-hidden="true" className="size-4" /> Nối node
          </Button>
          <Button variant="secondary" size="sm" disabled={!graph.nodes.length} onClick={() => setConfirmClear(true)}>
            <Trash2 aria-hidden="true" className="size-4" /> Xoá hết
          </Button>
          <div className="ml-auto flex items-center gap-1" role="group" aria-label="Thu phóng">
            <IconButton label="Thu nhỏ" size="sm" icon={<Minus />} onClick={() => setZoom((z) => clampZoom(z - 0.15))} />
            <span className="w-12 text-center text-sm tabular-nums text-fg-muted" aria-live="polite">{Math.round(zoom * 100)}%</span>
            <IconButton label="Phóng to" size="sm" icon={<Plus />} onClick={() => setZoom((z) => clampZoom(z + 0.15))} />
            <IconButton label="Đặt lại thu phóng" size="sm" icon={<RotateCcw />} onClick={() => setZoom(1)} />
          </div>
        </div>
        <p className="text-sm text-fg-muted" role="status">{hint}</p>
      </Card>

      {selNode && mode === 'normal' && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-solid border-border bg-surface px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">Đã chọn: {selNode.label}</span>
          <Button variant="secondary" size="sm" onClick={() => openRename(selNode)}><Pencil aria-hidden="true" className="size-4" /> Đổi tên</Button>
          <Button variant="danger" size="sm" onClick={() => deleteNode(selNode.id)}><Trash2 aria-hidden="true" className="size-4" /> Xoá node</Button>
        </div>
      )}

      <div
        ref={scrollRef}
        className="h-[60dvh] min-h-80 overflow-auto rounded-lg border border-solid border-border bg-surface-2"
      >
        <svg
          ref={svgRef}
          role="group"
          aria-label="Sơ đồ lộ trình tùy chỉnh"
          width={maxX * zoom}
          height={maxY * zoom}
          className="block min-w-full"
          onClick={(e) => {
            // Bấm vào nền trống = bỏ chọn.
            if (e.target === e.currentTarget) {
              setSelected(null);
              setConnectSrc(null);
            }
          }}
        >
          <defs>
            <marker id="rm-arrow" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
              <polygon points="0 0,9 3.5,0 7" className="fill-info" />
            </marker>
          </defs>
          <g transform={`scale(${zoom})`}>
            {graph.edges.map((e, i) => {
              const a = byId.get(e.from), b = byId.get(e.to);
              if (!a || !b) return null;
              const d = edgePath(a, b);
              return (
                <g key={`${e.from}-${e.to}`} className="cursor-pointer" onClick={(ev) => { ev.stopPropagation(); deleteEdge(i); }}>
                  <title>Bấm để xoá mũi tên</title>
                  <path d={d} fill="none" stroke="transparent" strokeWidth={16} />
                  <path d={d} fill="none" className="stroke-info" strokeWidth={2} markerEnd="url(#rm-arrow)" />
                </g>
              );
            })}
            {graph.nodes.map((n) => {
              const w = nodeWidth(n.label);
              const isSel = selected === n.id;
              const isSrc = connectSrc === n.id;
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x - w / 2} ${n.y - NODE_H / 2})`}
                  tabIndex={0}
                  role="button"
                  aria-label={`${n.label}${isSel ? ' (đang chọn)' : ''}`}
                  aria-pressed={isSel}
                  className="ui-focus-ring cursor-grab touch-none outline-none focus-visible:[&>rect]:stroke-[3] active:cursor-grabbing"
                  onPointerDown={(e) => onPointerDown(e, n)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  onClick={(e) => { e.stopPropagation(); onNodeClick(n.id); }}
                  onDoubleClick={(e) => { e.stopPropagation(); openRename(n); }}
                  onKeyDown={(e) => onNodeKey(e, n)}
                >
                  <rect
                    width={w}
                    height={NODE_H}
                    rx={10}
                    strokeWidth={isSel || isSrc ? 3 : 1.5}
                    className={cn(NODE_TONE[(n.color || 0) % COLOR_COUNT], isSrc && 'stroke-fg')}
                  />
                  <text x={w / 2} y={NODE_H / 2} textAnchor="middle" dominantBaseline="central" className="select-none fill-fg text-sm font-semibold">
                    {n.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <Dialog
        open={renaming !== null}
        onOpenChange={(o) => { if (!o) setRenaming(null); }}
        title="Đổi tên node"
        size="sm"
        footer={<Button onClick={submitRename}>Xong</Button>}
      >
        <form onSubmit={(e) => { e.preventDefault(); submitRename(); }} className="py-2">
          <Input aria-label="Tên node" autoFocus value={renameText} onChange={(e) => setRenameText(e.target.value)} maxLength={80} lang="vi" />
        </form>
      </Dialog>

      <Dialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Xoá toàn bộ sơ đồ?"
        description="Mọi node và mũi tên trên canvas sẽ bị xoá. Lộ trình đã lưu trước đó chỉ đổi khi bạn bấm Lưu."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmClear(false)}>Giữ lại</Button>
            <Button
              variant="danger"
              onClick={() => {
                setGraph((g) => ({ ...g, nodes: [], edges: [] }));
                setSelected(null);
                setConnectSrc(null);
                setConfirmClear(false);
              }}
            >
              Xoá hết
            </Button>
          </>
        }
      >
        <span className="sr-only">Xác nhận xoá</span>
      </Dialog>
    </div>
  );
}
