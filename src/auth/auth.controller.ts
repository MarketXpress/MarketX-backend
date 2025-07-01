import { Controller, Post, Body, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { StrictRateLimit } from '../decorators/rate-limit.decorator';
import { RateLimitGuard } from '../guards/rate-limit.guard';

@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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