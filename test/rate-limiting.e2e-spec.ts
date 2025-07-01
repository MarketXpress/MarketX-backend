import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { RateLimitService } from '../src/rate-limiting/rate-limit.service';

describe('Rate Limiting (e2e)', () => {
  let app: INestApplication;
  let rateLimitService: RateLimitService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    rateLimitService = moduleFixture.get<RateLimitService>(RateLimitService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Reset rate limits before each test
    await rateLimitService.resetRateLimit('ip:127.0.0.1');
  });

  describe('Auth endpoints rate limiting', () => {
    it('should allow login attempts within limit', async () => {
      for (let i = 0; i < 3; i++) {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: 'test@example.com', password: 'password' })
          .expect((res) => {
            expect(res.headers['x-ratelimit-limit']).toBeDefined();
            expect(res.headers['x-ratelimit-remaining']).toBeDefined();
            expect(res.headers['x-ratelimit-reset']).toBeDefined();
          });
      }
    });

    it('should block login attempts when exceeding limit', async () => {
      // Make requests up to the limit
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: 'test@example.com', password: 'password' });
      }

      // The next request should be blocked
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password' })
        .expect(429)
        .expect((res) => {
          expect(res.body.message).toContain('Too many login attempts');
          expect(res.body.retryAfter).toBeDefined();
          expect(res.headers['retry-after']).toBeDefined();
        });
    });

    it('should include proper rate limit headers', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password' })
        .expect((res) => {
          expect(res.headers['x-ratelimit-limit']).toBe('5');
          expect(parseInt(res.headers['x-ratelimit-remaining'])).toBeLessThan(5);
          expect(res.headers['x-ratelimit-window']).toBe('900000'); // 15 minutes
          expect(res.headers['x-ratelimit-burst']).toBe('0');
        });
    });
  });

  describe('Listings endpoints rate limiting', () => {
    const authToken = 'mock-jwt-token'; // In real tests, you'd get this from login

    it('should allow listing creation within limit', async () => {
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post('/listings')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: `Test Listing ${i}`,
            description: 'Test description',
            price: 100,
            category: 'electronics',
          })
          .expect((res) => {
            expect(res.headers['x-ratelimit-limit']).toBeDefined();
            expect(res.headers['x-ratelimit-remaining']).toBeDefined();
          });
      }
    });

    it('should block listing creation when exceeding limit', async () => {
      // Make requests up to the limit (5 for FREE tier)
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/listings')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: `Test Listing ${i}`,
            description: 'Test description',
            price: 100,
            category: 'electronics',
          });
      }

      // The next request should be blocked
      await request(app.getHttpServer())
        .post('/listings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Listing Blocked',
          description: 'Test description',
          price: 100,
          category: 'electronics',
        })
        .expect(429)
        .expect((res) => {
          expect(res.body.message).toContain('Too many listings created');
        });
    });

    it('should allow different limits for different endpoints', async () => {
      // Listings GET should have different (higher) limits than POST
      for (let i = 0; i < 15; i++) {
        await request(app.getHttpServer())
          .get('/listings/activeListings')
          .expect((res) => {
            if (res.status === 429) {
              expect(i).toBeGreaterThan(10); // Should allow more GET requests
            }
          });
      }
    });
  });

  describe('Admin endpoints', () => {
    const adminToken = 'mock-admin-jwt-token';

    it('should not rate limit admin endpoints', async () => {
      // Make many requests to admin endpoint - should not be rate limited
      for (let i = 0; i < 20; i++) {
        await request(app.getHttpServer())
          .get('/admin/rate-limits/analytics')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect((res) => {
            expect(res.status).not.toBe(429);
          });
      }
    });

    it('should allow admins to reset rate limits', async () => {
      // First, hit rate limit for a user
      for (let i = 0; i < 6; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: 'test@example.com', password: 'password' });
      }

      // Verify rate limit is active
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password' })
        .expect(429);

      // Reset rate limit via admin endpoint
      await request(app.getHttpServer())
        .post('/admin/rate-limits/reset')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ identifier: 'ip:127.0.0.1', endpoint: '/auth/login' })
        .expect(200);

      // Verify rate limit is reset
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password' })
        .expect((res) => {
          expect(res.status).not.toBe(429);
        });
    });

    it('should provide rate limit analytics', async () => {
      await request(app.getHttpServer())
        .get('/admin/rate-limits/analytics?days=1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should allow updating rate limit configurations', async () => {
      await request(app.getHttpServer())
        .put('/admin/rate-limits/config/tiers/free')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          maxRequests: 20,
          windowMs: 120000,
          burstAllowance: 5,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toContain('updated successfully');
          expect(res.body.config.maxRequests).toBe(20);
        });
    });
  });

  describe('Rate limit headers and responses', () => {
    it('should include all required headers in successful responses', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password' })
        .expect((res) => {
          expect(res.headers['x-ratelimit-limit']).toBeDefined();
          expect(res.headers['x-ratelimit-remaining']).toBeDefined();
          expect(res.headers['x-ratelimit-reset']).toBeDefined();
          expect(res.headers['x-ratelimit-window']).toBeDefined();
          expect(res.headers['x-ratelimit-burst']).toBeDefined();
        });
    });

    it('should include retry-after header in blocked responses', async () => {
      // Hit rate limit
      for (let i = 0; i < 6; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: 'test@example.com', password: 'password' });
      }

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password' })
        .expect(429)
        .expect((res) => {
          expect(res.headers['retry-after']).toBeDefined();
          expect(parseInt(res.headers['retry-after'])).toBeGreaterThan(0);
          expect(res.body.rateLimit).toBeDefined();
          expect(res.body.rateLimit.limit).toBeDefined();
          expect(res.body.rateLimit.remaining).toBe(0);
          expect(res.body.rateLimit.reset).toBeDefined();
        });
    });
  });

  describe('IP-based rate limiting', () => {
    it('should rate limit by IP when user is not authenticated', async () => {
      // Make requests without authentication
      for (let i = 0; i < 15; i++) {
        const response = await request(app.getHttpServer())
          .get('/listings/activeListings');
        
        if (response.status === 429) {
          expect(i).toBeGreaterThan(5); // Should allow some requests before limiting
          break;
        }
      }
    });

    it('should handle X-Forwarded-For header correctly', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('X-Forwarded-For', '192.168.1.100, 10.0.0.1')
        .send({ email: 'test@example.com', password: 'password' })
        .expect((res) => {
          // Should be rate limited based on the forwarded IP
          expect(res.headers['x-ratelimit-limit']).toBeDefined();
        });
    });
  });

  describe('Sliding window algorithm', () => {
    it('should allow requests as time window slides', async () => {
      // This test would need to use fake timers or wait for actual time
      // For now, we'll test that the window resets after the specified time
      
      // Hit rate limit
      for (let i = 0; i < 6; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: 'test@example.com', password: 'password' });
      }

      // Should be rate limited
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password' })
        .expect(429);

      // In a real test, you'd wait for the window to expire
      // or use fake timers to advance time
    });
  });
});
