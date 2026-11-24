import { createHash, randomBytes, randomUUID } from 'crypto';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';

/** Parse chuỗi kiểu '8h' / '30m' / '7d' / '45s' → milliseconds. */
function parseDuration(value: string | undefined, fallbackMs: number): number {
  if (!value) return fallbackMs;
  const m = /^(\d+)\s*(ms|s|m|h|d)$/i.exec(value.trim());
  if (!m) return fallbackMs;
  const n = Number(m[1]);
  switch (m[2].toLowerCase()) {
    case 'ms':
      return n;
    case 's':
      return n * 1000;
    case 'm':
      return n * 60_000;
    case 'h':
      return n * 3_600_000;
    case 'd':
      return n * 86_400_000;
    default:
      return fallbackMs;
  }
}

/**
 * Token đã bị rotate trong khoảng này mà bị gửi lại thì coi là race hợp lệ
 * (2 tab cùng refresh bằng một cookie) — chỉ trả 401, KHÔNG thu hồi cả family.
 * Quá khoảng này mới coi là token bị đánh cắp và dùng lại.
 */
const REUSE_GRACE_MS = 30_000;

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export interface RotatedRefreshToken {
  userId: number;
  refreshToken: string;
}

@Injectable()
export class RefreshTokenService implements OnModuleInit, OnModuleDestroy {
  /** Lifetime đọc từ JWT_REFRESH_EXPIRES (mặc định 8h) — 1 nguồn sự thật duy nhất. */
  readonly lifetimeMs: number;
  private readonly logger = new Logger(RefreshTokenService.name);
  private pruneTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.lifetimeMs = parseDuration(
      config.get<string>('jwt.refreshExpires'),
      8 * 3_600_000,
    );
  }

  /**
   * familyId nối các token sinh ra từ cùng một lần đăng nhập. Mỗi lần rotate
   * token mới kế thừa familyId của token cũ — nhờ đó khi phát hiện dùng lại
   * token đã thu hồi có thể thu hồi TOÀN BỘ chuỗi phiên đó.
   */
  async issue(
    userId: number,
    familyId: string = randomUUID(),
  ): Promise<string> {
    const rawToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.lifetimeMs);

    await this.prisma.authSession.create({
      data: {
        userId,
        token: hashToken(rawToken),
        familyId,
        expiresAt,
      },
    });

    return rawToken;
  }

  /**
   * Trả về CẢ userId (không chỉ token mới) vì AuthService.refresh() cần userId
   * để ký access token mới mà không phải tra DB thêm lần nữa.
   *
   * Chống race: bước revoke dùng updateMany có điều kiện `revokedAt: null` như
   * một compare-and-set nguyên tử — 2 request refresh cùng lúc với CÙNG token
   * thì chỉ đúng 1 request thắng (count=1), request kia nhận 401 thay vì cả 2
   * cùng được cấp cặp token mới.
   *
   * Chống dùng lại token bị đánh cắp: token đã bị thu hồi từ lâu hơn
   * REUSE_GRACE_MS mà vẫn được gửi lên nghĩa là có HAI bên cùng giữ chuỗi
   * token này (người dùng và kẻ tấn công) -> thu hồi cả family, cả hai đều
   * phải đăng nhập lại. Không làm vậy thì ai refresh trước sẽ giữ phiên mãi.
   */
  async rotateAndBlacklist(oldToken: string): Promise<RotatedRefreshToken> {
    const session = await this.prisma.authSession.findFirst({
      where: { token: hashToken(oldToken) },
    });

    if (!session) {
      throw new UnauthorizedException();
    }

    if (session.revokedAt) {
      const revokedAgoMs = Date.now() - session.revokedAt.getTime();
      if (revokedAgoMs > REUSE_GRACE_MS) {
        await this.revokeFamily(session.id, session.familyId);
        this.logger.warn(
          `Phát hiện dùng lại refresh token đã thu hồi (user ${session.userId}) — đã thu hồi cả chuỗi phiên`,
        );
      }
      throw new UnauthorizedException();
    }

    if (!session.expiresAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException();
    }

    const revoked = await this.prisma.authSession.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count === 0) {
      // Token vừa bị request song song khác rotate — race hợp lệ, chỉ từ chối.
      throw new UnauthorizedException();
    }

    return {
      userId: session.userId,
      refreshToken: await this.issue(
        session.userId,
        session.familyId ?? randomUUID(),
      ),
    };
  }

  /**
   * Thu hồi token khi logout. KHÔNG ném lỗi nếu token sai/không tồn tại —
   * theo spec: "không lỗi nếu token không hợp lệ".
   */
  async revoke(rawToken: string): Promise<void> {
    const session = await this.prisma.authSession.findFirst({
      where: { token: hashToken(rawToken) },
      select: { id: true, familyId: true },
    });
    if (session) await this.revokeFamily(session.id, session.familyId);
  }

  /**
   * Thu hồi mọi token còn hiệu lực cùng family. Phiên cũ (tạo trước khi có
   * cột family_id) không có family -> chỉ thu hồi chính nó.
   */
  private async revokeFamily(
    sessionId: number,
    familyId: string | null,
  ): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: familyId
        ? { familyId, revokedAt: null }
        : { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Chạy dọn dẹp mỗi giờ; unref() để timer không giữ process sống khi shutdown. */
  onModuleInit(): void {
    this.pruneTimer = setInterval(() => {
      this.pruneExpired()
        .then(
          (n) => n > 0 && this.logger.log(`Đã dọn ${n} phiên refresh hết hạn`),
        )
        .catch((e) => this.logger.warn(`Dọn phiên refresh thất bại: ${e}`));
    }, 3_600_000);
    this.pruneTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.pruneTimer) clearInterval(this.pruneTimer);
  }

  /**
   * Dọn phiên hết hạn/đã thu hồi quá 24h — để bảng auth_sessions không phình
   * vô hạn theo thời gian.
   */
  async pruneExpired(): Promise<number> {
    const cutoff = new Date(Date.now() - 86_400_000);
    const res = await this.prisma.authSession.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }],
      },
    });
    return res.count;
  }
}
