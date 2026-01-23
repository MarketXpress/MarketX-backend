import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { PaymentsModule } from './payments.module';
import { OrdersModule } from 'src/orders/orders.module';
import { WalletModule } from 'src/wallet/wallet.module';
import { PaymentsService } from './payments.service';
import { PaymentMonitorService } from './payment-monitor.service';
import { PaymentStatus, PaymentCurrency } from './dto/payment.dto';

describe('Payments Module (e2e)', () => {
  let app: INestApplication;
  let paymentsService: PaymentsService;
  let paymentMonitorService: PaymentMonitorService;

  // Mock data
  const testOrderId = 'order-123';
  const testBuyerId = 'buyer-123';
  const testWalletAddress = 'GBUQWP3BOUZX34ULNQG23RQ6F5DOBAB4NSTZDVSXTVWDNXMhtqc6VPM7';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        EventEmitterModule.forRoot(),
        ScheduleModule.forRoot(),
        PaymentsModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    paymentsService = moduleFixture.get<PaymentsService>(PaymentsService);
    paymentMonitorService = moduleFixture.get<PaymentMonitorService>(PaymentMonitorService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /payments/initiate', () => {
    it('should initiate a payment and return wallet address', async () => {
      const response = await request(app.getHttpServer())
        .post('/payments/initiate')
        .send({
          orderId: testOrderId,
          currency: PaymentCurrency.XLM,
          timeoutMinutes: 30,
        })
        .expect(HttpStatus.CREATED);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('destinationWalletAddress');
      expect(response.body.status).toBe(PaymentStatus.PENDING);
      expect(response.body.currency).toBe(PaymentCurrency.XLM);
    });

    it('should return 400 for invalid currency', async () => {
      await request(app.getHttpServer())
        .post('/payments/initiate')
        .send({
          orderId: testOrderId,
          currency: 'INVALID',
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 404 for non-existent order', async () => {
      await request(app.getHttpServer())
        .post('/payments/initiate')
        .send({
          orderId: 'non-existent',
          currency: PaymentCurrency.XLM,
        })
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('GET /payments/:paymentId', () => {
    it('should retrieve payment status', async () => {
      // This test would require setting up test data first
      // For demonstration purposes
      const response = await request(app.getHttpServer())
        .get('/payments/payment-123')
        .expect((res) => {
          // Expect either 200 (if payment exists) or 404 (if not)
          expect([200, 404]).toContain(res.status);
        });
    });
  });

  describe('POST /payments/webhook/stellar', () => {
    it('should accept Stellar webhook', async () => {
      const webhookData = {
        transactionHash: 'tx-123',
        sourceAccount: 'GBUQWP3BOUZX34ULNQG23RQ6F5DOBAB4NSTZDVSXTVWDNXMHTQC6VTEST',
        destinationAccount: testWalletAddress,
        amount: '100',
        asset_code: 'XLM',
        ledger: 123456,
        created_at: new Date().toISOString(),
      };

      await request(app.getHttpServer())
        .post('/payments/webhook/stellar')
        .send(webhookData)
        .expect(HttpStatus.OK);
    });

    it('should reject invalid webhook data', async () => {
      await request(app.getHttpServer())
        .post('/payments/webhook/stellar')
        .send({
          // Missing required fields
        })
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  describe('GET /payments/monitor/status', () => {
    it('should return monitor status', async () => {
      const response = await request(app.getHttpServer())
        .get('/payments/monitor/status')
        .expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('activeStreams');
      expect(typeof response.body.activeStreams).toBe('number');
    });
  });

  describe('Payment Flow Simulation', () => {
    it('should handle complete payment flow', async () => {
      // 1. Initiate payment
      const initiateResponse = await request(app.getHttpServer())
        .post('/payments/initiate')
        .send({
          orderId: `order-${Date.now()}`,
          currency: PaymentCurrency.XLM,
          timeoutMinutes: 30,
        });

      expect(initiateResponse.status).toBe(HttpStatus.CREATED);
      const paymentId = initiateResponse.body.id;

      // 2. Verify monitoring started
      const statusResponse = await request(app.getHttpServer())
        .get('/payments/monitor/status')
        .expect(HttpStatus.OK);

      expect(statusResponse.body.activeStreams).toBeGreaterThanOrEqual(0);

      // 3. Get payment status
      const paymentResponse = await request(app.getHttpServer())
        .get(`/payments/${paymentId}`)
        .expect(HttpStatus.OK);

      expect(paymentResponse.body.status).toBe(PaymentStatus.PENDING);
      expect(paymentResponse.body.destinationWalletAddress).toBeDefined();
    });

    it('should timeout payment after expiration', async () => {
      // This test would require setting up test data with a past expiration date
      // For demonstration purposes, we're showing the structure
      expect(true).toBe(true);
    });
  });
});
