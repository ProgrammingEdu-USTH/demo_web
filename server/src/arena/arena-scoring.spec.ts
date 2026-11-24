import {
  computeOutcome,
  eloDelta,
  expectedScore,
  settleMatch,
  type BestSubmission,
} from './arena-scoring';

const t = (sec: number) => new Date(Date.UTC(2026, 9, 17, 0, 0, sec));
const best = (passed: number, sec: number, id = 1): BestSubmission => ({
  passed,
  createdAt: t(sec),
  id,
});
const H = 1;
const G = 2;
const base = { hostId: H, guestId: G };

describe('computeOutcome', () => {
  it('hết giờ: nhiều test đạt hơn thắng', () => {
    expect(
      computeOutcome({
        ...base,
        reason: 'timeout',
        hostBest: best(3, 10),
        guestBest: best(5, 50),
      }),
    ).toEqual({ winnerId: G, isDraw: false });
  });

  it('bằng số test (>0): nộp sớm hơn thắng', () => {
    expect(
      computeOutcome({
        ...base,
        reason: 'timeout',
        hostBest: best(4, 90),
        guestBest: best(4, 20),
      }),
    ).toEqual({ winnerId: G, isDraw: false });
    expect(
      computeOutcome({
        ...base,
        reason: 'timeout',
        hostBest: best(4, 20),
        guestBest: best(4, 90),
      }),
    ).toEqual({ winnerId: H, isDraw: false });
  });

  it('bằng nhau tuyệt đối (cùng passed và createdAt) -> hoà', () => {
    expect(
      computeOutcome({
        ...base,
        reason: 'timeout',
        hostBest: best(4, 20, 1),
        guestBest: best(4, 20, 2),
      }),
    ).toEqual({ winnerId: null, isDraw: true });
  });

  it('cả hai 0 test (hoặc chưa nộp) -> hoà', () => {
    expect(
      computeOutcome({
        ...base,
        reason: 'timeout',
        hostBest: null,
        guestBest: null,
      }),
    ).toEqual({ winnerId: null, isDraw: true });
    expect(
      computeOutcome({
        ...base,
        reason: 'timeout',
        hostBest: best(0, 5),
        guestBest: best(0, 1),
      }),
    ).toEqual({ winnerId: null, isDraw: true });
  });

  it('một bên 0 một bên >0: bên >0 thắng', () => {
    expect(
      computeOutcome({
        ...base,
        reason: 'timeout',
        hostBest: null,
        guestBest: best(1, 10),
      }),
    ).toEqual({ winnerId: G, isDraw: false });
  });

  it('solved: người giải xong thắng ngay', () => {
    expect(
      computeOutcome({
        ...base,
        reason: 'solved',
        solverId: H,
        hostBest: best(10, 5),
        guestBest: best(9, 1),
      }),
    ).toEqual({ winnerId: H, isDraw: false });
  });

  describe('forfeit (chống cày điểm)', () => {
    const started = new Date('2026-01-01T00:00:00Z');
    const at = (sec: number) => new Date(started.getTime() + sec * 1000);
    const forfeit = (over: object) =>
      computeOutcome({
        ...base,
        reason: 'forfeit',
        forfeiterId: G,
        startedAt: started,
        now: at(120),
        hostBest: best(1, 1),
        guestBest: null,
        ...over,
      });

    it('người thắng có passed >= 1 và trận >= 60 s -> tính điểm', () => {
      expect(forfeit({})).toEqual({
        winnerId: H,
        isDraw: false,
        unscored: false,
      });
      expect(forfeit({ now: at(60) }).unscored).toBe(false);
      expect(
        forfeit({
          forfeiterId: H,
          hostBest: null,
          guestBest: best(3, 1),
        }),
      ).toEqual({ winnerId: G, isDraw: false, unscored: false });
    });

    it('trận < 60 s -> vẫn có người thắng nhưng không tính điểm', () => {
      expect(forfeit({ now: at(59) })).toEqual({
        winnerId: H,
        isDraw: false,
        unscored: true,
      });
    });

    it('người thắng chưa có bài passed >= 1 -> không tính điểm', () => {
      expect(forfeit({ hostBest: null }).unscored).toBe(true);
      expect(forfeit({ hostBest: best(0, 1) }).unscored).toBe(true);
    });

    it('thiếu startedAt/now -> không tính điểm', () => {
      expect(forfeit({ startedAt: null }).unscored).toBe(true);
    });

    it('settleMatch: unscored -> delta 0, XP 0, không thống kê', () => {
      const s = settleMatch({
        winnerId: H,
        isDraw: false,
        unscored: true,
        hostId: H,
        hostRating: 1200,
        guestRating: 1000,
        hostPassed: 5,
        guestPassed: 0,
      });
      expect(s).toMatchObject({
        hostDelta: 0,
        guestDelta: 0,
        hostXp: 0,
        guestXp: 0,
        hostResult: 'none',
        guestResult: 'none',
        hostNewRating: 1200,
        guestNewRating: 1000,
      });
    });
  });

  it('id không hợp lệ -> ném lỗi', () => {
    expect(() =>
      computeOutcome({
        ...base,
        reason: 'solved',
        solverId: 99,
        hostBest: null,
        guestBest: null,
      }),
    ).toThrow();
    expect(() =>
      computeOutcome({
        ...base,
        reason: 'forfeit',
        hostBest: null,
        guestBest: null,
      }),
    ).toThrow();
  });
});

