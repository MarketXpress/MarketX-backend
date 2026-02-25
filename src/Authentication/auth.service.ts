import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from './user.entity';
import { Users } from '../users/users.entity';
import { RegisterDto, AuthResponseDto, ForgotPasswordDto, ResetPasswordDto } from './auth.dto';
import { JwtPayload, JWT_CONSTANTS } from './jwt-payload.interface';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) { }

  async validateUser(email: string, password: string): Promise<Users | null> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return null;
    }

    const isPasswordValid = await user.validatePassword(password);

    if (!isPasswordValid) {
      return null;
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    return user as any;
  }

  async login(user: User): Promise<AuthResponseDto> {
    const tokens = await this.generateTokens(user as any);
    await this.usersService.updateRefreshToken(parseInt(String(user.id)), tokens.refreshToken);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const createDto = { ...registerDto, name: registerDto.email.split('@')[0] };
    const user = await this.usersService.create(createDto as any);
    const authResponse = await this.login(user as any);

    // Send welcome email (fire-and-forget — don't block registration)
    const appUrl = this.configService.get<string>('APP_URL') || 'https://marketx.com';
    this.emailService
      .sendWelcome({
        userId: String(user.id),
        to: user.email,
        name: user.name,
        loginUrl: `${appUrl}/login`,
      })
      .catch(() => {/* non-critical */ });

    return authResponse;
  }

  async refreshTokens(userId: string, refreshToken: string): Promise<AuthResponseDto> {
    const user = await this.usersService.findOne(parseInt(userId));

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Access denied');
    }

    const isValid = await this.usersService.validateRefreshToken(userId, refreshToken);

    if (!isValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.generateTokens(user);
    await this.usersService.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: {
        id: user.id.toString(),
        email: user.email,
        firstName: user.name,
        lastName: '',
        role: user.role || 'user',
      },
    };
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.updateRefreshToken(parseInt(userId), null);
  }

  /**
   * Request a password reset — looks up the user, issues a short-lived JWT reset token,
   * and queues the password-reset email.
   */
  async requestPasswordReset(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(dto.email);

    // Always return success to prevent user enumeration attacks
    if (!user) {
      return { message: 'If that email exists, a reset link has been sent.' };
    }

    const resetPayload = {
      sub: user.id.toString(),
      email: user.email,
      type: 'password-reset',
    };

    const resetToken = await this.jwtService.signAsync(resetPayload, {
      secret: JWT_CONSTANTS.accessTokenSecret,
      expiresIn: '15m',
    } as any);

    const appUrl = this.configService.get<string>('APP_URL') || 'https://marketx.com';
    const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;

    // Queue the password reset email — don't await so the response is fast
    this.emailService
      .sendPasswordReset({
        userId: String(user.id),
        to: user.email,
        name: user.name,
        resetUrl,
        expiryTime: '15 minutes',
      })
      .catch(() => {/* non-critical – email failure shouldn't fail the API response */ });

    return { message: 'If that email exists, a reset link has been sent.' };
  }

  /**
   * Verify the reset token and update the user's password.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(dto.token, {
        secret: JWT_CONSTANTS.accessTokenSecret,
      } as any);
    } catch {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (payload.type !== 'password-reset') {
      throw new BadRequestException('Invalid token type');
    }

    const user = await this.usersService.findOne(parseInt(payload.sub));
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const hashed = await bcrypt.hash(dto.newPassword, 10);
    await (this.usersService as any)['userRepository']?.update(user.id, { password: hashed })
      ?? (this.usersService as any).userRepository?.update(user.id, { password: hashed });

    return { message: 'Password successfully reset. You can now log in.' };
  }

  async verifyToken(token: string, type: 'access' | 'refresh' = 'access'): Promise<JwtPayload> {
    try {
      const secret = type === 'access'
        ? JWT_CONSTANTS.accessTokenSecret
        : JWT_CONSTANTS.refreshTokenSecret;

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret,
      });

      if (payload.type !== type) {
        throw new UnauthorizedException('Invalid token type');
      }

      return payload;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private async generateTokens(user: Users): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const accessPayload: JwtPayload = {
      sub: user.id.toString(),
      email: user.email,
      role: user.role || 'user',
      type: 'access',
    };

    const refreshPayload: JwtPayload = {
      sub: user.id.toString(),
      email: user.email,
      role: user.role || 'user',
      type: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload as any, {
        secret: JWT_CONSTANTS.accessTokenSecret,
        expiresIn: JWT_CONSTANTS.accessTokenExpiration,
      } as any),
      this.jwtService.signAsync(refreshPayload as any, {
        secret: JWT_CONSTANTS.refreshTokenSecret,
        expiresIn: JWT_CONSTANTS.refreshTokenExpiration,
      } as any),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }
}