import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { AppModule } from '../../src/app.module';

export interface E2EApp {
  app: INestApplication;
  pg: StartedPostgreSqlContainer;
}

/**
 * Shared bootstrap helper for e2e suites.
 *
 * Spins up a real PostgreSQL container via Testcontainers and initialises the
 * full NestJS application against it. No manual database or Redis setup is
 * required — the cache used by AuthModule is in-memory (CacheModule.register())
 * and BullModule falls back gracefully in the test environment.
 *
 * Usage:
 *   const { app, pg } = await createE2EApp();
 *   // ... tests ...
 *   await teardownE2EApp({ app, pg });
 */
export async function createE2EApp(): Promise<E2EApp> {
  const pg = await new PostgreSqlContainer('postgres:15-alpine')
    .withDatabase('marketx_e2e')
    .withUsername('test')
    .withPassword('test')
    .start();

  // Wire TypeORM at the container's ephemeral address before the module loads.
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_HOST = pg.getHost();
  process.env.DATABASE_PORT = String(pg.getMappedPort(5432));
  process.env.DATABASE_USER = pg.getUsername();
  process.env.DATABASE_PASSWORD = pg.getPassword();
  process.env.DATABASE_NAME = pg.getDatabase();

  // Minimal secrets required by auth strategies.
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'e2e-test-secret';
  process.env.JWT_REFRESH_SECRET =
    process.env.JWT_REFRESH_SECRET ?? 'e2e-refresh-secret';

  // Suppress Redis connection noise — BullModule connects lazily.
  process.env.REDIS_HOST = process.env.REDIS_HOST ?? 'localhost';
  process.env.REDIS_PORT = process.env.REDIS_PORT ?? '6379';

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  return { app, pg };
}

export async function teardownE2EApp({ app, pg }: E2EApp): Promise<void> {
  await app?.close();
  await pg?.stop();
}
