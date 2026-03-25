import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuthService, OAuthProfile } from './auth.service';
import { UsersService } from '../users/users.service';
import { Users } from '../users/users.entity';

describe('AuthService — findOrCreateOAuthUser', () => {
  let authService: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;

  const mockProfile: OAuthProfile = {
    provider: 'google',
    providerId: 'google-uid-123',
    email: 'jane@example.com',
    name: 'Jane Doe',
    avatarUrl: 'https://example.com/avatar.png',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('signed.jwt.token') },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService) as jest.Mocked<UsersService>;
    jwtService = module.get(JwtService) as jest.Mocked<JwtService>;
  });

  describe('when the user already exists (email match)', () => {
    it('should return a JWT without creating a new user', async () => {
      const existingUser = { id: 42, email: 'jane@example.com' } as unknown as Users;
      usersService.findByEmail.mockResolvedValue(existingUser);

      const token = await authService.findOrCreateOAuthUser(mockProfile);

      expect(usersService.findByEmail).toHaveBeenCalledWith('jane@example.com');
      expect(usersService.create).not.toHaveBeenCalled();
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: existingUser.id,
        email: existingUser.email,
      });
      expect(token).toBe('signed.jwt.token');
    });
  });

  describe('when the user does not yet exist', () => {
    it('should create a new user and return a JWT', async () => {
      const newUser = { id: 99, email: 'jane@example.com' } as unknown as Users;
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(newUser);

      const token = await authService.findOrCreateOAuthUser(mockProfile);

      expect(usersService.findByEmail).toHaveBeenCalledWith('jane@example.com');
      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'jane@example.com',
          name: 'Jane Doe',
          password: null,
          oauthProvider: 'google',
          oauthProviderId: 'google-uid-123',
        }),
      );
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: newUser.id,
        email: newUser.email,
      });
      expect(token).toBe('signed.jwt.token');
    });
  });

  describe('when the OAuth profile has no email', () => {
    it('should skip the email lookup and create a user with empty email', async () => {
      const profileWithoutEmail: OAuthProfile = {
        ...mockProfile,
        email: '',
      };
      const createdUser = { id: 77, email: '' } as unknown as Users;
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(createdUser);

      await authService.findOrCreateOAuthUser(profileWithoutEmail);

      // findByEmail is not called when email is falsy
      expect(usersService.findByEmail).not.toHaveBeenCalled();
      expect(usersService.create).toHaveBeenCalled();
    });
  });
});
