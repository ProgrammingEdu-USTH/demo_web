// Trạng thái phía trình duyệt của trang Lộ trình (thay cho roadmap.js).
// Giữ NGUYÊN khoá localStorage v4 của bản cũ để người dùng không mất lộ trình đã ghim/tiến độ đã đánh dấu.
import { ROADMAP_DATA, ROADMAP_DETAILS, ROADMAP_LIST, type RoadmapDetail, type RoadmapResource } from '@/lib/roadmap-data';

export const CUSTOM_TAB = 'personal'; // tab "Tùy chỉnh" (canvas kéo-thả)
export const MY_TAB = '__my__'; // tab "Lộ trình của tôi" (sinh từ khảo sát)
export const DEFAULT_PINNED = ['frontend', 'backend', 'ai-engineer'];

const LS_PINNED = 'roadmap_pinned_v4';
const LS_ACTIVE = 'roadmap_active_v4';
const LS_PROGRESS = 'roadmap_progress_v4';
export const LS_SEEN_GENERATED = 'roadmap_generated_seen_v2';

export type Status = 'done' | 'active' | 'locked';
export const STATUS_LABEL: Record<Status, string> = { done: 'Đã học', active: 'Đang học', locked: 'Chưa học' };

export type Stage = {
  id: string;
  title: string;
  desc: string;
  /** Mô tả của chặng sinh từ khảo sát (backend trả HTML) — đã đổi sang văn bản thuần. */
  text?: string;
  topics: string[];
  course: string | null;
  res: RoadmapResource[];
};

export type EnrolledCourse = {
  id: string;
  title?: string;
  progress?: number;
  completedLessons?: number;
  totalLessons?: number;
  lessons?: number;
  timeSpent?: string;
};

export type MyRoadmap = {
  mermaid_def?: string;
  title?: string;
  icon?: string;
  nodes?: Record<string, { title?: string; desc?: string; course_id?: string }>;
};

export const listMeta = (id: string) => ROADMAP_LIST.find((r) => r.id === id);
export const isValidTab = (id: string) => id === CUSTOM_TAB || id === MY_TAB || !!listMeta(id);

function readJson<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null;
  } catch {
    return null;
  }
}
function writeLs(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* chế độ riêng tư / hết dung lượng: bỏ qua, trạng thái vẫn giữ trong bộ nhớ trang */
  }
}

export function loadPinned(): string[] {
  const v = readJson<unknown>(LS_PINNED);
  const list = (Array.isArray(v) ? (v as string[]) : DEFAULT_PINNED).filter((x) => typeof x === 'string' && isValidTab(x));
  return list.length ? list : [...DEFAULT_PINNED];
}
export const savePinned = (arr: string[]) => writeLs(LS_PINNED, JSON.stringify(arr));

export function loadActive(pinned: string[]): string {
  let id: string | null = null;
  try {
    id = localStorage.getItem(LS_ACTIVE);
  } catch {
    /* noop */
  }
  return id && isValidTab(id) ? id : (pinned[0] ?? DEFAULT_PINNED[0]);
}
export const saveActive = (id: string) => writeLs(LS_ACTIVE, id);

export type Overrides = Record<string, Status>;
export const loadOverrides = (): Overrides => readJson<Overrides>(LS_PROGRESS) ?? {};
export const saveOverrides = (o: Overrides) => writeLs(LS_PROGRESS, JSON.stringify(o));

/** Chặng tuyến tính của một lộ trình tĩnh (id 's0','s1',… theo thứ tự). */
export function stagesOf(rmId: string): Stage[] {
  return (ROADMAP_DATA[rmId] ?? []).map((s, i) => ({
    id: `s${i}`,
    title: s.title,
    desc: s.desc ?? '',
    topics: s.topics ?? [],
    course: s.course ?? null,
    res: s.res ?? [],
  }));
}

/** Sắp node id theo số thực (rm_2 < rm_10), không theo alphabet. */
function sortNodeIds(ids: string[]): string[] {
  const num = (s: string) => parseInt(s.replace(/\D/g, ''), 10) || 0;
  return ids.slice().sort((a, b) => num(a) - num(b));
}

/**
 * HTML do backend sinh → văn bản thuần. Không render HTML thô vào trang (tránh XSS nếu template có
 * thẻ lạ); ngắt dòng của <br>/<p>/<li> được giữ lại bằng \n.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function stagesOfMine(my: MyRoadmap): Stage[] {
  const nodes = my.nodes ?? {};
  return sortNodeIds(Object.keys(nodes)).map((nid) => {
    const d = nodes[nid] ?? {};
    return { id: nid, title: d.title || nid, desc: '', text: d.desc ? htmlToText(d.desc) : '', topics: [], course: d.course_id || null, res: [] };
  });
}

/** Tra mô tả/tài nguyên dự phòng theo tên chặng (cho chặng sinh từ khảo sát không có sẵn dữ liệu). */
export function detailByLabel(label: string): RoadmapDetail | null {
  const key = label.toLowerCase().trim().replace(/^\d+[.)]\s*/, '');
  return ROADMAP_DETAILS[key] ?? null;
}

/** Số khoá học nền tảng (course id duy nhất) mà một lộ trình gắn tới. */
export function countCourses(rmId: string): number {
  return new Set((ROADMAP_DATA[rmId] ?? []).map((s) => s.course).filter(Boolean)).size;
}
