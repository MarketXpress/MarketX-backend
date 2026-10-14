import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { APP_GUARD, Reflector } from '@nestjs/core';
import * as request from 'supertest';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../guards/admin.guard';
import { UserOwnerOrAdminGuard } from '../guards/user-owner-or-admin.guard';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';

@Injectable()
class MockJwtAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const auth = req.headers?.authorization;

    if (!auth) {
      throw new UnauthorizedException('Invalid or missing JWT token');
    }

    if (auth === 'Bearer admin-token') {
      req.user = {
        id: 999,
        userId: 999,
        role: 'admin',
        email: 'admin@example.com',
      };
      return true;
    }

    if (auth === 'Bearer user-1-token') {
      req.user = { id: 1, userId: 1, role: 'user', email: 'user1@example.com' };
      return true;
    }

    if (auth === 'Bearer user-2-token') {
      req.user = { id: 2, userId: 2, role: 'user', email: 'user2@example.com' };
      return true;
    }

    throw new UnauthorizedException('Invalid or missing JWT token');
  }
}

describe('UsersController (Authorization & Access Control)', () => {
  let app: INestApplication;
  let usersService: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    getUserStats: jest.Mock;
    updateProfile: jest.Mock;
    softDeleteUser: jest.Mock;
  };

  beforeEach(async () => {
    usersService = {
      create: jest
        .fn()
        .mockImplementation((dto) => Promise.resolve({ id: 1, ...dto })),
      findAll: jest
        .fn()
        .mockResolvedValue([{ id: 1, email: 'user1@example.com' }]),
      findOne: jest
        .fn()
        .mockImplementation((id) =>
          Promise.resolve({ id, email: `user${id}@example.com` }),
        ),
      getUserStats: jest.fn().mockResolvedValue({ totalOrders: 5 }),
      updateProfile: jest
        .fn()
        .mockImplementation((id, dto) => Promise.resolve({ id, ...dto })),
      softDeleteUser: jest.fn().mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersService },
        AdminGuard,
        UserOwnerOrAdminGuard,
        {
          provide: APP_GUARD,
          useClass: MockJwtAuthGuard,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockJwtAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  describe('POST /users (Account creation - Public)', () => {
    it('allows unauthenticated caller to create an account', async () => {
      const res = await request(app.getHttpServer())
        .post('/users')
        .send({
          email: 'newuser@example.com',
          name: 'New User',
          password: 'Password123!',
        })
        .expect(201);

      expect(res.body.email).toBe('newuser@example.com');
      expect(usersService.create).toHaveBeenCalled();
    });
  });

  describe('GET /users (Admin only)', () => {
    it('rejects unauthenticated request with 401', async () => {
      await request(app.getHttpServer()).get('/users').expect(401);
      expect(usersService.findAll).not.toHaveBeenCalled();
    });

    it('rejects authenticated non-admin user with 403', async () => {
      await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', 'Bearer user-1-token')
        .expect(403);
      expect(usersService.findAll).not.toHaveBeenCalled();
    });

    it('allows authenticated admin to view all users', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(usersService.findAll).toHaveBeenCalled();
    });
  });

  describe('GET /users/:id (Owner or Admin)', () => {
    it('rejects unauthenticated request with 401', async () => {
      await request(app.getHttpServer()).get('/users/1').expect(401);
      expect(usersService.findOne).not.toHaveBeenCalled();
    });

    it('rejects authenticated non-owner, non-admin request with 403', async () => {
      await request(app.getHttpServer())
        .get('/users/1')
        .set('Authorization', 'Bearer user-2-token')
        .expect(403);
      expect(usersService.findOne).not.toHaveBeenCalled();
    });

    it('allows authenticated owner to view own record', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/1')
        .set('Authorization', 'Bearer user-1-token')
        .expect(200);

      expect(res.body.id).toBe(1);
      expect(usersService.findOne).toHaveBeenCalledWith(1);
    });

    it('allows authenticated admin to view any user record', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/1')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(res.body.id).toBe(1);
      expect(usersService.findOne).toHaveBeenCalledWith(1);
    });
  });

  describe('GET /users/:id/stats (Owner or Admin)', () => {
    it('rejects unauthenticated request with 401', async () => {
      await request(app.getHttpServer()).get('/users/1/stats').expect(401);
      expect(usersService.getUserStats).not.toHaveBeenCalled();
    });

    it('rejects authenticated non-owner, non-admin request with 403', async () => {
      await request(app.getHttpServer())
        .get('/users/1/stats')
        .set('Authorization', 'Bearer user-2-token')
        .expect(403);
      expect(usersService.getUserStats).not.toHaveBeenCalled();
    });

    it('allows authenticated owner to view own stats', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/1/stats')
        .set('Authorization', 'Bearer user-1-token')
        .expect(200);

      expect(res.body.totalOrders).toBe(5);
      expect(usersService.getUserStats).toHaveBeenCalledWith('1');
    });

    it('allows authenticated admin to view any user stats', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/1/stats')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(res.body.totalOrders).toBe(5);
      expect(usersService.getUserStats).toHaveBeenCalledWith('1');
    });
  });

  describe('DELETE /users/:id (Owner or Admin)', () => {
    it('rejects unauthenticated DELETE /users/:id with 401', async () => {
      await request(app.getHttpServer()).delete('/users/1').expect(401);
      expect(usersService.softDeleteUser).not.toHaveBeenCalled();
    });

    it('rejects authenticated non-owner, non-admin DELETE /users/:id with 403', async () => {
      await request(app.getHttpServer())
        .delete('/users/1')
        .set('Authorization', 'Bearer user-2-token')
        .expect(403);
      expect(usersService.softDeleteUser).not.toHaveBeenCalled();
    });

    it('allows authenticated owner to delete own account', async () => {
      const res = await request(app.getHttpServer())
        .delete('/users/1')
        .set('Authorization', 'Bearer user-1-token')
        .expect(200);

      expect(res.body.message).toBe('User account deleted successfully');
      expect(usersService.softDeleteUser).toHaveBeenCalledWith(1);
    });

    it('allows authenticated admin to delete any user account', async () => {
      const res = await request(app.getHttpServer())
        .delete('/users/1')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(res.body.message).toBe('User account deleted successfully');
      expect(usersService.softDeleteUser).toHaveBeenCalledWith(1);
    });
  });

  describe('PATCH /users/profile', () => {
    it('rejects unauthenticated profile update with 401', async () => {
      await request(app.getHttpServer())
        .patch('/users/profile')
        .send({ bio: 'New bio' })
        .expect(401);
      expect(usersService.updateProfile).not.toHaveBeenCalled();
    });

    it('allows authenticated user to update their own profile', async () => {
      await request(app.getHttpServer())
        .patch('/users/profile')
        .set('Authorization', 'Bearer user-1-token')
        .send({ bio: 'Updated bio' })
        .expect(200);

      expect(usersService.updateProfile).toHaveBeenCalledWith(1, {
        bio: 'Updated bio',
      });
    });
  });
});
