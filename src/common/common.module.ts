import { Module } from '@nestjs/common';
import { ThrottleGuard } from './guards/throttle.guard';
import { SecurityMiddleware } from './middleware/security.middleware';
import { LoggerModule } from './logger/logger.module';

/**
 * Common module for shared security, guards, middleware, and logging
 */
@Module({
  imports: [LoggerModule],
  providers: [ThrottleGuard, SecurityMiddleware],
  exports: [ThrottleGuard, SecurityMiddleware, LoggerModule],
})
export class CommonModule {}
