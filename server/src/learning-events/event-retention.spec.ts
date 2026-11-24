import {
  DEFAULT_HEARTBEAT_DAYS,
  DEFAULT_KEEP_DAYS,
  dayAlignedCutoff,
  parseDaysFlag,
} from './event-retention';

describe('dayAlignedCutoff', () => {
  it('trả về 00:00 UTC, bất kể giờ trong ngày của now', () => {
    const sang = dayAlignedCutoff(new Date('2026-11-15T00:00:01Z'), 7);
    const toi = dayAlignedCutoff(new Date('2026-11-15T23:59:59Z'), 7);
    expect(sang.toISOString()).toBe('2026-11-08T00:00:00.000Z');
    // Hai lần chạy cùng ngày phải ra CÙNG mốc: đây là thứ chống đếm một phút hai lần.
    expect(toi.getTime()).toBe(sang.getTime());
  });

  it('lùi đúng số ngày, qua ranh giới tháng và năm', () => {
    expect(
      dayAlignedCutoff(new Date('2026-03-02T10:00:00Z'), 3).toISOString(),
    ).toBe('2026-02-27T00:00:00.000Z');
    expect(
      dayAlignedCutoff(new Date('2027-01-02T10:00:00Z'), 5).toISOString(),
    ).toBe('2026-12-28T00:00:00.000Z');
  });

  it('theo UTC, không theo múi giờ máy: 23:30 UTC vẫn là ngày hôm đó', () => {
    expect(
      dayAlignedCutoff(new Date('2026-11-15T23:30:00Z'), 1).toISOString(),
    ).toBe('2026-11-14T00:00:00.000Z');
  });
});

describe('parseDaysFlag', () => {
  it('thiếu cờ thì lấy mặc định', () => {
    expect(parseDaysFlag([], '--keep-days', DEFAULT_KEEP_DAYS)).toBe(90);
    expect(
      parseDaysFlag(['--apply'], '--heartbeat-days', DEFAULT_HEARTBEAT_DAYS),
    ).toBe(7);
  });

  it('đọc đúng giá trị', () => {
    expect(parseDaysFlag(['--keep-days=30'], '--keep-days', 90)).toBe(30);
  });

  it('không nhầm hai cờ có tiền tố giống nhau', () => {
    const argv = ['--keep-days=30', '--keep-days-x=5'];
    expect(parseDaysFlag(argv, '--keep-days', 90)).toBe(30);
  });

  it.each(['0', '-1', '1.5', 'abc', '', '7d'])('từ chối %j', (v) => {
    expect(() =>
      parseDaysFlag([`--keep-days=${v}`], '--keep-days', 90),
    ).toThrow('--keep-days');
  });
});
