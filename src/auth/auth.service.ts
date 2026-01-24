import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async validateUser(email: string, password: string): Promise<string> {
    // Mock user for demonstration purposes
    const user = { email: 'test@example.com', password: await bcrypt.hash('password123', 10) };

    if (user && (await bcrypt.compare(password, user.password))) {
      return this.jwtService.sign({ email: user.email });
    }
    throw new UnauthorizedException('Invalid credentials');
  }
}