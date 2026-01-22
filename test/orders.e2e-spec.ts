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

  it('/GET orders (findAll)', () => {
    return request(app.getHttpServer())
      .get('/orders')
      .expect(200);
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
      .then(response => {
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
      .then(response => {
        const orderId = response.body.id;
        return request(app.getHttpServer())
          .patch(`/orders/${orderId}/status`)
          .send({ status: 'paid' })
          .expect(200);
      });
  });
});