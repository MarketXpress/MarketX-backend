import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    UnauthorizedException,
    Logger,
  } from '@nestjs/common';
  import { Reflector } from '@nestjs/core';
  import { Observable } from 'rxjs';
  
  /**
   * Admin Guard - Restricts access to admin-only endpoints
   * 
   * This guard checks if the authenticated user has admin role.
   * It should be used in conjunction with an authentication guard
   * to ensure the user is both authenticated and has admin privileges.
   * 
   * @example
   * ```typescript
   * @UseGuards(JwtAuthGuard, AdminGuard)
   * @Get('admin/users')
   * async getUsers() {
   *   // Only admin users can access this endpoint
   * }
   * ```
   */
  @Injectable()
  export class AdminGuard implements CanActivate {
    private readonly logger = new Logger(AdminGuard.name);
  
    constructor(private reflector: Reflector) {}
  
    canActivate(
      context: ExecutionContext,
    ): boolean | Promise<boolean> | Observable<boolean> {
      const request = context.switchToHttp().getRequest();
      const user = request.user;
  
      // Check if user is authenticated
      if (!user) {
        this.logger.warn('Admin guard: No user found in request. Ensure authentication guard is applied first.');
        throw new UnauthorizedException('Authentication required');
      }
  
      // Check if user has admin role
      if (user.role !== 'admin') {
        this.logger.warn(
          `Admin access denied for user ${user.id || 'unknown'} with role: ${user.role || 'undefined'}`,
        );
        throw new ForbiddenException('Admin access required');
      }
  
      this.logger.debug(`Admin access granted for user ${user.id}`);
      return true;
    }
  }
  