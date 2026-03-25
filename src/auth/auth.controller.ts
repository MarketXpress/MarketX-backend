import {
  Controller,
  Post,
  Body,
  Get,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { StrictRateLimit } from '../decorators/rate-limit.decorator';
import { RateLimitGuard } from '../guards/rate-limit.guard';

@ApiTags('auth')
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

  // ── Google OAuth ────────────────────────────────────────────────────────────

  @Get('google')
  @ApiOperation({ summary: 'Initiate Google OAuth2 login' })
  @UseGuards(AuthGuard('google'))
  googleLogin(): void {
    // Passport redirects the browser to Google — nothing to return here
  }

  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth2 callback — returns JWT' })
  @ApiResponse({ status: 200, description: 'Returns { accessToken }' })
  @UseGuards(AuthGuard('google'))
  googleCallback(@Req() req: any): { accessToken: string } {
    return { accessToken: req.user.accessToken };
  }

  // ── GitHub OAuth ────────────────────────────────────────────────────────────

  @Get('github')
  @ApiOperation({ summary: 'Initiate GitHub OAuth2 login' })
  @UseGuards(AuthGuard('github'))
  githubLogin(): void {
    // Passport redirects the browser to GitHub — nothing to return here
  }

  @Get('github/callback')
  @ApiOperation({ summary: 'GitHub OAuth2 callback — returns JWT' })
  @ApiResponse({ status: 200, description: 'Returns { accessToken }' })
  @UseGuards(AuthGuard('github'))
  githubCallback(@Req() req: any): { accessToken: string } {
    return { accessToken: req.user.accessToken };
  }
}