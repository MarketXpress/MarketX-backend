import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderStatus } from './dto/create-order.dto';

describe('OrdersService', () => {
  let service: OrdersService;
  let mockRepository: any;

  beforeEach(async () => {
    mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: getRepositoryToken(Order),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new order', async () => {
      const createOrderDto = {
        items: [{ productId: '1', quantity: 2 }],
        buyerId: 'user123',
      };

      const expectedResult = {
        id: 'generated-id',
        totalAmount: 21.98,
        status: OrderStatus.PENDING,
        items: [
          {
            productId: '1',
            productName: 'Product 1',
            quantity: 2,
            price: 10.99,
            subtotal: 21.98,
          },
        ],
        buyerId: 'user123',
      };

      mockRepository.create.mockReturnValue(expectedResult);
      mockRepository.save.mockResolvedValue(expectedResult);

      const result = await service.create(createOrderDto);

      expect(result).toEqual(expectedResult);
      expect(mockRepository.create).toHaveBeenCalledWith({
        totalAmount: 21.98,
        status: OrderStatus.PENDING,
        items: [
          {
            productId: '1',
            productName: 'Product 1',
            quantity: 2,
            price: 10.99,
            subtotal: 21.98,
          },
        ],
        buyerId: 'user123',
      });
    });
  });

  describe('findAll', () => {
    it('should return all orders', async () => {
      const orders = [
        {
          id: '1',
          totalAmount: 21.98,
          status: OrderStatus.PENDING,
          buyerId: 'user123',
        },
      ];

      mockRepository.find.mockResolvedValue(orders);

      const result = await service.findAll();

      expect(result).toEqual(orders);
      expect(mockRepository.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
      });
    });

    it('should return orders for a specific buyer', async () => {
      const orders = [
        {
          id: '1',
          totalAmount: 21.98,
          status: OrderStatus.PENDING,
          buyerId: 'user123',
        },
      ];

      mockRepository.find.mockResolvedValue(orders);

      const result = await service.findAll('user123');

      expect(result).toEqual(orders);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { buyerId: 'user123' },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findOne', () => {
    it('should return an order by id', async () => {
      const order = {
        id: '1',
        totalAmount: 21.98,
        status: OrderStatus.PENDING,
        buyerId: 'user123',
      };

      mockRepository.findOne.mockResolvedValue(order);

      const result = await service.findOne('1');

      expect(result).toEqual(order);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });
  });

  describe('updateStatus', () => {
    it('should update order status', async () => {
      const order = {
        id: '1',
        totalAmount: 21.98,
        status: OrderStatus.PENDING,
        buyerId: 'user123',
        updatedAt: new Date(),
      };

      const updateDto = {
        status: OrderStatus.PAID,
      };

      mockRepository.findOne.mockResolvedValue(order);
      mockRepository.save.mockResolvedValue({ ...order, status: OrderStatus.PAID });

      const result = await service.updateStatus('1', updateDto);

      expect(result.status).toBe(OrderStatus.PAID);
    });

    it('should reject invalid state transitions', async () => {
      const order = {
        id: '1',
        totalAmount: 21.98,
        status: OrderStatus.DELIVERED,
        buyerId: 'user123',
        updatedAt: new Date(),
      };

      const updateDto = {
        status: OrderStatus.PENDING,
      };

      mockRepository.findOne.mockResolvedValue(order);

      await expect(service.updateStatus('1', updateDto)).rejects.toThrow(
        'Invalid state transition from delivered to pending'
      );
    });
  });

  describe('cancelOrder', () => {
    it('should cancel an order', async () => {
      const order = {
        id: '1',
        totalAmount: 21.98,
        status: OrderStatus.PENDING,
        buyerId: 'user123',
        updatedAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(order);
      mockRepository.save.mockResolvedValue({ ...order, status: OrderStatus.CANCELLED });

      const result = await service.cancelOrder('1', 'user123');

      expect(result.status).toBe(OrderStatus.CANCELLED);
    });

    it('should reject cancellation for delivered orders', async () => {
      const order = {
        id: '1',
        totalAmount: 21.98,
        status: OrderStatus.DELIVERED,
        buyerId: 'user123',
        updatedAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(order);

      await expect(service.cancelOrder('1', 'user123')).rejects.toThrow(
        'Cannot cancel order with status delivered. Only pending or paid orders can be cancelled.'
      );
    });
  });
});