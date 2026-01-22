import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../src/notifications/notification.entity';
import { Users } from '../src/users/users.entity';
import { JwtService } from '@nestjs/jwt';

describe('NotificationsController (e2e)', () => {
  let app: INestApplication;
  let notificationRepository: Repository<Notification>;
  let userRepository: Repository<Users>;
  let jwtService: JwtService;
  let accessToken: string;
  let testUser: Users;
  let testNotification: Notification;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());

    notificationRepository = moduleFixture.get<Repository<Notification>>(
      getRepositoryToken(Notification),
    );
    userRepository = moduleFixture.get<Repository<Users>>(
      getRepositoryToken(Users),
    );
    jwtService = moduleFixture.get<JwtService>(JwtService);

    await app.init();

    // Create test user
    testUser = await userRepository.save({
      email: 'test@example.com',
      password: 'hashedpassword',
      firstName: 'Test',
      lastName: 'User',
    });

    // Generate JWT token
    accessToken = jwtService.sign({ sub: testUser.id, email: testUser.email });

    // Create test notification
    testNotification = await notificationRepository.save({
      title: 'Test Notification',
      message: 'This is a test notification',
      type: 'info',
      isRead: false,
      recipient: testUser,
      recipientId: testUser.id,
    });
  });

  afterAll(async () => {
    await notificationRepository.delete({});
    await userRepository.delete({});
    await app.close();
  });

  describe('PATCH /notifications/:id/read', () => {
    it('should mark notification as read successfully', () => {
      return request(app.getHttpServer())
        .patch(`/notifications/${testNotification.id}/read`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe(
            'Notification marked as read successfully',
          );
          expect(res.body.notification.id).toBe(testNotification.id);
          expect(res.body.notification.isRead).toBe(true);
          expect(res.body.notification.readAt).toBeDefined();
        });
    });

    it('should return 404 for non-existent notification', () => {
      return request(app.getHttpServer())
        .patch('/notifications/99999/read')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toContain(
            'Notification with ID 99999 not found',
          );
        });
    });

    it('should return 401 without authentication', () => {
      return request(app.getHttpServer())
        .patch(`/notifications/${testNotification.id}/read`)
        .expect(401);
    });

    it('should return 403 for unauthorized user', async () => {
      // Create another user
      const otherUser = await userRepository.save({
        email: 'other@example.com',
        password: 'hashedpassword',
        firstName: 'Other',
        lastName: 'User',
      });

      // Create notification for other user
      const otherNotification = await notificationRepository.save({
        title: 'Other User Notification',
        message: 'This belongs to another user',
        type: 'info',
        isRead: false,
        recipient: otherUser,
        recipientId: otherUser.id,
      });

      return request(app.getHttpServer())
        .patch(`/notifications/${otherNotification.id}/read`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403)
        .expect((res) => {
          expect(res.body.message).toBe(
            'You can only mark your own notifications as read',
          );
        });
    });

    it('should return 400 for invalid notification ID', () => {
      return request(app.getHttpServer())
        .patch('/notifications/invalid/read')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });

  describe('GET /notifications', () => {
    it('should return user notifications with unread count', () => {
      return request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.notifications).toBeDefined();
          expect(res.body.unreadCount).toBeDefined();
          expect(Array.isArray(res.body.notifications)).toBe(true);
        });
    });

    it('should return 401 without authentication', () => {
      return request(app.getHttpServer()).get('/notifications').expect(401);
    });
  });

  describe('GET /notifications/:id', () => {
    it('should return specific notification for authorized user', () => {
      return request(app.getHttpServer())
        .get(`/notifications/${testNotification.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(testNotification.id);
          expect(res.body.title).toBe(testNotification.title);
        });
    });

    it('should return 404 for non-existent notification', () => {
      return request(app.getHttpServer())
        .get('/notifications/99999')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });
});
