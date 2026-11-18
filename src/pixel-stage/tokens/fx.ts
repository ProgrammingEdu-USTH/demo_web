// Tham số lớp hoàn thiện và ánh sáng (dùng chung mọi thế giới).
export const overlay = {
  grainDensity: 0.035, // tỉ lệ điểm ảnh có hạt mỗi khung
  grainAlpha: 0.08,
  vignette: [0.0, 0.07, 0.15], // mức tối theo vòng, dither 4×4
} as const;

/** Mức tối khi tắt đèn (0 = sáng hẳn, 1 = đen). Dither, không tô mờ. */
export const darkLevel = 0.5;

/** Phần thừa ngoài khung 320×180 khi canvas phủ toàn màn hình (fill "extend"):
 *  kéo dài mép cảnh rồi tối dần theo nấc (nấc trong cùng → ngoài cùng). */
export const letterbox = { bands: [0.28, 0.4, 0.52, 0.64] } as const;

/** Số hạt mặc định của action emit. */
export const emitCount = 6;
