import { Module, OnModuleInit } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';

@Module({
  providers: [RateLimitService],
  exports: [RateLimitService],
})
export class RateLimitingModule implements OnModuleInit {
  constructor(private readonly rateLimitService: RateLimitService) {}

  async onModuleInit() {
    await this.rateLimitService.loadConfigurations();
  }
}
