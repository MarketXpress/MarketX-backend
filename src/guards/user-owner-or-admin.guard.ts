import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * UserOwnerOrAdminGuard
 *
 * Ensures the authenticated caller is either the owner of the user resource
 * (matched by the route `:id` parameter) or possesses the 'admin' role.
 *
 * If no user is attached to request (unauthenticated), throws UnauthorizedException.
 * If user is neither the owner nor an admin, throws ForbiddenException.
 */
@Injectable()
export class UserOwnerOrAdminGuard implements CanActivate {
  private readonly logger = new Logger(UserOwnerOrAdminGuard.name);

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Check if user is authenticated
    if (!user) {
      this.logger.warn(
        'UserOwnerOrAdmin guard: No user found in request. Authentication required.',
      );
      throw new UnauthorizedException('Authentication required');
    }

    // Check if user has admin role
    if (user.role === 'admin') {
      this.logger.debug(
        `UserOwnerOrAdmin: Admin access granted for user ${user.id ?? user.userId}`,
      );
      return true;
    }

    // Check ownership against the route parameter :id
    const paramId = request.params?.id;
    const callerId =
      user.id !== undefined ? String(user.id) : String(user.userId ?? '');

    if (paramId !== undefined && String(paramId) === callerId) {
      this.logger.debug(
        `UserOwnerOrAdmin: Owner access granted for user ${callerId}`,
      );
      return true;
    }

    this.logger.warn(
      `UserOwnerOrAdmin: Access denied for caller ${callerId} with role '${user.role}' on target resource '${paramId}'`,
    );
    throw new ForbiddenException(
      'Access denied: You can only access your own account or must be an admin',
    );
  }
}
