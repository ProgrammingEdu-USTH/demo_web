/* Phần vẽ thêm trên lịch treo tường (nằm trong lớp đồ vật calendar để đung đưa cùng): thẻ chuỗi ngày và SVG ngày tháng. */
import { memo } from "react";
import { CALENDAR, ITEMS } from "../config/scene";
import { CalSvgContent, monthCells } from "./calendar";
import { useToday } from "./useClientValues";

const [ox, oy, ow, oh] = ITEMS.calendar;
const rc = CALENDAR.room.cells;
const cw = Math.hypot(rc[1][0] - rc[0][0], rc[1][1] - rc[0][1]);
const [p0, p1] = CALENDAR.room.pic;
const nx = (p0[0] + p1[0]) / 2 - ox;
const ny = (p0[1] + p1[1]) / 2 - oy;
const nw = (p1[0] - p0[0]) * 0.86;

/* memo: Item lịch nhận phần này qua children (element mới mỗi lần cảnh render), SVG lưới ngày không cần vẽ lại */
export const WallCalendar = memo(function WallCalendar({ streak }: { streak: number }) {
  const today = useToday();
  return (
    <>
      <div id="calNote" aria-hidden="true" style={{ left: nx, top: ny, ["--s" as string]: (nw / 150).toFixed(3) }}>
        <svg viewBox="0 0 24 24">
          <path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.6 1 2.5 2 3 0-3 0-6 1-8.5z" />
        </svg>
        <div>
          <b>{streak} ngày</b>
          <small>chuỗi học</small>
        </div>
      </div>
      <svg id="calSvg" viewBox={`${ox} ${oy} ${ow} ${oh}`} style={{ width: ow, height: oh }}>
        {today && (
          <CalSvgContent
            cells={CALENDAR.room.cells}
            labels={CALENDAR.room.labels}
            cw={cw}
            fs={cw * 0.34}
            month={monthCells(today, streak)}
            withIds
          />
        )}
      </svg>
    </>
  );
});
