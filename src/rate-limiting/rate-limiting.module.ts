import { Module } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';

@Module({
  providers: [RateLimitService],
  exports: [RateLimitService],
})
export class RateLimitingModule {
  constructor(private readonly rateLimitService: RateLimitService) {
    this.rateLimitService.configure();
  }
}
