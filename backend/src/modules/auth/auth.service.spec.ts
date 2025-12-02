/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';

// Mock bcrypt at module level
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  genSalt: jest.fn(),
  hash: jest.fn(),
}));

import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    passwordHash: '$2b$10$hashedpassword',
    portfolios: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockToken = 'mock.jwt.token';

  beforeEach(async () => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user when credentials are valid', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser(
        'test@example.com',
        'password123',
      );

      expect(result).toEqual(mockUser);
      expect(usersService.findByEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('should return null when user is not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await service.validateUser(
        'nonexistent@example.com',
        'password123',
      );

      expect(result).toBeNull();
      expect(usersService.findByEmail).toHaveBeenCalledWith(
        'nonexistent@example.com',
      );
    });

    it('should return null when password is incorrect', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser(
        'test@example.com',
        'wrongpassword',
      );

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return auth response when credentials are valid', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.sign.mockReturnValue(mockToken);

      const result = await service.login('test@example.com', 'password123');

      expect(result).toEqual({
        token: mockToken,
        user: {
          id: mockUser.id,
          email: mockUser.email,
        },
      });
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
      });
    });

    it('should throw UnauthorizedException when credentials are invalid', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login('test@example.com', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('verifyToken', () => {
    it('should return auth response when token is valid', async () => {
      const payload = { sub: mockUser.id };
      configService.get.mockReturnValue('test-secret');
      jwtService.verifyAsync.mockResolvedValue(payload);
      usersService.findOne.mockResolvedValue(mockUser);

      const result = await service.verifyToken(mockToken);

      expect(result).toEqual({
        token: mockToken,
        user: {
          id: mockUser.id,
          email: mockUser.email,
        },
      });
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(mockToken, {
        secret: 'test-secret',
      });
      expect(usersService.findOne).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw UnauthorizedException when token is invalid', async () => {
      configService.get.mockReturnValue('test-secret');
      jwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      await expect(service.verifyToken('invalid.token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      const payload = { sub: 'non-existent-id' };
      configService.get.mockReturnValue('test-secret');
      jwtService.verifyAsync.mockResolvedValue(payload);
      usersService.findOne.mockResolvedValue(null);

      await expect(service.verifyToken(mockToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('generateJwt', () => {
    it('should generate JWT token with correct payload', () => {
      jwtService.sign.mockReturnValue(mockToken);

      const result = service.generateJwt(mockUser);

      expect(result).toBe(mockToken);
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
      });
    });
  });

  describe('createAuthResponse', () => {
    it('should generate auth response without password validation', async () => {
      jwtService.sign.mockReturnValue(mockToken);

      const result = service.createAuthResponse(mockUser);

      expect(result).toEqual({
        token: mockToken,
        user: {
          id: mockUser.id,
          email: mockUser.email,
        },
      });
      expect(jwtService.sign).toHaveBeenCalledWith({ sub: mockUser.id });
    });

    it('should not call usersService when creating auth response', async () => {
      jwtService.sign.mockReturnValue(mockToken);

      service.createAuthResponse(mockUser);

      // Should NOT validate user or password
      expect(usersService.findByEmail).not.toHaveBeenCalled();
      expect(usersService.findOne).not.toHaveBeenCalled();
    });
  });
});
