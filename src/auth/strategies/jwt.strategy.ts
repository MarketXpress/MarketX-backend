import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') as string,
    });
  }

  async validate(payload: any) {
    // Hydrate the user so downstream guards/controllers have role and id data.
    const user = await this.usersService.findByEmail(payload.email);

    if (!user) {
      return { id: payload.sub, userId: payload.sub, email: payload.email };
    }

    const { password, refreshToken, ...safeUser } = user as any;
    return {
      ...safeUser,
      id: user.id,
      userId: user.id,
      email: user.email,
      role: user.role,
      isBanned: user.isBanned,
    };
  }
}
