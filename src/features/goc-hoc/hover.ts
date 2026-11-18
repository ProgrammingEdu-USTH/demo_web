/* Hover hai chiều giữa đồ vật và menu: port setOn(), menuHL(), lightRoute().
   Trạng thái hover nằm trong HoverStore (ngoài React): mỗi đồ vật, nhãn, mục menu tự đăng ký và chỉ render lại khi
   trạng thái sáng của chính nó đổi — như prototype chỉ bật/tắt class, thay vì render lại cả app mỗi lần rê chuột. */
import { createContext, useContext, useSyncExternalStore } from "react";
import { GROUPS, groupsLitBy, menuRouteOf, type GroupRoute, type ObjectGroup } from "./config/objects";
import type { ItemKey } from "./config/scene";
import type { Route } from "./types";

export type Hover =
  /** Rê chuột lên đồ vật: đồ vật sáng + mục menu tương ứng highlight */
  | { from: "object"; g: string }
  /** Focus bàn phím vào đồ vật: chỉ đồ vật sáng */
  | { from: "focus"; g: string }
  /** Rê lên mục menu (hoặc nút có data-go): các đồ vật của trang đó sáng */
  | { from: "menu"; r: GroupRoute }
  | null;

export interface HoverView {
  /** Nhóm đang sáng (setOn) — cũng là nhãn .tag đang hiện */
  groups: ReadonlySet<string>;
  /** Lớp đồ vật đang sáng (.item.on, .glowi.on) */
  keys: ReadonlySet<ItemKey>;
  /** Viền sáng cửa sổ */
  window: boolean;
  /** Đích có [data-go] được highlight (.hl) */
  hl: GroupRoute | null;
}

const byId = new Map(GROUPS.map((G) => [G.g, G]));
export const groupById = (g: string): ObjectGroup | undefined => byId.get(g);

export function hoverView(h: Hover): HoverView {
  const lit: ObjectGroup[] = !h ? [] : h.from === "menu" ? groupsLitBy(h.r) : [byId.get(h.g)].filter((G) => !!G);
  const hl = h?.from === "object" && byId.get(h.g) ? menuRouteOf(byId.get(h.g)!) : null;
  return {
    groups: new Set(lit.map((G) => G.g)),
    keys: new Set(lit.flatMap((G) => G.keys)),
    window: lit.some((G) => G.g === "window"),
    hl,
  };
}

const NONE = hoverView(null);

export class HoverStore {
  private h: Hover = null;
  private v: HoverView = NONE;
  private subs = new Set<() => void>();

  get = (): Hover => this.h;
  /** HoverView của trạng thái hiện tại; cùng object cho tới lần đổi sau (an toàn cho useSyncExternalStore). */
  view = (): HoverView => this.v;
  set = (next: Hover | ((h: Hover) => Hover)) => {
    const h = typeof next === "function" ? next(this.h) : next;
    if (h === this.h) return;
    this.h = h;
    this.v = h ? hoverView(h) : NONE;
    this.subs.forEach((f) => f());
  };
  subscribe = (f: () => void) => {
    this.subs.add(f);
    return () => void this.subs.delete(f);
  };
}

export const HoverContext = createContext<HoverStore | null>(null);

/** Đọc một giá trị suy ra từ HoverView; component chỉ render lại khi giá trị đó đổi. Ngoài Provider: không sáng gì. */
function useHoverSelect<T>(pick: (v: HoverView) => T): T {
  const store = useContext(HoverContext);
  const get = () => pick(store ? store.view() : NONE);
  return useSyncExternalStore(store ? store.subscribe : noopSubscribe, get, get);
}
const noopSubscribe = () => () => {};

/** Đồ vật k đang sáng (.item.on, .glowi.on) */
export const useLit = (k: ItemKey) => useHoverSelect((v) => v.keys.has(k));
/** Viền sáng hai cánh cửa sổ */
export const useLitWindow = () => useHoverSelect((v) => v.window);
/** Các nhóm đang sáng (nhãn .tag hiện) */
export const useLitGroups = () => useHoverSelect((v) => v.groups);
/** Nút [data-go] của route r đang được highlight (.hl) */
export const useIsHl = (r: Route) => useHoverSelect((v) => v.hl === r);
