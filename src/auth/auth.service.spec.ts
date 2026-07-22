/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { TokenRegistryService } from './token-registry.service';
import * as bcrypt from 'bcrypt';
import * as otplib from 'otplib';
import * as qrcode from 'qrcode';

// Mock otplib to avoid ES module transformation issues
jest.mock('otplib', () => ({
  generateSecret: jest.fn(),
  generateURI: jest.fn(),
  verify: jest.fn(),
}));

// Mock qrcode to avoid ES module transformation issues
jest.mock('qrcode', () => ({
  toDataURL: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;
  let tokenRegistry: TokenRegistryService;
  let _eventEmitter: EventEmitter2;

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    password: 'hashedPassword',
    name: 'Test User',
    twoFAEnabled: false,
    twoFASecret: null,
  };

  const getMockUser = (email: string) => ({
    ...mockUser,
    email,
  });

  const mockTokens = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            create: jest.fn(),
            findByEmail: jest.fn(),
            findOne: jest.fn(),
            update2FA: jest.fn(),
            updatePassword: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
            sign: jest.fn(),
          },
        },
        {
          provide: TokenRegistryService,
          useValue: {
            store: jest.fn(),
            exists: jest.fn(),
            invalidate: jest.fn(),
            invalidateAllForUser: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
            on: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
    tokenRegistry = module.get<TokenRegistryService>(TokenRegistryService);
    _eventEmitter = module.get<EventEmitter2>(EventEmitter2);

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should hash password and return tokens on successful registration', async () => {
      const registerDto = {
        email: 'new@example.com',
        password: 'plainPassword',
        firstName: 'John',
        lastName: 'Doe',
      };

      const bcryptHashSpy = jest
        .spyOn(bcrypt, 'hash')
        .mockResolvedValue('hashedPassword' as never);
      (usersService.create as jest.Mock).mockResolvedValue(
        getMockUser('new@example.com'),
      );
      (jwtService.signAsync as jest.Mock).mockResolvedValue(
        mockTokens.accessToken,
      );
      (tokenRegistry.store as jest.Mock).mockResolvedValue(undefined);

      const result = await service.register(registerDto);

      expect(bcryptHashSpy).toHaveBeenCalledWith('plainPassword', 10);
      expect(usersService.create).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'hashedPassword',
        name: 'John Doe',
      });
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: '1', email: 'new@example.com' },
        { expiresIn: '15m' },
      );
      expect(tokenRegistry.store).toHaveBeenCalledWith('1', expect.any(String));
      expect(result.accessToken).toBe(mockTokens.accessToken);
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw ConflictException on duplicate email', async () => {
      const registerDto = {
        email: 'existing@example.com',
        password: 'plainPassword',
      };

      const conflictError = new ConflictException('Email already exists');
      (usersService.create as jest.Mock).mockRejectedValue(conflictError);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should use name from firstName and lastName when provided', async () => {
      const registerDto = {
        email: 'new@example.com',
        password: 'plainPassword',
        firstName: 'Jane',
        lastName: 'Smith',
      };

      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashedPassword' as never);
      (usersService.create as jest.Mock).mockResolvedValue(mockUser);
      (jwtService.signAsync as jest.Mock).mockResolvedValue(
        mockTokens.accessToken,
      );
      (tokenRegistry.store as jest.Mock).mockResolvedValue(undefined);

      await service.register(registerDto);

      expect(usersService.create).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'hashedPassword',
        name: 'Jane Smith',
      });
    });

    it('should use email as name when no name fields provided', async () => {
      const registerDto = {
        email: 'new@example.com',
        password: 'plainPassword',
      };

      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashedPassword' as never);
      (usersService.create as jest.Mock).mockResolvedValue(mockUser);
      (jwtService.signAsync as jest.Mock).mockResolvedValue(
        mockTokens.accessToken,
      );
      (tokenRegistry.store as jest.Mock).mockResolvedValue(undefined);

      await service.register(registerDto);

      expect(usersService.create).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'hashedPassword',
        name: 'new@example.com',
      });
    });
  });

  describe('validateUser (login)', () => {
    it('should throw UnauthorizedException when user not found', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(null);

      await expect(
        service.validateUser('nonexistent@example.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.validateUser('nonexistent@example.com', 'password'),
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedException when password is incorrect', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(
        service.validateUser('test@example.com', 'wrongPassword'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.validateUser('test@example.com', 'wrongPassword'),
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedException when user has no password', async () => {
      const userWithoutPassword = { ...mockUser, password: null };
      (usersService.findByEmail as jest.Mock).mockResolvedValue(
        userWithoutPassword,
      );

      await expect(
        service.validateUser('test@example.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return tokens on valid credentials', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      (jwtService.signAsync as jest.Mock).mockResolvedValue(
        mockTokens.accessToken,
      );
      (tokenRegistry.store as jest.Mock).mockResolvedValue(undefined);

      const result = await service.validateUser(
        'test@example.com',
        'correctPassword',
      );

      expect(bcrypt.compare).toHaveBeenCalledWith(
        'correctPassword',
        'hashedPassword',
      );
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: '1', email: 'test@example.com' },
        { expiresIn: '15m' },
      );
      expect(tokenRegistry.store).toHaveBeenCalledWith('1', expect.any(String));
      expect(result.accessToken).toBe(mockTokens.accessToken);
      expect(result.refreshToken).toBeDefined();
    });
  });

  describe('refreshTokens', () => {
    it('should throw ForbiddenException when refresh token is invalid/expired', async () => {
      (tokenRegistry.exists as jest.Mock).mockResolvedValue(false);

      await expect(
        service.refreshTokens('1', 'test@example.com', 'invalid-token'),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.refreshTokens('1', 'test@example.com', 'invalid-token'),
      ).rejects.toThrow('Access Denied: Refresh token reuse detected.');
      expect(tokenRegistry.invalidateAllForUser).toHaveBeenCalledWith('1');
    });

    it('should invalidate old token and return new tokens on valid refresh', async () => {
      (tokenRegistry.exists as jest.Mock).mockResolvedValue(true);
      (tokenRegistry.invalidate as jest.Mock).mockResolvedValue(undefined);
      (jwtService.signAsync as jest.Mock).mockResolvedValue(
        mockTokens.accessToken,
      );
      (tokenRegistry.store as jest.Mock).mockResolvedValue(undefined);

      const result = await service.refreshTokens(
        '1',
        'test@example.com',
        'valid-token',
      );

      expect(tokenRegistry.exists).toHaveBeenCalledWith('1', 'valid-token');
      expect(tokenRegistry.invalidate).toHaveBeenCalledWith('1', 'valid-token');
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: '1', email: 'test@example.com' },
        { expiresIn: '15m' },
      );
      expect(tokenRegistry.store).toHaveBeenCalledWith('1', expect.any(String));
      expect(result.accessToken).toBe(mockTokens.accessToken);
      expect(result.refreshToken).toBeDefined();
    });

    it('should revoke all user tokens when reuse is detected', async () => {
      (tokenRegistry.exists as jest.Mock).mockResolvedValue(false);
      (tokenRegistry.invalidateAllForUser as jest.Mock).mockResolvedValue(
        undefined,
      );

      await expect(
        service.refreshTokens('1', 'test@example.com', 'reused-token'),
      ).rejects.toThrow(ForbiddenException);

      expect(tokenRegistry.invalidateAllForUser).toHaveBeenCalledWith('1');
    });
  });

  describe('enable2FA', () => {
    it('should generate TOTP secret and return QR code', async () => {
      const mockSecret = 'JBSWY3DPEHPK3PXP';
      const mockOtpauth =
        'otpauth://totp/MarketX:1?secret=JBSWY3DPEHPK3PXP&issuer=MarketX';
      const mockQrCode = 'data:image/png;base64,mockqr';

      jest.spyOn(otplib, 'generateSecret').mockReturnValue(mockSecret);
      jest.spyOn(otplib, 'generateURI').mockReturnValue(mockOtpauth);
      jest.spyOn(qrcode, 'toDataURL').mockResolvedValue(mockQrCode);

      (usersService.update2FA as jest.Mock).mockResolvedValue(undefined);

      const result = await service.enable2FA('1');

      expect(otplib.generateSecret).toHaveBeenCalled();
      expect(usersService.update2FA).toHaveBeenCalledWith(1, mockSecret, true);
      expect(result.qrCodeDataURL).toBeDefined();
      expect(result.otpauth).toBe(mockOtpauth);
    });
  });

  describe('verify2FA', () => {
    it('should throw BadRequestException when 2FA is not enabled for user', async () => {
      const userWithout2FA = {
        ...mockUser,
        twoFAEnabled: false,
        twoFASecret: null,
      };
      (usersService.findOne as jest.Mock).mockResolvedValue(userWithout2FA);

      await expect(service.verify2FA('1', '123456')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.verify2FA('1', '123456')).rejects.toThrow(
        '2FA not enabled for this user',
      );
    });

    it('should throw BadRequestException when user not found', async () => {
      (usersService.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.verify2FA('1', '123456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when TOTP code is invalid', async () => {
      const userWith2FA = {
        ...mockUser,
        twoFAEnabled: true,
        twoFASecret: 'JBSWY3DPEHPK3PXP',
      };
      (usersService.findOne as jest.Mock).mockResolvedValue(userWith2FA);
      jest.spyOn(otplib, 'verify').mockResolvedValue({ valid: false } as never);

      await expect(service.verify2FA('1', '000000')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.verify2FA('1', '000000')).rejects.toThrow(
        'Invalid 2FA code',
      );
    });

    it('should return true when TOTP code is valid', async () => {
      const userWith2FA = {
        ...mockUser,
        twoFAEnabled: true,
        twoFASecret: 'JBSWY3DPEHPK3PXP',
      };
      (usersService.findOne as jest.Mock).mockResolvedValue(userWith2FA);
      jest.spyOn(otplib, 'verify').mockResolvedValue({ valid: true, delta: 0 });

      const result = await service.verify2FA('1', '123456');

      expect(otplib.verify).toHaveBeenCalledWith({
        secret: 'JBSWY3DPEHPK3PXP',
        token: '123456',
      });
      expect(result).toBe(true);
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should invalidate all tokens for a user', async () => {
      (tokenRegistry.invalidateAllForUser as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.revokeAllUserTokens('1');

      expect(tokenRegistry.invalidateAllForUser).toHaveBeenCalledWith('1');
    });
  });

  describe('getTokens', () => {
    it('should generate access and refresh tokens', async () => {
      (jwtService.signAsync as jest.Mock).mockResolvedValue(
        mockTokens.accessToken,
      );
      (tokenRegistry.store as jest.Mock).mockResolvedValue(undefined);

      const result = await service.getTokens('1', 'test@example.com');

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: '1', email: 'test@example.com' },
        { expiresIn: '15m' },
      );
      expect(tokenRegistry.store).toHaveBeenCalledWith('1', expect.any(String));
      expect(result.accessToken).toBe(mockTokens.accessToken);
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken).toHaveLength(80); // 40 bytes * 2 hex chars
    });
  });
});