describe('Elo', () => {
  it('ngang rating: thắng +16, thua -16, hoà 0', () => {
    expect(eloDelta(1000, 1000, 1)).toBe(16);
    expect(eloDelta(1000, 1000, 0)).toBe(-16);
    expect(eloDelta(1000, 1000, 0.5)).toBe(0);
  });

  it('kỳ vọng đối xứng cộng lại bằng 1', () => {
    expect(expectedScore(1200, 1000) + expectedScore(1000, 1200)).toBeCloseTo(
      1,
    );
  });

  it('thắng người mạnh hơn nhận nhiều hơn', () => {
    expect(eloDelta(1000, 1400, 1)).toBeGreaterThan(eloDelta(1000, 1000, 1));
    expect(eloDelta(1400, 1000, 1)).toBeLessThan(16);
  });
});

describe('settleMatch', () => {
  const s = (over: Partial<Parameters<typeof settleMatch>[0]>) =>
    settleMatch({
      hostId: H,
      winnerId: H,
      isDraw: false,
      hostRating: 1000,
      guestRating: 1000,
      hostPassed: 10,
      guestPassed: 2,
      ...over,
    });

  it('thắng: delta đối xứng, XP 50 / 10', () => {
    const r = s({});
    expect(r.hostDelta).toBe(16);
    expect(r.guestDelta).toBe(-16);
    expect(r.hostDelta + r.guestDelta).toBe(0);
    expect(r.hostXp).toBe(50);
    expect(r.guestXp).toBe(10);
    expect(r.hostResult).toBe('win');
    expect(r.guestResult).toBe('loss');
  });

  it('thua không có test nào đạt: XP 0', () => {
    const r = s({ winnerId: H, guestPassed: 0 });
    expect(r.guestXp).toBe(0);
  });

  it('delta đối xứng với nhiều cặp rating', () => {
    for (const [a, b] of [
      [1000, 1000],
      [1500, 900],
      [800, 1600],
      [1234, 1237],
    ]) {
      for (const winnerId of [H, G]) {
        const r = s({ hostRating: a, guestRating: b, winnerId });
        expect(r.hostDelta + r.guestDelta).toBe(0);
      }
    }
  });

  it('hoà có test: S=0.5, XP 20 mỗi bên; rating cao hơn mất điểm', () => {
    const r = s({
      winnerId: null,
      isDraw: true,
      hostRating: 1200,
      guestRating: 1000,
      hostPassed: 3,
      guestPassed: 3,
    });
    expect(r.hostDelta).toBeLessThan(0);
    expect(r.guestDelta).toBe(-r.hostDelta);
    expect(r.hostXp).toBe(20);
    expect(r.guestXp).toBe(20);
    expect(r.hostResult).toBe('draw');
  });

  it('hoà 0-0: không đổi rating, không thống kê, không XP', () => {
    const r = s({
      winnerId: null,
      isDraw: true,
      hostRating: 1300,
      guestRating: 900,
      hostPassed: 0,
      guestPassed: 0,
    });
    expect(r).toMatchObject({
      hostDelta: 0,
      guestDelta: 0,
      hostNewRating: 1300,
      guestNewRating: 900,
      hostXp: 0,
      guestXp: 0,
      hostResult: 'none',
      guestResult: 'none',
    });
  });

  it('sàn rating 0: delta lưu là delta thực tế sau khi chặn sàn', () => {
    const r = s({ hostRating: 10, guestRating: 10, winnerId: H });
    expect(r.guestNewRating).toBe(0);
    expect(r.guestDelta).toBe(-10);
    expect(r.hostDelta).toBeGreaterThan(0);
    const z = s({ hostRating: 1000, guestRating: 0, winnerId: H });
    expect(z.guestNewRating).toBe(0);
    expect(z.guestDelta).toBe(0);
  });

  it('forfeit coi như thua: khách thắng, XP thua theo test đạt', () => {
    const r = s({ winnerId: G, hostPassed: 0, guestPassed: 0 });
    expect(r.hostResult).toBe('loss');
    expect(r.guestXp).toBe(50);
    expect(r.hostXp).toBe(0);
  });
});
