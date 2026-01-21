/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: jest.Mocked<JwtService>;
  let usersService: jest.Mocked<UsersService>;
  let configService: jest.Mocked<ConfigService>;

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    passwordHash: '$2b$10$hashedpassword',
    portfolios: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockExecutionContext = (token?: string, queryToken?: string) => {
    const mockRequest = {
      headers: {
        authorization: token ? `Bearer ${token}` : undefined,
      },
      query: {
        token: queryToken,
      },
      user: undefined,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findOne: jest.fn(),
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

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
    jwtService = module.get(JwtService);
    usersService = module.get(UsersService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should return true and attach user when token is valid', async () => {
      const context = mockExecutionContext('valid.jwt.token');
      const payload = { sub: mockUser.id };

      configService.get.mockReturnValue('test-secret');
      jwtService.verifyAsync.mockResolvedValue(payload);
      usersService.findOne.mockResolvedValue(mockUser);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(context.switchToHttp().getRequest().user).toEqual(mockUser);
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid.jwt.token', {
        secret: 'test-secret',
      });
      expect(usersService.findOne).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw UnauthorizedException when no token is provided', async () => {
      const context = mockExecutionContext();

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'No token provided',
      );
    });

    it('should throw UnauthorizedException when token is invalid', async () => {
      const context = mockExecutionContext('invalid.jwt.token');

      configService.get.mockReturnValue('test-secret');
      jwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Invalid or expired token',
      );
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      const context = mockExecutionContext('valid.jwt.token');
      const payload = { sub: 'non-existent-id' };

      configService.get.mockReturnValue('test-secret');
      jwtService.verifyAsync.mockResolvedValue(payload);
      usersService.findOne.mockResolvedValue(null);

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'User not found',
      );
    });

    it('should throw UnauthorizedException when authorization header is malformed', async () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: 'NotBearer token',
            },
            query: {},
          }),
        }),
      } as ExecutionContext;

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'No token provided',
      );
    });
  });

  describe('SSE Authentication (Query Parameter)', () => {
    it('should authenticate with token from query parameter', async () => {
      const context = mockExecutionContext(undefined, 'valid.jwt.token');
      const payload = { sub: mockUser.id };

      configService.get.mockReturnValue('test-secret');
      jwtService.verifyAsync.mockResolvedValue(payload);
      usersService.findOne.mockResolvedValue(mockUser);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(
        'valid.jwt.token',
        expect.objectContaining({ secret: 'test-secret' }),
      );
    });

    it('should prefer header token over query parameter', async () => {
      const context = mockExecutionContext('header.token', 'query.token');
      const payload = { sub: mockUser.id };

      configService.get.mockReturnValue('test-secret');
      jwtService.verifyAsync.mockResolvedValue(payload);
      usersService.findOne.mockResolvedValue(mockUser);

      await guard.canActivate(context);

      // Should use header token, not query token
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(
        'header.token',
        expect.any(Object),
      );
    });

    it('should throw UnauthorizedException when query token is empty string', async () => {
      const context = mockExecutionContext(undefined, '');

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'No token provided',
      );
    });

    it('should throw UnauthorizedException when query token is invalid', async () => {
      const context = mockExecutionContext(undefined, 'invalid.token');

      configService.get.mockReturnValue('test-secret');
      jwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Invalid or expired token',
      );
    });
  });
});
