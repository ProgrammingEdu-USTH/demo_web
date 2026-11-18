/* Cửa vào cho thông báo mới: gọi pushNote(note) từ bất kỳ đâu (sau này là socket/poll backend).
   Lớp ghi chú trong phòng đăng ký nhận khi đã hiện; ghi chú đẩy vào trước đó được giữ lại và dán khi lớp sẵn sàng. */
import type { StickyNote } from "../types";

type Listener = (note: StickyNote) => void;

let listener: Listener | null = null;
const queue: StickyNote[] = [];

/** Dán một tờ ghi chú mới dưới cửa sổ (bay vào, điện thoại rung, chuông lắc). Đủ 4 tờ thì tờ cũ nhất bị bóc ra. */
export function pushNote(note: StickyNote): void {
  if (listener) listener(note);
  else queue.push(note);
}

/** Lớp ghi chú đăng ký nhận; trả về hàm huỷ đăng ký. */
export function subscribeNotes(fn: Listener): () => void {
  listener = fn;
  queue.splice(0).forEach(fn);
  return () => {
    if (listener === fn) listener = null;
  };
}
