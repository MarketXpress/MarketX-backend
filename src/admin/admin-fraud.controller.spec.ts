/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminFraudController } from './admin-fraud.controller';
import { FraudAlert } from '../fraud/entities/fraud-alert.entity';
import { AuditService } from '../audit/audit.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('AdminFraudController', () => {
  let controller: AdminFraudController;
  let fraudAlertRepo: Repository<FraudAlert>;
  let auditService: AuditService;
  let eventEmitter: EventEmitter2;

  const mockFraudAlert = {
    id: 'alert-1',
    userId: 'user-1',
    orderId: 'order-1',
    ip: '192.168.1.1',
    riskScore: 85,
    reason: 'high_value_order, new_account',
    status: 'pending',
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminFraudController],
      providers: [
        {
          provide: getRepositoryToken(FraudAlert),
          useValue: {
            find: jest.fn().mockResolvedValue([mockFraudAlert]),
            findOne: jest.fn().mockResolvedValue(mockFraudAlert),
            createQueryBuilder: jest.fn().mockReturnValue({
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              skip: jest.fn().mockReturnThis(),
              take: jest.fn().mockReturnThis(),
              getManyAndCount: jest.fn().mockResolvedValue([[mockFraudAlert], 1]),
              getMany: jest.fn().mockResolvedValue([mockFraudAlert]),
              getCount: jest.fn().mockResolvedValue(1),
            }),
            save: jest.fn().mockResolvedValue(mockFraudAlert),
            count: jest.fn().mockResolvedValue(5),
          },
        },
        {
          provide: AuditService,
          useValue: {
            getAuditLogs: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'audit-1',
                  userId: 'user-1',
                  action: 'FRAUD_ALERT',
                  status: 'WARNING',
                  resourceType: 'fraud_alert',
                  resourceId: 'alert-1',
                  createdAt: new Date(),
                },
              ],
              meta: {
                total: 1,
                page: 1,
                limit: 100,
                totalPages: 1,
              },
            }),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AdminFraudController>(AdminFraudController);
    fraudAlertRepo = module.get<Repository<FraudAlert>>(getRepositoryToken(FraudAlert));
    auditService = module.get<AuditService>(AuditService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('list', () => {
    it('should return paginated fraud alerts', async () => {
      const result = await controller.list(1, 50, undefined, undefined);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(50);
    });

    it('should filter by status', async () => {
      const result = await controller.list(1, 50, 'pending', undefined);

      expect(fraudAlertRepo.createQueryBuilder).toHaveBeenCalled();
    });

    it('should filter by userId', async () => {
      const result = await controller.list(1, 50, undefined, 'user-1');

      expect(fraudAlertRepo.createQueryBuilder).toHaveBeenCalled();
    });
  });

  describe('getOne', () => {
    it('should return a single fraud alert', async () => {
      const result = await controller.getOne('alert-1');

      expect(result).toEqual(mockFraudAlert);
    });

    it('should return error if alert not found', async () => {
      jest.spyOn(fraudAlertRepo, 'findOne').mockResolvedValueOnce(null);

      const result = await controller.getOne('non-existent');

      expect(result).toEqual({ error: 'Alert not found' });
    });
  });

  describe('review', () => {
    it('should update alert status and emit audit event', async () => {
      const mockUser = { id: 'admin-1', role: 'admin' };
      const result = await controller.review(
        'alert-1',
        { mark: 'safe', notes: 'Reviewed and cleared' },
        mockUser,
      );

      expect((result as any).status).toBe('safe');
      expect((result as any).reviewedBy).toBe('admin-1');
      expect((result as any).reviewNotes).toBe('Reviewed and cleared');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'fraud.alert_reviewed',
        expect.objectContaining({
          userId: 'admin-1',
          actionType: 'FRAUD_REVIEW',
          resourceType: 'fraud_alert',
          resourceId: 'alert-1',
        }),
      );
    });

    it('should return error if alert not found', async () => {
      jest.spyOn(fraudAlertRepo, 'findOne').mockResolvedValueOnce(null);

      const result = await controller.review(
        'non-existent',
        { mark: 'safe' },
        undefined,
      );

      expect(result).toEqual({ error: 'Alert not found' });
    });
  });

  describe('getAuditTrail', () => {
    it('should return audit trail for a fraud alert', async () => {
      const result = await controller.getAuditTrail('alert-1');

      expect(result).toHaveProperty('alert');
      expect(result).toHaveProperty('auditTrail');
      expect(result.auditTrail).toHaveProperty('alertEvents');
      expect(result.auditTrail).toHaveProperty('lockoutEvents');
      expect(result.auditTrail).toHaveProperty('total');
    });

    it('should return error if alert not found', async () => {
      jest.spyOn(fraudAlertRepo, 'findOne').mockResolvedValueOnce(null);

      const result = await controller.getAuditTrail('non-existent');

      expect(result).toEqual({ error: 'Alert not found' });
    });
  });

  describe('getLockouts', () => {
    it('should return paginated lockout events', async () => {
      const result = await controller.getLockouts(1, 50, undefined);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(auditService.getAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'FRAUD_LOCKOUT',
          page: 1,
          limit: 50,
        }),
      );
    });

    it('should filter lockouts by userId', async () => {
      const result = await controller.getLockouts(1, 50, 'user-1');

      expect(auditService.getAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
        }),
      );
    });
  });

  describe('getStats', () => {
    it('should return fraud statistics', async () => {
      const result = await controller.getStats();

      expect(result).toHaveProperty('alerts');
      expect(result).toHaveProperty('lockouts');
      expect(result.alerts).toHaveProperty('last24Hours');
      expect(result.alerts).toHaveProperty('last7Days');
      expect(result.alerts).toHaveProperty('last30Days');
      expect(result.lockouts).toHaveProperty('last24Hours');
      expect(result.lockouts).toHaveProperty('last7Days');
    });
  });
});
