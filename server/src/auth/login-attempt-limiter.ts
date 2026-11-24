/**
 * Hạn mức đăng nhập sai THEO TÀI KHOẢN (5 lần / 15 phút), bổ sung cho hạn mức theo IP của
 * throttler. Theo IP một mình không đủ: cả lớp chung một IP thì phải để ngưỡng IP cao, và khi đó
 * kẻ đoán mật khẩu một email cụ thể gần như không bị chặn.
 *
 * shortcut: bộ nhớ của MỘT tiến trình (Render chạy 1 bản). Chạy N bản thì mỗi bản đếm riêng
 * (ngưỡng thực = N×5) — khi đó chuyển sang bảng/Redis. Khoá theo định danh người gõ (đã chuẩn hoá)
 * kể cả khi tài khoản không tồn tại, để không lộ email nào có thật; đổi lại, ai đó có thể cố ý
 * khoá email của người khác trong 15 phút (đánh đổi quen thuộc của kiểu chặn này).
 */
export class LoginAttemptLimiter {
  private readonly attempts = new Map<
    string,
    { fails: number; resetAt: number }
  >();

  constructor(
    private readonly maxFails = 5,
    private readonly windowMs = 15 * 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  /** Số giây còn bị khoá, 0 nếu được thử. */
  lockedForSeconds(key: string): number {
    const e = this.attempts.get(key);
    if (!e || e.resetAt <= this.now()) return 0;
    return e.fails >= this.maxFails
      ? Math.ceil((e.resetAt - this.now()) / 1000)
      : 0;
  }

  recordFailure(key: string): void {
    const t = this.now();
    if (this.attempts.size > 10_000) this.sweep(t);
    const e = this.attempts.get(key);
    if (!e || e.resetAt <= t)
      this.attempts.set(key, { fails: 1, resetAt: t + this.windowMs });
    else e.fails++;
  }

  clear(key: string): void {
    this.attempts.delete(key);
  }

  private sweep(t: number): void {
    for (const [k, v] of this.attempts)
      if (v.resetAt <= t) this.attempts.delete(k);
  }
}
