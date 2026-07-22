import { Test, TestingModule } from '@nestjs/testing';
import { OrdersExportService } from './orders-export.service';
import { Order, OrderStatus } from './entities/order.entity';
import { SupportedCurrency } from '../products/services/pricing.service';

describe('OrdersExportService', () => {
  let service: OrdersExportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrdersExportService],
    }).compile();

    service = module.get<OrdersExportService>(OrdersExportService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('exportAsCsv', () => {
    it('should write CSV data to response', () => {
      const mockResponse = {
        setHeader: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
        on: jest.fn(),
        once: jest.fn(),
        emit: jest.fn(),
      } as any;

      const mockOrders = [
        {
          id: '1',
          status: OrderStatus.PENDING,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          totalAmount: 100,
          items: [
            {
              productName: 'Item A',
              subtotal: 50,
              quantity: 1,
              price: 50,
              priceCurrency: SupportedCurrency.USD,
              productId: 'p1',
            },
            {
              productName: 'Item B',
              subtotal: 50,
              quantity: 1,
              price: 50,
              priceCurrency: SupportedCurrency.USD,
              productId: 'p2',
            },
          ],
        } as unknown as Order,
        {
          id: '2',
          status: OrderStatus.PAID,
          createdAt: new Date('2026-01-02T00:00:00Z'),
          totalAmount: 200,
          items: [],
        } as unknown as Order,
      ];

      service.exportAsCsv(mockOrders, mockResponse);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/csv',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename=orders.csv',
      );
    });
  });

  describe('exportAsPdf', () => {
    it('should generate PDF and pipe to response', () => {
      const mockResponse = {
        setHeader: jest.fn(),
        on: jest.fn(),
        once: jest.fn(),
        emit: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
      } as any;

      const mockOrders = [
        {
          id: '1',
          status: OrderStatus.PENDING,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          totalAmount: 100,
          currency: SupportedCurrency.USD,
          items: [
            {
              productName: 'Item A',
              subtotal: 50,
              quantity: 1,
              price: 50,
              priceCurrency: SupportedCurrency.USD,
              productId: 'p1',
            },
          ],
        } as unknown as Order,
      ];

      service.exportAsPdf(mockOrders, mockResponse);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/pdf',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename=orders.pdf',
      );
    });
  });
});
