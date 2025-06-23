// test/profile-update.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../src/users/users.entity';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';

describe('Profile Update (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let jwtService: JwtService;

  const testUser = {
    email: 'test@example.com',
    password: 'hashedPassword',
    name: 'John Doe',
    bio: 'Original bio',
    avatarUrl: 'https://example.com/original.jpg',
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());

    userRepository = moduleFixture.get<Repository<User>>(
      getRepositoryToken(User),
    );
    jwtService = moduleFixture.get<JwtService>(JwtService);

    await app.init();
  });

  afterEach(async () => {
    await userRepository.clear();
    await app.close();
  });

  describe('PATCH /users/profile', () => {
    let authToken: string;
    let userId: number;

    beforeEach(async () => {
      // Create test user
      const user = userRepository.create(testUser);
      const savedUser = await userRepository.save(user);
      userId = savedUser.id;

      // Generate JWT token
      authToken = jwtService.sign({ sub: userId, email: testUser.email });
    });

    it('should update user profile successfully', async () => {
      const updateData = {
        name: 'Jane Doe',
        bio: 'Updated bio description',
        avatarUrl: 'https://example.com/new-avatar.jpg',
      };

      const response = await request(app.getHttpServer())
        .patch('/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        id: userId,
        email: testUser.email,
        name: updateData.name,
        bio: updateData.bio,
        avatarUrl: updateData.avatarUrl,
      });

      // Verify database was updated
      const updatedUser = await userRepository.findOne({
        where: { id: userId },
      });
      expect(updatedUser.name).toBe(updateData.name);
      expect(updatedUser.bio).toBe(updateData.bio);
      expect(updatedUser.avatarUrl).toBe(updateData.avatarUrl);
    });

    it('should update only provided fields', async () => {
      const updateData = {
        name: 'Jane Doe',
      };

      const response = await request(app.getHttpServer())
        .patch('/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe(updateData.name);
      expect(response.body.bio).toBe(testUser.bio);
      expect(response.body.avatarUrl).toBe(testUser.avatarUrl);
    });

    it('should return 401 without authentication', async () => {
      const updateData = {
        name: 'Jane Doe',
      };

      await request(app.getHttpServer())
        .patch('/users/profile')
        .send(updateData)
        .expect(401);
    });

    it('should return 401 with invalid token', async () => {
      const updateData = {
        name: 'Jane Doe',
      };

      await request(app.getHttpServer())
        .patch('/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .send(updateData)
        .expect(401);
    });

    it('should validate name length', async () => {
      const updateData = {
        name: 'A', // Too short
      };

      const response = await request(app.getHttpServer())
        .patch('/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.message).toContain(
        'Name must be at least 2 characters long',
      );
    });

    it('should validate bio length', async () => {
      const updateData = {
        bio: 'A'.repeat(501), // Too long
      };

      const response = await request(app.getHttpServer())
        .patch('/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.message).toContain(
        'Bio must not exceed 500 characters',
      );
    });

    it('should validate avatar URL format', async () => {
      const updateData = {
        avatarUrl: 'not-a-valid-url',
      };

      const response = await request(app.getHttpServer())
        .patch('/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.message).toContain('Avatar URL must be a valid URL');
    });

    it('should handle empty request body', async () => {
      const response = await request(app.getHttpServer())
        .patch('/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(200);

      // Should return user unchanged
      expect(response.body.name).toBe(testUser.name);
      expect(response.body.bio).toBe(testUser.bio);
      expect(response.body.avatarUrl).toBe(testUser.avatarUrl);
    });
  });
});
