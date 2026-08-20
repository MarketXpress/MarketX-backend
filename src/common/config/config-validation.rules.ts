/**
 * Single source of truth for the environment variables the application needs.
 *
 * The same rule set is consumed twice:
 *
 *  - `ConfigModule.forRoot({ validate })` in `AppModule`, which runs before any
 *    provider is instantiated. This is the only place that can produce a
 *    consolidated error for variables that would otherwise blow up during DI
 *    resolution (for example `JWT_SECRET`, which makes passport-jwt throw
 *    "JwtStrategy requires a secret or key" long before any lifecycle hook).
 *  - `ConfigValidationService`, which re-checks the resolved `ConfigService` on
 *    module init and exposes a summary for diagnostics.
 *
 * Anything that must be present for the process to boot belongs here rather
 * than behind an ad-hoc `throw` in the component that consumes it, so that a
 * misconfigured deployment reports every problem at once instead of the first
 * one it happens to hit.
 */
export interface ConfigValidationRule {
  key: string;
  required: boolean;
  defaultValue?: string;
  description: string;
  validate?: (value: string) => boolean;
}

export const CONFIG_VALIDATION_RULES: ConfigValidationRule[] = [
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
    key: 'JWT_SECRET',
    required: true,
    description:
      'Signing secret for JwtModule and the passport JWT strategies. ' +
      'passport-jwt throws while the DI graph is being resolved when it is ' +
      'absent, so the application cannot boot without it.',
  },
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

  // Encryption
  {
    key: 'ENCRYPTION_SECRET',
    required: false,
    description:
      'Symmetric secret used by EncryptionService to envelope-encrypt data at ' +
      'rest. Falls back to a well-known development key, so it is not required ' +
      'to boot, but it must be set in any real deployment.',
  },

  // Webhooks
  {
    key: 'STELLAR_WEBHOOK_SECRET',
    required: true,
    description:
      'HMAC-SHA256 shared secret used to verify Stellar webhook signatures. ' +
      'There is deliberately no fallback: without it inbound webhooks could ' +
      'not be authenticated.',
  },

  // CORS
  {
    key: 'CORS_ORIGIN',
    required: false,
    defaultValue: 'http://localhost:3000',
    description: 'Allowed CORS origins (comma-separated)',
  },
];

/**
 * Collect every configuration problem instead of stopping at the first one, so
 * that a misconfigured environment can be fixed in a single pass.
 */
export function collectConfigErrors(
  read: (key: string) => string | undefined,
): string[] {
  const errors: string[] = [];

  for (const rule of CONFIG_VALIDATION_RULES) {
    const value = read(rule.key);

    // Required and missing (no default value means it must be set)
    if (rule.required && (!value || value.trim() === '')) {
      errors.push(
        `Required config "${rule.key}" is missing. ${rule.description}`,
      );
      continue;
    }

    if (value && rule.validate && !rule.validate(value)) {
      errors.push(
        `Invalid value for "${rule.key}": ${value}. ${rule.description}`,
      );
    }
  }

  return errors;
}

/**
 * Render the collected problems as one readable, self-contained message. The
 * detail lives in the thrown error rather than only in the logger so that a
 * failed boot is diagnosable from the process output alone.
 */
export function formatConfigErrors(errors: string[]): string {
  return [
    `Configuration validation failed with ${errors.length} error(s). Please check your .env file.`,
    ...errors.map((error) => `  - ${error}`),
  ].join('\n');
}

/**
 * `ConfigModule.forRoot({ validate })` entry point. Throws before any provider
 * is constructed, and returns the config untouched when everything is present.
 */
export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const errors = collectConfigErrors((key) => {
    const value = config[key];
    // Values come from process.env / .env, so anything present is a string;
    // narrow explicitly rather than stringifying an unexpected shape.
    return typeof value === 'string' ? value : undefined;
  });

  if (errors.length > 0) {
    throw new Error(formatConfigErrors(errors));
  }

  return config;
}
