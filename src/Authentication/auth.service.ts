import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { User } from './user.entity';
import { Users } from '../users/users.entity';
import { RegisterDto, AuthResponseDto } from './auth.dto';
import { JwtPayload, JWT_CONSTANTS } from './jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

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
    return await this.login(user as any);
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
}