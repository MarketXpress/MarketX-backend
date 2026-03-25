import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class RefreshTokenGuard extends AuthGuard('jwt-refresh') {
  constructor() {
    super();
  }

  handleRequest(err: any, user: any, info: any) {
    // You can throw a specific error here if the token is missing or invalid
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid or missing refresh token');
    }
    return user;
  }
}