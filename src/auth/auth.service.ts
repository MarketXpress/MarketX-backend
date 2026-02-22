import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async validateUser(email: string, password: string): Promise<string> {
    // Mock user for demonstration purposes
    const user = { email: 'test@example.com', password: await bcrypt.hash('password123', 10) };

    if (user && (await bcrypt.compare(password, user.password))) {
      return this.jwtService.sign({ email: user.email });
    }
    throw new UnauthorizedException('Invalid credentials');
  }

  async forgotPassword(email: string): Promise<void> {
    const resetUrl = `https://marketx.com/reset-password?token=mock-token-${Date.now()}`;
    
    this.eventEmitter.emit('auth.password_reset_requested', {
      email,
      name: 'User',
      resetUrl,
    });
  }
}