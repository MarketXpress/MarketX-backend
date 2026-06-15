import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() body: { email: string; password: string; firstName: string; lastName: string }) {
    return this.authService.register(body);
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    try {
      return await this.authService.validateUser(body.email, body.password);
    } catch {
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  async refresh(@Req() req: any, @Body('email') email: string) {
    const { userId, refreshToken } = req.user;
    return this.authService.refreshTokens(userId, email, refreshToken);
  }
}
