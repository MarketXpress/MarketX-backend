import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from './audit.service';
import {
  AuditLog,
  AuditActionType,
  AuditStatus,
} from './entities/audit-log.entity';
import { IAuditEvent } from './interfaces/audit-event.interface';

describe('AuditService', () => {
  let service: AuditService;
  let repository: Repository<AuditLog>;

  const mockAuditLog = {
    id: 'test-id-123',
    userId: 'user-123',
    action: AuditActionType.PASSWORD_CHANGE,
    status: AuditStatus.SUCCESS,
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0...',
    createdAt: new Date(),
    statePreviousValue: null,
    stateNewValue: null,
    stateDiff: {},
    changedFields: '',
    resourceType: null,
    resourceId: null,
    details: null,
    errorMessage: null,
    responseTime: null,
    expiresAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: getRepositoryToken(AuditLog),
          useClass: Repository,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    repository = module.get<Repository<AuditLog>>(getRepositoryToken(AuditLog));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAuditLog', () => {
    it('should create an audit log entry', async () => {
      const mockSave = jest
        .spyOn(repository, 'save')
        .mockResolvedValue(mockAuditLog as unknown as AuditLog);
      jest
        .spyOn(repository, 'create')
        .mockReturnValue(mockAuditLog as unknown as AuditLog);

      const result = await service.createAuditLog({
        userId: 'user-123',
        action: AuditActionType.PASSWORD_CHANGE,
      });

      expect(result).toEqual(mockAuditLog);
      expect(mockSave).toHaveBeenCalledTimes(1);
    });

    it('should handle errors when creating audit log', async () => {
      const error = new Error('Database error');
      jest.spyOn(repository, 'create').mockImplementation(() => {
        throw error;
      });

      await expect(
        service.createAuditLog({ userId: 'user-123', action: AuditActionType.PASSWORD_CHANGE }),
      ).rejects.toThrow(error);
    });
  });

  describe('logStateChange', () => {
    it('should log state changes with diffs calculated', async () => {
      const event: IAuditEvent = {
        actionType: 'EMAIL_CHANGE',
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        statePreviousValue: { email: 'old@example.com' },
        stateNewValue: { email: 'new@example.com' },
        resourceType: 'user',
        resourceId: 'user-123',
        status: 'SUCCESS',
      };

      const mockSave = jest.spyOn(repository, 'save').mockResolvedValue({
        ...mockAuditLog,
        action: AuditActionType.EMAIL_CHANGE,
      } as unknown as AuditLog);

      jest.spyOn(repository, 'create').mockReturnValue({
        ...mockAuditLog,
        action: AuditActionType.EMAIL_CHANGE,
      } as unknown as AuditLog);

      const result = await service.logStateChange(event);

      expect(result).toBeDefined();
      expect(result.action).toBe(AuditActionType.EMAIL_CHANGE);
      expect(mockSave).toHaveBeenCalled();
    });

    it('should calculate state diffs correctly', async () => {
      const event: IAuditEvent = {
        actionType: 'UPDATE',
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        statePreviousValue: { name: 'John', age: 30 },
        stateNewValue: { name: 'John', age: 31 },
        status: 'SUCCESS',
      };

      const savedLog = {
        ...mockAuditLog,
        stateDiff: {
          age: { previous: 30, new: 31 },
        },
        changedFields: 'age',
      };

      jest
        .spyOn(repository, 'create')
        .mockReturnValue(savedLog as unknown as AuditLog);
      const mockSave = jest
        .spyOn(repository, 'save')
        .mockResolvedValue(savedLog as unknown as AuditLog);

      const result = await service.logStateChange(event);

      expect(result.changedFields).toBe('age');
      expect(mockSave).toHaveBeenCalled();
    });

    it('should not calculate diffs if no state change', async () => {
      const event: IAuditEvent = {
        actionType: 'READ',
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        status: 'SUCCESS',
      };

      const savedLog = {
        ...mockAuditLog,
        stateDiff: {},
        changedFields: '',
      };

      jest
        .spyOn(repository, 'create')
        .mockReturnValue(savedLog as unknown as AuditLog);
      jest
        .spyOn(repository, 'save')
        .mockResolvedValue(savedLog as unknown as AuditLog);

      const result = await service.logStateChange(event);

      expect(result.changedFields).toBe('');
    });
  });

  describe('createBulkAuditLogs', () => {
    it('should create multiple audit logs', async () => {
      const events: IAuditEvent[] = [
        {
          actionType: 'PASSWORD_CHANGE',
          userId: 'user-1',
          ipAddress: '192.168.1.1',
          status: 'SUCCESS',
        },
        {
          actionType: 'EMAIL_CHANGE',
          userId: 'user-2',
          ipAddress: '192.168.1.2',
          status: 'SUCCESS',
        },
      ];

      const mockLogs = [
        { ...mockAuditLog, userId: 'user-1' },
        {
          ...mockAuditLog,
          userId: 'user-2',
          action: AuditActionType.EMAIL_CHANGE,
        },
      ];

      jest
        .spyOn(repository, 'create')
        .mockReturnValue(mockLogs[0] as unknown as AuditLog);
      const mockSave = jest
        .spyOn(repository, 'save')
        .mockResolvedValue(mockLogs as any);

      const result = await service.createBulkAuditLogs(events);

      expect(result).toHaveLength(2);
      expect(mockSave).toHaveBeenCalled();
    });
  });

  describe('getAuditLogs', () => {
    it('should retrieve audit logs with pagination', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockAuditLog], 1]),
      };

      jest
        .spyOn(repository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      const result = await service.getAuditLogs({
        page: 1,
        limit: 10,
      });

      expect(result.data).toBeDefined();
      expect(result.meta).toBeDefined();
      expect(result.meta.page).toBe(1);
    });

    it('should filter logs by userId', async () => {
      const mockQueryBuilder = {
        createQueryBuilder: jest.fn(),
        andWhere: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockAuditLog], 1]),
      };

      jest
        .spyOn(repository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      const result = await service.getAuditLogs({
        userId: 'user-123',
        page: 1,
        limit: 10,
      });

      expect(result.data).toBeDefined();
    });

    it('should filter logs by action type', async () => {
      const mockQueryBuilder = {
        createQueryBuilder: jest.fn(),
        andWhere: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockAuditLog], 1]),
      };

      jest
        .spyOn(repository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      const result = await service.getAuditLogs({
        action: AuditActionType.PASSWORD_CHANGE,
        page: 1,
        limit: 10,
      });

      expect(result.data).toBeDefined();
    });

    it('should filter logs by date range', async () => {
      const mockQueryBuilder = {
        createQueryBuilder: jest.fn(),
        andWhere: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockAuditLog], 1]),
      };

      jest
        .spyOn(repository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      const result = await service.getAuditLogs({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        page: 1,
        limit: 10,
      });

      expect(result.data).toBeDefined();
    });
  });

  describe('getAuditLogsByChangedFields', () => {
    it('should retrieve logs by changed field', async () => {
      const mockQueryBuilder = {
        createQueryBuilder: jest.fn(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockAuditLog]),
      };

      jest
        .spyOn(repository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      const result = await service.getAuditLogsByChangedFields('password');

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
    });
  });

  describe('getAuditStats', () => {
    it('should retrieve audit statistics', async () => {
      const mockStats = [
        {
          action: AuditActionType.PASSWORD_CHANGE,
          status: AuditStatus.SUCCESS,
          count: 5,
        },
        {
          action: AuditActionType.EMAIL_CHANGE,
          status: AuditStatus.SUCCESS,
          count: 3,
        },
      ];

      const mockQueryBuilder = {
        createQueryBuilder: jest.fn(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockStats),
      };

      jest
        .spyOn(repository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      const result = await service.getAuditStats(
        new Date('2024-01-01'),
        new Date('2024-12-31'),
      );

      expect(result).toBeDefined();
      expect(result).toHaveLength(2);
    });
  });

  describe('cleanupExpiredLogs', () => {
    it('should delete expired audit logs', async () => {
      const mockQueryBuilder = {
        createQueryBuilder: jest.fn(),
        delete: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 5 }),
      };

      jest
        .spyOn(repository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      const result = await service.cleanupExpiredLogs(90);

      expect(result).toBe(5);
    });
  });

  describe('getAuditLogById', () => {
    it('should retrieve a specific audit log by ID', async () => {
      jest
        .spyOn(repository, 'findOne')
        .mockResolvedValue(mockAuditLog as unknown as AuditLog);

      const result = await service.getAuditLogById('test-id-123');

      expect(result).toEqual(mockAuditLog);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 'test-id-123' },
      });
    });

    it('should throw error if audit log not found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.getAuditLogById('non-existent')).rejects.toThrow(
        'Audit log with ID non-existent not found',
      );
    });
  });
});
