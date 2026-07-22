import * as request from 'supertest';
import {
  createE2EApp,
  teardownE2EApp,
  E2EApp,
} from './helpers/app-setup.helper';

/**
 * Auth Lifecycle Integration Tests (extended suite)
 *
 * Mirrors the auth.e2e-spec.ts core flow but exercises additional edge-cases
 * and duplicate-registration scenarios in more depth.
 *
 * Current API contract (no /auth/profile, /auth/logout, /auth/forgot-password):
 *  - POST /auth/register  → 201 { accessToken, refreshToken }
 *  - POST /auth/login     → 201 { accessToken, refreshToken }
 *  - POST /auth/refresh   → guarded by JwtRefreshGuard (Bearer required)
 *
 * Issue: #443 — Integration (e2e) test suite setup.
 */
describe('Auth Lifecycle (e2e)', () => {
  let ctx: E2EApp;

  const testUser = {
    email: `auth_lifecycle_${Date.now()}@marketx.test`,
    password: 'SecurePass123!',
    firstName: 'Lifecycle',
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

  // ── Registration ──────────────────────────────────────────────────────────────

  describe('User Registration', () => {
    it('should register a new user and return token pair', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');

      accessToken = res.body.accessToken;
      _refreshToken = res.body.refreshToken;
    });

    it('should reject registration with duplicate email with 400', async () => {
      await request(ctx.app.getHttpServer())
        .post('/auth/register')
        .send({ ...testUser, password: 'DifferentPass999!' })
        .expect(400);
    });

    it('should reject registration without required fields with 400', async () => {
      await request(ctx.app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'missingpass@marketx.test' })
        .expect(400);
    });
  });

  // ── Login ─────────────────────────────────────────────────────────────────────

  describe('User Login', () => {
    it('should authenticate with correct credentials', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');

      // Refresh tokens for subsequent tests.
      accessToken = res.body.accessToken;
      _refreshToken = res.body.refreshToken;
    });

    it('should reject login with wrong password with 401', async () => {
      await request(ctx.app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: 'WrongPassword123!' })
        .expect(401);
    });

    it('should reject login with non-existent email with 401', async () => {
      await request(ctx.app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@marketx.test',
          password: 'SomePassword123!',
        })
        .expect(401);
    });
  });

  // ── Refresh / session management ──────────────────────────────────────────────

  describe('Token Refresh', () => {
    it('should return 401 when called without a bearer token', async () => {
      await request(ctx.app.getHttpServer())
        .post('/auth/refresh')
        .send({ email: testUser.email })
        .expect(401);
    });

    it('should return 403 (reuse-detection / session revocation) when called with valid bearer', async () => {
      /**
       * The JwtRefreshGuard extracts userId + refreshToken from the bearer
       * token. Because the RT value is not embedded in the AT, the registry
       * lookup fails → reuse-detection → all sessions revoked → 403.
       * This is the effective "logout" path in the current implementation.
       */
      await request(ctx.app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: testUser.email })
        .expect(403);
    });
  });

  // ── Input validation edge-cases ───────────────────────────────────────────────

  describe('Input Validation', () => {
    it('POST /auth/register — rejects empty body with 400', async () => {
      await request(ctx.app.getHttpServer())
        .post('/auth/register')
        .send({})
        .expect(400);
    });

    it('POST /auth/login — rejects empty body with 400', async () => {
      await request(ctx.app.getHttpServer())
        .post('/auth/login')
        .send({})
        .expect(400);
    });
  });
});
