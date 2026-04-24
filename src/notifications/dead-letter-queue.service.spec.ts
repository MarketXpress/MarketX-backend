import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DeadLetterQueueService, DeadLetterQueueEntity } from './dead-letter-queue.service';

describe('DeadLetterQueueService', () => {
  let service: DeadLetterQueueService;
  let eventEmitter: EventEmitter2;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeadLetterQueueService,
        {
          provide: getRepositoryToken(DeadLetterQueueEntity),
          useValue: mockRepository,
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DeadLetterQueueService>(DeadLetterQueueService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('routeToDLQ', () => {
    it('should save failed event to DLQ', async () => {
      const mockEntry = {
        id: 'dlq-123',
        eventType: 'notification.email',
        domain: 'notification',
        status: 'pending',
      };

      mockRepository.create.mockReturnValue(mockEntry);
      mockRepository.save.mockResolvedValue(mockEntry);

      const error = new Error('Test error');
      const result = await service.routeToDLQ(
        'notification.email',
        'notification',
        { notificationId: '123' },
        error,
        {
          attempts: 3,
          retryHistory: [
            { attemptNumber: 1, timestamp: new Date(), error: 'Error 1' },
            { attemptNumber: 2, timestamp: new Date(), error: 'Error 2' },
            { attemptNumber: 3, timestamp: new Date(), error: 'Error 3' },
          ],
        },
      );

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'notification.email',
          domain: 'notification',
          status: 'pending',
        }),
      );
      expect(mockRepository.save).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'dlq.entry.created',
        expect.any(Object),
      );
    });
  });

  describe('getDLQEntries', () => {
    it('should return DLQ entries with pagination', async () => {
      const mockEntries = [
        { id: '1', eventType: 'order.created', status: 'pending' },
        { id: '2', eventType: 'payment.failed', status: 'investigating' },
      ];

      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockEntries, 2]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getDLQEntries({
        status: 'pending',
        limit: 10,
        offset: 0,
      });

      expect(result.entries).toEqual(mockEntries);
      expect(result.total).toBe(2);
    });
  });

  describe('updateDLQEntryStatus', () => {
    it('should update DLQ entry status', async () => {
      const mockEntry = {
        id: 'dlq-123',
        status: 'pending',
        metadata: {},
      };

      mockRepository.findOne.mockResolvedValue(mockEntry);
      mockRepository.save.mockResolvedValue({
        ...mockEntry,
        status: 'resolved',
      });

      const result = await service.updateDLQEntryStatus(
        'dlq-123',
        'resolved',
      );

      expect(result.status).toBe('resolved');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'dlq.entry.status_changed',
        expect.any(Object),
      );
    });

    it('should throw error if entry not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateDLQEntryStatus('non-existent', 'resolved'),
      ).rejects.toThrow('DLQ entry not found');
    });
  });

  describe('retryDLQEntry', () => {
    it('should retry DLQ entry and emit event', async () => {
      const mockEntry = {
        id: 'dlq-123',
        status: 'pending',
        eventType: 'order.created',
        domain: 'order',
        originalPayload: { orderId: '123' },
        metadata: {},
      };

      mockRepository.findOne.mockResolvedValue(mockEntry);
      mockRepository.save.mockResolvedValue(mockEntry);

      const result = await service.retryDLQEntry('dlq-123');

      expect(result).toBe(true);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'dlq.entry.retry',
        expect.any(Object),
      );
    });

    it('should not retry resolved entries', async () => {
      const mockEntry = {
        id: 'dlq-123',
        status: 'resolved',
      };

      mockRepository.findOne.mockResolvedValue(mockEntry);

      const result = await service.retryDLQEntry('dlq-123');

      expect(result).toBe(false);
    });
  });

  describe('getDLQStats', () => {
    it('should return DLQ statistics', async () => {
      mockRepository.count.mockResolvedValue(10);
      mockRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
        getCount: jest.fn().mockResolvedValue(5),
      });

      const stats = await service.getDLQStats();

      expect(stats.total).toBe(10);
      expect(stats.byStatus).toBeDefined();
      expect(stats.byDomain).toBeDefined();
      expect(stats.byEventType).toBeDefined();
    });
  });
});
