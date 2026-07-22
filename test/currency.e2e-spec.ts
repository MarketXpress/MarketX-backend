import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Currency (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/currency/rates (GET)', () => {
    it('should return exchange rates', () => {
      return request(app.getHttpServer())
        .get('/currency/rates')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('USD');
          expect(res.body.USD).toBe(1);
          expect(res.body).toHaveProperty('EUR');
          expect(res.body).toHaveProperty('GBP');
        });
    });
  });

  describe('/currency/convert (POST)', () => {
    it('should convert USD to EUR', () => {
      return request(app.getHttpServer())
        .post('/currency/convert')
        .send({ amount: 100, from: 'USD', to: 'EUR' })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('amount');
          expect(res.body).toHaveProperty('rate');
          expect(res.body.amount).toBeLessThan(100);
        });
    });

    it('should return same amount for same currency', () => {
      return request(app.getHttpServer())
        .post('/currency/convert')
        .send({ amount: 100, from: 'USD', to: 'USD' })
        .expect(201)
        .expect((res) => {
          expect(res.body.amount).toBe(100);
          expect(res.body.rate).toBe(1);
        });
    });
  });

  describe('/products (GET) with X-Currency header', () => {
    it('should return products with prices in requested currency', () => {
      return request(app.getHttpServer())
        .get('/products')
        .set('X-Currency', 'EUR')
        .expect(200);
    });
  });
});
