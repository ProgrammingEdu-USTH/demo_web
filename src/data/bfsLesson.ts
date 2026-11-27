import { HighlightableThread, ThreadKey } from '../context/HighlightContext';

export type NodeId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface GraphNode {
  id: NodeId;
  x: number;
  y: number;
}

export interface GraphEdge {
  from: NodeId;
  to: NodeId;
  curved?: 'top-cycle';
  weightKm: number;
  labelX: number;
  labelY: number;
}

export interface ParentPair {
  child: NodeId;
  from: NodeId | null;
}

export interface CodeLineDef {
  num: number;
  code: string;
  thread?: ThreadKey;
}

export interface BfsTickSnapshot {
  tickIndex: number;
  title: string;
  currentNode: NodeId | null;
  activeEdge: { from: NodeId; to: NodeId } | null;
  queue: NodeId[];
  visited: NodeId[];
  parent: ParentPair[];
  blockedEdges: Array<{ from: NodeId; to: NodeId }>;
  handoffTarget: 'queue-pop' | 'visited-parent' | null;
  handoffNode: NodeId | null;
  finalPath: NodeId[] | null;
}

export interface DecompositionChip {
  id: string;
  label: string;
  sub: string;
  correct: boolean;
  thread?: HighlightableThread;
  rejectReason?: string;
}

export interface BfsLessonStep {
  id: number;
  phase: 1 | 2 | 3 | 4;
  milestoneLabel: string;
  macroStage: 'overview' | 'queue' | 'visited' | 'parent' | 'unified' | 'limit';
  completedStages: Array<'queue' | 'visited' | 'parent'>;
  metrics: {
    stepLabel: string;
    currentNode: string;
    queueLength: string;
  };
  contextCompass: string;
  title: string;
  whyExplanation: string;
  callout: {
    type: 'KEY IDEA' | 'WATCH OUT';
    thread: ThreadKey;
    title: string;
    body: string;
  };
  activeLineNums: number[];
  dockFocus: 'none' | 'queue' | 'visited' | 'parent' | 'all';
  dataState: {
    queue: NodeId[];
    visited: NodeId[];
    parent: ParentPair[];
  };
  autoPlayDurationMs?: number;
}

export const GRAPH_NODES: GraphNode[] = [
  { id: 'A', x: 86, y: 185 },
  { id: 'B', x: 216, y: 100 },
  { id: 'C', x: 216, y: 270 },
  { id: 'D', x: 352, y: 100 },
  { id: 'E', x: 352, y: 270 },
  { id: 'F', x: 476, y: 185 },
];

export const GRAPH_NODE_MAP: Record<NodeId, GraphNode> = {
  A: GRAPH_NODES[0],
  B: GRAPH_NODES[1],
  C: GRAPH_NODES[2],
  D: GRAPH_NODES[3],
  E: GRAPH_NODES[4],
  F: GRAPH_NODES[5],
};

export const BFS_ADJACENCY: Record<NodeId, NodeId[]> = {
  A: ['B', 'C'],
  B: ['D'],
  C: ['E'],
  D: ['A', 'E'],
  E: ['F'],
  F: ['D'],
};

export const GRAPH_EDGES: GraphEdge[] = [
  { from: 'A', to: 'B', weightKm: 2, labelX: 138, labelY: 128 },
  { from: 'A', to: 'C', weightKm: 25, labelX: 138, labelY: 244 },
  { from: 'B', to: 'D', weightKm: 3, labelX: 284, labelY: 82 },
  { from: 'C', to: 'E', weightKm: 22, labelX: 284, labelY: 290 },
  {
    from: 'D',
    to: 'A',
    curved: 'top-cycle',
    weightKm: 5,
    labelX: 214,
    labelY: 52,
  },
  { from: 'D', to: 'E', weightKm: 2, labelX: 378, labelY: 185 },
  { from: 'E', to: 'F', weightKm: 3, labelX: 428, labelY: 244 },
  { from: 'F', to: 'D', weightKm: 8, labelX: 428, labelY: 126 },
];

