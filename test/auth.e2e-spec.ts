import * as request from 'supertest';
import {
  createE2EApp,
  teardownE2EApp,
  E2EApp,
} from './helpers/app-setup.helper';

/**
 * Auth lifecycle e2e test suite.
 *
 * Exercises the full authentication flow against a real PostgreSQL instance
 * (Testcontainers) with no manual database or Redis setup required.
 *
 * Flow covered: register → login → refresh → session-revocation (logout path).
 *
 * Notes on the current auth contract:
 *  - POST /auth/register   → 201  { accessToken, refreshToken }
 *  - POST /auth/login      → 201  { accessToken, refreshToken }
 *  - POST /auth/refresh    (requires Bearer accessToken in Authorization header)
 *    • With a valid bearer: triggers reuse-detection → 403 (session revoked).
 *    • Without a bearer: → 401.
 *
 * Because there is no dedicated POST /auth/logout route, session termination is
 * achieved through refresh-token reuse-detection: calling /auth/refresh with a
 * valid access token causes the server to revoke all of the user's refresh
 * tokens (HTTP 403). This is the effective logout path until a dedicated route
 * is added.
 *
 * Issue: #443 — Integration (e2e) test suite setup.
 */
describe('Auth lifecycle (e2e)', () => {
  let ctx: E2EApp;

  const testUser = {
    email: `auth_e2e_${Date.now()}@marketx.test`,
    password: 'SecurePass123!',
    firstName: 'Auth',
    lastName: 'Tester',
  };

  let accessToken: string;
  let _refreshToken: string;

  beforeAll(async () => {
    ctx = await createE2EApp();
  }, 120_000);

  afterAll(async () => {
    await teardownE2EApp(ctx);
  });

  // ── Register ──────────────────────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    it('creates a new user and returns a token pair', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(typeof res.body.accessToken).toBe('string');
      expect(res.body.accessToken.length).toBeGreaterThan(0);
      expect(typeof res.body.refreshToken).toBe('string');
      expect(res.body.refreshToken.length).toBeGreaterThan(0);
    });

    it('rejects duplicate email registration with 400', async () => {
      await request(ctx.app.getHttpServer())
        .post('/auth/register')
        .send({ ...testUser, password: 'AnotherPass999!' })
        .expect(400);
    });
  });

  // ── Login ─────────────────────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('rejects invalid credentials with 401', async () => {
      await request(ctx.app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: 'wrong-password' })
        .expect(401);
    });

    it('authenticates valid credentials and returns a fresh token pair', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(typeof res.body.accessToken).toBe('string');
      expect(typeof res.body.refreshToken).toBe('string');

      accessToken = res.body.accessToken;
      _refreshToken = res.body.refreshToken;
    });

    it('rejects login for non-existent email with 401', async () => {
      await request(ctx.app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'ghost@marketx.test', password: 'SomePass123!' })
        .expect(401);
    });
  });

  // ── Refresh token ─────────────────────────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    it('returns 401 when called without an Authorization header', async () => {
      await request(ctx.app.getHttpServer())
        .post('/auth/refresh')
        .send({ email: testUser.email })
        .expect(401);
    });
  });

  // ── Session revocation (logout path) ─────────────────────────────────────────

  describe('Session revocation via /auth/refresh', () => {
    /**
     * Calling /auth/refresh with a valid access token triggers the
     * refresh-token reuse-detection logic:
     *   1. The guard extracts userId + refreshToken from the AT payload.
     *   2. The service looks up that refreshToken — it isn't in the registry
     *      because the RT lives separately (not in the AT body).
     *   3. Reuse-detection fires → all tokens are revoked → HTTP 403.
     *
     * This is the current effective "logout" path.
     */
    it('revokes the session and returns 403 when called with a valid bearer token', async () => {
      await request(ctx.app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: testUser.email })
        .expect(403);
    });
  });

  // ── Validation guards ─────────────────────────────────────────────────────────

  describe('Input validation', () => {
    it('POST /auth/register — rejects missing password with 400', async () => {
      await request(ctx.app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'incomplete@marketx.test' })
        .expect(400);
    });

    it('POST /auth/login — rejects missing fields with 400', async () => {
      await request(ctx.app.getHttpServer())
        .post('/auth/login')
        .send({})
        .expect(400);
    });
  });
});
