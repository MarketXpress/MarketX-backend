import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CONFIG_VALIDATION_RULES,
  collectConfigErrors,
  formatConfigErrors,
} from './config-validation.rules';

@Injectable()
export class ConfigValidationService implements OnModuleInit {
  private readonly logger = new Logger(ConfigValidationService.name);

  private readonly validationRules = CONFIG_VALIDATION_RULES;

  constructor(private readonly configService: ConfigService) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  async onModuleInit() {
    this.logger.log('Validating environment configuration...');
    this.validateConfiguration();
    this.logger.log('Environment configuration validation completed');
  }

  private validateConfiguration(): void {
    const errors = collectConfigErrors((key) =>
      this.configService.get<string>(key),
    );

    if (errors.length > 0) {
      errors.forEach((error) => this.logger.error(error));
      throw new Error(formatConfigErrors(errors));
    }
  }

  /**
   * Get validation summary for debugging
   */
  getValidationSummary(): {
    totalRules: number;
    requiredRules: number;
    optionalRules: number;
    validatedRules: number;
  } {
    const totalRules = this.validationRules.length;
    const requiredRules = this.validationRules.filter((r) => r.required).length;
    const optionalRules = totalRules - requiredRules;
    const validatedRules = this.validationRules.filter((rule) => {
      const value = this.configService.get<string>(rule.key);
      return value && value.trim() !== '';
    }).length;

    return {
      totalRules,
      requiredRules,
      optionalRules,
      validatedRules,
    };
  }
}
