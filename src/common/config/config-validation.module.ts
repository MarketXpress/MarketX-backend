import { Module } from '@nestjs/common';
import { ConfigValidationService } from './config-validation.service';

@Module({
  providers: [ConfigValidationService],
  exports: [ConfigValidationService],
})
export class ConfigValidationModule {}