export const DECOMPOSITION_CHIPS: DecompositionChip[] = [
  {
    id: 'layer',
    label: 'Duyệt tỏa đều từng lớp',
    sub: 'Để chạm đích ít bước nhất',
    correct: true,
    thread: 'queue',
  },
  {
    id: 'alpha',
    label: 'Sắp xếp tên đỉnh theo bảng chữ cái',
    sub: 'Ưu tiên đi từ A → B → C...',
    correct: false,
    rejectReason:
      'Tên đỉnh chỉ là nhãn ký hiệu — thứ tự bảng chữ cái không cho biết đỉnh nào gần đích hơn!',
  },
  {
    id: 'visited',
    label: 'Ghi nhớ đỉnh đã qua',
    sub: 'Để không đi vòng lặp vô hạn',
    correct: true,
    thread: 'visited',
  },
  {
    id: 'count-all',
    label: 'Đếm tổng số cạnh toàn đồ thị trước',
    sub: 'Quét hết đồ thị trước khi xuất phát',
    correct: false,
    rejectReason:
      'Không cần biết trước toàn bộ đồ thị; ta chỉ cần khám phá dần các đỉnh kề từ A!',
  },
  {
    id: 'parent',
    label: 'Lưu dấu vết đường đi',
    sub: 'Để lần ngược từ đích về nguồn',
    correct: true,
    thread: 'parent',
  },
];

export const UNIFIED_BFS_CODE: CodeLineDef[] = [
  { num: 1, code: 'queue = deque([start])', thread: 'queue' },
  { num: 2, code: 'visited = {start}', thread: 'visited' },
  { num: 3, code: 'parent = {start: None}', thread: 'parent' },
  { num: 4, code: 'while queue:', thread: 'queue' },
  { num: 5, code: '    u = queue.popleft()', thread: 'queue' },
  { num: 6, code: '    if u == goal: break' },
  { num: 7, code: '    for v in graph[u]:' },
  { num: 8, code: '        if v not in visited:', thread: 'visited' },
  { num: 9, code: '            visited.add(v)', thread: 'visited' },
  { num: 10, code: '            parent[v] = u', thread: 'parent' },
  { num: 11, code: '            queue.append(v)', thread: 'queue' },
  { num: 12, code: '# Lần ngược parent[goal] -> start', thread: 'parent' },
];

