import { Test, TestingModule } from '@nestjs/testing';
import { AuditEventListener } from './audit.listener';
import { AuditService } from './audit.service';
import { Logger } from '@nestjs/common';

describe('AuditEventListener', () => {
  let listener: AuditEventListener;
  let auditService: AuditService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditEventListener,
        {
          provide: AuditService,
          useValue: {
            logStateChange: jest.fn().mockResolvedValue({
              id: 'audit-123',
              userId: 'user-123',
              action: 'PASSWORD_CHANGE',
            }),
          },
        },
      ],
    }).compile();

    listener = module.get<AuditEventListener>(AuditEventListener);
    auditService = module.get<AuditService>(AuditService);

    // Suppress logger output in tests
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(listener).toBeDefined();
  });

  describe('handlePasswordChange', () => {
    it('should log password change event', async () => {
      const event = {
        actionType: 'PASSWORD_CHANGE',
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        status: 'SUCCESS',
      };

      await listener.handlePasswordChange(event as any);

      expect(auditService.logStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'PASSWORD_CHANGE',
          userId: 'user-123',
          ipAddress: '192.168.1.1',
        }),
      );
    });

    it('should redact password values in audit log', async () => {
      const event = {
        actionType: 'PASSWORD_CHANGE',
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        statePreviousValue: { password: 'hashed_old' },
        stateNewValue: { password: 'hashed_new' },
        status: 'SUCCESS',
      };

      await listener.handlePasswordChange(event as any);

      const callArgs = (auditService.logStateChange as jest.Mock).mock
        .calls[0][0];
      expect(callArgs.statePreviousValue).toEqual({ passwordUpdated: true });
      expect(callArgs.stateNewValue).toEqual({ passwordUpdated: true });
    });

    it('should handle errors gracefully', async () => {
      (auditService.logStateChange as jest.Mock).mockRejectedValueOnce(
        new Error('Database error'),
      );

      const event = {
        actionType: 'PASSWORD_CHANGE',
        userId: 'user-123',
        ipAddress: '192.168.1.1',
      };

      // Should not throw, should log error instead
      await expect(
        listener.handlePasswordChange(event as any),
      ).resolves.not.toThrow();
    });
  });

  describe('handleEmailChange', () => {
    it('should log email change event', async () => {
      const event = {
        actionType: 'EMAIL_CHANGE',
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        statePreviousValue: { email: 'old@example.com' },
        stateNewValue: { email: 'new@example.com' },
        status: 'SUCCESS',
      };

      await listener.handleEmailChange(event as any);

      expect(auditService.logStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'EMAIL_CHANGE',
          userId: 'user-123',
        }),
      );
    });
  });

  describe('handleWithdrawalRequested', () => {
    it('should log withdrawal requested event', async () => {
      const event = {
        actionType: 'WITHDRAWAL',
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        resourceId: 'wallet-456',
        status: 'SUCCESS',
        metadata: {
          amount: 100,
          destination:
            'GBQQ5GFXLAJB3ZTBLZEXD34WVDZN3DXZFXN6LSPWJHH3TDZ2YIK5LDV',
        },
      };

      await listener.handleWithdrawalRequested(event as any);

      expect(auditService.logStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'WITHDRAWAL',
          userId: 'user-123',
          resourceType: 'wallet',
        }),
      );
    });
  });

  describe('handleWithdrawalCompleted', () => {
    it('should log withdrawal completed event', async () => {
      const event = {
        actionType: 'WITHDRAWAL',
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        resourceId: 'wallet-456',
        status: 'SUCCESS',
        metadata: {
          amount: 100,
          transactionHash: 'tx_123abc',
        },
      };

      await listener.handleWithdrawalCompleted(event as any);

      expect(auditService.logStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'WITHDRAWAL',
          userId: 'user-123',
        }),
      );
    });
  });

  describe('handleProfileUpdate', () => {
    it('should log profile update event', async () => {
      const event = {
        actionType: 'UPDATE',
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        statePreviousValue: { name: 'John Doe' },
        stateNewValue: { name: 'Jane Doe' },
        status: 'SUCCESS',
      };

      await listener.handleProfileUpdate(event as any);

      expect(auditService.logStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'UPDATE',
          resourceType: 'user_profile',
        }),
      );
    });
  });

  describe('handleAccountModified', () => {
    it('should log generic account modification', async () => {
      const event = {
        actionType: 'UPDATE',
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        status: 'SUCCESS',
        metadata: { reason: 'admin_action' },
      };

      await listener.handleAccountModified(event as any);

      expect(auditService.logStateChange).toHaveBeenCalledWith(event);
    });
  });

  describe('handlePermissionsChanged', () => {
    it('should log permission changes', async () => {
      const event = {
        actionType: 'PERMISSION_CHANGE',
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        statePreviousValue: { role: 'user' },
        stateNewValue: { role: 'admin' },
        status: 'SUCCESS',
      };

      await listener.handlePermissionsChanged(event as any);

      expect(auditService.logStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'PERMISSION_CHANGE',
          resourceType: 'user_permissions',
        }),
      );
    });
  });
});
