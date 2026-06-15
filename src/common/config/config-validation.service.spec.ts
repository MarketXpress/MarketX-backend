import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConfigValidationService } from './config-validation.service';

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
            get: jest.fn((key: string) => {
              const mockValues: Record<string, string> = {
                NODE_ENV: 'development',
                DATABASE_HOST: 'localhost',
                DATABASE_PORT: '5432',
                DATABASE_USER: 'postgres',
                DATABASE_PASSWORD: 'password',
                DATABASE_NAME: 'marketx',
                JWT_ACCESS_SECRET: 'super-secret-access-key-that-is-long-enough',
                JWT_REFRESH_SECRET: 'super-secret-refresh-key-that-is-long-enough',
              };
              return mockValues[key];
            }),
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
});