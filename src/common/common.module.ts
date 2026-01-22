import { Module } from '@nestjs/common';
import { ThrottleGuard } from './guards/throttle.guard';
import { SecurityMiddleware } from './middleware/security.middleware';

/**
 * Common module for shared security, guards, and middleware
 */
@Module({
  providers: [ThrottleGuard, SecurityMiddleware],
  exports: [ThrottleGuard, SecurityMiddleware],
})
export class CommonModule {}
