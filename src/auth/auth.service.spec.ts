import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { TokenRegistryService } from './token-registry.service';
import { ForbiddenException } from '@nestjs/common';

describe('AuthService - Refresh Token Security', () => {
  let service: AuthService;
  let tokenRegistry: TokenRegistryService;

  const mockTokenRegistry = {
    store: jest.fn(),
    exists: jest.fn(),
    invalidate: jest.fn(),
    invalidateAllForUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue('new_at') },
        },
        { provide: TokenRegistryService, useValue: mockTokenRegistry },
        { provide: 'EventEmitter2', useValue: {} },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    tokenRegistry = module.get<TokenRegistryService>(TokenRegistryService);
  });

  it('should rotate tokens and delete the old one on success', async () => {
    mockTokenRegistry.exists.mockResolvedValue(true);

    const result = await service.refreshTokens(
      'user123',
      'test@example.com',
      'old_rt',
    );

    expect(result).toHaveProperty('accessToken');
    expect(mockTokenRegistry.invalidate).toHaveBeenCalledWith(
      'user123',
      'old_rt',
    );
  });

  it('should throw ForbiddenException and revoke all tokens if reuse is detected', async () => {
    // Simulate token already rotated/missing
    mockTokenRegistry.exists.mockResolvedValue(false);
    const revokeSpy = jest.spyOn(service, 'revokeAllUserTokens');

    await expect(
      service.refreshTokens('user123', 'test@example.com', 'stolen_rt'),
    ).rejects.toThrow(ForbiddenException);

    expect(revokeSpy).toHaveBeenCalledWith('user123');
  });
});
