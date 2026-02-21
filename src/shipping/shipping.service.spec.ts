import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { ShippingService } from './shipping.service';
import { Shipment } from './entities/shipment.entity';
import { Order } from '../orders/entities/order.entity';
import { ShipmentStatus, ShippingCarrier } from './dto/create-shipment.dto';
import { OrderStatus } from '../orders/dto/create-order.dto';

describe('ShippingService', () => {
  let service: ShippingService;
  let mockShipmentsRepo: any;
  let mockOrdersRepo: any;
  let mockEventEmitter: any;

  const testOrderId = 'order-123';
  const testTrackingNumber = '1Z999AA10123456784';

  const mockShippingAddress = {
    street: '123 Main St',
    city: 'Springfield',
    state: 'IL',
    postalCode: '62701',
    country: 'US',
  };

  beforeEach(async () => {
    mockShipmentsRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    mockOrdersRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShippingService,
        {
          provide: getRepositoryToken(Shipment),
          useValue: mockShipmentsRepo,
        },
        {
          provide: getRepositoryToken(Order),
          useValue: mockOrdersRepo,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<ShippingService>(ShippingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createShipment', () => {
    it('should create a shipment for a PAID order', async () => {
      const mockOrder: Partial<Order> = {
        id: testOrderId,
        status: OrderStatus.PAID,
        buyerId: 'buyer-123',
      };

      const mockShipment: Partial<Shipment> = {
        id: 'shipment-123',
        orderId: testOrderId,
        carrier: ShippingCarrier.UPS,
        trackingNumber: testTrackingNumber,
        status: ShipmentStatus.LABEL_CREATED,
        shippingAddress: mockShippingAddress,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockOrdersRepo.findOne.mockResolvedValue(mockOrder);
      mockShipmentsRepo.findOne.mockResolvedValue(null); // No existing shipment
      mockShipmentsRepo.create.mockReturnValue(mockShipment);
      mockShipmentsRepo.save.mockResolvedValue(mockShipment);
      mockOrdersRepo.save.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.SHIPPED,
      });

      const result = await service.createShipment({
        orderId: testOrderId,
        carrier: ShippingCarrier.UPS,
        trackingNumber: testTrackingNumber,
        shippingAddress: mockShippingAddress,
      });

      expect(result.id).toBe('shipment-123');
      expect(result.status).toBe(ShipmentStatus.LABEL_CREATED);
      expect(result.carrier).toBe(ShippingCarrier.UPS);
      expect(mockShipmentsRepo.save).toHaveBeenCalledTimes(1);
      expect(mockOrdersRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: OrderStatus.SHIPPED,
          trackingNumber: testTrackingNumber,
        }),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'shipment.created',
        expect.any(Object),
      );
    });

    it('should throw error if order not found', async () => {
      mockOrdersRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createShipment({
          orderId: 'non-existent',
          carrier: ShippingCarrier.FEDEX,
          trackingNumber: testTrackingNumber,
          shippingAddress: mockShippingAddress,
        }),
      ).rejects.toThrow('Order with ID');
    });

    it('should throw error if order is not in PAID status', async () => {
      const mockOrder: Partial<Order> = {
        id: testOrderId,
        status: OrderStatus.PENDING,
        buyerId: 'buyer-123',
      };

      mockOrdersRepo.findOne.mockResolvedValue(mockOrder);

      await expect(
        service.createShipment({
          orderId: testOrderId,
          carrier: ShippingCarrier.DHL,
          trackingNumber: testTrackingNumber,
          shippingAddress: mockShippingAddress,
        }),
      ).rejects.toThrow('Order must be in PAID status');
    });

    it('should throw error if shipment already exists for order', async () => {
      const mockOrder: Partial<Order> = {
        id: testOrderId,
        status: OrderStatus.PAID,
        buyerId: 'buyer-123',
      };

      const existingShipment: Partial<Shipment> = {
        id: 'existing-shipment',
        orderId: testOrderId,
      };

      mockOrdersRepo.findOne.mockResolvedValue(mockOrder);
      mockShipmentsRepo.findOne.mockResolvedValue(existingShipment);

      await expect(
        service.createShipment({
          orderId: testOrderId,
          carrier: ShippingCarrier.USPS,
          trackingNumber: testTrackingNumber,
          shippingAddress: mockShippingAddress,
        }),
      ).rejects.toThrow('A shipment already exists');
    });
  });

  describe('updateStatus', () => {
    it('should update shipment status with valid transition', async () => {
      const mockShipment: Partial<Shipment> = {
        id: 'shipment-123',
        orderId: testOrderId,
        status: ShipmentStatus.LABEL_CREATED,
        carrier: ShippingCarrier.UPS,
        trackingNumber: testTrackingNumber,
        shippingAddress: mockShippingAddress,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockShipmentsRepo.findOne.mockResolvedValue(mockShipment);
      mockShipmentsRepo.save.mockResolvedValue({
        ...mockShipment,
        status: ShipmentStatus.PICKED_UP,
      });
      mockOrdersRepo.findOne.mockResolvedValue({ id: testOrderId });

      const result = await service.updateStatus('shipment-123', {
        status: ShipmentStatus.PICKED_UP,
      });

      expect(result.status).toBe(ShipmentStatus.PICKED_UP);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'shipment.status_updated',
        expect.objectContaining({
          previousStatus: ShipmentStatus.LABEL_CREATED,
          newStatus: ShipmentStatus.PICKED_UP,
        }),
      );
    });

    it('should sync order status to DELIVERED when shipment is delivered', async () => {
      const mockShipment: Partial<Shipment> = {
        id: 'shipment-123',
        orderId: testOrderId,
        status: ShipmentStatus.OUT_FOR_DELIVERY,
        carrier: ShippingCarrier.FEDEX,
        trackingNumber: testTrackingNumber,
        shippingAddress: mockShippingAddress,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockOrder: Partial<Order> = {
        id: testOrderId,
        status: OrderStatus.SHIPPED,
      };

      mockShipmentsRepo.findOne.mockResolvedValue(mockShipment);
      mockShipmentsRepo.save.mockResolvedValue({
        ...mockShipment,
        status: ShipmentStatus.DELIVERED,
        actualDeliveryDate: new Date(),
      });
      mockOrdersRepo.findOne.mockResolvedValue(mockOrder);
      mockOrdersRepo.save.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.DELIVERED,
      });

      const result = await service.updateStatus('shipment-123', {
        status: ShipmentStatus.DELIVERED,
      });

      expect(result.status).toBe(ShipmentStatus.DELIVERED);
      expect(mockOrdersRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: OrderStatus.DELIVERED }),
      );
    });

    it('should reject invalid state transitions', async () => {
      const mockShipment: Partial<Shipment> = {
        id: 'shipment-123',
        orderId: testOrderId,
        status: ShipmentStatus.DELIVERED,
        carrier: ShippingCarrier.UPS,
        trackingNumber: testTrackingNumber,
      };

      mockShipmentsRepo.findOne.mockResolvedValue(mockShipment);

      await expect(
        service.updateStatus('shipment-123', {
          status: ShipmentStatus.IN_TRANSIT,
        }),
      ).rejects.toThrow('Invalid state transition');
    });

    it('should throw error if shipment not found', async () => {
      mockShipmentsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus('non-existent', {
          status: ShipmentStatus.PICKED_UP,
        }),
      ).rejects.toThrow('Shipment with ID');
    });
  });

  describe('findByTrackingNumber', () => {
    it('should return shipment by tracking number', async () => {
      const mockShipment: Partial<Shipment> = {
        id: 'shipment-123',
        orderId: testOrderId,
        carrier: ShippingCarrier.UPS,
        trackingNumber: testTrackingNumber,
        status: ShipmentStatus.IN_TRANSIT,
        shippingAddress: mockShippingAddress,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockShipmentsRepo.findOne.mockResolvedValue(mockShipment);

      const result = await service.findByTrackingNumber(testTrackingNumber);

      expect(result.trackingNumber).toBe(testTrackingNumber);
      expect(result.carrier).toBe(ShippingCarrier.UPS);
    });

    it('should throw error if tracking number not found', async () => {
      mockShipmentsRepo.findOne.mockResolvedValue(null);

      await expect(service.findByTrackingNumber('INVALID')).rejects.toThrow(
        'Shipment with tracking number',
      );
    });
  });

  describe('findByOrderId', () => {
    it('should return shipment for an order', async () => {
      const mockShipment: Partial<Shipment> = {
        id: 'shipment-123',
        orderId: testOrderId,
        carrier: ShippingCarrier.DHL,
        trackingNumber: testTrackingNumber,
        status: ShipmentStatus.LABEL_CREATED,
        shippingAddress: mockShippingAddress,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockShipmentsRepo.findOne.mockResolvedValue(mockShipment);

      const result = await service.findByOrderId(testOrderId);

      expect(result.orderId).toBe(testOrderId);
    });

    it('should throw error if no shipment for order', async () => {
      mockShipmentsRepo.findOne.mockResolvedValue(null);

      await expect(service.findByOrderId('no-shipment-order')).rejects.toThrow(
        'Shipment for order',
      );
    });
  });

  describe('getCarrierInfo', () => {
    it('should return all 5 supported carriers', () => {
      const carriers = service.getCarrierInfo();

      expect(carriers).toHaveLength(5);

      const carrierNames = carriers.map((c) => c.carrier);
      expect(carrierNames).toContain(ShippingCarrier.UPS);
      expect(carrierNames).toContain(ShippingCarrier.FEDEX);
      expect(carrierNames).toContain(ShippingCarrier.DHL);
      expect(carrierNames).toContain(ShippingCarrier.USPS);
      expect(carrierNames).toContain(ShippingCarrier.LOCAL);
    });

    it('should include tracking URL templates for all carriers', () => {
      const carriers = service.getCarrierInfo();

      carriers.forEach((carrier) => {
        expect(carrier).toHaveProperty('trackingUrlTemplate');
        expect(carrier).toHaveProperty('estimatedDeliveryDays');
        expect(carrier.estimatedDeliveryDays).toHaveProperty('min');
        expect(carrier.estimatedDeliveryDays).toHaveProperty('max');
      });
    });
  });

  describe('getEstimatedDelivery', () => {
    it('should return estimated delivery for a valid carrier', () => {
      const result = service.getEstimatedDelivery(ShippingCarrier.FEDEX);

      expect(result.estimatedDays.min).toBe(2);
      expect(result.estimatedDays.max).toBe(5);
      expect(result.estimatedDate).toBeInstanceOf(Date);
      expect(result.estimatedDate.getTime()).toBeGreaterThan(Date.now());
    });
  });
});
