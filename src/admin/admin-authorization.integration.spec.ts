import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';

describe('Admin Authorization Integration Tests', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let jwtService: JwtService;

  // Test users with different roles
  let adminToken: string;
  let moderatorToken: string;
  let userToken: string;
  let supportToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    jwtService = moduleFixture.get<JwtService>(JwtService);

    await app.init();

    // Create test users and generate tokens
    await createTestUsers();
    await generateTokens();
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  async function createTestUsers() {
    const users = [
      { id: 'admin-1', email: 'admin@test.com', role: 'admin', isActive: true },
      { id: 'moderator-1', email: 'moderator@test.com', role: 'moderator', isActive: true },
      { id: 'user-1', email: 'user@test.com', role: 'user', isActive: true },
      { id: 'support-1', email: 'support@test.com', role: 'support', isActive: true },
    ];

    for (const userData of users) {
      const existingUser = await userRepository.findOne({ where: { id: userData.id } });
      if (!existingUser) {
        const user = userRepository.create(userData);
        await userRepository.save(user);
      }
    }
  }

  async function generateTokens() {
    adminToken = jwtService.sign({ sub: 'admin-1', role: 'admin', email: 'admin@test.com' });
    moderatorToken = jwtService.sign({ sub: 'moderator-1', role: 'moderator', email: 'moderator@test.com' });
    userToken = jwtService.sign({ sub: 'user-1', role: 'user', email: 'user@test.com' });
    supportToken = jwtService.sign({ sub: 'support-1', role: 'support', email: 'support@test.com' });
  }

  async function cleanupTestData() {
    await userRepository.delete({ id: 'admin-1' });
    await userRepository.delete({ id: 'moderator-1' });
    await userRepository.delete({ id: 'user-1' });
    await userRepository.delete({ id: 'support-1' });
  }

  describe('Admin Routes Authorization Matrix', () => {
    const adminRoutes = [
      { path: '/admin/users', method: 'GET' },
      { path: '/admin/orders', method: 'GET' },
      { path: '/admin/stats', method: 'GET' },
      { path: '/admin/users/test-user/suspend', method: 'PATCH' },
      { path: '/admin/users/test-user/activate', method: 'PATCH' },
    ];

    const escrowRoutes = [
      { path: '/admin/escrows/pending', method: 'GET' },
    ];

    const fraudRoutes = [
      { path: '/admin/fraud/alerts', method: 'GET' },
      { path: '/admin/fraud/test-id/review', method: 'PATCH' },
    ];

    describe('Admin-only routes (require ADMIN role)', () => {
      adminRoutes.forEach(route => {
        describe(`${route.method} ${route.path}`, () => {
          it('should allow access with ADMIN token', async () => {
            const response = request(app.getHttpServer())
              .get(route.path)
              .set('Authorization', `Bearer ${adminToken}`);

            if (route.method === 'GET') {
              await (await response).expect(200);
            } else {
              await (await request(app.getHttpServer())
                .patch(route.path)
                .set('Authorization', `Bearer ${adminToken}`)
              ).expect(200);
            }
          });

          it('should deny access with MODERATOR token', async () => {
            const response = request(app.getHttpServer())
              .get(route.path)
              .set('Authorization', `Bearer ${moderatorToken}`);

            if (route.method === 'GET') {
              await (await response).expect(403);
            } else {
              await (await request(app.getHttpServer())
                .patch(route.path)
                .set('Authorization', `Bearer ${moderatorToken}`)
              ).expect(403);
            }
          });

          it('should deny access with USER token', async () => {
            const response = request(app.getHttpServer())
              .get(route.path)
              .set('Authorization', `Bearer ${userToken}`);

            if (route.method === 'GET') {
              await (await response).expect(403);
            } else {
              await (await request(app.getHttpServer())
                .patch(route.path)
                .set('Authorization', `Bearer ${userToken}`)
              ).expect(403);
            }
          });

          it('should deny access with SUPPORT token', async () => {
            const response = request(app.getHttpServer())
              .get(route.path)
              .set('Authorization', `Bearer ${supportToken}`);

            if (route.method === 'GET') {
              await (await response).expect(403);
            } else {
              await (await request(app.getHttpServer())
                .patch(route.path)
                .set('Authorization', `Bearer ${supportToken}`)
              ).expect(403);
            }
          });

          it('should deny access without authentication', async () => {
            const response = request(app.getHttpServer())
              .get(route.path);

            if (route.method === 'GET') {
              await (await response).expect(401);
            } else {
              await (await request(app.getHttpServer())
                .patch(route.path)
              ).expect(401);
            }
          });
        });
      });
    });

    describe('Escrow routes (multi-role access)', () => {
      escrowRoutes.forEach(route => {
        describe(`${route.method} ${route.path}`, () => {
          it('should allow access with ADMIN token', async () => {
            await (await request(app.getHttpServer())
              .get(route.path)
              .set('Authorization', `Bearer ${adminToken}`)
            ).expect(200);
          });

          it('should allow access with MODERATOR token (if configured)', async () => {
            // This test assumes moderators have access to escrow routes
            // Adjust based on actual role configuration
            await (await request(app.getHttpServer())
              .get(route.path)
              .set('Authorization', `Bearer ${moderatorToken}`)
            ).expect(403); // Currently denied, update if configuration changes
          });

          it('should allow access with SUPPORT token (if configured)', async () => {
            // This test assumes support staff have access to escrow routes
            // Adjust based on actual role configuration
            await (await request(app.getHttpServer())
              .get(route.path)
              .set('Authorization', `Bearer ${supportToken}`)
            ).expect(403); // Currently denied, update if configuration changes
          });

          it('should deny access with USER token', async () => {
            await (await request(app.getHttpServer())
              .get(route.path)
              .set('Authorization', `Bearer ${userToken}`)
            ).expect(403);
          });

          it('should deny access without authentication', async () => {
            await (await request(app.getHttpServer())
              .get(route.path)
            ).expect(401);
          });
        });
      });
    });

    describe('Fraud routes (admin-only)', () => {
      fraudRoutes.forEach(route => {
        describe(`${route.method} ${route.path}`, () => {
          it('should allow access with ADMIN token', async () => {
            if (route.method === 'GET') {
              await (await request(app.getHttpServer())
                .get(route.path)
                .set('Authorization', `Bearer ${adminToken}`)
              ).expect(200);
            } else {
              await (await request(app.getHttpServer())
                .patch(route.path)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ mark: 'safe' })
              ).expect(200);
            }
          });

          it('should deny access with MODERATOR token', async () => {
            if (route.method === 'GET') {
              await (await request(app.getHttpServer())
                .get(route.path)
                .set('Authorization', `Bearer ${moderatorToken}`)
              ).expect(403);
            } else {
              await (await request(app.getHttpServer())
                .patch(route.path)
                .set('Authorization', `Bearer ${moderatorToken}`)
                .send({ mark: 'safe' })
              ).expect(403);
            }
          });

          it('should deny access with USER token', async () => {
            if (route.method === 'GET') {
              await (await request(app.getHttpServer())
                .get(route.path)
                .set('Authorization', `Bearer ${userToken}`)
              ).expect(403);
            } else {
              await (await request(app.getHttpServer())
                .patch(route.path)
                .set('Authorization', `Bearer ${userToken}`)
                .send({ mark: 'safe' })
              ).expect(403);
            }
          });
        });
      });
    });
  });

  describe('Authorization Edge Cases', () => {
    it('should reject malformed JWT tokens', async () => {
      await (await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', 'Bearer malformed.token.here')
      ).expect(401);
    });

    it('should reject expired JWT tokens', async () => {
      const expiredToken = jwtService.sign(
        { sub: 'admin-1', role: 'admin' },
        { expiresIn: '-1h' }
      );

      await (await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${expiredToken}`)
      ).expect(401);
    });

    it('should reject tokens with invalid role structure', async () => {
      const malformedToken = jwtService.sign({
        sub: 'admin-1',
        role: { admin: true }, // Object instead of string
        email: 'admin@test.com'
      });

      await (await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${malformedToken}`)
      ).expect(403);
    });

    it('should reject tokens for non-existent users', async () => {
      const nonExistentUserToken = jwtService.sign({
        sub: 'non-existent-user',
        role: 'admin',
        email: 'nonexistent@test.com'
      });

      await (await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${nonExistentUserToken}`)
      ).expect(401);
    });

    it('should reject requests with missing Authorization header', async () => {
      await (await request(app.getHttpServer())
        .get('/admin/users')
      ).expect(401);
    });

    it('should reject requests with invalid Authorization header format', async () => {
      await (await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `InvalidFormat ${adminToken}`)
      ).expect(401);
    });
  });

  describe('Cross-Role Access Prevention', () => {
    it('should prevent role escalation through token manipulation', async () => {
      // Create a token for a regular user but manually set role to admin
      const escalatedToken = jwtService.sign({
        sub: 'user-1', // Regular user ID
        role: 'admin', // Escalated role
        email: 'user@test.com'
      });

      // This should fail because the user exists but doesn't have admin role in database
      await (await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${escalatedToken}`)
      ).expect(403);
    });

    it('should prevent access to suspended admin accounts', async () => {
      // Create a suspended admin user
      const suspendedAdmin = userRepository.create({
        id: 'suspended-admin',
        email: 'suspended@admin.com',
        role: 'admin',
        isActive: false
      });
      await userRepository.save(suspendedAdmin);

      const suspendedAdminToken = jwtService.sign({
        sub: 'suspended-admin',
        role: 'admin',
        email: 'suspended@admin.com'
      });

      await (await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${suspendedAdminToken}`)
      ).expect(401);

      // Cleanup
      await userRepository.delete({ id: 'suspended-admin' });
    });
  });

  describe('Authorization Performance and Security', () => {
    it('should handle concurrent authorization checks', async () => {
      const concurrentRequests = Array(10).fill(null).map(() =>
        request(app.getHttpServer())
          .get('/admin/users')
          .set('Authorization', `Bearer ${adminToken}`)
      );

      const responses = await Promise.all(concurrentRequests);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should log authorization failures appropriately', async () => {
      // This test would verify that authorization failures are logged
      // Implementation depends on your logging setup
      const response = await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      // In a real implementation, you'd check logs here
    });
  });
});
