// Mô hình + (de)serialize cho canvas "Tùy chỉnh" của trang Lộ trình.
// Định dạng lưu giữ NGUYÊN như bản cũ (main.js): chuỗi mermaid flowchart + dòng `%% VDATA:{json}`,
// vì cột mermaid_def dùng chung với bản Django/JS cũ — đổi định dạng là làm hỏng lộ trình đã lưu.

export type VNode = { id: string; x: number; y: number; label: string; color: number };
export type VEdge = { from: string; to: string };
export type VGraph = { nodes: VNode[]; edges: VEdge[]; nextId: number };

export const COLOR_COUNT = 6;
export const NODE_H = 44;

export const DEFAULT_GRAPH: VGraph = {
  nodes: [
    { id: 'vn_1', x: 220, y: 80, label: '🎯 Bắt đầu', color: 0 },
    { id: 'vn_2', x: 220, y: 200, label: '📚 Học lý thuyết', color: 1 },
    { id: 'vn_3', x: 220, y: 320, label: '🛠️ Thực hành', color: 2 },
    { id: 'vn_4', x: 220, y: 440, label: '✅ Hoàn thành', color: 3 },
  ],
  edges: [
    { from: 'vn_1', to: 'vn_2' },
    { from: 'vn_2', to: 'vn_3' },
    { from: 'vn_3', to: 'vn_4' },
  ],
  nextId: 5,
};

/** Bề rộng node ước lượng theo độ dài nhãn (SVG không tự co theo chữ như div). */
export function nodeWidth(label: string): number {
  return Math.min(260, Math.max(112, Array.from(label).length * 8.5 + 36));
}

export function toMermaid(g: VGraph): string {
  if (!g.nodes.length) return 'flowchart TD\n    A["🎯 Bắt đầu"] --> B["✅ Hoàn thành"]';
  const lines = ['flowchart TD'];
  g.nodes.forEach((n) => lines.push(`    ${n.id}["${n.label.replace(/"/g, "'")}"]`));
  g.edges.forEach((e) => lines.push(`    ${e.from} --> ${e.to}`));
  lines.push('%% VDATA:' + JSON.stringify({ nodes: g.nodes, edges: g.edges, nextId: g.nextId }));
  return lines.join('\n');
}

/** Parse mermaid flowchart thường (lộ trình sinh từ template, không có VDATA) và tự xếp toạ độ theo tầng. */
function fromPlainMermaid(mdef: string): VGraph | null {
  const nodes: Record<string, { id: string; label: string }> = {};
  const order: string[] = [];
  const edges: VEdge[] = [];
  const nodeDef = /^\s*([A-Za-z0-9_]+)\s*\[\s*"?([^"\]]*)"?\s*\]\s*$/;
  const edgeDef = /^\s*([A-Za-z0-9_]+)\s*-->\s*([A-Za-z0-9_]+)\s*$/;
  const ensure = (id: string, label?: string) => {
    if (!nodes[id]) {
      nodes[id] = { id, label: label || id };
      order.push(id);
    } else if (label) nodes[id].label = label;
  };
  for (const raw of mdef.split('\n')) {
    const line = raw.trim();
    if (!line || /^flowchart/i.test(line) || line.startsWith('%%')) continue;
    const em = line.match(edgeDef);
    if (em) {
      ensure(em[1]);
      ensure(em[2]);
      edges.push({ from: em[1], to: em[2] });
      continue;
    }
    const nm = line.match(nodeDef);
    if (nm) ensure(nm[1], nm[2].trim());
  }
  if (!order.length) return null;

  // Độ sâu theo đường dài nhất; lặp tới hội tụ (đồ thị nhỏ). Giới hạn số vòng để đồ thị có chu trình không treo.
  const depth: Record<string, number> = {};
  order.forEach((id) => (depth[id] = 0));
  for (let pass = 0; pass < order.length; pass++) {
    let changed = false;
    for (const e of edges) {
      if (depth[e.to] < depth[e.from] + 1) {
        depth[e.to] = depth[e.from] + 1;
        changed = true;
      }
    }
    if (!changed) break;
  }
  const byDepth: Record<number, string[]> = {};
  order.forEach((id) => (byDepth[depth[id]] ??= []).push(id));
  const COL_GAP = 210, ROW_GAP = 130, X0 = 240, Y0 = 80;
  let ci = 0;
  const out: VNode[] = [];
  Object.keys(byDepth).map(Number).sort((a, b) => a - b).forEach((d) => {
    const ids = byDepth[d];
    ids.forEach((id, i) => {
      out.push({ id, x: X0 + (i - (ids.length - 1) / 2) * COL_GAP, y: Y0 + d * ROW_GAP, label: nodes[id].label, color: ci++ % COLOR_COUNT });
    });
  });
  return { nodes: out, edges, nextId: order.length + 1 };
}

export function fromMermaid(mdef: string | null | undefined): VGraph | null {
  const text = (mdef ?? '').trim();
  if (!text) return null;
  const m = text.match(/%% VDATA:(.+)$/m);
  if (m) {
    try {
      const d = JSON.parse(m[1]) as Partial<VGraph>;
      const nodes = Array.isArray(d.nodes) ? d.nodes : [];
      return { nodes, edges: Array.isArray(d.edges) ? d.edges : [], nextId: d.nextId || nodes.length + 1 };
    } catch {
      /* rơi xuống parser mermaid thường */
    }
  }
  return fromPlainMermaid(text);
}

/** Điểm đầu/cuối mũi tên: đi từ đáy node nguồn tới đỉnh node đích; đích nằm cao hơn thì đi ngang hai bên. */
export function edgePath(a: VNode, b: VNode): string {
  const aw = nodeWidth(a.label), bw = nodeWidth(b.label);
  let x1 = a.x, y1 = a.y + NODE_H / 2, x2 = b.x, y2 = b.y - NODE_H / 2;
  if (b.y < a.y + NODE_H) {
    const dir = b.x >= a.x ? 1 : -1;
    x1 = a.x + (dir * aw) / 2;
    y1 = a.y;
    x2 = b.x - (dir * bw) / 2;
    y2 = b.y;
  }
  const cy = Math.max(40, (Math.abs(y2 - y1) + Math.abs(x2 - x1)) * 0.35);
  return `M${x1},${y1} C${x1},${y1 + cy} ${x2},${y2 - cy} ${x2},${y2}`;
}
