import { Module } from '@nestjs/common';
import { RateLimitConfigController } from './rate-limit-config.controller';
import { RateLimitingModule } from '../rate-limiting/rate-limiting.module';

@Module({
  imports: [RateLimitingModule],
  controllers: [RateLimitConfigController],
})
export class AdminModule {}
