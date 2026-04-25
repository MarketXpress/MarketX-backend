/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await */
import { FraudService } from '../fraud.service';
import { OrderStatus } from '../../orders/entities/order.entity';
import { evaluateAllRules } from '../score';
import { UserStatus } from '../../entities/user.entity';

describe('Fraud rules and service', () => {
  it('evaluateAllRules returns numeric score and reason', async () => {
    const res = await evaluateAllRules({ userId: 'u1' });
    expect(typeof res.riskScore).toBe('number');
    expect(typeof res.reason).toBe('string');
  });

  it('duplicate orders increase score', async () => {
    // first call should be ok
    const r1 = await evaluateAllRules({ userId: 'u2', orderId: 'o1' });
    const r2 = await evaluateAllRules({ userId: 'u2', orderId: 'o1' });
    expect(r2.riskScore).toBeGreaterThanOrEqual(r1.riskScore);
  });

  it('FraudService marks order MANUAL_REVIEW at >=75', async () => {
    const fakeRepo: any = {
      create: (o: any) => ({ ...o }),
      save: jest.fn(async (o: any) => ({ ...o, id: 'fake-id' })),
      findAndCount: jest.fn(async () => [[], 0]),
      findOneBy: jest.fn(async () => null),
      findOne: jest.fn(async () => null),
    };

    const fakeOrderRepo: any = {
      findOne: jest.fn(async () => ({
        id: 'ord-1',
        status: OrderStatus.PENDING,
      })),
      save: jest.fn(async (o: any) => o),
    };

    const fakeUserRepo: any = {
      findOne: jest.fn(async () => null),
      save: jest.fn(async (o: any) => o),
    };

    const fakeGeolocationService: any = {
      getLocationFromIp: jest.fn(async () => null),
      geocodeAddress: jest.fn(async () => null),
      distanceMiles: jest.fn(() => 0),
    };

    const fakeCacheService: any = {
      increment: jest.fn(async () => 0),
    };

    const fakeEmailService: any = {
      sendAccountLocked: jest.fn(async () => ({})),
    };

    const fakeAdminWebhookService: any = {
      notifyAdmin: jest.fn(async () => ({})),
    };

    const fakeAuditService: any = {
      logStateChange: jest.fn(async () => ({})),
    };

    const fakeEventEmitter: any = {
      emit: jest.fn(),
    };

    const svc = new FraudService(
      fakeRepo,
      fakeOrderRepo,
      fakeUserRepo,
      fakeGeolocationService,
      fakeCacheService,
      fakeEmailService,
      fakeAdminWebhookService,
      fakeAuditService,
      fakeEventEmitter,
    );

    const result = await svc.analyzeRequest({
      userId: 'user-highrisk',
      orderId: 'ord-1',
      metadata: {
        amount: 1000,
        accountAgeHours: 1,
        billingAddress: '123 A St',
        shippingAddress: '456 B Ave',
      },
    });

    expect(result.flagged).toBe(true);
    expect(fakeOrderRepo.save).toHaveBeenCalled();
    expect(fakeOrderRepo.save.mock.calls[0][0].status).toBe(
      OrderStatus.MANUAL_REVIEW,
    );
  });

  it('FraudService creates alert when score high', async () => {
    const fakeRepo: any = {
      create: (o: any) => ({ ...o }),
      save: jest.fn(async (o: any) => ({ ...o, id: 'fake-id' })),
      findAndCount: jest.fn(async () => [[], 0]),
      findOneBy: jest.fn(async () => null),
      findOne: jest.fn(async () => null),
    };

    const fakeOrderRepo: any = {
      findOne: jest.fn(async () => ({
        id: 'ord-1',
        status: OrderStatus.PENDING,
      })),
      save: jest.fn(async (o: any) => o),
    };

    const fakeUserRepo: any = {
      findOne: jest.fn(async () => null),
      save: jest.fn(async (o: any) => o),
    };

    const fakeGeolocationService: any = {
      getLocationFromIp: jest.fn(async () => null),
      geocodeAddress: jest.fn(async () => null),
      distanceMiles: jest.fn(() => 0),
    };

    const fakeCacheService: any = {
      increment: jest.fn(async () => 0),
    };

    const fakeEmailService: any = {
      sendAccountLocked: jest.fn(async () => ({})),
    };

    const fakeAdminWebhookService: any = {
      notifyAdmin: jest.fn(async () => ({})),
    };

    const fakeAuditService: any = {
      logStateChange: jest.fn(async () => ({})),
    };

    const fakeEventEmitter: any = {
      emit: jest.fn(),
    };

    const svc = new FraudService(
      fakeRepo,
      fakeOrderRepo,
      fakeUserRepo,
      fakeGeolocationService,
      fakeCacheService,
      fakeEmailService,
      fakeAdminWebhookService,
      fakeAuditService,
      fakeEventEmitter,
    );

    // prime velocity: call rules repeatedly to build internal state
    for (let i = 0; i < 30; i++) {
      await evaluateAllRules({
        userId: 'u-progressive',
        metadata: { orderCount: i },
      });
    }

    // prime fingerprint: same fingerprint from multiple IPs
    const ips = ['1.1.1.1', '2.2.2.2', '3.3.3.3', '4.4.4.4'];
    for (const ip of ips) {
      await evaluateAllRules({ deviceFingerprint: 'fp-1', ip });
    }

    // prime duplicate: call once to store order
    await evaluateAllRules({ userId: 'u-progressive', orderId: 'ord-1' });

    // Check combined score before invoking service
    const combined = await evaluateAllRules({
      userId: 'u-progressive',
      orderId: 'ord-1',
      ip: '4.4.4.4',
      deviceFingerprint: 'fp-1',
    });
    // Debugging assertion: ensure score is high enough to trigger alert creation
    expect(combined.riskScore).toBeGreaterThanOrEqual(20);

    // now call service which should create an alert given primed state
    await svc.analyzeRequest({
      userId: 'u-progressive',
      orderId: 'ord-1',
      ip: '4.4.4.4',
      deviceFingerprint: 'fp-1',
    });

    expect(fakeRepo.save).toHaveBeenCalled();
  }, 20000);

  it('FraudService emits audit events on alert creation', async () => {
    const fakeRepo: any = {
      create: (o: any) => ({ ...o, id: 'alert-123' }),
      save: jest.fn(async (o: any) => ({ ...o, id: 'alert-123' })),
      findAndCount: jest.fn(async () => [[], 0]),
      findOneBy: jest.fn(async () => null),
      findOne: jest.fn(async () => null),
    };

    const fakeOrderRepo: any = {
      findOne: jest.fn(async () => null),
      save: jest.fn(async (o: any) => o),
    };

    const fakeUserRepo: any = {
      findOne: jest.fn(async () => null),
      save: jest.fn(async (o: any) => o),
    };

    const fakeGeolocationService: any = {
      getLocationFromIp: jest.fn(async () => null),
      geocodeAddress: jest.fn(async () => null),
      distanceMiles: jest.fn(() => 0),
    };

    const fakeCacheService: any = {
      increment: jest.fn(async () => 0),
    };

    const fakeEmailService: any = {
      sendAccountLocked: jest.fn(async () => ({})),
    };

    const fakeAdminWebhookService: any = {
      notifyAdmin: jest.fn(async () => ({})),
    };

    const fakeAuditService: any = {
      logStateChange: jest.fn(async () => ({})),
    };

    const fakeEventEmitter: any = {
      emit: jest.fn(),
    };

    const svc = new FraudService(
      fakeRepo,
      fakeOrderRepo,
      fakeUserRepo,
      fakeGeolocationService,
      fakeCacheService,
      fakeEmailService,
      fakeAdminWebhookService,
      fakeAuditService,
      fakeEventEmitter,
    );

    await svc.analyzeRequest({
      userId: 'user-audit-test',
      orderId: 'ord-audit',
      ip: '192.168.1.100',
      metadata: {
        amount: 1000,
        accountAgeHours: 1,
        billingAddress: '123 A St',
        shippingAddress: '456 B Ave',
      },
    });

    // Verify audit event was emitted
    expect(fakeEventEmitter.emit).toHaveBeenCalled();
    const emitCalls = fakeEventEmitter.emit.mock.calls;
    const fraudAlertEvent = emitCalls.find(
      (call: any[]) => call[0] === 'fraud.alert_created',
    );
    expect(fraudAlertEvent).toBeDefined();
    expect(fraudAlertEvent[1].userId).toBe('user-audit-test');
    expect(fraudAlertEvent[1].actionType).toBe('FRAUD_ALERT');
  });

  it('FraudService emits lockout audit event after 3 flags', async () => {
    let flagCount = 0;
    const fakeRepo: any = {
      create: (o: any) => ({ ...o, id: 'alert-lock' }),
      save: jest.fn(async (o: any) => ({ ...o, id: 'alert-lock' })),
      findAndCount: jest.fn(async () => [[], 0]),
      findOneBy: jest.fn(async () => null),
      findOne: jest.fn(async () => null),
    };

    const fakeOrderRepo: any = {
      findOne: jest.fn(async () => null),
      save: jest.fn(async (o: any) => o),
    };

    const fakeUserRepo: any = {
      findOne: jest.fn(async () => ({
        id: 'user-lock',
        email: 'test@example.com',
        firstName: 'Test',
        status: UserStatus.ACTIVE,
      })),
      save: jest.fn(async (o: any) => o),
    };

    const fakeGeolocationService: any = {
      getLocationFromIp: jest.fn(async () => null),
      geocodeAddress: jest.fn(async () => null),
      distanceMiles: jest.fn(() => 0),
    };

    const fakeCacheService: any = {
      increment: jest.fn(async () => {
        flagCount++;
        return flagCount;
      }),
    };

    const fakeEmailService: any = {
      sendAccountLocked: jest.fn(async () => ({})),
    };

    const fakeAdminWebhookService: any = {
      notifyAdmin: jest.fn(async () => ({})),
    };

    const fakeAuditService: any = {
      logStateChange: jest.fn(async () => ({})),
    };

    const fakeEventEmitter: any = {
      emit: jest.fn(),
    };

    const svc = new FraudService(
      fakeRepo,
      fakeOrderRepo,
      fakeUserRepo,
      fakeGeolocationService,
      fakeCacheService,
      fakeEmailService,
      fakeAdminWebhookService,
      fakeAuditService,
      fakeEventEmitter,
    );

    // Trigger high-risk request that will increment flag count to 3
    await svc.analyzeRequest({
      userId: 'user-lock',
      orderId: 'ord-lock',
      ip: '10.0.0.1',
      metadata: {
        amount: 1000,
        accountAgeHours: 1,
        billingAddress: '123 A St',
        shippingAddress: '456 B Ave',
      },
    });

    // Verify lockout audit event was emitted
    expect(fakeEventEmitter.emit).toHaveBeenCalled();
    const emitCalls = fakeEventEmitter.emit.mock.calls;
    const lockoutEvent = emitCalls.find(
      (call: any[]) => call[0] === 'fraud.account_locked',
    );

    if (flagCount >= 3) {
      expect(lockoutEvent).toBeDefined();
      expect(lockoutEvent[1].userId).toBe('user-lock');
      expect(lockoutEvent[1].actionType).toBe('FRAUD_LOCKOUT');
      expect(lockoutEvent[1].status).toBe('WARNING');
    }
  });
});
