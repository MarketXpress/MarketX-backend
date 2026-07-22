import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
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
    // The payload contains 'sub' (userId) and 'email' from AuthService.getTokens().
    // Controllers across the app read req.user.id/req.user.role for identity and
    // authorization decisions (ownership checks, AdminGuard, RolesGuard), so both
    // must be populated here rather than just the raw JWT claims.
    let role: string | undefined;
    try {
      const user = await this.usersService.findOne(Number(payload.sub));
      role = user.role;
    } catch {
      throw new UnauthorizedException('Invalid or missing JWT token');
    }

    return {
      id: payload.sub,
      userId: payload.sub,
      email: payload.email,
      role,
    };
  }
}
