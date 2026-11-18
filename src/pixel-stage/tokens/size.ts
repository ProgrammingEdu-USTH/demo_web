// Kích thước logic (px của buffer 320×180).
export const stageW = 320;
export const stageH = 180;
export const tile = 16;
export const actorSize = 32;
export const propSize = 16;

/** Font pixel: thân chữ 5 hàng, dòng 9 hàng (2 hàng dấu phía trên, 1 hàng chân/ dấu nặng phía dưới). */
export const font = { body: 5, ascent: 3, descent: 2, gap: 1, space: 2 } as const;
export const lineH = font.ascent + font.body + font.descent - 1;

export const bubble = { maxW: 96, pad: 3, tail: 3, gap: 2 } as const;
export const plate = { padX: 2, padY: 2, gap: 2 } as const;

/** Tay cầm đồ của nhân vật, tính từ chân (dùng khi đặt anchor "*.hand"). */
export const hand = { dx: 9, dy: -13 } as const;
