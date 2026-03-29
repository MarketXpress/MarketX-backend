import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { App } from 'supertest/types';
import {
  CURRENT_API_VERSION,
  NEXT_API_VERSION,
  configureGlobalApiVersioning,
} from '../src/common/versioning/api-versioning';

@Controller('versioning-probe')
class VersioningProbeController {
  @Get()
  getVersionedRoute() {
    return {
      routeVersion: CURRENT_API_VERSION,
    };
  }
}

@Controller({
  path: 'versioning-probe',
  version: NEXT_API_VERSION,
})
class NextVersioningProbeController {
  @Get()
  getNextRoute() {
    return {
      routeVersion: NEXT_API_VERSION,
    };
  }
}

@Module({
  controllers: [VersioningProbeController, NextVersioningProbeController],
})
class VersioningTestModule {}

describe('Global API versioning (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [VersioningTestModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureGlobalApiVersioning(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves canonical v1 routes from the default controller version', async () => {
    await request(app.getHttpServer())
      .get('/v1/versioning-probe')
      .expect(200)
      .expect({ routeVersion: '1' });
  });

  it('silently preserves legacy unversioned routes by mapping them to v1', async () => {
    await request(app.getHttpServer())
      .get('/versioning-probe')
      .expect(200)
      .expect({ routeVersion: '1' });
  });

  it('keeps v2 routes available for new integrations without falling back to v1', async () => {
    await request(app.getHttpServer())
      .get('/v2/versioning-probe')
      .expect(200)
      .expect({ routeVersion: '2' });
  });
});
