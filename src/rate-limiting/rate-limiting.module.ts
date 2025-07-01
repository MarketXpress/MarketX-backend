import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RateLimitService } from './rate-limit.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [RateLimitService],
  exports: [RateLimitService],
})
export class RateLimitingModule {
  constructor(private readonly rateLimitService: RateLimitService) {
    // Load configurations on module initialization
    this.rateLimitService.loadConfigurations();
  }
}
