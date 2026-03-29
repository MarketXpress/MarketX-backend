import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ETagInterceptor } from '../src/common/interceptors/etag.interceptor';

describe('ETagInterceptor (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalInterceptors(new ETagInterceptor());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET / should return ETag header', async () => {
    const response = await request(app.getHttpServer())
      .get('/')
      .expect(200);

    expect(response.get('ETag')).toBeDefined();
    expect(response.get('ETag')).toMatch(/^".*"$/); // Must be a strong ETag
  });

  it('GET / with If-None-Match should return 304', async () => {
    // First request to get the ETag
    const firstRes = await request(app.getHttpServer())
      .get('/')
      .expect(200);

    const etag = firstRes.get('ETag');
    expect(etag).toBeDefined();

    // Subsequent request with If-None-Match
    await request(app.getHttpServer())
      .get('/')
      .set('If-None-Match', etag)
      .expect(304)
      .expect((res) => {
        expect(res.body).toEqual({}); // Body must be empty (supertest might return empty object for null)
      });
  });

  it('GET / with incorrect If-None-Match should return 200', async () => {
    await request(app.getHttpServer())
      .get('/')
      .set('If-None-Match', '"wrong-etag"')
      .expect(200);
  });

  it('POST / should NOT return ETag header', async () => {
    // Note: Depends on if there's a POST endpoint at / or if we use another one
    // But since ETagInterceptor only runs on GET, this should be fine.
    const response = await request(app.getHttpServer())
      .post('/categories')
      .send({ name: 'Test' })
      .expect((res) => {
          // Should not have ETag if interceptor is working correctly for only GET
          expect(res.get('ETag')).toBeUndefined();
      });
  });
});
