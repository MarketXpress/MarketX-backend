import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class TwoFAGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // from JWT payload
    const code = request.headers['x-2fa-code']; // client sends 2FA code in header

    if (user.twoFAEnabled) {
      if (!code) throw new ForbiddenException('2FA code required');
      const isValid = await this.authService.verify2FA(user.id, code);
      if (!isValid) throw new ForbiddenException('Invalid 2FA code');
    }

    return true;
  }
}
