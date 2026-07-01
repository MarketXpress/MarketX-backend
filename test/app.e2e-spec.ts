import * as request from 'supertest';
import {
  createE2EApp,
  teardownE2EApp,
  E2EApp,
} from './helpers/app-setup.helper';

/**
 * Application-level e2e smoke tests.
 *
 * Boots the full NestJS application against a real PostgreSQL instance spun up
 * via Testcontainers (no manual DB setup required) and verifies that:
 *  - The health check endpoint returns 200 with the database marked "up".
 *  - The liveness probe responds correctly.
 *  - Unknown routes return 404 (not 500).
 *
 * Issue: #443 — Integration (e2e) test suite setup.
 */
describe('Application health (e2e)', () => {
  let ctx: E2EApp;

  beforeAll(async () => {
    ctx = await createE2EApp();
  }, 120_000);

  afterAll(async () => {
    await teardownE2EApp(ctx);
  });

  // ── Health check ─────────────────────────────────────────────────────────────

  it('GET /health — returns 200 with database status "up"', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(res.body.status).toBe('ok');
    expect(res.body.info?.database?.status).toBe('up');
  });

  // ── Liveness probe ───────────────────────────────────────────────────────────

  it('GET /health/live — returns 200 liveness probe', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/health/live')
      .expect(200);

    expect(res.body).toEqual({ status: 'up' });
  });

  // ── 404 guard ────────────────────────────────────────────────────────────────

  it('GET /nonexistent-route — returns 404 (not 500)', async () => {
    await request(ctx.app.getHttpServer())
      .get('/this-route-does-not-exist')
      .expect(404);
  });
});
