import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { AppModule } from '../src/app.module';

/**
 * Auth Lifecycle Integration Tests
 *
 * Tests the complete authentication flow:
 * - User registration
 * - Login
 * - Token refresh
 * - Logout
 * - Password reset
 * - Profile access
 */
describe('Auth Lifecycle (e2e)', () => {
  let app: INestApplication;
  let pg: StartedPostgreSqlContainer;

  // Test data
  const testUser = {
    email: `auth_test_${Date.now()}@marketx.test`,
    password: 'SecurePass123!',
    name: 'Auth Test User',
  };

  let accessToken: string;
  let refreshToken: string;
  let resetToken: string;

  beforeAll(async () => {
    // Start PostgreSQL container
    pg = await new PostgreSqlContainer('postgres:15-alpine')
      .withDatabase('marketx_auth_e2e')
      .withUsername('test')
      .withPassword('test')
      .start();

    // Set environment variables for the test database
    process.env.DATABASE_HOST = pg.getHost();
    process.env.DATABASE_PORT = String(pg.getMappedPort(5432));
    process.env.DATABASE_USER = pg.getUsername();
    process.env.DATABASE_PASSWORD = pg.getPassword();
    process.env.DATABASE_NAME = pg.getDatabase();
    process.env.NODE_ENV = 'test';

    // Create and configure the NestJS app
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await pg.stop();
  });

  describe('User Registration', () => {
    it('should register a new user', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: testUser.email,
          password: testUser.password,
          name: testUser.name,
        })
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.email).toBe(testUser.email);

      accessToken = response.body.accessToken;
      refreshToken = response.body.refreshToken;
    });

    it('should not register user with existing email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: testUser.email,
          password: 'DifferentPass123!',
          name: 'Different Name',
        })
        .expect(400);
    });
  });

  describe('User Login', () => {
    it('should login with correct credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');

      // Update tokens for subsequent tests
      accessToken = response.body.accessToken;
      refreshToken = response.body.refreshToken;
    });

    it('should reject login with wrong password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
        })
        .expect(401);
    });

    it('should reject login with non-existent email', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@marketx.test',
          password: 'SomePassword123!',
        })
        .expect(401);
    });
  });

  describe('Profile Access', () => {
    it('should get user profile with valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('email', testUser.email);
      expect(response.body).toHaveProperty('name', testUser.name);
    });

    it('should reject profile access without token', async () => {
      await request(app.getHttpServer())
        .get('/auth/profile')
        .expect(401);
    });

    it('should reject profile access with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);
    });
  });

  describe('Token Refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({
          refreshToken: refreshToken,
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');

      // Update tokens
      accessToken = response.body.accessToken;
      refreshToken = response.body.refreshToken;
    });

    it('should reject refresh with invalid token', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({
          refreshToken: 'invalid.refresh.token',
        })
        .expect(401);
    });
  });

  describe('Password Reset', () => {
    it('should request password reset for existing user', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({
          email: testUser.email,
        })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      // In a real scenario, we'd capture the reset token from email
      // For testing, we'll assume the token is generated
    });

    it('should not reveal if email exists for non-existent user', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({
          email: 'nonexistent@marketx.test',
        })
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });

    // Note: Reset password test would require mocking email service
    // or extracting token from email queue
    it.skip('should reset password with valid token', async () => {
      const newPassword = 'NewSecurePass123!';
      const resetToken = 'mock-reset-token';

      const response = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: newPassword,
        })
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // Verify login with new password
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: newPassword,
        })
        .expect(200);

      expect(loginResponse.body).toHaveProperty('accessToken');
    });
  });

  describe('Logout', () => {
    it('should logout user and invalidate refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Logged out successfully');
    });

    it('should reject refresh with invalidated refresh token', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({
          refreshToken: refreshToken,
        })
        .expect(401);
    });

    // Note: Access tokens remain valid until expiry
    it('should still allow profile access with valid access token', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('email', testUser.email);
    });
  });

  // OAuth tests would go here if implemented
  describe.skip('OAuth Linking', () => {
    it('should link OAuth provider to user account', async () => {
      // Implementation depends on OAuth provider
    });

    it('should login via OAuth', async () => {
      // Implementation depends on OAuth provider
    });
  });
});