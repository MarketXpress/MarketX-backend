import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Roles decorator - Specify required roles for an endpoint
 * 
 * @param roles - Array of role strings required to access the endpoint
 * 
 * @example
 * ```typescript
 * @Roles('admin', 'moderator')
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Get('protected')
 * async protectedEndpoint() {
 *   // Only admin or moderator can access
 * }
 * ```
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Admin decorator - Shorthand for admin-only access
 * 
 * @example
 * ```typescript
 * @Admin()
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Get('admin-only')
 * async adminOnlyEndpoint() {
 *   // Only admin can access
 * }
 * ```
 */
export const Admin = () => Roles('admin');

/**
 * Public decorator - Mark endpoint as public (no authentication required)
 * 
 * @example
 * ```typescript
 * @Public()
 * @Get('public')
 * async publicEndpoint() {
 *   // Anyone can access
 * }
 * ```
 */
export const Public = () => SetMetadata('isPublic', true);