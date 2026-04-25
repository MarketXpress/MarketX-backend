import { Test, TestingModule } from '@nestjs/testing';
import { CurrencyService } from './currency.service';
import { ExchangeRateService } from './exchange-rate.service';

describe('CurrencyService', () => {
  let service: CurrencyService;
  let exchangeRateService: ExchangeRateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurrencyService,
        {
          provide: ExchangeRateService,
          useValue: {
            getRates: jest.fn().mockResolvedValue({
              USD: 1,
              EUR: 0.92,
              GBP: 0.79,
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CurrencyService>(CurrencyService);
    exchangeRateService = module.get<ExchangeRateService>(ExchangeRateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return same amount for same currency', async () => {
    const result = await service.convert(100, 'USD', 'USD');
    expect(result.amount).toBe(100);
    expect(result.rate).toBe(1);
  });

  it('should convert USD to EUR', async () => {
    const result = await service.convert(100, 'USD', 'EUR');
    expect(result.amount).toBe(92);
    expect(result.rate).toBeCloseTo(0.92);
  });

  it('should convert EUR to GBP', async () => {
    const result = await service.convert(100, 'EUR', 'GBP');
    expect(result.amount).toBeCloseTo(85.87, 1);
  });
});
