import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('OrdersController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/POST orders (create)', () => {
    const createOrderDto = {
      items: [
        {
          productId: '1',
          quantity: 2,
        },
      ],
      buyerId: 'user123',
    };

    return request(app.getHttpServer())
      .post('/orders')
      .send(createOrderDto)
      .expect(201);
  });

  it('/POST orders with the same Idempotency-Key returns the cached response and creates only one order', async () => {
    const createOrderDto = {
      items: [{ productId: '1', quantity: 2 }],
      buyerId: 'user123',
    };
    const idempotencyKey = `idem-${Date.now()}-${Math.random()}`;

    const first = await request(app.getHttpServer())
      .post('/orders')
      .set('Idempotency-Key', idempotencyKey)
      .send(createOrderDto)
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/orders')
      .set('Idempotency-Key', idempotencyKey)
      .send(createOrderDto)
      .expect(201);

    // Same order id => cached response was replayed.
    expect(second.body.id).toBe(first.body.id);
  });

  it('/POST orders with different Idempotency-Keys creates separate orders', async () => {
    const createOrderDto = {
      items: [{ productId: '1', quantity: 2 }],
      buyerId: 'user123',
    };

    const first = await request(app.getHttpServer())
      .post('/orders')
      .set('Idempotency-Key', `idem-A-${Date.now()}`)
      .send(createOrderDto)
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/orders')
      .set('Idempotency-Key', `idem-B-${Date.now()}`)
      .send(createOrderDto)
      .expect(201);

    expect(second.body.id).not.toBe(first.body.id);
  });

  it('/GET orders (findAll)', () => {
    return request(app.getHttpServer()).get('/orders').expect(200);
  });

  it('/GET orders/:id (findOne)', () => {
    // Since we don't know the order ID beforehand, we first create one
    const createOrderDto = {
      items: [
        {
          productId: '1',
          quantity: 2,
        },
      ],
      buyerId: 'user123',
    };

    return request(app.getHttpServer())
      .post('/orders')
      .send(createOrderDto)
      .then((response) => {
        const orderId = response.body.id;
        return request(app.getHttpServer())
          .get(`/orders/${orderId}`)
          .expect(200);
      });
  });

  it('/PATCH orders/:id/status (updateStatus)', () => {
    // First create an order, then update its status
    const createOrderDto = {
      items: [
        {
          productId: '1',
          quantity: 2,
        },
      ],
      buyerId: 'user123',
    };

    return request(app.getHttpServer())
      .post('/orders')
      .send(createOrderDto)
      .then((response) => {
        const orderId = response.body.id;
        return request(app.getHttpServer())
          .patch(`/orders/${orderId}/status`)
          .send({ status: 'paid' })
          .expect(200);
      });
  });
});
