import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-facebook';
import { AuthService, OAuthProfile } from 'src/auth/auth.service';
import { createOAuthStateStore } from 'src/auth/oauth-state';

/** Task 61 — FacebookStrategy, mirror GoogleStrategy. */
@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.getOrThrow<string>('oauth.facebook.clientId'),
      clientSecret: configService.getOrThrow<string>(
        'oauth.facebook.clientSecret',
      ),
      callbackURL: configService.getOrThrow<string>(
        'oauth.facebook.callbackUrl',
      ),
      // Graph API mặc định KHÔNG trả email/ảnh — phải khai profileFields.
      profileFields: ['id', 'displayName', 'emails', 'photos'],
      scope: ['email'],
      // Cùng lý do như GoogleStrategy: không có `state` thì /auth/facebook/callback
      // nhận mọi ?code= đưa tới, mở đường login CSRF. Cookie state riêng cho
      // facebook nên hai luồng OAuth mở song song không ghi đè nhau.
      store: createOAuthStateStore(
        'facebook',
        configService.getOrThrow<string>('jwt.accessSecret'),
      ),
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: (err: Error | null, user?: unknown) => void,
  ): Promise<void> {
    try {
      // Facebook chỉ trả email khi tài khoản đã xác minh email/SĐT với Meta,
      // nên email ở đây coi như đã xác minh — đủ điều kiện cho nhánh auto-link.
      const email = profile.emails?.[0]?.value?.trim().toLowerCase();

      const mapped: OAuthProfile = {
        provider: 'facebook',
        providerId: profile.id,
        email: email || undefined,
        emailVerified: Boolean(email),
        name: profile.displayName,
        avatar: profile.photos?.[0]?.value,
      };

      const user = await this.authService.validateOAuthLogin(mapped);
      done(null, user);
    } catch (err) {
      done(err as Error, undefined);
    }
  }
}