export function runBfsSimulation(
  start: NodeId,
  goal: NodeId
): BfsTickSnapshot[] {
  const snapshots: BfsTickSnapshot[] = [];
  const queue: NodeId[] = [start];
  const visitedSet = new Set<NodeId>([start]);
  const visitedList: NodeId[] = [start];
  const parentMap = new Map<NodeId, NodeId | null>([[start, null]]);
  const parentList: ParentPair[] = [{ child: start, from: null }];

  let tick = 0;
  snapshots.push({
    tickIndex: tick++,
    title: `Khởi tạo: đẩy ${start} vào Queue, Visited & Parent`,
    currentNode: start,
    activeEdge: null,
    queue: [...queue],
    visited: [...visitedList],
    parent: [...parentList],
    blockedEdges: [],
    handoffTarget: 'visited-parent',
    handoffNode: start,
    finalPath: start === goal ? [start] : null,
  });

  if (start === goal) return snapshots;

  while (queue.length > 0) {
    const u = queue.shift()!;
    snapshots.push({
      tickIndex: tick++,
      title: `Lấy ${u} khỏi đầu Queue (FIFO) để xét`,
      currentNode: u,
      activeEdge: null,
      queue: [...queue],
      visited: [...visitedList],
      parent: [...parentList],
      blockedEdges: [],
      handoffTarget: 'queue-pop',
      handoffNode: u,
      finalPath: null,
    });

    if (u === goal) {
      const path: NodeId[] = [];
      let curr: NodeId | null = goal;
      while (curr !== null) {
        path.push(curr);
        curr = parentMap.get(curr) ?? null;
      }
      path.reverse();
      snapshots.push({
        tickIndex: tick++,
        title: `Chạm đích ${goal}! Truy vết ngắn nhất: ${path.join(' ➔ ')}`,
        currentNode: goal,
        activeEdge: null,
        queue: [...queue],
        visited: [...visitedList],
        parent: [...parentList],
        blockedEdges: [],
        handoffTarget: null,
        handoffNode: null,
        finalPath: path,
      });
      return snapshots;
    }

    const neighbors = BFS_ADJACENCY[u];
    const blockedNow: Array<{ from: NodeId; to: NodeId }> = [];

    for (const v of neighbors) {
      if (visitedSet.has(v)) {
        blockedNow.push({ from: u, to: v });
        snapshots.push({
          tickIndex: tick++,
          title: `Chặn cạnh ${u} ➔ ${v} vì ${v} ∈ visited`,
          currentNode: u,
          activeEdge: { from: u, to: v },
          queue: [...queue],
          visited: [...visitedList],
          parent: [...parentList],
          blockedEdges: [...blockedNow],
          handoffTarget: null,
          handoffNode: null,
          finalPath: null,
        });
      } else {
        visitedSet.add(v);
        visitedList.push(v);
        parentMap.set(v, u);
        parentList.push({ child: v, from: u });
        queue.push(v);
        snapshots.push({
          tickIndex: tick++,
          title: `Từ ${u} khám phá ${v}: ghi visited, parent[${v}] = ${u}, nạp Queue`,
          currentNode: u,
          activeEdge: { from: u, to: v },
          queue: [...queue],
          visited: [...visitedList],
          parent: [...parentList],
          blockedEdges: [...blockedNow],
          handoffTarget: 'visited-parent',
          handoffNode: v,
          finalPath: null,
        });
      }
    }
  }

  return snapshots;
}

