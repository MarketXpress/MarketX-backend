import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { StrictRateLimit } from '../decorators/rate-limit.decorator';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { RefreshTokenGuard } from './common/guards/refresh-token.guard';
import { Enable2FADto } from './dto/enable-2fa.dto';
import { Verify2FADto } from './dto/verify-2fa.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  async refresh(@Req() req: any, @Body('email') email: string) {
    // The Guard attaches { userId, refreshToken } to req.user
    const { userId, refreshToken } = req.user;
    return this.authService.refreshTokens(userId, email, refreshToken);
  }

  @Post('login')
  @StrictRateLimit({
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: 'Too many login attempts. Please try again later.',
  })
  async login(@Body() body: { email: string; password: string }) {
    try {
      const token = await this.authService.validateUser(body.email, body.password);
      return { accessToken: token };
    } catch {
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  /**
   * Enable 2FA for a user, returning QR code payload for Google Authenticator
   */
  @Post('enable-2fa')
  async enable2FA(@Body() dto: Enable2FADto) {
    return this.authService.enable2FA(dto.userId);
  }

  /**
   * Verify a 6-digit TOTP code for a user
   */
  @Post('verify-2fa')
  async verify2FA(@Body() dto: Verify2FADto) {
    return this.authService.verify2FA(dto.userId, dto.code);
  }
}
