import { Test, TestingModule } from '@nestjs/testing';
import { PriceService } from './price.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { SupportedCurrency } from './dto/conversion.dto';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockRatesResponse = {
  data: {
    stellar: { usd: 0.12 },
    'usd-coin': { usd: 1.0 },
  },
  status: 200,
  statusText: 'OK',
  headers: {},
  config: { headers: {} as any },
} as any;

describe('PriceService', () => {
  let service: PriceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PriceService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(null) } },
      ],
    }).compile();

    service = module.get<PriceService>(PriceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('refreshRates', () => {
    it('should fetch and cache live rates', async () => {
      mockedAxios.get.mockResolvedValue(mockRatesResponse);

      await service.refreshRates();
      const rates = service.getRates();

      expect(rates.XLM_USD).toBe(0.12);
      expect(rates.USDC_USD).toBe(1.0);
      expect(rates.source).toBe('live');
    });

    it('should fall back to last known rates on API failure', async () => {
      // First load good rates
      mockedAxios.get.mockResolvedValueOnce(mockRatesResponse);
      await service.refreshRates();

      // Then simulate failure
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));
      await service.refreshRates();

      const rates = service.getRates();
      expect(rates.source).toBe('fallback');
      expect(rates.XLM_USD).toBe(0.12); // last known value preserved
    });

    it('should use hardcoded fallback if no rates ever loaded', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));
      await service.refreshRates();

      const rates = service.getRates();
      expect(rates.source).toBe('fallback');
      expect(rates.XLM_USD).toBe(0.11); // hardcoded default
    });
  });

  describe('convert', () => {
    beforeEach(async () => {
      mockedAxios.get.mockResolvedValue(mockRatesResponse);
      await service.refreshRates();
    });

    it('should convert XLM to USD', () => {
      const result = service.convert(SupportedCurrency.XLM, SupportedCurrency.USD, 100);
      expect(result.result).toBeCloseTo(12, 1);
    });

    it('should convert USD to XLM', () => {
      const result = service.convert(SupportedCurrency.USD, SupportedCurrency.XLM, 12);
      expect(result.result).toBeCloseTo(100, 1);
    });

    it('should return 1:1 rate for same currency', () => {
      const result = service.convert(SupportedCurrency.XLM, SupportedCurrency.XLM, 50);
      expect(result.result).toBe(50);
      expect(result.rate).toBe(1);
    });

    it('should convert XLM to USDC', () => {
      const result = service.convert(SupportedCurrency.XLM, SupportedCurrency.USDC, 100);
      expect(result.result).toBeCloseTo(12, 1);
    });
  });
});