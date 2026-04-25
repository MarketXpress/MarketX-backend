import { Test, TestingModule } from '@nestjs/testing';
import { ExchangeRateService } from './exchange-rate.service';
import { RedisCacheService } from '../redis-caching/redis-cache.service';

describe('ExchangeRateService', () => {
  let service: ExchangeRateService;
  let cacheService: RedisCacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExchangeRateService,
        {
          provide: RedisCacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ExchangeRateService>(ExchangeRateService);
    cacheService = module.get<RedisCacheService>(RedisCacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return cached rates if available', async () => {
    const mockRates = { USD: 1, EUR: 0.92, GBP: 0.79 };
    jest.spyOn(cacheService, 'get').mockResolvedValue(mockRates);

    const rates = await service.getRates();
    expect(rates).toEqual(mockRates);
  });

  it('should return fallback rates if cache is empty', async () => {
    jest.spyOn(cacheService, 'get').mockResolvedValue(null);

    const rates = await service.getRates();
    expect(rates.USD).toBe(1);
    expect(rates.EUR).toBeDefined();
  });
});
