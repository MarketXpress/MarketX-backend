import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    UnauthorizedException,
    Logger,
  } from '@nestjs/common';
  import { Reflector } from '@nestjs/core';
  import { ROLES_KEY } from '../decorators/roles.decorator';
  
  /**
   * Flexible Roles Guard - Supports multiple roles
   * 
   * This guard can check for multiple roles and is more flexible than AdminGuard.
   * Use this when you need to allow access to multiple roles.
   */
  @Injectable()
  export class RolesGuard implements CanActivate {
    private readonly logger = new Logger(RolesGuard.name);
  
    constructor(private reflector: Reflector) {}
  
    canActivate(context: ExecutionContext): boolean {
      const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
  
      if (!requiredRoles) {
        return true; // No roles required
      }
  
      const request = context.switchToHttp().getRequest();
      const user = request.user;
  
      if (!user) {
        this.logger.warn('Roles guard: No user found in request');
        throw new UnauthorizedException('Authentication required');
      }
  
      const hasRole = requiredRoles.includes(user.role);
      
      if (!hasRole) {
        this.logger.warn(
          `Access denied for user ${user.id} with role ${user.role}. Required roles: ${requiredRoles.join(', ')}`,
        );
        throw new ForbiddenException(`Required roles: ${requiredRoles.join(', ')}`);
      }
  
      this.logger.debug(`Access granted for user ${user.id} with role ${user.role}`);
      return true;
    }
  }
  