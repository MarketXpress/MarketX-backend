import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { Users } from './users.entity';
import { Listing } from '../listing/entities/listing.entity';
import { CacheManagerService } from '../cache/cache-manager.service';

const mockUser = (): Partial<Users> => ({
  id: 1,
  email: 'user@example.com',
  name: 'Test User',
  isActive: true,
  status: 'active',
  deletedAt: null,
});

describe('UsersService - softDeleteUser', () => {
  let service: UsersService;
  let userRepo: {
    findOne: jest.Mock;
    update: jest.Mock;
    softDelete: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };
  let listingRepo: { softDelete: jest.Mock };
  let cacheManager: { getOrSet: jest.Mock };

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };
    listingRepo = { softDelete: jest.fn() };
    cacheManager = { getOrSet: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(Users), useValue: userRepo },
        { provide: getRepositoryToken(Listing), useValue: listingRepo },
        { provide: CacheManagerService, useValue: cacheManager },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('throws NotFoundException when user does not exist', async () => {
    userRepo.findOne.mockResolvedValue(null);
    await expect(service.softDeleteUser(999)).rejects.toThrow(NotFoundException);
  });

  it('calls softDelete on the user repository', async () => {
    userRepo.findOne.mockResolvedValue(mockUser());
    userRepo.update.mockResolvedValue({ affected: 1 });
    userRepo.softDelete.mockResolvedValue({ affected: 1 });
    listingRepo.softDelete.mockResolvedValue({ affected: 0 });

    await service.softDeleteUser(1);

    expect(userRepo.softDelete).toHaveBeenCalledWith(1);
  });

  it('sets status=deleted and isActive=false on the user', async () => {
    userRepo.findOne.mockResolvedValue(mockUser());
    userRepo.update.mockResolvedValue({ affected: 1 });
    userRepo.softDelete.mockResolvedValue({ affected: 1 });
    listingRepo.softDelete.mockResolvedValue({ affected: 0 });

    await service.softDeleteUser(1);

    expect(userRepo.update).toHaveBeenCalledWith(1, {
      status: 'deleted',
      isActive: false,
    });
  });

  it('cascades soft-delete to all listings owned by the user', async () => {
    userRepo.findOne.mockResolvedValue(mockUser());
    userRepo.update.mockResolvedValue({ affected: 1 });
    userRepo.softDelete.mockResolvedValue({ affected: 1 });
    listingRepo.softDelete.mockResolvedValue({ affected: 3 });

    await service.softDeleteUser(1);

    expect(listingRepo.softDelete).toHaveBeenCalledWith({ userId: '1' });
  });

  it('is idempotent: calling softDeleteUser twice does not throw', async () => {
    userRepo.findOne.mockResolvedValue(mockUser());
    userRepo.update.mockResolvedValue({ affected: 1 });
    userRepo.softDelete.mockResolvedValue({ affected: 0 }); // already deleted
    listingRepo.softDelete.mockResolvedValue({ affected: 0 });

    await expect(service.softDeleteUser(1)).resolves.not.toThrow();
    await expect(service.softDeleteUser(1)).resolves.not.toThrow();
  });
});
