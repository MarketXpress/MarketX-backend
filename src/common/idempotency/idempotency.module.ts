import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { IdempotencyService } from './idempotency.service';

@Global()
@Module({
  imports: [CacheModule.register()],
  providers: [IdempotencyService],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
