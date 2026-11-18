/* Lịch: ngày của tháng này, chuỗi ngày học khoanh đỏ, vòng hôm nay riêng. Port ringPath(), monthCells(), calSVG(). */
import { Fragment } from "react";
import type { Point } from "../config/scene";

/** Vòng khoanh tay quanh (cx, cy), bán kính rx, ry. */
export function ringPath(cx: number, cy: number, rx: number, ry: number): string {
  const k = rx / 16, j = ry / 10, f = (v: number) => v.toFixed(1);
  return `M${f(cx - 16 * k)} ${f(cy - 2 * j)}c${f(6 * k)} ${f(-11 * j)} ${f(26 * k)} ${f(-12 * j)} ${f(32 * k)} ${f(-1 * j)} ${f(5 * k)} ${f(10 * j)} ${f(-6 * k)} ${f(18 * j)} ${f(-18 * k)} ${f(17 * j)} ${f(-11 * k)} ${f(-1 * j)} ${f(-17 * k)} ${f(-8 * j)} ${f(-13 * k)} ${f(-17 * j)}`;
}

export interface MonthCell {
  /** Ngày trong tháng */
  d: number;
  /** Ô trong lưới 5×7 (T2 đầu tuần); ngày tràn ô 35 quay lên hàng đầu */
  i: number;
  st: "" | "streak" | "today";
}

export function monthCells(now: Date, streak: number): MonthCell[] {
  const y = now.getFullYear(), m = now.getMonth(), today = now.getDate();
  const first = (new Date(y, m, 1).getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
  const out: MonthCell[] = [];
  for (let d = 1; d <= days; d++) {
    let i = first + d - 1;
    if (i > 34) i -= 7;
    out.push({ d, i, st: d === today ? "today" : d < today && d >= today - streak ? "streak" : "" });
  }
  return out;
}

const DAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

/** Bản chuỗi của CalSvgContent (calSVG() của prototype), cho tờ lịch phóng to dựng ngoài cây React trong lớp #held. */
export function calSvgMarkup(cells: readonly Point[], labels: readonly Point[], cw: number, fs: number, month: readonly MonthCell[]): string {
  let s = labels.map((p, i) => `<text class="cl" x="${p[0]}" y="${p[1]}" font-size="${fs * 0.9}">${DAY_LABELS[i]}</text>`).join("");
  for (const c of month) {
    const [x, y] = cells[c.i];
    s += `<text class="cd${c.st ? " on" : ""}" x="${(x - cw * 0.36).toFixed(1)}" y="${(y - cw * 0.12).toFixed(1)}" font-size="${fs}">${c.d}</text>`;
    if (c.st) s += `<path class="ring ${c.st}" pathLength="100" d="${ringPath(x, y + cw * 0.04, cw * 0.42, cw * 0.36)}"/>`;
  }
  return s;
}

interface CalSvgProps {
  cells: readonly Point[];
  labels: readonly Point[];
  cw: number;
  fs: number;
  month: readonly MonthCell[];
  /** Gắn id="calPath" cho vòng hôm nay (bản lịch trong phòng) */
  withIds?: boolean;
}

/** Nội dung SVG của lịch (nhãn thứ, số ngày, vòng khoanh). */
export function CalSvgContent({ cells, labels, cw, fs, month, withIds }: CalSvgProps) {
  return (
    <>
      {labels.map((p, i) => (
        <text key={`l${i}`} className="cl" x={p[0]} y={p[1]} fontSize={fs * 0.9}>
          {DAY_LABELS[i]}
        </text>
      ))}
      {month.map((c) => {
        const [x, y] = cells[c.i];
        return (
          <Fragment key={c.d}>
            <text className={`cd${c.st ? " on" : ""}`} x={(x - cw * 0.36).toFixed(1)} y={(y - cw * 0.12).toFixed(1)} fontSize={fs}>
              {c.d}
            </text>
            {c.st && (
              <path
                className={`ring ${c.st}`}
                pathLength={100}
                id={withIds && c.st === "today" ? "calPath" : undefined}
                d={ringPath(x, y + cw * 0.04, cw * 0.42, cw * 0.36)}
              />
            )}
          </Fragment>
        );
      })}
    </>
  );
}
