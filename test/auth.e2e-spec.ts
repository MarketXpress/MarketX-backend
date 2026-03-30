import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { AppModule } from '../src/app.module';
import { AuthModule } from '../src/Authentication/user.module';

/**
 * Full end-to-end flow exercising the real application stack against a live
 * PostgreSQL container (Testcontainers). No mocks — every layer is hit:
 * routing, middleware, guards, DB relations, escrow simulation.
 *
 * Flow:
 *   1. Register user  (POST /users)
 *   2. Browse products (GET /products)
 *   3. Create order   (POST /orders)
 *   4. Register webhook endpoint (POST /webhooks)
 *   5. Simulate payment via order status update (PATCH /orders/:id/status)
 *   6. Create escrow  (POST /escrow)
 *   7. Verify escrow persisted (GET /escrow/order/:orderId)
 *   8. Confirm order state end-to-end (GET /orders/:id)
 */
describe('Full Purchase Flow (e2e)', () => {
  let app: INestApplication;
  let pg: StartedPostgreSqlContainer;

  // State threaded through the sequential flow
  let userId: string;
  let productId: string;
  let orderId: string;
  let escrowId: string;

  const testUser = {
    email: `e2e_${Date.now()}@marketx.test`,
    password: 'SecurePass123!',
    name: 'E2E Buyer',
  };

  // ── Container + App bootstrap ──────────────────────────────────────────────

  beforeAll(async () => {
    pg = await new PostgreSqlContainer('postgres:15-alpine')
      .withDatabase('marketx_e2e')
      .withUsername('test')
      .withPassword('test')
      .start();

    // Inject container credentials before AppModule initialises TypeORM
    process.env.DATABASE_HOST = pg.getHost();
    process.env.DATABASE_PORT = String(pg.getMappedPort(5432));
    process.env.DATABASE_USER = pg.getUsername();
    process.env.DATABASE_PASSWORD = pg.getPassword();
    process.env.DATABASE_NAME = pg.getDatabase();
    process.env.NODE_ENV = 'test';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await pg.stop();
  });

  // ── Step 1: Register user ──────────────────────────────────────────────────

  it('POST /users — registers a new user', async () => {
    const res = await request(app.getHttpServer())
      .post('/users')
      .send(testUser)
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.email).toBe(testUser.email);

    userId = String(res.body.id);
  });

  // ── Step 2: Browse products ────────────────────────────────────────────────

  it('GET /products — returns product catalogue (public)', async () => {
    const res = await request(app.getHttpServer())
      .get('/products')
      .expect(200);

    const products: any[] = Array.isArray(res.body) ? res.body : (res.body?.data ?? []);
    expect(Array.isArray(products)).toBe(true);

    if (products.length > 0) {
      productId = products[0].id;
    }
  });

  // ── Step 3: Create order ───────────────────────────────────────────────────

  it('POST /orders — places an order for the registered buyer', async () => {
    const itemProductId = productId ?? '00000000-0000-0000-0000-000000000001';

    const res = await request(app.getHttpServer())
      .post('/orders')
      .send({
        buyerId: userId,
        items: [{ productId: itemProductId, quantity: 1 }],
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.buyerId).toBe(userId);
    expect(res.body.status).toBe('pending');

    orderId = res.body.id;
  });

  // ── Step 4: Register a webhook endpoint ───────────────────────────────────

  it('POST /webhooks — registers a webhook for order lifecycle events', async () => {
    const res = await request(app.getHttpServer())
      .post('/webhooks')
      .send({
        url: 'https://webhook.site/marketx-e2e-test',
        events: ['order.created', 'order.paid'],
        isActive: true,
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.isActive).toBe(true);
  });

  // ── Step 5: Simulate payment confirmation via status update ───────────────

  it('PATCH /orders/:id/status — transitions order to paid (webhook-driven simulation)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .send({ status: 'paid' })
      .expect(200);

    expect(res.body.status).toBe('paid');
  });

  // ── Step 6: Create escrow ──────────────────────────────────────────────────

  it('POST /escrow — locks funds in escrow for the paid order', async () => {
    const { Keypair } = await import('@stellar/stellar-sdk');
    const buyer = Keypair.random();
    const seller = Keypair.random();

    const res = await request(app.getHttpServer())
      .post('/escrow')
      .send({
        orderId,
        buyerPublicKey: buyer.publicKey(),
        sellerPublicKey: seller.publicKey(),
        buyerSecretKey: buyer.secret(),
        amount: 10,
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.orderId).toBe(orderId);
    expect(['pending', 'locked']).toContain(res.body.status);

    escrowId = res.body.id;
  });

  // ── Step 7: Verify escrow lookup by order ─────────────────────────────────

  it('GET /escrow/order/:orderId — retrieves escrow record by order ID', async () => {
    const res = await request(app.getHttpServer())
      .get(`/escrow/order/${orderId}`)
      .expect(200);

    expect(res.body.id).toBe(escrowId);
    expect(res.body.orderId).toBe(orderId);
  });

  // ── Step 8: Assert end-to-end order persistence ───────────────────────────

  it('GET /orders/:id — confirms order persisted with correct state across the full flow', async () => {
    const res = await request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .expect(200);

    expect(res.body.id).toBe(orderId);
    expect(res.body.buyerId).toBe(userId);
    expect(res.body.status).toBe('paid');
  });
});
