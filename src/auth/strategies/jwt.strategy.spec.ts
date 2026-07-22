import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../../users/users.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let mockUsersService: { findOne: jest.Mock };

  beforeEach(async () => {
    mockUsersService = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should return id, userId, email, and role for a valid payload', async () => {
    mockUsersService.findOne.mockResolvedValue({ id: 1, role: 'admin' });

    const result = await strategy.validate({ sub: '1', email: 'a@b.com' });

    expect(result).toEqual({
      id: '1',
      userId: '1',
      email: 'a@b.com',
      role: 'admin',
    });
  });

  it('should throw UnauthorizedException when the user no longer exists', async () => {
    mockUsersService.findOne.mockRejectedValue(new Error('not found'));

    await expect(
      strategy.validate({ sub: '999', email: 'gone@b.com' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
