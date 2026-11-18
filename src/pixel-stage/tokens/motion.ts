// Motion tokens (mục 4 của spec). Mọi thời lượng trong engine lấy từ đây.
export const spriteFps = 10;

export const dur = { xs: 120, sm: 250, md: 500, lg: 900 } as const;
export type DurToken = keyof typeof dur;

/** Khi Play: dừng ở trạng thái cuối mỗi step để kịp đọc caption (theo độ dài caption), rồi mới sang step sau. */
export const hold = { min: 1400, perChar: 20, max: 3400 } as const;
export const holdFor = (caption: string): number => Math.min(hold.max, Math.max(hold.min, caption.length * hold.perChar));

/** Hệ số tốc độ toàn cục. */
export const speeds = [0.5, 1, 2] as const;
export type Speed = (typeof speeds)[number];

/** Thời lượng mặc định của từng loại action (null = tức thời). */
export const actionDur = {
  move: "md", anim: null, spawn: "sm", despawn: "sm", say: "sm", label: "xs",
  highlight: "sm", emit: "lg", timer: "sm", set: null, camera: "lg", wait: "md", sound: null,
} as const satisfies Record<string, DurToken | null>;

/** Nhịp nền của thế giới DJ (loa nhún, đèn quét). Step vẫn do Prev / Next điều khiển. */
export const bpm = 100;
export const beatMs = 60_000 / bpm;

/** Chu kỳ ambient (2–120 s), lệch pha bằng rng có seed. */
export const ambient = {
  sway: 2400, // ticket lắc
  steam: 2000, // một làn khói bay hết
  flicker: 3200, // đèn ấm chập chờn
  clock: 60_000, // kim phút đồng hồ treo tường quay 1 vòng
  dust: 7000, // hạt bụi trôi trong phòng trống
} as const;

/** Chuyển cảnh vào / ra thế giới pixel: editor phóng ra rồi cảnh hiện dần từ khối thô tới pixel thật (pixelate). */
export const transition = {
  zoom: dur.md, // khung code phóng lên và mờ đi
  pixelate: 700, // khối mosaic thu nhỏ dần về 1px
  mosaic: [24, 16, 12, 8, 6, 4, 3, 2, 1], // cỡ khối (px logic) qua từng nấc
} as const;

/** Bước thời gian tối đa của một khung (khung giật dài không làm animation nhảy cóc). */
export const maxFrameDt = 100;

/** Nháy highlight: bật/tắt mỗi dur.xs, nháy 3 lần rồi sáng đều. */
export const blinkCount = 3;
