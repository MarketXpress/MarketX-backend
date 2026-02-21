import { Test, TestingModule } from '@nestjs/testing';
import { SellersAnalyticsController } from './sellers-analytics.controller';
import { AnalyticsService } from './analytics.service';

describe('SellersAnalyticsController', () => {
  let controller: SellersAnalyticsController;
  let analyticsService: AnalyticsService;

  const mockAnalyticsService = {
    getSellerSalesAnalytics: jest.fn(),
    getSellerProductPerformance: jest.fn(),
    getSellerCustomerDemographics: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SellersAnalyticsController],
      providers: [
        {
          provide: AnalyticsService,
          useValue: mockAnalyticsService,
        },
      ],
    }).compile();

    controller = module.get<SellersAnalyticsController>(SellersAnalyticsController);
    analyticsService = module.get<AnalyticsService>(AnalyticsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getSales', () => {
    it('should return sales analytics for a seller', async () => {
      const mockQuery = {
        sellerId: 'seller-1',
        startDate: '2026-01-01',
        endDate: '2026-02-01',
        granularity: 'daily' as const,
      };

      const mockResult = {
        data: {
          totalRevenue: 5000,
          totalOrders: 25,
          series: [{ period: '2026-01-01', orders: 5, revenue: 500 }],
        },
      };

      mockAnalyticsService.getSellerSalesAnalytics.mockResolvedValue(mockResult);

      const result = await controller.getSales(mockQuery);

      expect(mockAnalyticsService.getSellerSalesAnalytics).toHaveBeenCalledWith(
        'seller-1',
        mockQuery,
      );
      expect(result).toEqual(mockResult.data);
    });

    it('should throw BadRequestException when sellerId is missing', async () => {
      const mockQuery = {
        sellerId: '',
        startDate: '2026-01-01',
        endDate: '2026-02-01',
      };

      await expect(controller.getSales(mockQuery)).rejects.toThrow(
        'sellerId is required',
      );
    });

    it('should export CSV when export param is csv', async () => {
      const mockQuery = {
        sellerId: 'seller-1',
        export: 'csv' as const,
      };

      const mockResult = {
        csv: 'period,orders,revenue\n2026-01-01,5,500',
      };

      mockAnalyticsService.getSellerSalesAnalytics.mockResolvedValue(mockResult);

      const result = await controller.getSales(mockQuery);

      expect(result).toEqual({ csv: mockResult.csv });
    });
  });

  describe('getProducts', () => {
    it('should return product performance analytics for a seller', async () => {
      const mockQuery = {
        sellerId: 'seller-1',
        limit: 10,
      };

      const mockResult = {
        data: [
          {
            listingId: 'listing-1',
            title: 'Product 1',
            unitsSold: 50,
            revenue: 2500,
          },
        ],
      };

      mockAnalyticsService.getSellerProductPerformance.mockResolvedValue(
        mockResult,
      );

      const result = await controller.getProducts(mockQuery);

      expect(mockAnalyticsService.getSellerProductPerformance).toHaveBeenCalledWith(
        'seller-1',
        mockQuery,
      );
      expect(result).toEqual(mockResult.data);
    });

    it('should throw BadRequestException when sellerId is missing', async () => {
      const mockQuery = {
        sellerId: '',
        limit: 10,
      };

      await expect(controller.getProducts(mockQuery)).rejects.toThrow(
        'sellerId is required',
      );
    });

    it('should export CSV when export param is csv', async () => {
      const mockQuery = {
        sellerId: 'seller-1',
        export: 'csv' as const,
      };

      const mockResult = {
        csv: 'listingId,title,unitsSold,revenue\nlisting-1,Product 1,50,2500',
      };

      mockAnalyticsService.getSellerProductPerformance.mockResolvedValue(
        mockResult,
      );

      const result = await controller.getProducts(mockQuery);

      expect(result).toEqual({ csv: mockResult.csv });
    });
  });

  describe('getCustomerDemographics', () => {
    it('should return customer demographics for a seller', async () => {
      const mockQuery = {
        sellerId: 'seller-1',
      };

      const mockResult = {
        data: {
          totalUniqueCustomers: 450,
          totalCustomerRevenue: 45000,
          avgCustomerLifetimeValue: 100,
          repeatCustomers: 180,
          topCustomers: [
            {
              customerId: 'user-001',
              customerName: 'John Smith',
              purchaseCount: 25,
              totalSpent: 2500,
              avgOrderValue: 100,
            },
          ],
        },
      };

      mockAnalyticsService.getSellerCustomerDemographics.mockResolvedValue(
        mockResult,
      );

      const result = await controller.getCustomerDemographics(mockQuery);

      expect(mockAnalyticsService.getSellerCustomerDemographics).toHaveBeenCalledWith(
        'seller-1',
        mockQuery,
      );
      expect(result).toEqual(mockResult.data);
    });

    it('should throw BadRequestException when sellerId is missing', async () => {
      const mockQuery = {
        sellerId: '',
      };

      await expect(controller.getCustomerDemographics(mockQuery)).rejects.toThrow(
        'sellerId is required',
      );
    });

    it('should export CSV when export param is csv', async () => {
      const mockQuery = {
        sellerId: 'seller-1',
        export: 'csv' as const,
      };

      const mockResult = {
        csv: 'customerId,customerName,purchaseCount,totalSpent,avgOrderValue\nuser-001,John Smith,25,2500,100',
      };

      mockAnalyticsService.getSellerCustomerDemographics.mockResolvedValue(
        mockResult,
      );

      const result = await controller.getCustomerDemographics(mockQuery);

      expect(result).toEqual({ csv: mockResult.csv });
    });
  });
});
