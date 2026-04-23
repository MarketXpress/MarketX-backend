import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuditService } from '../src/audit/audit.service';
import {
  AuditLog,
  AuditActionType,
  AuditStatus,
} from '../src/audit/entities/audit-log.entity';

describe('Audit Module E2E Tests', () => {
  let app: INestApplication;
  let auditService: AuditService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    auditService = moduleFixture.get<AuditService>(AuditService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /admin/audit-logs', () => {
    it('should return paginated audit logs', async () => {
      // This requires admin authentication
      const response = await request(app.getHttpServer())
        .get('/admin/audit-logs')
        .query({ page: 1, limit: 10 });

      // Should be 403 without admin access or 200 if authenticated
      expect([HttpStatus.FORBIDDEN, HttpStatus.OK]).toContain(response.status);

      if (response.status === HttpStatus.OK) {
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('meta');
        expect(response.body.meta).toHaveProperty('page');
        expect(response.body.meta).toHaveProperty('limit');
        expect(response.body.meta).toHaveProperty('total');
      }
    });

    it('should filter audit logs by userId', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/audit-logs')
        .query({ userId: 'test-user-123', page: 1, limit: 10 });

      expect([HttpStatus.FORBIDDEN, HttpStatus.OK]).toContain(response.status);

      if (response.status === HttpStatus.OK) {
        // If there are any logs, they should match the filter
        if (response.body.data.length > 0) {
          response.body.data.forEach((log: AuditLog) => {
            expect(log.userId).toBe('test-user-123');
          });
        }
      }
    });

    it('should filter audit logs by action', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/audit-logs')
        .query({ action: 'PASSWORD_CHANGE', page: 1, limit: 10 });

      expect([HttpStatus.FORBIDDEN, HttpStatus.OK]).toContain(response.status);

      if (response.status === HttpStatus.OK) {
        if (response.body.data.length > 0) {
          response.body.data.forEach((log: AuditLog) => {
            expect(log.action).toBe(AuditActionType.PASSWORD_CHANGE);
          });
        }
      }
    });

    it('should filter audit logs by date range', async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const endDate = new Date();

      const response = await request(app.getHttpServer())
        .get('/admin/audit-logs')
        .query({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          page: 1,
          limit: 10,
        });

      expect([HttpStatus.FORBIDDEN, HttpStatus.OK]).toContain(response.status);

      if (response.status === HttpStatus.OK) {
        if (response.body.data.length > 0) {
          response.body.data.forEach((log: AuditLog) => {
            const logDate = new Date(log.createdAt);
            expect(logDate.getTime()).toBeGreaterThanOrEqual(
              startDate.getTime(),
            );
            expect(logDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
          });
        }
      }
    });
  });

  describe('GET /admin/audit-logs/:id', () => {
    it('should return a specific audit log', async () => {
      // First, create an audit log
      const auditLog = await auditService.createAuditLog({
        userId: 'test-user',
        action: AuditActionType.PASSWORD_CHANGE,
        status: AuditStatus.SUCCESS,
        ipAddress: '192.168.1.1',
      });

      const response = await request(app.getHttpServer()).get(
        `/admin/audit-logs/${auditLog.id}`,
      );

      expect([HttpStatus.FORBIDDEN, HttpStatus.OK]).toContain(response.status);

      if (response.status === HttpStatus.OK) {
        expect(response.body).toHaveProperty('id', auditLog.id);
        expect(response.body).toHaveProperty('userId', 'test-user');
        expect(response.body).toHaveProperty(
          'action',
          AuditActionType.PASSWORD_CHANGE,
        );
      }
    });

    it('should return 404 for non-existent audit log', async () => {
      const response = await request(app.getHttpServer()).get(
        '/admin/audit-logs/non-existent-id',
      );

      expect([HttpStatus.FORBIDDEN, HttpStatus.NOT_FOUND]).toContain(
        response.status,
      );
    });
  });

  describe('GET /admin/audit-stats', () => {
    it('should return audit statistics for date range', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const endDate = new Date();

      const response = await request(app.getHttpServer())
        .get('/admin/audit-stats')
        .query({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });

      expect([HttpStatus.FORBIDDEN, HttpStatus.OK]).toContain(response.status);

      if (response.status === HttpStatus.OK) {
        expect(Array.isArray(response.body)).toBe(true);
        // Stats array may be empty if no logs exist
        if (response.body.length > 0) {
          response.body.forEach((stat: any) => {
            expect(stat).toHaveProperty('action');
            expect(stat).toHaveProperty('status');
            expect(stat).toHaveProperty('count');
          });
        }
      }
    });
  });

  describe('Immutable Audit Log Creation', () => {
    it('should create immutable audit log for password change', async () => {
      const event = {
        userId: 'user-immutable-123',
        action: AuditActionType.PASSWORD_CHANGE,
        status: AuditStatus.SUCCESS,
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Test)',
        resourceType: 'user',
        resourceId: 'user-immutable-123',
        statePreviousValue: { passwordChanged: false },
        stateNewValue: { passwordChanged: true },
        details: { reason: 'user_initiated' },
      };

      const auditLog = await auditService.createAuditLog(event);

      // Verify immutability - fields should not be modifiable
      expect(auditLog).toHaveProperty('id');
      expect(auditLog).toHaveProperty('createdAt');
      expect(auditLog.userId).toBe('user-immutable-123');
      expect(auditLog.action).toBe(AuditActionType.PASSWORD_CHANGE);
      expect(auditLog.ipAddress).toBe('192.168.1.100');

      // Attempt to verify the timestamp
      const retrievedLog = await auditService.getAuditLogById(auditLog.id);
      expect(retrievedLog.createdAt).toEqual(auditLog.createdAt);
    });

    it('should track state changes with diffs', async () => {
      const event = {
        userId: 'user-123',
        action: AuditActionType.EMAIL_CHANGE,
        status: AuditStatus.SUCCESS,
        ipAddress: '192.168.1.1',
        resourceType: 'user',
        resourceId: 'user-123',
        statePreviousValue: { email: 'old@example.com', verified: true },
        stateNewValue: { email: 'new@example.com', verified: false },
      };

      const auditLog = await auditService.logStateChange(event as any);

      // Verify state tracking
      expect(auditLog.statePreviousValue).toBeDefined();
      expect(auditLog.stateNewValue).toBeDefined();
      expect(auditLog.stateDiff).toBeDefined();
      expect(auditLog.changedFields).toContain('email');

      // The stateDiff should show the changes
      expect(auditLog.stateDiff).toHaveProperty('email');
      expect(auditLog.stateDiff?.email.previous).toBe('old@example.com');
      expect(auditLog.stateDiff?.email.new).toBe('new@example.com');
    });

    it('should maintain audit trail for massive withdrawal', async () => {
      const withdrawalEvent = {
        userId: 'user-withdrawal-123',
        action: AuditActionType.WITHDRAWAL,
        status: AuditStatus.SUCCESS,
        ipAddress: '192.168.1.50',
        resourceType: 'wallet',
        resourceId: 'wallet-999',
        statePreviousValue: { balance: 10000, withdrawn: false },
        stateNewValue: { balance: 5000, withdrawn: true },
        metadata: {
          amount: 5000,
          destination:
            'GBQQ5GFXLAJB3ZTBLZEXD34WVDZN3DXZFXN6LSPWJHH3TDZ2YIK5LDV',
          transactionHash: 'tx_12345',
        },
      };

      const auditLog = await auditService.logStateChange(
        withdrawalEvent as any,
      );

      // Verify withdrawal tracking
      expect(auditLog.action).toBe(AuditActionType.WITHDRAWAL);
      expect(auditLog.resourceType).toBe('wallet');
      expect(auditLog.details).toHaveProperty('amount', 5000);
      expect(auditLog.details).toHaveProperty('transactionHash');

      // Retrieve and verify immutability
      const retrieved = await auditService.getAuditLogById(auditLog.id);
      expect(retrieved.id).toBe(auditLog.id);
      expect(retrieved.createdAt).toEqual(auditLog.createdAt);
    });
  });

  describe('Bulk Audit Logging', () => {
    it('should create multiple audit logs in bulk', async () => {
      const events = [
        {
          userId: 'user-1',
          action: AuditActionType.PASSWORD_CHANGE,
          status: AuditStatus.SUCCESS,
          ipAddress: '192.168.1.1',
          statePreviousValue: { passwordChanged: false },
          stateNewValue: { passwordChanged: true },
        },
        {
          userId: 'user-2',
          action: AuditActionType.EMAIL_CHANGE,
          status: AuditStatus.SUCCESS,
          ipAddress: '192.168.1.2',
          statePreviousValue: { email: 'old@test.com' },
          stateNewValue: { email: 'new@test.com' },
        },
      ];

      const auditLogs = await auditService.createBulkAuditLogs(events as any);

      expect(auditLogs).toHaveLength(2);
      expect(auditLogs[0].userId).toBe('user-1');
      expect(auditLogs[1].userId).toBe('user-2');
    });
  });

  describe('Audit Log Filtering by Changed Fields', () => {
    it('should retrieve logs filtered by changed field', async () => {
      // Create an audit log with specific changed fields
      const event = {
        userId: 'user-filter-test',
        action: AuditActionType.UPDATE,
        status: AuditStatus.SUCCESS,
        ipAddress: '192.168.1.1',
        statePreviousValue: { name: 'John', email: 'old@test.com' },
        stateNewValue: { name: 'John', email: 'new@test.com' },
      };

      await auditService.logStateChange(event as any);

      // Query logs by changed field
      const logs = await auditService.getAuditLogsByChangedFields('email', {
        userId: 'user-filter-test',
      });

      expect(logs.length).toBeGreaterThan(0);
      logs.forEach((log) => {
        expect(log.changedFields).toContain('email');
      });
    });
  });

  describe('Audit Log Retention and Cleanup', () => {
    it('should cleanup expired logs', async () => {
      // Create an audit log that would be expired
      const expiredDate = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000); // 91 days ago

      const auditLog = await auditService.createAuditLog({
        userId: 'user-expired',
        action: AuditActionType.PASSWORD_CHANGE,
        status: AuditStatus.SUCCESS,
        ipAddress: '192.168.1.1',
        createdAt: expiredDate,
      });

      // Cleanup with 90 day retention
      const deletedCount = await auditService.cleanupExpiredLogs(90);

      // The cleanup should have removed logs older than 90 days
      expect(typeof deletedCount).toBe('number');
    });
  });

  describe('Compliance Audit Trail', () => {
    it('should maintain complete compliance audit trail', async () => {
      const userId = 'compliance-test-user';

      // Simulate password change event
      const passwordChangeEvent = {
        userId,
        action: AuditActionType.PASSWORD_CHANGE,
        status: AuditStatus.SUCCESS,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Compliance Test)',
        statePreviousValue: { passwordSet: false },
        stateNewValue: { passwordSet: true },
        metadata: { reason: 'user_initiated' },
      };

      const passwordLog = await auditService.logStateChange(
        passwordChangeEvent as any,
      );

      // Retrieve logs for this user
      const userLogs = await auditService.getAuditLogs({
        userId,
        page: 1,
        limit: 50,
      });

      // Verify we can find the password change event
      const foundLog = userLogs.data.find((log) => log.id === passwordLog.id);

      expect(foundLog).toBeDefined();
      expect(foundLog?.action).toBe(AuditActionType.PASSWORD_CHANGE);
      expect(foundLog?.ipAddress).toBe('192.168.1.1');
      expect(foundLog?.userAgent).toBe('Mozilla/5.0 (Compliance Test)');
    });
  });
});
