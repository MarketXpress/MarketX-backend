import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new account' })
  @ApiResponse({
    status: 201,
    description: 'Account registered successfully.',
  })
  @ApiResponse({ status: 400, description: 'Invalid registration data.' })
  async register(
    @Body()
    body: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    },
  ) {
    return this.authService.register(body);
  }

  @Post('login')
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiResponse({ status: 200, description: 'Authentication tokens returned.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  async login(@Body() body: { email: string; password: string }) {
    try {
      return await this.authService.validateUser(body.email, body.password);
    } catch {
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  @UseGuards(JwtRefreshGuard)
  @ApiBearerAuth()
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh authentication tokens' })
  @ApiResponse({
    status: 200,
    description: 'Refreshed authentication tokens returned.',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired refresh token.',
  })
  async refresh(@Req() req: any, @Body('email') email: string) {
    const { userId, refreshToken } = req.user;
    return this.authService.refreshTokens(userId, email, refreshToken);
  }
}
