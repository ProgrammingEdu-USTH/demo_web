// Tham số âm tổng hợp bằng WebAudio (không dùng file âm thanh). Thời gian tính bằng giây.
export const audio = {
  master: 0.35,
  kick: { from: 150, to: 42, dur: 0.32 },
  snare: { tone: 190, dur: 0.18, noiseHz: 1800 },
  hat: { dur: 0.06, noiseHz: 7000 },
  ding: { tone: 1320, dur: 0.6 },
} as const;
