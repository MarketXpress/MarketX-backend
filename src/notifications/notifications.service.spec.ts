/* eslint-disable @typescript-eslint/unbound-method */
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Notification, NotificationType } from './notification.entity';
import { NotificationsService } from './notifications.service';

function buildNotification(
  overrides: Partial<Notification> = {},
): Notification {
  return {
    id: 1,
    title: 'Order update',
    message: 'Your order has shipped.',
    type: NotificationType.INFO,
    isRead: false,
    createdAt: new Date('2026-08-21T12:00:00.000Z'),
    readAt: null,
    recipientId: 101,
    recipient: undefined as never,
    ...overrides,
  };
}

describe('NotificationsService', () => {
  let service: NotificationsService;
  let repository: jest.Mocked<Repository<Notification>>;

  beforeEach(async () => {
    const repositoryMock = {
      countBy: jest.fn(),
      create: jest.fn(),
      createQueryBuilder: jest.fn(),
      delete: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: repositoryMock,
        },
      ],
    }).compile();

    service = module.get(NotificationsService);
    repository = module.get(getRepositoryToken(Notification));
  });

  describe('create', () => {
    it('allowlists notification fields and forces the trusted recipient', async () => {
      const saved = buildNotification();
      repository.create.mockReturnValue(saved);
      repository.save.mockResolvedValue(saved);

      const untrustedDto = {
        title: 'Order update',
        message: 'Your order has shipped.',
        type: NotificationType.INFO,
        recipientId: 202,
        isRead: true,
      };

      await service.create(101, untrustedDto);

      expect(repository.create).toHaveBeenCalledWith({
        title: untrustedDto.title,
        message: untrustedDto.message,
        type: untrustedDto.type,
        recipientId: 101,
      });
      expect(repository.save).toHaveBeenCalledWith(saved);
    });
  });

  describe('findOne', () => {
    it('queries by notification ID and authenticated recipient together', async () => {
      const ownedNotification = buildNotification();
      repository.findOne.mockResolvedValue(ownedNotification);

      await expect(service.findOne(1, 202)).resolves.toBe(ownedNotification);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 1, recipientId: 202 },
      });
    });

    it('returns the same 404 for a foreign or nonexistent notification', async () => {
      repository.findOne.mockResolvedValue(null);

      const foreignError = service.findOne(2, 101);
      const missingError = service.findOne(999, 101);

      await expect(foreignError).rejects.toMatchObject({
        constructor: NotFoundException,
        message: 'Notification not found',
      });
      await expect(missingError).rejects.toMatchObject({
        constructor: NotFoundException,
        message: 'Notification not found',
      });
    });
  });

  describe('markRead', () => {
    it('atomically scopes the update and lookup to the authenticated recipient', async () => {
      const ownedNotification = buildNotification();
      const updatedNotification = buildNotification({
        isRead: true,
        readAt: new Date('2026-08-21T12:30:00.000Z'),
      });
      repository.update.mockResolvedValue({
        affected: 1,
        generatedMaps: [],
        raw: [],
      });
      repository.findOne.mockResolvedValue(updatedNotification);

      const result = await service.markRead(1, 303);

      expect(repository.update).toHaveBeenCalledWith(
        { id: 1, recipientId: 303, isRead: false },
        { isRead: true, readAt: expect.any(Date) },
      );
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 1, recipientId: 303 },
      });
      expect(result).toBe(updatedNotification);
      expect(ownedNotification.isRead).toBe(false);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('does not mutate a notification owned by another user', async () => {
      repository.update.mockResolvedValue({
        affected: 0,
        generatedMaps: [],
        raw: [],
      });
      repository.findOne.mockResolvedValue(null);

      await expect(service.markRead(2, 101)).rejects.toThrow(NotFoundException);
      expect(repository.update).toHaveBeenCalledWith(
        { id: 2, recipientId: 101, isRead: false },
        { isRead: true, readAt: expect.any(Date) },
      );
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 2, recipientId: 101 },
      });
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('is idempotent when the owned notification is already read', async () => {
      const readAt = new Date('2026-08-21T12:30:00.000Z');
      const alreadyRead = buildNotification({ isRead: true, readAt });
      repository.update.mockResolvedValue({
        affected: 0,
        generatedMaps: [],
        raw: [],
      });
      repository.findOne.mockResolvedValue(alreadyRead);

      await expect(service.markRead(1, 101)).resolves.toBe(alreadyRead);
      expect(repository.update).toHaveBeenCalledWith(
        { id: 1, recipientId: 101, isRead: false },
        { isRead: true, readAt: expect.any(Date) },
      );
      expect(repository.save).not.toHaveBeenCalled();
      expect(alreadyRead.readAt).toBe(readAt);
    });
  });

  describe('markAllRead', () => {
    it('updates only unread rows owned by the authenticated recipient', async () => {
      repository.update.mockResolvedValue({
        affected: 3,
        generatedMaps: [],
        raw: [],
      });

      await expect(service.markAllRead(202)).resolves.toEqual({ affected: 3 });
      expect(repository.update).toHaveBeenCalledWith(
        { recipientId: 202, isRead: false },
        { isRead: true, readAt: expect.any(Date) },
      );
    });
  });

  describe('getUnreadCount', () => {
    it('counts only unread rows owned by the authenticated recipient', async () => {
      repository.countBy.mockResolvedValue(4);

      await expect(service.getUnreadCount(303)).resolves.toBe(4);
      expect(repository.countBy).toHaveBeenCalledWith({
        recipientId: 303,
        isRead: false,
      });
    });
  });
});
