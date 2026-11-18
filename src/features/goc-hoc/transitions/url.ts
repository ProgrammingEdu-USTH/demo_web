/* Đồng bộ trang con với URL: ?p=<trang>, thêm &shelf=&lesson= cho bài học và &tab= cho điện thoại.
   Cùng route "/", dùng History API (Next.js hỗ trợ pushState/replaceState gốc mà không tải lại trang). */
import { ROUTES } from "../config/objects";
import { SHELVES } from "../config/shelves";
import type { GoOpts } from "../targets";
import type { PhoneTab, Route } from "../types";

export interface Dest {
  route: Route;
  opts: GoOpts;
}

const MARK = "gocHoc";

export function destToQuery({ route, opts }: Dest): string {
  const q = new URLSearchParams({ p: route });
  if (route === "learn" && opts.shelf !== undefined && opts.lesson !== undefined) {
    q.set("shelf", String(opts.shelf));
    q.set("lesson", String(opts.lesson));
  }
  if (route === "phone" && opts.tab) q.set("tab", opts.tab);
  return "?" + q.toString();
}

/** Đọc đích từ URL hiện tại; trang/bài không hợp lệ (hoặc bài chưa mở) thì bỏ qua phần đó. */
export function parseLocation(search: string): Dest | null {
  const q = new URLSearchParams(search);
  const p = q.get("p") as Route | null;
  if (!p || !ROUTES.includes(p)) return null;
  const opts: GoOpts = {};
  if (p === "learn") {
    const s = Number(q.get("shelf")), l = Number(q.get("lesson"));
    const lesson = Number.isInteger(s) && Number.isInteger(l) ? SHELVES[s]?.lessons[l] : undefined;
    if (q.has("shelf") && lesson && lesson[1] !== "lock") Object.assign(opts, { shelf: s, lesson: l });
  }
  if (p === "phone") {
    const t = q.get("tab");
    if (t === "me" || t === "rank") opts.tab = t as PhoneTab;
  }
  return { route: p, opts };
}

/** Hai đích có trỏ cùng một trang (cùng bài, cùng tab) không. */
export const sameDest = (a: Dest | null, b: Dest | null) =>
  a === b || (!!a && !!b && destToQuery(a) === destToQuery(b));

const baseUrl = () => window.location.pathname + window.location.hash;

/** Mở trang: thêm một mục lịch sử (đánh dấu là do Góc học thêm). */
export const pushDest = (d: Dest) => window.history.pushState({ ...window.history.state, [MARK]: true }, "", destToQuery(d));
/** Đổi trang con bằng tab: thay mục hiện tại, để nút back vẫn về phòng. */
export const replaceDest = (d: Dest | null) =>
  window.history.replaceState({ ...window.history.state }, "", d ? destToQuery(d) : baseUrl());
/** Mục lịch sử hiện tại do Góc học thêm (có mục "phòng" phía trước để back về). */
export const currentEntryIsOurs = () => !!(window.history.state as Record<string, unknown> | null)?.[MARK];
