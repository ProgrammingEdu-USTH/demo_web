/* Hiệu ứng hiện/ẩn của từng trang con; trang không khai báo thì dùng DEFAULT_FX. */
import type { Route } from "../../types";
import { ACHIEVEMENTS_FX } from "./achievements";
import { DEFAULT_FX, type PageFx } from "./base";
import { COURSES_FX } from "./courses";
import { LEARN_FX } from "./learn";
import { PHONE_FX } from "./phone";
import { PRACTICE_FX } from "./practice";
import { ROADMAP_FX } from "./roadmap";

export type { FxCtx, PageFx } from "./base";

const PAGE_FX: Record<Route, Partial<PageFx>> = {
  learn: LEARN_FX,
  roadmap: ROADMAP_FX,
  courses: COURSES_FX,
  practice: PRACTICE_FX,
  achievements: ACHIEVEMENTS_FX,
  phone: PHONE_FX,
};

export const fxFor = (r: Route): PageFx => ({ ...DEFAULT_FX, ...PAGE_FX[r] });
