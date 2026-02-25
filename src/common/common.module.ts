import { Module } from '@nestjs/common';
import { ThrottleGuard } from './guards/throttle.guard';
import { SecurityMiddleware } from './middleware/security.middleware';
import { LoggerModule } from './logger/logger.module';
import { EncryptionService } from './services/encryption.service';

/**
 * Common module for shared security, guards, middleware, and logging
 */
@Module({
  imports: [LoggerModule],
  providers: [ThrottleGuard, SecurityMiddleware, EncryptionService],
  exports: [ThrottleGuard, SecurityMiddleware, LoggerModule, EncryptionService],
})
export class CommonModule {}
