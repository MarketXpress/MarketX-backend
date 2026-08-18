import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConfigValidationService } from './config-validation.service';
import { validateEnvironment } from './config-validation.rules';

const VALID_CONFIG: Record<string, string> = {
  NODE_ENV: 'development',
  DATABASE_HOST: 'localhost',
  DATABASE_PORT: '5432',
  DATABASE_USER: 'postgres',
  DATABASE_PASSWORD: 'password',
  DATABASE_NAME: 'marketx',
  JWT_SECRET: 'super-secret-signing-key-that-is-long-enough',
  JWT_ACCESS_SECRET: 'super-secret-access-key-that-is-long-enough',
  JWT_REFRESH_SECRET: 'super-secret-refresh-key-that-is-long-enough',
  STELLAR_WEBHOOK_SECRET: 'stellar-webhook-shared-secret',
};

describe('ConfigValidationService', () => {
  let service: ConfigValidationService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigValidationService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => VALID_CONFIG[key]),
          },
        },
      ],
    }).compile();

    service = module.get<ConfigValidationService>(ConfigValidationService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should validate configuration successfully with valid values', async () => {
    await expect(service.onModuleInit()).resolves.not.toThrow();
  });

  it('should get validation summary', () => {
    const summary = service.getValidationSummary();
    expect(summary).toHaveProperty('totalRules');
    expect(summary).toHaveProperty('requiredRules');
    expect(summary).toHaveProperty('optionalRules');
    expect(summary).toHaveProperty('validatedRules');
    expect(summary.totalRules).toBeGreaterThan(0);
  });

  it('should fail validation with missing required config', async () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'DATABASE_USER') return undefined;
      return 'some-value';
    });

    await expect(service.onModuleInit()).rejects.toThrow(
      'Configuration validation failed',
    );
  });

  it('should fail validation with invalid JWT secret length', async () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'JWT_ACCESS_SECRET') return 'short';
      return 'some-value';
    });

    await expect(service.onModuleInit()).rejects.toThrow(
      'Configuration validation failed',
    );
  });

  it('should name a missing required variable in the consolidated error', async () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'STELLAR_WEBHOOK_SECRET') return undefined;
      return VALID_CONFIG[key];
    });

    await expect(service.onModuleInit()).rejects.toThrow(
      /Required config "STELLAR_WEBHOOK_SECRET" is missing/,
    );
  });

  it('should report every missing required variable in one error', async () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'STELLAR_WEBHOOK_SECRET' || key === 'JWT_SECRET') {
        return undefined;
      }
      return VALID_CONFIG[key];
    });

    await expect(service.onModuleInit()).rejects.toThrow(
      expect.objectContaining({
        message: expect.stringContaining('2 error(s)') as string,
      }),
    );

    await expect(service.onModuleInit()).rejects.toThrow(
      /JWT_SECRET[\s\S]*STELLAR_WEBHOOK_SECRET/,
    );
  });
});

describe('validateEnvironment', () => {
  it('returns the configuration when every required variable is present', () => {
    expect(validateEnvironment({ ...VALID_CONFIG })).toEqual(VALID_CONFIG);
  });

  it('throws a consolidated error naming each missing required variable', () => {
    const { STELLAR_WEBHOOK_SECRET, JWT_SECRET, ...incomplete } = VALID_CONFIG;
    expect(STELLAR_WEBHOOK_SECRET).toBeDefined();
    expect(JWT_SECRET).toBeDefined();

    expect(() => validateEnvironment(incomplete)).toThrow(
      /Configuration validation failed with 2 error\(s\)/,
    );
    expect(() => validateEnvironment(incomplete)).toThrow(
      /Required config "STELLAR_WEBHOOK_SECRET" is missing/,
    );
  });
});
