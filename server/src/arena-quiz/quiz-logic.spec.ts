import {
  QUESTION_MS,
  QUESTIONS_PER_MATCH,
  QUIZ_BANK,
  QUIZ_XP,
  REVEAL_MS,
  endAt,
  getQuizItem,
  phaseAt,
  pickQuestions,
  pointsFor,
  settleQuiz,
  timeline,
  type AnswerRec,
} from './quiz-logic';

const ans = (userId: number, qIndex: number, at: number): AnswerRec => ({
  userId,
  qIndex,
  choice: 0,
  correct: true,
  points: 100,
  at,
});

describe('quiz bank', () => {
  it('có đủ câu, id duy nhất, mỗi câu có code và output', () => {
    expect(QUIZ_BANK.length).toBeGreaterThanOrEqual(QUESTIONS_PER_MATCH * 4);
    expect(new Set(QUIZ_BANK.map((q) => q.id)).size).toBe(QUIZ_BANK.length);
    for (const q of QUIZ_BANK) {
      expect(q.code.length).toBeGreaterThan(0);
      expect(typeof q.output).toBe('string');
    }
  });
});

describe('pickQuestions', () => {
  it('5 câu khác nhau, 4 lựa chọn không trùng, đáp án đúng nằm đúng chỗ', () => {
    for (let k = 0; k < 50; k++) {
      const qs = pickQuestions();
      expect(qs).toHaveLength(QUESTIONS_PER_MATCH);
      expect(new Set(qs.map((q) => q.qid)).size).toBe(QUESTIONS_PER_MATCH);
      for (const q of qs) {
        expect(q.opts).toHaveLength(4);
        expect(new Set(q.opts).size).toBe(4);
        expect(q.opts[q.answer]).toBe(getQuizItem(q.qid)!.output);
      }
    }
  });
});

describe('timeline / phaseAt', () => {
  const P = [1, 2];
  it('không ai trả lời: mỗi câu 15 s + 3 s hiện đáp án', () => {
    const s = timeline(0, [], P);
    expect(s[0]).toEqual({ index: 0, openAt: 0, closeAt: QUESTION_MS, revealUntil: QUESTION_MS + REVEAL_MS });
    expect(s[1].openAt).toBe(QUESTION_MS + REVEAL_MS);
    expect(endAt(s)).toBe(5 * (QUESTION_MS + REVEAL_MS));
  });
  it('cả hai trả lời sớm thì câu đóng ngay, câu sau mở sớm hơn', () => {
    const s = timeline(0, [ans(1, 0, 2000), ans(2, 0, 4000)], P);
    expect(s[0].closeAt).toBe(4000);
    expect(s[1].openAt).toBe(4000 + REVEAL_MS);
  });
  it('mới một người trả lời: vẫn chờ hết giờ', () => {
    const s = timeline(0, [ans(1, 0, 2000)], P);
    expect(s[0].closeAt).toBe(QUESTION_MS);
  });
  it('các pha theo thời gian', () => {
    const s = timeline(1000, [], P);
    expect(phaseAt(s, 500).phase).toBe('countdown');
    expect(phaseAt(s, 1000)).toEqual({ phase: 'question', slot: s[0] });
    expect(phaseAt(s, 1000 + QUESTION_MS).phase).toBe('reveal');
    expect(phaseAt(s, 1000 + QUESTION_MS + REVEAL_MS)).toEqual({ phase: 'question', slot: s[1] });
    expect(phaseAt(s, endAt(s)).phase).toBe('done');
  });
});

describe('pointsFor', () => {
  it('sai 0 điểm; đúng 100 + 10/giây còn lại', () => {
    expect(pointsFor(false, 0)).toBe(0);
    expect(pointsFor(true, 0)).toBe(250);
    expect(pointsFor(true, 5000)).toBe(200);
    expect(pointsFor(true, 20000)).toBe(100);
  });
});

describe('settleQuiz', () => {
  const base = { hostId: 1, guestId: 2, hostRating: 1000, guestRating: 1000, hostCorrect: 3, guestCorrect: 2 };
  it('điểm cao hơn thắng, Elo ±16 khi bằng hạng, XP thắng/thua', () => {
    const s = settleQuiz({ ...base, hostScore: 600, guestScore: 400 });
    expect(s.winnerId).toBe(1);
    expect([s.hostDelta, s.guestDelta]).toEqual([16, -16]);
    expect([s.hostXp, s.guestXp]).toEqual([QUIZ_XP.win, QUIZ_XP.loss]);
  });
  it('bằng điểm là hoà', () => {
    const s = settleQuiz({ ...base, hostScore: 500, guestScore: 500 });
    expect(s.winnerId).toBeNull();
    expect(s.hostResult).toBe('draw');
    expect(s.hostDelta).toBe(0);
  });
  it('đầu hàng: người kia thắng dù ít điểm hơn', () => {
    const s = settleQuiz({ ...base, hostScore: 600, guestScore: 0, forfeiterId: 1 });
    expect(s.winnerId).toBe(2);
    expect(s.guestResult).toBe('win');
  });
  it('không tính điểm khi unscored hoặc cả hai không đúng câu nào', () => {
    expect(settleQuiz({ ...base, hostScore: 1, guestScore: 0, unscored: true }).hostResult).toBe('none');
    const z = settleQuiz({ ...base, hostCorrect: 0, guestCorrect: 0, hostScore: 0, guestScore: 0 });
    expect([z.hostDelta, z.hostXp, z.hostResult]).toEqual([0, 0, 'none']);
  });
  it('Elo không xuống dưới 0', () => {
    const s = settleQuiz({ ...base, hostRating: 10, guestRating: 5, hostScore: 600, guestScore: 100 });
    expect(s.guestDelta).toBe(-5);
  });
});
