import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    try {
      const token = await this.authService.validateUser(body.email, body.password);
      return { accessToken: token };
    } catch (error) {
      throw new UnauthorizedException('Invalid credentials');
    }
  }
}