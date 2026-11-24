import {
  checkHostCapacity,
  formatMemoryFlag,
  MIN_MEMORY_MIB,
  parseMemory,
} from './host-capacity';

const GIB = 1024 ** 3;

describe('parseMemory', () => {
  it.each([
    ['1g', 1024, '1g'],
    ['1G', 1024, '1g'],
    ['1.5g', 1536, '1536m'],
    ['1536m', 1536, '1536m'],
    ['1536M', 1536, '1536m'],
    ['2gb', 2048, '2g'],
    ['512mb', 512, '512m'],
    ['  2g  ', 2048, '2g'],
    ['0.25g', 256, '256m'],
    ['1024m', 1024, '1g'], // bội của 1 GiB giữ dạng cũ "1g"
  ])('%j → %d MiB, cờ docker %j', (raw, mib, flag) => {
    expect(parseMemory(raw)).toEqual({ mib, flag });
  });

  it.each(['', '1', '1024', 'g', '1.5', '1x', '-1g', '1 g m', 'abc', '1,5g'])(
    'từ chối %j (thiếu đơn vị / sai định dạng)',
    (raw) => {
      expect(() => parseMemory(raw)).toThrow(/PY_RUN_MEMORY/);
    },
  );

  it('từ chối giá trị nhỏ hơn mức tối thiểu để Python khởi động được', () => {
    expect(() => parseMemory(`${MIN_MEMORY_MIB - 1}m`)).toThrow(/quá nhỏ/);
    expect(parseMemory(`${MIN_MEMORY_MIB}m`).mib).toBe(MIN_MEMORY_MIB);
  });

  it('formatMemoryFlag: bội của 1 GiB → g, còn lại → m', () => {
    expect(formatMemoryFlag(2048)).toBe('2g');
    expect(formatMemoryFlag(1536)).toBe('1536m');
  });
});

describe('checkHostCapacity', () => {
  const base = { slots: 4, memoryMiB: 1536, ncpu: 4, memTotalBytes: 8 * GIB };

  it('đúng ví dụ VM 4 nhân, 8 GB: 4 bài × 1.5g + 1.5 GB = 7.5 GB ≤ 8 GB → ổn', () => {
    const r = checkHostCapacity(base);
    expect(r.status).toBe('ok');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('đúng bằng ngưỡng thì vẫn ổn, vượt 1 byte là từ chối', () => {
    const exact = 4 * 1536 * 1024 ** 2 + 1.5 * GIB;
    expect(checkHostCapacity({ ...base, memTotalBytes: exact }).status).toBe(
      'ok',
    );
    expect(
      checkHostCapacity({ ...base, memTotalBytes: exact - 1 }).status,
    ).toBe('insufficient');
  });

  it('thiếu RAM: báo MỌI con số và gợi ý giảm', () => {
    const r = checkHostCapacity({ ...base, memTotalBytes: 6 * GIB });
    expect(r.status).toBe('insufficient');
    const msg = r.errors.join(' ');
    expect(msg).toContain('PY_RUN_MAX_CONCURRENT=4');
    expect(msg).toContain('PY_RUN_MEMORY=1536m');
    expect(msg).toContain('6.0 GiB'); // 4 × 1.5
    expect(msg).toContain('7.5 GiB'); // cần
    expect(msg).toContain('6.0 GiB'); // có
    // (6 − 1.5) / 1.5 = 3 bài; (6 − 1.5) / 4 = 1152 MiB
    expect(msg).toContain('tối đa 3');
    expect(msg).toContain('1152m');
  });

  it('máy quá nhỏ cho cả một bài thì không gợi ý giảm số bài', () => {
    const r = checkHostCapacity({
      slots: 1,
      memoryMiB: 4096,
      ncpu: 2,
      memTotalBytes: 2 * GIB,
    });
    expect(r.status).toBe('insufficient');
    expect(r.errors[0]).not.toContain('giảm PY_RUN_MAX_CONCURRENT');
    expect(r.errors[0]).toContain('cấp thêm RAM');
  });

  it('PY_RUN_MAX_CONCURRENT > 1.5 × số nhân: CHỈ cảnh báo, vẫn ổn', () => {
    const r = checkHostCapacity({
      slots: 7,
      memoryMiB: 512,
      ncpu: 4,
      memTotalBytes: 16 * GIB,
    });
    expect(r.status).toBe('ok');
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain('PY_RUN_MAX_CONCURRENT=7');
    expect(r.warnings[0]).toContain('4 nhân');
  });

  it('đúng 1.5 × số nhân thì không cảnh báo', () => {
    const r = checkHostCapacity({
      slots: 6,
      memoryMiB: 512,
      ncpu: 4,
      memTotalBytes: 16 * GIB,
    });
    expect(r.warnings).toEqual([]);
  });

  it('thiếu RAM VÀ quá nhân: có cả lỗi lẫn cảnh báo', () => {
    const r = checkHostCapacity({
      slots: 10,
      memoryMiB: 1024,
      ncpu: 2,
      memTotalBytes: 4 * GIB,
    });
    expect(r.status).toBe('insufficient');
    expect(r.errors).toHaveLength(1);
    expect(r.warnings).toHaveLength(1);
  });

  it('máy của bạn (24 nhân, ~15.3 GiB): 4 bài × 1.5g qua; 10 bài × 1.5g thì không', () => {
    const mine = { ncpu: 24, memTotalBytes: 16_460_197_888 };
    expect(
      checkHostCapacity({ ...mine, slots: 4, memoryMiB: 1536 }).status,
    ).toBe('ok');
    expect(
      checkHostCapacity({ ...mine, slots: 10, memoryMiB: 1536 }).status,
    ).toBe('insufficient');
  });
});