export const BFS_STEPS: BfsLessonStep[] = [
  {
    id: 1,
    phase: 1,
    milestoneLabel: '1. Tự tìm đường',
    macroStage: 'overview',
    completedStages: [],
    metrics: {
      stepLabel: '1 / 9',
      currentNode: 'A',
      queueLength: 'Chưa cần code',
    },
    contextCompass: 'PHA 1 • KHÁM PHÁ KHÔNG CẦN CODE',
    title: 'Thử thách 1: Tự tìm đường ngắn nhất bằng tay',
    whyExplanation:
      'Trước khi đụng tới dòng code Python nào, hãy tự dùng trực giác của bạn! Bấm lần lượt lên các đỉnh trên đồ thị để đi từ `A` tới `F` với ít bước nhất, đồng thời để ý cái bẫy vòng lặp `A → B → D → A`.',
    callout: {
      type: 'KEY IDEA',
      thread: 'queue',
      title: 'Nhiệm vụ: Bấm đỉnh trên đồ thị tìm đường 3 bước tới F',
      body: 'Đồ thị có đường `A → B → D → E → F` (4 bước) và một đường khác chỉ 3 bước. Hãy tìm đúng đường 3 bước để mở khóa Bước 2!',
    },
    activeLineNums: [],
    dockFocus: 'none',
    dataState: { queue: [], visited: [], parent: [] },
    autoPlayDurationMs: 4500,
  },
  {
    id: 2,
    phase: 1,
    milestoneLabel: '2. Phân rã việc',
    macroStage: 'overview',
    completedStages: [],
    metrics: {
      stepLabel: '2 / 9',
      currentNode: 'A → F',
      queueLength: '3 mảnh ghép',
    },
    contextCompass: 'PHA 1 • PHÂN RÃ BÀI TOÁN',
    title: 'Phân rã: Bộ não bạn vừa làm 3 việc gì?',
    whyExplanation:
      'Máy tính không có "đôi mắt" nhìn toàn cảnh như con người — nó chỉ nhìn thấy các đỉnh hàng xóm ngay cạnh mình. Để máy tính tự tìm được đường 3 bước như bạn vừa làm, ta phải tách bài toán thành 3 nhiệm vụ con rõ ràng.',
    callout: {
      type: 'KEY IDEA',
      thread: 'queue',
      title: 'Chọn đúng 3 mảnh ghép yêu cầu để mở khóa Quy trình BFS',
      body: 'Cẩn thận với 2 thẻ gây nhiễu! Chỉ khi ghép đúng 3 mảnh ghép cốt lõi, thanh công cụ 3 chặng phía trên mới được mở khóa.',
    },
    activeLineNums: [],
    dockFocus: 'none',
    dataState: { queue: [], visited: [], parent: [] },
    autoPlayDurationMs: 4800,
  },
  {
    id: 3,
    phase: 2,
    milestoneLabel: '3. Stack vs Queue',
    macroStage: 'queue',
    completedStages: [],
    metrics: {
      stepLabel: '3 / 9',
      currentNode: 'Đấu trường 1',
      queueLength: 'Stack vs Queue',
    },
    contextCompass: 'PHA 2 • ĐẤU TRƯỜNG 1/3 (DUYỆT THEO LỚP)',
    title: 'Đấu trường 1: Stack (LIFO) vs Queue (FIFO)',
    whyExplanation:
      'Cả `Stack` và `Queue` đều dùng để lưu danh sách đỉnh chờ xét, nhưng thứ tự lấy ra quyết định số bước đi! Hãy thử chạy cả hai để xem vì sao chọn nhầm [[queue:Queue]] thành `Stack` sẽ khiến ta đi đường vòng 4 bước.',
    callout: {
      type: 'WATCH OUT',
      thread: 'queue',
      title: 'Thử nghiệm thất bại chủ đích: Chạy Stack trước, rồi chạy Queue!',
      body: '`Stack` (vào sau ra trước) đâm sâu vào một nhánh (`A→B→D→E→F` - 4 bước). Chỉ `Queue` (vào trước ra trước) mới loang đều theo lớp để tìm thấy `A→C→E→F` (3 bước).',
    },
    activeLineNums: [],
    dockFocus: 'queue',
    dataState: { queue: ['B', 'C'], visited: [], parent: [] },
    autoPlayDurationMs: 5200,
  },
  {
    id: 4,
    phase: 2,
    milestoneLabel: '4. List vs Set',
    macroStage: 'visited',
    completedStages: ['queue'],
    metrics: {
      stepLabel: '4 / 9',
      currentNode: 'Đấu trường 2',
      queueLength: 'List vs Set',
    },
    contextCompass: 'PHA 2 • ĐẤU TRƯỜNG 2/3 (CHỐNG ĐI LẶP)',
    title: 'Đấu trường 2: List vs Set cho dữ liệu visited',
    whyExplanation:
      'Trên đồ thị 6 đỉnh nhỏ xíu, cả `List` và [[visited:Set]] đều chặn được chu trình `D → A` dễ dàng. Nhưng khi hệ thống thực tế có **100,000 đỉnh**, việc dò từng phần tử trong `List` (`O(n)`) sẽ làm chương trình chậm đi hàng chục nghìn lần so với `Set` (`O(1)`).',
    callout: {
      type: 'KEY IDEA',
      thread: 'visited',
      title: 'Bấm "Chạy thử" để xem bài test chịu tải 100,000 đỉnh!',
      body: 'Quan sát thanh đo tốc độ phía dưới đồ thị, sau đó bấm **Chốt dùng Set** để khóa lựa chọn tối ưu.',
    },
    activeLineNums: [],
    dockFocus: 'visited',
    dataState: { queue: ['E'], visited: ['A', 'B', 'C', 'D', 'E'], parent: [] },
    autoPlayDurationMs: 5200,
  },
  {
    id: 5,
    phase: 2,
    milestoneLabel: '5. prev vs Dict',
    macroStage: 'parent',
    completedStages: ['queue', 'visited'],
    metrics: {
      stepLabel: '5 / 9',
      currentNode: 'Đấu trường 3',
      queueLength: 'prev vs Dict',
    },
    contextCompass: 'PHA 2 • ĐẤU TRƯỜNG 3/3 (TRUY VẾT ĐƯỜNG ĐI)',
    title: 'Đấu trường 3: 1 biến prev vs Dict parent',
    whyExplanation:
      'Tại sao ta không dùng một biến đơn `prev` cho tiết kiệm bộ nhớ, mà phải dùng [[parent:Dict parent]]? Vì BFS tỏa ra nhiều nhánh cùng lúc (`B` và `C`), nếu chỉ dùng 1 biến `prev` thì nhánh sau sẽ ghi đè mất dấu vết của nhánh trước!',
    callout: {
      type: 'KEY IDEA',
      thread: 'parent',
      title: 'Thử chạy "1 biến prev" để thấy dấu vết bị đè nát ra sao!',
      body: 'Sau đó chọn **Dict parent** và bấm **Chạy thử** để xem từng cặp `{con: cha}` giúp lần ngược `F ➔ E ➔ C ➔ A` trơn tru.',
    },
    activeLineNums: [],
    dockFocus: 'parent',
    dataState: {
      queue: [],
      visited: ['A', 'B', 'C', 'D', 'E', 'F'],
      parent: [
        { child: 'A', from: null },
        { child: 'B', from: 'A' },
        { child: 'C', from: 'A' },
        { child: 'D', from: 'B' },
        { child: 'E', from: 'C' },
        { child: 'F', from: 'E' },
      ],
    },
    autoPlayDurationMs: 5200,
  },
  {
    id: 6,
    phase: 3,
    milestoneLabel: '6. Lắp ráp Code',
    macroStage: 'unified',
    completedStages: ['queue', 'visited', 'parent'],
    metrics: {
      stepLabel: '6 / 9',
      currentNode: 'Mind-to-Code',
      queueLength: '3 ô lắp ghép',
    },
    contextCompass: 'PHA 3 • CHUYỂN TƯ DUY THÀNH CODE PYTHON',
    title: 'Lắp ráp 3 công cụ chiến thắng vào Code Python',
    whyExplanation:
      'Bây giờ bạn mới nhìn thấy code Python lần đầu — và nó trở nên cực kỳ dễ hiểu vì mọi dòng đều khớp 1-1 với 3 công cụ bạn vừa tự tay chọn: [[queue:Queue]] (Xanh dương), [[visited:Set]] (Tím), và [[parent:Dict]] (Xanh lá).',
    callout: {
      type: 'KEY IDEA',
      thread: 'parent',
      title: 'Bấm từng công cụ hoặc "Lắp 3 công cụ vào Code" để hoàn chỉnh hàm!',
      body: 'Không học vẹt cú pháp: mỗi màu sắc trong code chính là nhiệm vụ bạn đã phân rã ở Bước 2.',
    },
    activeLineNums: [1, 2, 3, 4, 5, 8, 9, 10, 11],
    dockFocus: 'none',
    dataState: { queue: [], visited: [], parent: [] },
    autoPlayDurationMs: 4800,
  },
  {
    id: 7,
    phase: 3,
    milestoneLabel: '7. Chạy & Sandbox',
    macroStage: 'unified',
    completedStages: ['queue', 'visited', 'parent'],
    metrics: {
      stepLabel: '7 / 9',
      currentNode: 'Live',
      queueLength: 'Sandbox',
    },
    contextCompass: 'PHA 3 • MÔ PHỎNG HOÀN CHỈNH & SANDBOX',
    title: 'Chạy toàn bộ BFS & Tự do thử nghiệm đỉnh mới',
    whyExplanation:
      'Cả [[queue:Queue]], [[visited:Set visited]] và [[parent:Dict parent]] cùng chạy nhịp nhàng trong một vòng lặp. Rê chuột vào các nhãn màu để tô sáng chéo Code + Hộp dữ liệu, hoặc bấm chọn 2 đỉnh bất kỳ trên đồ thị để chạy BFS theo ý bạn!',
    callout: {
      type: 'KEY IDEA',
      thread: 'queue',
      title: 'Thử nghiệm tự do: Chọn Start / Goal trên đồ thị rồi bấm "Chạy BFS"',
      body: 'Bạn cũng có thể tắt từng lớp hiển thị (`Queue`, `Visited`, `Parent`) để kiểm chứng lại vai trò của từng thành phần.',
    },
    activeLineNums: [1, 2, 3, 5, 8, 9, 10, 11],
    dockFocus: 'all',
    dataState: {
      queue: [],
      visited: ['A', 'B', 'C', 'D', 'E', 'F'],
      parent: [
        { child: 'A', from: null },
        { child: 'B', from: 'A' },
        { child: 'C', from: 'A' },
        { child: 'D', from: 'B' },
        { child: 'E', from: 'C' },
        { child: 'F', from: 'E' },
      ],
    },
    autoPlayDurationMs: 5600,
  },
  {
    id: 8,
    phase: 4,
    milestoneLabel: '8. Giới hạn BFS',
    macroStage: 'limit',
    completedStages: ['queue', 'visited', 'parent'],
    metrics: {
      stepLabel: '8 / 9',
      currentNode: 'Đồ thị có trọng số',
      queueLength: 'Cầu nối Dijkstra',
    },
    contextCompass: 'PHA 4 • PHÁ VỠ GIỚI HẠN (CẦU NỐI BÀI TIẾP THEO)',
    title: 'Khi nào BFS thất bại? (Cầu nối sang Dijkstra)',
    whyExplanation:
      'Hãy gắn khoảng cách thực tế (`km`) lên từng con đường! Nhánh trên `A ➔ B ➔ D ➔ E ➔ F` tốn **4 bước** nhưng chỉ dài `10 km`, còn nhánh dưới `A ➔ C ➔ E ➔ F` chỉ **3 bước** nhưng dài tới `50 km`. Vì [[queue:Queue]] chỉ đếm số bước, BFS sẽ chọn nhầm đường xa gấp 5 lần!',
    callout: {
      type: 'WATCH OUT',
      thread: 'bug',
      title: 'Bấm "Chạy BFS" để chứng kiến BFS chọn nhầm đường 50 km!',
      body: 'BFS chỉ tối ưu khi mọi cạnh có trọng số bằng nhau. Khi cạnh có độ dài khác nhau, ta phải nâng cấp `Queue` thành `Priority Queue` (Thuật toán Dijkstra).',
    },
    activeLineNums: [5, 11],
    dockFocus: 'none',
    dataState: { queue: [], visited: [], parent: [] },
    autoPlayDurationMs: 5500,
  },
  {
    id: 9,
    phase: 4,
    milestoneLabel: '9. Tự Code Mini',
    macroStage: 'unified',
    completedStages: ['queue', 'visited', 'parent'],
    metrics: {
      stepLabel: '9 / 9',
      currentNode: 'Tự viết Code',
      queueLength: '4 đỉnh (Mini)',
    },
    contextCompass: 'THỰC HÀNH • BÀI TOÁN CON NHỎ HƠN 33%',
    title: 'Sandbox Thực Hành: Tự code hàm min_steps (4 đỉnh)',
    whyExplanation:
      'Để bạn thực hành nhẹ nhàng ngay sau bài học, bài toán con này cắt giảm ~33% độ phức tạp: đồ thị chỉ còn **4 đỉnh** (`A, B, C, D` kèm chu trình `A ↔ B`), và bạn chỉ cần trả về **số bước ít nhất** (sử dụng [[queue:Queue]] + [[visited:Set]], chưa cần [[parent:Dict]]).',
    callout: {
      type: 'KEY IDEA',
      thread: 'parent',
      title: 'Hoàn thành 4 dòng # TODO và bấm "Chạy Code & Chấm 4 Test"',
      body: 'Nếu quên `visited`, chu trình `A ↔ B` sẽ làm vòng lặp chạy quá 250 bước và bị ngắt cảnh báo ngay lập tức!',
    },
    activeLineNums: [],
    dockFocus: 'none',
    dataState: { queue: [], visited: [], parent: [] },
    autoPlayDurationMs: 6000,
  },
];
