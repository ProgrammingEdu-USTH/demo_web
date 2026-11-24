import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { Prisma, User } from 'src/generated/prisma';
import { extractFields } from 'src/common/filters/prisma-exception/prisma-exception.filter';
import { LoginAttemptLimiter } from './login-attempt-limiter';
import { PrismaService } from 'src/prisma/prisma.service';
import { checkPassword } from 'src/common/security/check-password';
import { WerkzeugScryptHasher } from 'src/common/security/werkzeug-scrypt-hasher';
import { CachedUserService } from './cached-user.service';
import { LoginDto } from './dto/login.dto';
import { PHONE_REGEX, RegisterDto } from './dto/register.dto';
import { RefreshTokenService } from './refresh-token.service';

/** Khớp default của Django: backend/accounts/models.py -> role = 'Học viên'. */
const DEFAULT_ROLE = 'Học viên';

/**
 * Chuẩn hoá email về chữ thường + trim.
 * Cột users.email là text @unique (case-SENSITIVE trong Postgres), trong khi
 * Google luôn trả claim email ở dạng chữ thường. Không chuẩn hoá thì
 * 'Victim@Gmail.com' và 'victim@gmail.com' thành 2 tài khoản khác nhau.
 */
function normalizeEmail(email?: string | null): string | undefined {
  const v = email?.trim().toLowerCase();
  return v ? v : undefined;
}

/** Khách: mật khẩu rỗng + email @guest.local + không OAuth (xem AuthService.guest). */
export function isGuestUser(
  u: Pick<User, 'password' | 'email' | 'oauthProvider'>,
): boolean {
  return (
    u.password === '' && u.email.endsWith('@guest.local') && !u.oauthProvider
  );
}

const emailTaken = () =>
  new ConflictException(
    'Email đã được sử dụng. Hãy đăng nhập bằng tài khoản đó.',
  );
const phoneTaken = () =>
  new ConflictException(
    'Số điện thoại đã được sử dụng. Hãy đăng nhập bằng tài khoản đó.',
  );

export interface OAuthProfile {
  provider: string;
  providerId: string;
  email?: string;
  /** Chỉ true khi provider XÁC NHẬN email đã verify. Gate cho nhánh auto-link. */
  emailVerified?: boolean;
  name?: string;
  avatar?: string;
}

