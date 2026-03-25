import { Controller, Post, Body, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { StrictRateLimit } from '../decorators/rate-limit.decorator';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { RefreshTokenGuard } from './common/guards/refresh-token.guard';


@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  async refresh(@Req() req: any, @Body('email') email: string) {
    // The Guard attaches { userId, refreshToken } to req.user 
    // based on the RefreshTokenStrategy validate() method.
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
      const token = await this.authService.validateUser(
        body.email,
        body.password,
      );
      return { accessToken: token };
    } catch {
      throw new UnauthorizedException('Invalid credentials');
    }
  }
}