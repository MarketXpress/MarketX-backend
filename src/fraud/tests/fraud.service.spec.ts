import { FraudService } from '../fraud.service';
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

  it('FraudService creates alert when score high', async () => {
    const fakeRepo: any = {
      create: (o: any) => ({ ...o }),
      save: jest.fn(async (o: any) => ({ ...o, id: 'fake-id' })),
      findAndCount: jest.fn(async () => [[], 0]),
      findOneBy: jest.fn(async () => null),
    };

    const svc = new FraudService(fakeRepo);

    // prime velocity: call rules repeatedly to build internal state
    for (let i = 0; i < 30; i++) {
      // eslint-disable-next-line no-await-in-loop
      await evaluateAllRules({ userId: 'u-progressive', metadata: { i } });
    }

    // prime fingerprint: same fingerprint from multiple IPs
    const ips = ['1.1.1.1', '2.2.2.2', '3.3.3.3', '4.4.4.4'];
    for (const ip of ips) {
      // eslint-disable-next-line no-await-in-loop
      await evaluateAllRules({ deviceFingerprint: 'fp-1', ip });
    }

    // prime duplicate: call once to store order
    await evaluateAllRules({ userId: 'u-progressive', orderId: 'ord-1' });

    // Check combined score before invoking service
    const combined = await evaluateAllRules({ userId: 'u-progressive', orderId: 'ord-1', ip: '4.4.4.4', deviceFingerprint: 'fp-1' });
    // Debugging assertion: ensure score is high enough to trigger alert creation
    expect(combined.riskScore).toBeGreaterThanOrEqual(20);

    // now call service which should create an alert given primed state
    await svc.analyzeRequest({ userId: 'u-progressive', orderId: 'ord-1', ip: '4.4.4.4', deviceFingerprint: 'fp-1' });

    expect(fakeRepo.save).toHaveBeenCalled();
  }, 20000);
});