export interface TokenPair {
  access: string;
  refresh: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly cachedUsers: CachedUserService,
  ) {}

  private readonly loginLimiter = new LoginAttemptLimiter();

  // ---------- Task 43-45: login ----------

  async login(dto: LoginDto) {
    // Bước 1: chọn ĐÚNG MỘT định danh (email ưu tiên hơn phone) rồi tra bằng khoá unique.
    // Trước đây findFirst({ OR }) không orderBy: body có cả hai thì có thể vào nhầm tài khoản.
    // Form chỉ có MỘT ô "Email hoặc số điện thoại" và FE gửi vào field email; giá trị khớp
    // định dạng SĐT thì phải tra cột phone — người đăng ký bằng SĐT có email là
    // '<sđt>@phone.local' nên không đăng nhập bằng email được.
    const typed = dto.email?.trim();
    const byPhone = typed ? PHONE_REGEX.test(typed) : true;
    const identifier = byPhone
      ? (typed ?? dto.phone?.trim())
      : normalizeEmail(typed);

    // Hạn mức theo tài khoản: kiểm TRƯỚC khi so mật khẩu để kẻ đoán không được thử tiếp.
    const limitKey = identifier ?? '';
    const lockedFor = this.loginLimiter.lockedForSeconds(limitKey);
    if (lockedFor > 0) {
      throw new HttpException(
        `Đăng nhập sai quá nhiều lần, vui lòng thử lại sau ${Math.ceil(lockedFor / 60)} phút`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = !identifier
      ? null
      : await this.prisma.user.findUnique({
          where: byPhone ? { phone: identifier } : { email: identifier },
        });

    // Bước 2: verify password. Cùng một message cho "không tìm thấy user" và
    // "sai mật khẩu" — tránh để lộ email/sđt nào đã tồn tại trong hệ thống.
    if (!user || !(await checkPassword(user.password, dto.password))) {
      this.loginLimiter.recordFailure(limitKey);
      throw new UnauthorizedException(
        'Email/số điện thoại hoặc mật khẩu không đúng',
      );
    }
    this.loginLimiter.clear(limitKey);

    // Bước 3: build response.
    const tokens = await this.issueTokens(user);
    return {
      ok: true,
      name: user.name,
      needs_questionnaire: !user.questionnaireCompleted,
      ...tokens,
    };
  }

  // ---------- Task 46-47: register ----------

  async register(dto: RegisterDto) {
    // Kiểm trùng trước để có message rõ; hai request đồng thời vẫn lọt qua đây nên unique
    // index (uq_users_phone, email) mới là chốt thật, và P2002 cũng thành 409 thay vì 500/400.
    const email = normalizeEmail(dto.email);
    await this.assertFree(email, dto.phone);

    const user = await this.createOr409(async () =>
      this.prisma.user.create({
        data: {
          name: dto.name,
          // Cột email NOT NULL + UNIQUE: user đăng ký bằng sđt vẫn phải có giá trị
          // duy nhất, dùng placeholder theo phone thay vì để trống.
          email: email ?? `${dto.phone}@phone.local`,
          phone: dto.phone ?? null,
          password: await WerkzeugScryptHasher.encode(dto.password),
          // Django User.role default='Học viên' — KHÔNG phải 'user'.
          role: DEFAULT_ROLE,
        },
      }),
    );

    const tokens = await this.issueTokens(user);
    return {
      ok: true,
      needs_questionnaire: !user.questionnaireCompleted,
      ...tokens,
    };
  }

  // ---------- Tài khoản khách (buổi thử nghiệm với giảng viên/sinh viên) ----------
  // Frontend đã gỡ trang đăng nhập/đăng ký, nhưng mọi API bài học vẫn đòi JWT
  // (tiến độ, XP, chấm bài đều gắn user_id). Thay vì mở từng route cho người
  // lạ, mỗi trình duyệt tự nhận một tài khoản ẩn danh: tiến độ vẫn lưu trên
  // server như học viên thật và đội dự án đọc lại được số liệu buổi test.
  //
  // An toàn:
  //  · password = '' — checkPassword() trả false cho chuỗi rỗng, nên không ai
  //    đăng nhập vào tài khoản khách bằng mật khẩu, kể cả qua bản Django.
  //  · email @guest.local là duy nhất (randomUUID) và nhận diện được để lọc.
  //    Dọn khách bằng scripts/cleanup-guest-accounts.ts, KHÔNG DELETE thẳng
  //    users: khoá ngoại RESTRICT làm câu đó vỡ, và LIKE '%@guest.local' trúng
  //    cả người thật (luật chọn ở ./guest-cleanup.ts).
  //  · Tắt bằng GUEST_LOGIN=off khi không còn cần (route trả 403).
  async guest() {
    if ((process.env.GUEST_LOGIN ?? 'on').toLowerCase() === 'off') {
      throw new ForbiddenException('Chế độ khách đã tắt');
    }
    const id = randomUUID();
    const user = await this.prisma.user.create({
      data: {
        name: `Khách ${id.slice(0, 4).toUpperCase()}`,
        email: `guest_${id}@guest.local`,
        password: '',
        role: DEFAULT_ROLE,
        // Bỏ bảng hỏi đầu vào: người thử vào thẳng khoá học.
        questionnaireCompleted: true,
      },
    });
    const tokens = await this.issueTokens(user);
    return { ok: true, guest: true, needs_questionnaire: false, ...tokens };
  }

  /**
   * Nâng khách thành tài khoản thật bằng UPDATE chính hàng users của khách: user_id giữ nguyên
   * nên lesson_progress, enrollments, xp đi theo mà không cần di chuyển gì. KHÔNG gộp với tài
   * khoản có sẵn — trùng email/sđt thì 409 để người dùng tự đăng nhập tài khoản kia.
   * UPDATE có điều kiện (mật khẩu rỗng + đúng email khách) là compare-and-set: hai lần upgrade
   * đồng thời chỉ một lần thắng.
   */
  async upgrade(userId: number, dto: RegisterDto, oldRefresh?: string) {
    const guest = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!guest || !isGuestUser(guest)) {
      throw new ForbiddenException('Chỉ tài khoản khách mới nâng cấp được');
    }
    const email = normalizeEmail(dto.email);
    await this.assertFree(email, dto.phone);

    const res = await this.createOr409(async () =>
      this.prisma.user.updateMany({
        where: { id: userId, password: '', email: guest.email },
        data: {
          name: dto.name,
          email: email ?? `${dto.phone}@phone.local`,
          phone: dto.phone ?? null,
          password: await WerkzeugScryptHasher.encode(dto.password),
        },
      }),
    );
    if (res.count === 0) {
      throw new ForbiddenException('Chỉ tài khoản khách mới nâng cấp được');
    }
    this.cachedUsers.invalidate(userId);

    // Access token cũ mang email @guest.local: cấp lại cặp mới, thu hồi chuỗi phiên cũ.
    if (oldRefresh) await this.refreshTokenService.revoke(oldRefresh);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    return {
      ok: true,
      upgraded: true,
      needs_questionnaire: !user.questionnaireCompleted,
      ...(await this.issueTokens(user)),
    };
  }

  // ---------- Task 48: logout ----------

  async logout(refresh?: string) {
    if (refresh) {
      // Không try/catch vì revoke() đã được thiết kế không ném lỗi khi token sai.
      await this.refreshTokenService.revoke(refresh);
    }
    return { ok: true };
  }

  // ---------- Task 49-50: refresh ----------

  async refresh(refreshToken: string): Promise<TokenPair> {
    // rotateAndBlacklist đã bao gồm: verify còn hạn + chưa bị thu hồi (bước 1),
    // rồi đánh dấu revokedAt + cấp token mới (bước 2).
    const { userId, refreshToken: newRefresh } =
      await this.refreshTokenService.rotateAndBlacklist(refreshToken);

    const user = await this.cachedUsers.findById(userId);
    if (!user) throw new UnauthorizedException();

    return {
      access: await this.signAccessToken(user),
      refresh: newRefresh,
    };
  }

  // ---------- Task 55-57: OAuth ----------

  async validateOAuthLogin(profile: OAuthProfile): Promise<User> {
    // Bước 1: đã liên kết trước đó -> đăng nhập luôn.
    const linked = await this.prisma.user.findFirst({
      where: {
        oauthProvider: profile.provider,
        oauthProviderId: profile.providerId,
      },
    });
    if (linked) return linked;

    // Bước 2: email trùng tài khoản thường (chưa liên kết OAuth) -> tự động liên kết.
    // CHỈ khi provider đã xác minh email. Thiếu gate này, kẻ tấn công đăng ký
    // trước bằng email nạn nhân rồi chờ nạn nhân đăng nhập Google là chiếm được
    // tài khoản (OAuth pre-hijacking).
    if (profile.email && profile.emailVerified === true) {
      const sameEmail = await this.prisma.user.findFirst({
        where: { email: profile.email, oauthProvider: null },
      });
      if (sameEmail) {
        // Chống account pre-hijacking: register() KHÔNG xác minh email, nên
        // tài khoản trùng email hoàn toàn có thể do kẻ tấn công đăng ký trước
        // bằng email nạn nhân + mật khẩu của hắn. Tài khoản có mật khẩu thật
        // -> TỪ CHỐI tự liên kết (nếu link, danh tính Google của nạn nhân rơi
        // vào tài khoản kẻ tấn công kiểm soát). Chỉ auto-link khi password
        // rỗng — quy ước của tài khoản tạo qua OAuth (bước 3 bên dưới).
        if (sameEmail.password !== '') {
          throw new UnauthorizedException(
            'Email này đã được đăng ký bằng mật khẩu. Vui lòng đăng nhập bằng mật khẩu của bạn.',
          );
        }
        const updated = await this.prisma.user.update({
          where: { id: sameEmail.id },
          data: {
            oauthProvider: profile.provider,
            oauthProviderId: profile.providerId,
            avatar: sameEmail.avatar ?? profile.avatar ?? null,
          },
        });
        this.cachedUsers.invalidate(updated.id);
        return updated;
      }
    }

    // Bước 3: chưa có gì -> tạo user mới.
    return this.prisma.user.create({
      data: {
        name: profile.name?.trim() || 'Người dùng',
        email:
          profile.email ??
          `${profile.provider}_${profile.providerId}@oauth.local`,
        password: '',
        role: DEFAULT_ROLE,
        oauthProvider: profile.provider,
        oauthProviderId: profile.providerId,
        avatar: profile.avatar ?? null,
        isVerified: true,
      },
    });
  }

  async issueTokens(user: User): Promise<TokenPair> {
    return {
      access: await this.signAccessToken(user),
      refresh: await this.refreshTokenService.issue(user.id),
    };
  }

  // ---------- helpers ----------

  private async signAccessToken(user: User): Promise<string> {
    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  /** 409 cho email/sđt đã có, message theo từng trường. */
  private async assertFree(email?: string, phone?: string): Promise<void> {
    const or: Prisma.UserWhereInput[] = [];
    if (email) or.push({ email });
    if (phone) or.push({ phone });
    if (!or.length) return;
    const rows = await this.prisma.user.findMany({
      where: { OR: or },
      select: { email: true, phone: true },
    });
    if (email && rows.some((r) => r.email === email)) throw emailTaken();
    if (phone && rows.some((r) => r.phone === phone)) throw phoneTaken();
  }

  /** Chạy thao tác ghi; vi phạm unique (race lọt qua assertFree) → 409. */
  private async createOr409<T>(op: () => Promise<T>): Promise<T> {
    try {
      return await op();
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const fields = extractFields(e);
        if (fields.includes('phone')) throw phoneTaken();
        if (fields.includes('email')) throw emailTaken();
      }
      throw e;
    }
  }
}
