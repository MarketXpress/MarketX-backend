import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import * as request from 'supertest';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationType } from './notification.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsModule } from './notifications.module';
import { NotificationsService } from './notifications.service';
import { NotificationsSseController } from './notifications-sse.controller';

class TestJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const httpRequest = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: { id: number; userId: number };
    }>();
    const authorization = httpRequest.headers.authorization;

    if (authorization === 'Bearer malformed-user') {
      httpRequest.user = {} as { id: number; userId: number };
      return true;
    }

    if (!authorization?.startsWith('Bearer user-')) {
      throw new UnauthorizedException();
    }

    const id = Number(authorization.slice('Bearer user-'.length));
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new UnauthorizedException();
    }

    httpRequest.user = { id, userId: id };
    return true;
  }
}

describe('NotificationsController authentication and identity', () => {
  let app: INestApplication;
  let sseController: NotificationsSseController;
  let sseStreamSpy: jest.SpyInstance;
  let service: {
    create: jest.Mock;
    findAllForUser: jest.Mock;
    findOne: jest.Mock;
    getUnreadCount: jest.Mock;
    markAllRead: jest.Mock;
    markRead: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue({ id: 1 }),
      findAllForUser: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: 1 }),
      getUnreadCount: jest.fn().mockResolvedValue(0),
      markAllRead: jest.fn().mockResolvedValue({ affected: 0 }),
      markRead: jest.fn().mockResolvedValue({ id: 1, isRead: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsSseController, NotificationsController],
      providers: [
        EventEmitter2,
        { provide: NotificationsService, useValue: service },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(TestJwtAuthGuard)
      .compile();

    sseController = module.get(NotificationsSseController);
    sseStreamSpy = jest
      .spyOn(sseController, 'stream')
      .mockReturnValue(of({ data: { ready: true } }));
    const originalStreamHandler = Object.getOwnPropertyDescriptor(
      NotificationsSseController.prototype,
      'stream',
    )?.value as object | undefined;
    const mockedStreamHandler = Object.getOwnPropertyDescriptor(
      sseController,
      'stream',
    )?.value as object | undefined;
    if (!originalStreamHandler || !mockedStreamHandler) {
      throw new Error('Unable to prepare the finite SSE test handler');
    }
    for (const metadataKey of Reflect.getMetadataKeys(originalStreamHandler)) {
      Reflect.defineMetadata(
        metadataKey,
        Reflect.getMetadata(metadataKey, originalStreamHandler),
        mockedStreamHandler,
      );
    }
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it.each([
    ['GET', '/notifications'],
    ['GET', '/notifications/unread-count'],
    ['GET', '/notifications/1'],
    ['POST', '/notifications'],
    ['PATCH', '/notifications/1/read'],
    ['PATCH', '/notifications/read-all'],
    ['GET', '/notifications/stream'],
  ])('rejects unauthenticated %s %s', async (method, path) => {
    const server = app.getHttpServer();
    const pendingRequest =
      method === 'POST'
        ? request(server).post(path).send({ title: 'Title', message: 'Body' })
        : method === 'PATCH'
          ? request(server).patch(path)
          : request(server).get(path);

    await pendingRequest.expect(401);
  });

  it.each([101, 202])(
    'derives list and unread-count recipients from authenticated user %i',
    async (userId) => {
      await request(app.getHttpServer())
        .get('/notifications?isRead=false')
        .set('Authorization', `Bearer user-${userId}`)
        .expect(200);
      await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .set('Authorization', `Bearer user-${userId}`)
        .expect(200);

      expect(service.findAllForUser).toHaveBeenCalledWith(userId, false);
      expect(service.getUnreadCount).toHaveBeenCalledWith(userId);
    },
  );

  it.each([101, 202])(
    'passes authenticated recipient %i to findOne and markRead',
    async (userId) => {
      await request(app.getHttpServer())
        .get('/notifications/42')
        .set('Authorization', `Bearer user-${userId}`)
        .expect(200);
      await request(app.getHttpServer())
        .patch('/notifications/42/read')
        .set('Authorization', `Bearer user-${userId}`)
        .expect(200);

      expect(service.findOne).toHaveBeenCalledWith(42, userId);
      expect(service.markRead).toHaveBeenCalledWith(42, userId);
    },
  );

  it('rejects an authenticated request whose principal has no valid user ID', async () => {
    await request(app.getHttpServer())
      .get('/notifications/42')
      .set('Authorization', 'Bearer malformed-user')
      .expect(401);

    expect(service.findOne).not.toHaveBeenCalled();
  });

  it.each([
    [101, 202],
    [202, 101],
  ])(
    'forces authenticated recipient %i when the client supplies recipient %i',
    async (userId, untrustedRecipientId) => {
      await request(app.getHttpServer())
        .post('/notifications')
        .set('Authorization', `Bearer user-${userId}`)
        .send({
          title: 'Order update',
          message: 'Your order has shipped.',
          type: NotificationType.INFO,
          recipientId: untrustedRecipientId,
        })
        .expect(201);

      expect(service.create).toHaveBeenCalledWith(userId, {
        title: 'Order update',
        message: 'Your order has shipped.',
        type: NotificationType.INFO,
      });
    },
  );

  it('passes only the authenticated recipient to markAllRead', async () => {
    await request(app.getHttpServer())
      .patch('/notifications/read-all')
      .set('Authorization', 'Bearer user-101')
      .expect(200);

    expect(service.markAllRead).toHaveBeenCalledWith(101);
  });

  it('keeps markAllRead scoped when a different user calls it', async () => {
    await request(app.getHttpServer())
      .patch('/notifications/read-all')
      .set('Authorization', 'Bearer user-202')
      .expect(200);

    expect(service.markAllRead).toHaveBeenCalledWith(202);
  });

  it('registers the static SSE controller before the parameterized REST controller', () => {
    const controllers = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      NotificationsModule,
    ) as unknown[];

    expect(controllers.indexOf(NotificationsSseController)).toBeLessThan(
      controllers.indexOf(NotificationsController),
    );
  });

  it('routes an authenticated stream request to the SSE handler', async () => {
    const response = await request(app.getHttpServer())
      .get('/notifications/stream')
      .set('Authorization', 'Bearer user-101')
      .expect(200);

    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(sseStreamSpy).toHaveBeenCalledTimes(1);
    expect(service.findOne).not.toHaveBeenCalled();
  });
});
