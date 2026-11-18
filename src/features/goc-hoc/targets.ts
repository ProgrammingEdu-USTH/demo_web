/* Đích khi bấm đồ vật hoặc mục menu: port activate() và các handler data-go của prototype.
   Engine chuyển cảnh chưa có nên tạm thời chỉ log đích ra console. */
import { GROUPS, MENU_PICK, pickKeyOf, type GroupRoute } from "./config/objects";
import type { ItemKey } from "./config/scene";
import { SHELVES } from "./config/shelves";
import type { PhoneTab, Route } from "./types";

export interface GoOpts {
  tab?: PhoneTab;
  pick?: ItemKey;
  shelf?: number;
  lesson?: number;
  from?: "book";
}

export type Target =
  | { kind: "go"; route: Route; opts: GoOpts }
  | { kind: "window" }
  | { kind: "peek-calendar" }
  | { kind: "sip" }
  /** Sách chưa mở: prototype hiện toast với nội dung này */
  | { kind: "locked"; message: string };

const ROUTE_SET = new Set<GroupRoute>(["learn", "roadmap", "courses", "practice", "achievements", "phone"]);
const isRoute = (r: GroupRoute): r is Route => ROUTE_SET.has(r);

/** Bấm đồ vật trong phòng (activate). clicked: key của polygon được bấm (để biết cúp/huy chương nào). */
export function objectTarget(g: string, clicked?: ItemKey | null): Target | null {
  const G = GROUPS.find((x) => x.g === g);
  if (!G) return null;
  if (G.route === "window") return { kind: "window" };
  if (G.route === "calendar") return { kind: "peek-calendar" };
  if (G.route === "mug") return { kind: "sip" };
  if (G.route === "book") {
    const S = SHELVES[G.shelf!];
    const i = G.lesson!;
    if (G.state === "lock") return { kind: "locked", message: `${S.short}: học xong Bài ${i} để mở “${S.lessons[i][0]}”` };
    return { kind: "go", route: "learn", opts: { shelf: G.shelf, lesson: i, from: "book", pick: G.keys[0] } };
  }
  if (!isRoute(G.route)) return null;
  const pick = pickKeyOf(G, clicked);
  return { kind: "go", route: G.route, opts: { ...(G.route === "phone" ? { tab: "me" as const } : {}), ...(pick ? { pick } : {}) } };
}

/** Bấm mục menu / nút có data-go. tab: data-tab của nút (Bảng xếp hạng = rank). */
export function menuTarget(r: Route, tab?: PhoneTab): Target {
  if (r === "phone") return { kind: "go", route: r, opts: { tab: tab ?? "rank", pick: MENU_PICK.phone } };
  if (r === "practice") return { kind: "go", route: r, opts: { pick: MENU_PICK.practice } };
  return { kind: "go", route: r, opts: {} };
}

/** Bấm avatar: mở Hồ sơ trên điện thoại. */
export const profileTarget: Target = { kind: "go", route: "phone", opts: { tab: "me", pick: "phone" } };

export function logTarget(source: string, t: Target | null) {
  console.log(`[Góc học] ${source} →`, t);
}
