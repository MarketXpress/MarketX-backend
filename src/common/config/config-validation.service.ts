import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface ConfigValidationRule {
  key: string;
  required: boolean;
  defaultValue?: string;
  description: string;
  validate?: (value: string) => boolean;
}

@Injectable()
export class ConfigValidationService implements OnModuleInit {
  private readonly logger = new Logger(ConfigValidationService.name);

  private readonly validationRules: ConfigValidationRule[] = [
    // Application
    {
      key: 'NODE_ENV',
      required: false,
      defaultValue: 'development',
      description: 'Node environment (development, production, test)',
      validate: (value) => ['development', 'production', 'test'].includes(value),
    },
    {
      key: 'PORT',
      required: false,
      defaultValue: '3000',
      description: 'Application port',
      validate: (value) => !isNaN(Number(value)) && Number(value) > 0,
    },
    {
      key: 'LOG_LEVEL',
      required: false,
      defaultValue: 'info',
      description: 'Logging level',
      validate: (value) => ['error', 'warn', 'info', 'debug'].includes(value),
    },

    // Database
    {
      key: 'DATABASE_HOST',
      required: false,
      defaultValue: 'localhost',
      description: 'PostgreSQL host',
    },
    {
      key: 'DATABASE_PORT',
      required: false,
      defaultValue: '5432',
      description: 'PostgreSQL port',
      validate: (value) => !isNaN(Number(value)) && Number(value) > 0,
    },
    {
      key: 'DATABASE_USER',
      required: true,
      description: 'PostgreSQL username',
    },
    {
      key: 'DATABASE_PASSWORD',
      required: true,
      description: 'PostgreSQL password',
    },
    {
      key: 'DATABASE_NAME',
      required: true,
      description: 'PostgreSQL database name',
    },

    // Redis
    {
      key: 'REDIS_HOST',
      required: false,
      defaultValue: 'localhost',
      description: 'Redis host',
    },
    {
      key: 'REDIS_PORT',
      required: false,
      defaultValue: '6379',
      description: 'Redis port',
      validate: (value) => !isNaN(Number(value)) && Number(value) > 0,
    },

    // RabbitMQ
    {
      key: 'AMQP_URL',
      required: false,
      defaultValue: 'amqp://guest:guest@localhost:5672',
      description: 'RabbitMQ connection URL',
    },

    // Authentication
    {
      key: 'JWT_ACCESS_SECRET',
      required: true,
      description: 'JWT access token secret',
      validate: (value) => value.length >= 32,
    },
    {
      key: 'JWT_REFRESH_SECRET',
      required: true,
      description: 'JWT refresh token secret',
      validate: (value) => value.length >= 32,
    },

    // AWS (required for file uploads and backups)
    {
      key: 'AWS_REGION',
      required: false,
      defaultValue: 'us-east-1',
      description: 'AWS region',
    },
    {
      key: 'AWS_S3_BUCKET',
      required: false,
      description: 'AWS S3 bucket for file storage',
    },
    {
      key: 'AWS_ACCESS_KEY_ID',
      required: false,
      description: 'AWS access key ID',
    },
    {
      key: 'AWS_SECRET_ACCESS_KEY',
      required: false,
      description: 'AWS secret access key',
    },

    // Payments (Stripe)
    {
      key: 'STRIPE_API_KEY',
      required: false,
      description: 'Stripe API key for payment processing',
      validate: (value) => value.startsWith('sk_'),
    },

    // Email (SendGrid)
    {
      key: 'SENDGRID_API_KEY',
      required: false,
      description: 'SendGrid API key for email sending',
      validate: (value) => value.startsWith('SG.'),
    },

    // CORS
    {
      key: 'CORS_ORIGIN',
      required: false,
      defaultValue: 'http://localhost:3000',
      description: 'Allowed CORS origins (comma-separated)',
    },
  ];

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    this.logger.log('Validating environment configuration...');
    await this.validateConfiguration();
    this.logger.log('Environment configuration validation completed');
  }

  private async validateConfiguration(): Promise<void> {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const rule of this.validationRules) {
      const value = this.configService.get<string>(rule.key);

      // Check if required and missing (no default value means it must be set)
      if (rule.required && (!value || value.trim() === '')) {
        errors.push(
          `Required config "${rule.key}" is missing. ${rule.description}`,
        );
        continue;
      }

      // If value exists, validate it
      if (value && rule.validate && !rule.validate(value)) {
        errors.push(
          `Invalid value for "${rule.key}": ${value}. ${rule.description}`,
        );
      }
    }

    // Log warnings
    warnings.forEach((warning) => this.logger.warn(warning));

    // Log errors and throw if any
    if (errors.length > 0) {
      errors.forEach((error) => this.logger.error(error));
      throw new Error(
        `Configuration validation failed with ${errors.length} error(s). Please check your .env file.`,
      );
    }

    if (warnings.length > 0) {
      this.logger.warn(
        `Configuration has ${warnings.length} warning(s). Consider setting explicit values for better control.`,
      );
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