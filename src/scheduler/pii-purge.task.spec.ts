import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PiiPurgeTask, PII_GRACE_PERIOD_DAYS } from './pii-purge.task';
import { Users } from '../users/users.entity';

/** Minimal Users stub factory */
function makeUser(overrides: Partial<Users> = {}): Users {
  return {
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    bio: 'Some bio',
    avatarUrl: 'https://example.com/avatar.png',
    isActive: true,
    status: 'active',
    deletedAt: null,
    // financial aggregates
    trustScore: 0,
    isVerifiedSeller: false,
    ...overrides,
  } as unknown as Users;
}

/** Returns a date that is `days` days in the past */
function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

describe('PiiPurgeTask', () => {
  let task: PiiPurgeTask;
  let userRepo: { find: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    userRepo = { find: jest.fn(), save: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PiiPurgeTask,
        { provide: getRepositoryToken(Users), useValue: userRepo },
      ],
    }).compile();

    task = module.get<PiiPurgeTask>(PiiPurgeTask);
  });

  describe('handlePiiPurge', () => {
    it('logs and returns early when no eligible users exist', async () => {
      userRepo.find.mockResolvedValue([]);
      await expect(task.handlePiiPurge()).resolves.not.toThrow();
      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('skips already-anonymized users (email starts with deleted_)', async () => {
      const alreadyAnon = makeUser({
        email: 'deleted_1@anonymized.local',
        deletedAt: daysAgo(PII_GRACE_PERIOD_DAYS + 5),
      });
      userRepo.find.mockResolvedValue([alreadyAnon]);
      await task.handlePiiPurge();
      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('anonymizes eligible users and preserves financial aggregates', async () => {
      const user = makeUser({
        deletedAt: daysAgo(PII_GRACE_PERIOD_DAYS + 1),
        trustScore: 42,
      });
      userRepo.find.mockResolvedValue([user]);
      userRepo.save.mockResolvedValue(user);

      await task.handlePiiPurge();

      expect(userRepo.save).toHaveBeenCalledTimes(1);
      const saved: Users = userRepo.save.mock.calls[0][0];

      // PII must be anonymized
      expect(saved.email).toMatch(/^deleted_/);
      expect(saved.name).toBe('Deleted User');
      expect(saved.bio).toBeNull();
      expect(saved.avatarUrl).toBeNull();
      expect(saved.isActive).toBe(false);
      expect(saved.status).toBe('deleted');

      // Financial aggregate must be preserved
      expect(saved.trustScore).toBe(42);
    });

    it('continues processing remaining users if one fails', async () => {
      const bad = makeUser({ id: 1, deletedAt: daysAgo(35) });
      const good = makeUser({
        id: 2,
        deletedAt: daysAgo(35),
        email: 'good@example.com',
      });

      userRepo.find.mockResolvedValue([bad, good]);
      userRepo.save
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce(good);

      await expect(task.handlePiiPurge()).resolves.not.toThrow();
      // save was attempted for both
      expect(userRepo.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('anonymizeUser', () => {
    it('overwrites all PII fields', async () => {
      const user = makeUser({ id: 99 });
      userRepo.save.mockResolvedValue(user);

      await task.anonymizeUser(user);

      expect(user.email).toBe('deleted_99@anonymized.local');
      expect(user.name).toBe('Deleted User');
      expect(user.bio).toBeNull();
      expect(user.avatarUrl).toBeNull();
      expect(user.isActive).toBe(false);
      expect(user.status).toBe('deleted');
    });

    it('preserves trustScore after anonymization', async () => {
      const user = makeUser({ id: 5, trustScore: 88 });
      userRepo.save.mockResolvedValue(user);

      await task.anonymizeUser(user);

      expect(user.trustScore).toBe(88);
    });
  });
});
