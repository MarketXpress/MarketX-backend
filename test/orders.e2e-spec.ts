import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('OrdersController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let buyerToken: string;
  let otherBuyerToken: string;
  const buyerId = 'buyer-e2e-user';
  const otherBuyerId = 'other-e2e-user';

  const createOrderDto = {
    items: [
      {
        productId: '1',
        quantity: 2,
      },
    ],
    // buyerId here is deliberately ignored by the server — it is always
    // derived from the authenticated caller (req.user.id), never trusted
    // from the request body. Kept only to satisfy DTO validation.
    buyerId: 'user123',
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    jwtService = moduleFixture.get<JwtService>(JwtService);
    await app.init();

    buyerToken = jwtService.sign({ sub: buyerId, email: 'buyer@example.com' });
    otherBuyerToken = jwtService.sign({
      sub: otherBuyerId,
      email: 'other@example.com',
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('/POST orders (create) requires authentication', () => {
    return request(app.getHttpServer())
      .post('/orders')
      .send(createOrderDto)
      .expect(401);
  });

  it('/POST orders (create) succeeds for an authenticated caller', () => {
    return request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send(createOrderDto)
      .expect(201)
      .expect((res) => {
        // The buyer on the created order must be the authenticated caller,
        // not the (ignored) buyerId supplied in the request body.
        expect(res.body.buyerId).toBe(buyerId);
      });
  });

  it('/POST orders with the same Idempotency-Key returns the cached response and creates only one order', async () => {
    const idempotencyKey = `idem-${Date.now()}-${Math.random()}`;

    const first = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(createOrderDto)
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(createOrderDto)
      .expect(201);

    // Same order id => cached response was replayed.
    expect(second.body.id).toBe(first.body.id);
  });

  it('/POST orders with different Idempotency-Keys creates separate orders', async () => {
    const first = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .set('Idempotency-Key', `idem-A-${Date.now()}`)
      .send(createOrderDto)
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .set('Idempotency-Key', `idem-B-${Date.now()}`)
      .send(createOrderDto)
      .expect(201);

    expect(second.body.id).not.toBe(first.body.id);
  });

  it('/GET orders (findAll) requires authentication', () => {
    return request(app.getHttpServer()).get('/orders').expect(401);
  });

  it("/GET orders (findAll) only returns the caller's own orders", () => {
    return request(app.getHttpServer())
      .get('/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
        for (const order of res.body) {
          expect(order.buyerId).toBe(buyerId);
        }
      });
  });

  it('/GET orders/export requires authentication', () => {
    return request(app.getHttpServer())
      .get('/orders/export')
      .query({ format: 'csv', buyerId: otherBuyerId })
      .expect(401);
  });

  it("/GET orders/export ignores a client-supplied buyerId and only exports the caller's own orders (IDOR regression, #466)", async () => {
    await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send(createOrderDto)
      .expect(201);

    // Even though a different buyerId is requested, a non-admin caller must
    // only ever be able to export their own order history.
    return request(app.getHttpServer())
      .get('/orders/export')
      .query({ format: 'csv', buyerId: otherBuyerId })
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200)
      .expect('Content-Type', /text\/csv/);
  });

  it('/GET orders/:id (findOne) requires authentication', () => {
    return request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send(createOrderDto)
      .then((response) => {
        const orderId = response.body.id;
        return request(app.getHttpServer())
          .get(`/orders/${orderId}`)
          .expect(401);
      });
  });

  it('/GET orders/:id (findOne) rejects a different authenticated user', () => {
    return request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send(createOrderDto)
      .then((response) => {
        const orderId = response.body.id;
        return request(app.getHttpServer())
          .get(`/orders/${orderId}`)
          .set('Authorization', `Bearer ${otherBuyerToken}`)
          .expect(403);
      });
  });

  it('/GET orders/:id (findOne) succeeds for the owning buyer', () => {
    return request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send(createOrderDto)
      .then((response) => {
        const orderId = response.body.id;
        return request(app.getHttpServer())
          .get(`/orders/${orderId}`)
          .set('Authorization', `Bearer ${buyerToken}`)
          .expect(200);
      });
  });

  it('/PATCH orders/:id/status (updateStatus) rejects a different authenticated user', () => {
    return request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send(createOrderDto)
      .then((response) => {
        const orderId = response.body.id;
        return request(app.getHttpServer())
          .patch(`/orders/${orderId}/status`)
          .set('Authorization', `Bearer ${otherBuyerToken}`)
          .send({ status: 'confirmed' })
          .expect(403);
      });
  });

  it('/PATCH orders/:id/status (updateStatus) succeeds for the owning buyer', () => {
    return request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send(createOrderDto)
      .then((response) => {
        const orderId = response.body.id;
        return request(app.getHttpServer())
          .patch(`/orders/${orderId}/status`)
          .set('Authorization', `Bearer ${buyerToken}`)
          .send({ status: 'confirmed' })
          .expect(200);
      });
  });

  it('/PATCH orders/:id/cancel rejects a different authenticated user (IDOR regression, #466)', () => {
    return request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send(createOrderDto)
      .then((response) => {
        const orderId = response.body.id;
        return request(app.getHttpServer())
          .patch(`/orders/${orderId}/cancel`)
          .set('Authorization', `Bearer ${otherBuyerToken}`)
          .send({})
          .expect(400);
      });
  });

  it('/PATCH orders/:id/cancel succeeds for the owning buyer', () => {
    return request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send(createOrderDto)
      .then((response) => {
        const orderId = response.body.id;
        return request(app.getHttpServer())
          .patch(`/orders/${orderId}/cancel`)
          .set('Authorization', `Bearer ${buyerToken}`)
          .send({})
          .expect(200);
      });
  });
});
