import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, seconds } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUserId } from 'src/common/decorators/current-user.decorator';
import { Public } from 'src/common/decorators/public.decorators';
import {
  FacebookCallbackGuard,
  GoogleCallbackGuard,
  type OAuthErrorRequest,
} from 'src/common/guards/jwt-auth/oauth-callback.guard';
import type { User } from 'src/generated/prisma';
import { AuthService, type TokenPair } from './auth.service';
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from './refresh-cookie';
import { RefreshTokenService } from './refresh-token.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { LogoutDto, RefreshDto } from './dto/token.dto';

// Toàn bộ route auth phải @Public(): JwtAuthGuard là APP_GUARD toàn cục, không
// loại trừ thì không ai đăng nhập được (chicken-and-egg).
@Controller('auth')
@Public()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly refreshTokens: RefreshTokenService,
  ) {}

  /** Chuyển refresh token từ body sang cookie httpOnly; body chỉ còn access. */
  private moveRefreshToCookie<T extends TokenPair>(
    res: Response,
    result: T,
  ): Omit<T, 'refresh'> {
    const { refresh, ...rest } = result;
    setRefreshCookie(res, refresh, this.refreshTokens.lifetimeMs);
    return rest;
  }

  // Throttle override: đè tier 'ip_hour' RIÊNG cho route này.
  // CustomThrottlerGuard sinh key theo `${controller}.${route}:${ip}:${name}` nên
  // quota này không dùng chung với các route khác.
  // Ngưỡng đọc từ env (mặc định giữ nguyên 20 req/60s) — @Throttle là decorator
  // nên giá trị phải tính được lúc nạp class, đọc trực tiếp process.env.
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    ip_hour: {
      limit: Number(process.env.THROTTLE_LOGIN_LIMIT ?? 20),
      ttl: seconds(Number(process.env.THROTTLE_LOGIN_TTL_SECONDS ?? 60)),
    },
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.moveRefreshToCookie(res, await this.authService.login(dto));
  }

  @Post('register')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    ip_hour: {
      limit: Number(process.env.THROTTLE_REGISTER_LIMIT ?? 10),
      ttl: seconds(Number(process.env.THROTTLE_REGISTER_TTL_SECONDS ?? 60)),
    },
  })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.moveRefreshToCookie(res, await this.authService.register(dto));
  }

  // Tài khoản khách cho buổi thử nghiệm (xem AuthService.guest). Quota riêng,
  // CAO hơn register vì cả lớp ngồi chung một Wi-Fi = chung một IP NAT: 40 máy
  // mở link cùng lúc không được bị 429. Mỗi trình duyệt chỉ gọi route này một
  // lần (sau đó dùng refresh cookie), nên quota này vẫn chặn được kẻ spam tạo
  // tài khoản hàng loạt.
  @Post('guest')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    ip_hour: {
      limit: Number(process.env.THROTTLE_GUEST_LIMIT ?? 120),
      ttl: seconds(Number(process.env.THROTTLE_GUEST_TTL_SECONDS ?? 3600)),
    },
  })
  async guest(@Res({ passthrough: true }) res: Response) {
    return this.moveRefreshToCookie(res, await this.authService.guest());
  }

  // Nâng khách → tài khoản thật, GIỮ tiến độ (xem AuthService.upgrade). Cần JWT của khách nên
  // @Public(false) đè @Public() của class. Chung hạn mức với register.
  @Post('upgrade')
  @Public(false)
  @HttpCode(HttpStatus.OK)
  @Throttle({
    ip_hour: {
      limit: Number(process.env.THROTTLE_REGISTER_LIMIT ?? 10),
      ttl: seconds(Number(process.env.THROTTLE_REGISTER_TTL_SECONDS ?? 60)),
    },
  })
  async upgrade(
    @CurrentUserId() userId: number,
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.moveRefreshToCookie(
      res,
      await this.authService.upgrade(userId, dto, readRefreshCookie(req)),
    );
  }

  // Spec yêu cầu hỗ trợ CẢ GET và POST /auth/logout.
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logoutPost(
    @Body() dto: LogoutDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    clearRefreshCookie(res);
    return this.authService.logout(readRefreshCookie(req) ?? dto?.refresh);
  }

  // GET KHÔNG nhận refresh token qua query string: token trong URL lọt vào
  // access log, browser history và header Referer. Muốn thu hồi token phải
  // dùng POST với body {refresh}; GET chỉ còn trả ok để không phá client cũ.
  @Get('logout')
  @HttpCode(HttpStatus.OK)
  logoutGet() {
    return { ok: true };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = readRefreshCookie(req) ?? dto.refresh;
    if (!token) throw new UnauthorizedException();
    try {
      return this.moveRefreshToCookie(
        res,
        await this.authService.refresh(token),
      );
    } catch (err) {
      // Cookie chết (hết hạn/đã thu hồi) -> xoá để trình duyệt khỏi gửi lại.
      if (err instanceof UnauthorizedException) clearRefreshCookie(res);
      throw err;
    }
  }

  // ---------- Task 59 ----------
  // Không có thân hàm: AuthGuard('google') tự redirect sang trang consent của Google.
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth(): void {
    /* passport lo phần redirect */
  }

  // ---------- Task 60 ----------
  // GoogleCallbackGuard (không phải AuthGuard('google') trần): lỗi từ
  // strategy/service không được ném thành trang JSON 401 mà lưu vào
  // req.oauthError để redirect về frontend kèm thông báo.
  @Get('google/callback')
  @UseGuards(GoogleCallbackGuard)
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl =
      this.configService.getOrThrow<string>('app.frontendUrl');

    // GoogleStrategy.validate() đã gán user (qua done(null, user)).
    const user = req.user as User | undefined;
    if (!user) {
      const params = new URLSearchParams({ error: 'oauth_failed' });
      const message = (req as OAuthErrorRequest).oauthError;
      if (message) params.set('message', message);
      res.redirect(`${frontendUrl}/auth/callback#${params.toString()}`);
      return;
    }

    const { access } = this.moveRefreshToCookie(
      res,
      await this.authService.issueTokens(user),
    );

    // Sheet 3: PHẢI dùng fragment (#), KHÔNG dùng query string (?).
    // Fragment không được trình duyệt gửi lên server, không lọt vào access log
    // hay header Referer của các request sau -> tránh rò rỉ JWT. Chỉ access
    // token đi qua fragment; refresh token đã nằm trong cookie httpOnly.
    const fragment = new URLSearchParams({ access }).toString();

    res.redirect(`${frontendUrl}/auth/callback#${fragment}`);
  }

  // ---------- Task 61-62: Facebook OAuth ----------
  @Get('facebook')
  @UseGuards(AuthGuard('facebook'))
  facebookAuth(): void {
    /* passport lo phần redirect sang trang consent của Facebook */
  }

  // Spec sheet 1 (API #7): giống Google nhưng KHÁC target redirect khi thất bại
  // — dùng mã lỗi riêng facebook_oauth_failed để FE phân biệt provider.
  @Get('facebook/callback')
  @UseGuards(FacebookCallbackGuard)
  async facebookCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl =
      this.configService.getOrThrow<string>('app.frontendUrl');

    const user = req.user as User | undefined;
    if (!user) {
      const params = new URLSearchParams({ error: 'facebook_failed' });
      const message = (req as OAuthErrorRequest).oauthError;
      if (message) params.set('message', message);
      res.redirect(`${frontendUrl}/login?${params.toString()}`);
      return;
    }

    const { access } = this.moveRefreshToCookie(
      res,
      await this.authService.issueTokens(user),
    );
    const fragment = new URLSearchParams({ access }).toString();

    res.redirect(`${frontendUrl}/auth/callback#${fragment}`);
  }
}
