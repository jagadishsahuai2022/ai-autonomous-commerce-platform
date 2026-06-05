import { Body, Controller, HttpCode, HttpStatus, Post, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';

/**
 * Mobile auth: refresh + phone OTP.
 * MVP: in-memory OTP store, 5-minute TTL, no SMS provider wired yet.
 * TODO: integrate Twilio Verify or Firebase Phone Auth before production.
 */
interface OtpRecord { code: string; expiresAt: number; attempts: number; }

@Controller()
export class MobileAuthController {
  private readonly logger = new Logger(MobileAuthController.name);
  private readonly otps = new Map<string, OtpRecord>(); // phone -> record
  private readonly refreshTokens = new Map<string, { userId: number; expiresAt: number }>();

  /**
   * POST /auth/refresh
   * Exchanges a long-lived refresh token for a new access token.
   * Stub: echo a fake access token. TODO: validate JWT signature + persist refresh tokens.
   */
  @Post('auth/refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: { refreshToken?: string }) {
    if (!body?.refreshToken) throw new BadRequestException('refreshToken required');
    // TODO: real refresh-token rotation against DB / Redis
    return {
      accessToken: `dev-access-${Date.now()}`,
      refreshToken: body.refreshToken,
      expiresIn: 60 * 60,
    };
  }

  /**
   * POST /auth/phone/send
   * Issues a 6-digit OTP for the given phone.
   * MVP returns the code in the response so the mobile dev can test without SMS.
   * TODO: remove `devCode` from response in production.
   */
  @Post('auth/phone/send')
  @HttpCode(HttpStatus.OK)
  async sendOtp(@Body() body: { phone?: string }) {
    if (!body?.phone || !/^\+?\d{8,15}$/.test(body.phone)) {
      throw new BadRequestException('valid phone required');
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    this.otps.set(body.phone, { code, expiresAt: Date.now() + 5 * 60_000, attempts: 0 });
    this.logger.log(`[OTP] ${body.phone} -> ${code} (dev only)`);
    return { ok: true, devCode: code };
  }

  /**
   * POST /auth/phone/verify
   * Verifies OTP and returns auth session. Stub user.
   */
  @Post('auth/phone/verify')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() body: { phone?: string; code?: string }) {
    if (!body?.phone || !body?.code) throw new BadRequestException('phone and code required');
    const rec = this.otps.get(body.phone);
    if (!rec) throw new UnauthorizedException('No OTP requested');
    if (rec.expiresAt < Date.now()) {
      this.otps.delete(body.phone);
      throw new UnauthorizedException('OTP expired');
    }
    if (rec.attempts >= 5) {
      this.otps.delete(body.phone);
      throw new UnauthorizedException('Too many attempts');
    }
    rec.attempts += 1;
    if (rec.code !== body.code) throw new UnauthorizedException('Invalid OTP');
    this.otps.delete(body.phone);

    // Stub user record. TODO: lookup or create user by phone.
    const userId = Math.floor(Math.random() * 1_000_000);
    const refreshToken = `dev-refresh-${userId}-${Date.now()}`;
    this.refreshTokens.set(refreshToken, { userId, expiresAt: Date.now() + 30 * 24 * 60 * 60_000 });
    return {
      user: { id: userId, name: 'Phone User', email: `${body.phone}@phone.local`, phone: body.phone, role: 'CUSTOMER', subscriptionPlan: 'BASIC' },
      accessToken: `dev-access-${userId}-${Date.now()}`,
      refreshToken,
      expiresIn: 60 * 60,
    };
  }
}
