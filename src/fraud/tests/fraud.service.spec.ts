/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await */
import { FraudService } from '../fraud.service';
import { OrderStatus } from '../../orders/dto/create-order.dto';
import { evaluateAllRules } from '../score';

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

    const svc = new FraudService(
      fakeRepo,
      fakeOrderRepo,
      fakeUserRepo,
      fakeGeolocationService,
      fakeCacheService,
      fakeEmailService,
      fakeAdminWebhookService,
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

    const svc = new FraudService(
      fakeRepo,
      fakeOrderRepo,
      fakeUserRepo,
      fakeGeolocationService,
      fakeCacheService,
      fakeEmailService,
      fakeAdminWebhookService,
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
});
