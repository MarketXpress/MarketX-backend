import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { TokenRegistryService } from './token-registry.service';
import { UsersService } from '../users/users.service';
import {
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('AuthService', () => {
  let service: AuthService;
  let tokenRegistry: TokenRegistryService;
  let jwtService: JwtService;
  let usersService: UsersService;
  let eventEmitter: EventEmitter2;

  const mockTokenRegistry = {
    store: jest.fn(),
    exists: jest.fn(),
    invalidate: jest.fn(),
    invalidateAllForUser: jest.fn(),
  };

  const mockUsersService = {
    findOne: jest.fn(),
    findByEmail: jest.fn(),
    create: jest.fn(),
    update2FA: jest.fn(),
    updatePassword: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn().mockResolvedValue('new_at'),
    sign: jest.fn().mockReturnValue('jwt-token'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: TokenRegistryService, useValue: mockTokenRegistry },
        { provide: UsersService, useValue: mockUsersService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    tokenRegistry = module.get<TokenRegistryService>(TokenRegistryService);
    jwtService = module.get<JwtService>(JwtService);
    usersService = module.get<UsersService>(UsersService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  // ─────────────────────────────────────────────────────────────
  // getTokens
  // ─────────────────────────────────────────────────────────────

  describe('getTokens', () => {
    it('should return accessToken and refreshToken', async () => {
      mockJwtService.signAsync.mockResolvedValue('access-token');
      mockTokenRegistry.store.mockResolvedValue(undefined);

      const result = await service.getTokens('user1', 'test@example.com');

      expect(result).toHaveProperty('accessToken', 'access-token');
      expect(result).toHaveProperty('refreshToken');
      expect(typeof result.refreshToken).toBe('string');
      expect(mockTokenRegistry.store).toHaveBeenCalledWith(
        'user1',
        result.refreshToken,
      );
    });

    it('should call signAsync with correct payload', async () => {
      mockJwtService.signAsync.mockResolvedValue('at');
      mockTokenRegistry.store.mockResolvedValue(undefined);

      await service.getTokens('uid', 'email@test.com');

      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        { sub: 'uid', email: 'email@test.com' },
        { expiresIn: '15m' },
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // validateUser
  // ─────────────────────────────────────────────────────────────

  describe('validateUser', () => {
    it('should return tokens for valid credentials', async () => {
      mockJwtService.signAsync.mockResolvedValue('valid_at');
      mockTokenRegistry.store.mockResolvedValue(undefined);

      const result = await service.validateUser('test@example.com', 'password123');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      await expect(
        service.validateUser('test@example.com', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // refreshTokens
  // ─────────────────────────────────────────────────────────────

  describe('refreshTokens', () => {
    it('should rotate tokens and delete the old one on success', async () => {
      mockTokenRegistry.exists.mockResolvedValue(true);
      mockJwtService.signAsync.mockResolvedValue('new_at');
      mockTokenRegistry.store.mockResolvedValue(undefined);

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
      mockTokenRegistry.exists.mockResolvedValue(false);
      mockTokenRegistry.invalidateAllForUser.mockResolvedValue(undefined);

      await expect(
        service.refreshTokens('user123', 'test@example.com', 'stolen_rt'),
      ).rejects.toThrow(ForbiddenException);

      expect(mockTokenRegistry.invalidateAllForUser).toHaveBeenCalledWith('user123');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // revokeAllUserTokens
  // ─────────────────────────────────────────────────────────────

  describe('revokeAllUserTokens', () => {
    it('should call invalidateAllForUser on token registry', async () => {
      mockTokenRegistry.invalidateAllForUser.mockResolvedValue(undefined);

      await service.revokeAllUserTokens('user1');

      expect(mockTokenRegistry.invalidateAllForUser).toHaveBeenCalledWith('user1');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // enable2FA
  // ─────────────────────────────────────────────────────────────

  describe('enable2FA', () => {
    it('should enable 2FA and return qrCodeDataURL and otpauth', async () => {
      mockUsersService.update2FA.mockResolvedValue(undefined);

      const result = await service.enable2FA('1');

      expect(result).toHaveProperty('qrCodeDataURL');
      expect(result).toHaveProperty('otpauth');
      expect(mockUsersService.update2FA).toHaveBeenCalledWith(
        1,
        expect.any(String),
        true,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // verify2FA
  // ─────────────────────────────────────────────────────────────

  describe('verify2FA', () => {
    it('should throw BadRequestException if 2FA not enabled', async () => {
      mockUsersService.findOne.mockResolvedValue({
        id: 1,
        twoFAEnabled: false,
        twoFASecret: null,
      });

      await expect(service.verify2FA('1', '123456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for invalid 2FA code', async () => {
      mockUsersService.findOne.mockResolvedValue({
        id: 1,
        twoFAEnabled: true,
        twoFASecret: 'JBSWY3DPEHPK3PXP',
      });

      // otplib verify will fail with wrong code/secret combo
      await expect(service.verify2FA('1', '000000')).rejects.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // forgotPassword
  // ─────────────────────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('should emit password reset requested event', async () => {
      await service.forgotPassword('user@example.com');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          email: 'user@example.com',
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // changePassword
  // ─────────────────────────────────────────────────────────────

  describe('changePassword', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      mockUsersService.findOne.mockRejectedValue(new Error('Not found'));

      await expect(
        service.changePassword('999', 'old', 'new', '127.0.0.1'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException if current password is invalid', async () => {
      mockUsersService.findOne.mockResolvedValue({
        id: 1,
        password:
          '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZa',
      });

      await expect(
        service.changePassword('1', 'wrongpassword', 'newpass', '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should change password successfully and emit success event', async () => {
      // First, we need a valid bcrypt hash for 'oldpass'
      const bcrypt = require('bcrypt');
      const hash = await bcrypt.hash('oldpass', 10);

      mockUsersService.findOne.mockResolvedValue({
        id: 1,
        password: hash,
      });
      mockUsersService.updatePassword.mockResolvedValue(undefined);

      const result = await service.changePassword(
        '1',
        'oldpass',
        'newpass',
        '127.0.0.1',
        'Mozilla/5.0',
      );

      expect(result).toEqual({ success: true });
      expect(mockUsersService.updatePassword).toHaveBeenCalledWith(
        1,
        expect.any(String),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // resetPassword
  // ─────────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('should reset password and emit success event', async () => {
      mockUsersService.updatePassword.mockResolvedValue(undefined);

      const result = await service.resetPassword(
        '1',
        'newpassword',
        '127.0.0.1',
        'Mozilla/5.0',
      );

      expect(result).toEqual({ success: true });
      expect(mockUsersService.updatePassword).toHaveBeenCalledWith(
        1,
        expect.any(String),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalled();
    });

    it('should emit failure event if updatePassword throws', async () => {
      mockUsersService.updatePassword.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(
        service.resetPassword('1', 'newpass', '127.0.0.1'),
      ).rejects.toThrow('DB error');

      expect(mockEventEmitter.emit).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // findOrCreateOAuthUser
  // ─────────────────────────────────────────────────────────────

  describe('findOrCreateOAuthUser', () => {
    const validProfile = {
      provider: 'google' as const,
      providerId: 'google-123',
      email: 'user@example.com',
      name: 'Test User',
      avatarUrl: 'https://avatar.url/pic.png',
    };

    it('should find existing user by email and return JWT', async () => {
      mockUsersService.findByEmail.mockResolvedValue({
        id: 42,
        email: 'user@example.com',
      });

      const result = await service.findOrCreateOAuthUser(validProfile);

      expect(result).toBe('jwt-token');
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: 42,
        email: 'user@example.com',
      });
    });

    it('should create a new user if not found by email', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue({
        id: 99,
        email: 'new@example.com',
      });

      const result = await service.findOrCreateOAuthUser(validProfile);

      expect(mockUsersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'user@example.com',
          oauthProvider: 'google',
          oauthProviderId: 'google-123',
        }),
      );
      expect(result).toBe('jwt-token');
    });

    it('should throw BadRequestException if profile validation fails', async () => {
      const invalidProfile = {
        provider: '',
        providerId: '',
        email: 'not-an-email',
        name: '',
      } as any;

      await expect(
        service.findOrCreateOAuthUser(invalidProfile),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle profile without email', async () => {
      const noEmailProfile = {
        provider: 'github' as const,
        providerId: 'gh-456',
        email: undefined as any,
        name: 'GH User',
        avatarUrl: undefined,
      };

      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue({
        id: 100,
        email: undefined,
      });

      const result = await service.findOrCreateOAuthUser(noEmailProfile);

      expect(result).toBe('jwt-token');
      expect(mockUsersService.create).toHaveBeenCalled();
    });
  });
});
