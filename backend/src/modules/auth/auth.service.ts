import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { AuthResponseDto } from './dto/auth-response.dto';
import { UserSerializer } from '../users/serializers/user.serializer';

interface JwtPayload {
  sub: string;
}

/**
 * Authentication service handling JWT generation and user validation
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Validates user credentials
   * @param email User email address
   * @param password Plain text password
   * @returns User entity if valid, null otherwise
   */
  async validateUser(email: string, password: string): Promise<User | null> {
    this.logger.log(`Validating credentials for email: ${email}`);

    // Include password for authentication
    const user = await this.usersService.findByEmail(email, true);

    if (!user) {
      this.logger.warn(`User not found: ${email}`);
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      this.logger.warn(`Invalid password attempt for email: ${email}`);
      return null;
    }

    this.logger.log(`User validated successfully: ${email}`);
    return user;
  }

  /**
   * Authenticates user and generates JWT token
   * @param email User email address
   * @param password Plain text password
   * @returns AuthResponse with JWT token and user data
   * @throws UnauthorizedException if credentials are invalid
   */
  async login(email: string, password: string): Promise<AuthResponseDto> {
    const user = await this.validateUser(email, password);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = this.generateJwt(user);

    this.logger.log(`Login successful for user: ${user.email}`);

    return {
      token,
      user: UserSerializer.serialize(user),
    };
  }

  /**
   * Verifies JWT token and returns fresh user data
   * @param token JWT token to verify
   * @returns AuthResponse with token and current user data
   * @throws UnauthorizedException if token is invalid or user not found
   */
  async verifyToken(token: string): Promise<AuthResponseDto> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const user = await this.usersService.findOne(payload.sub);

      if (!user) {
        this.logger.warn(
          `User not found for token payload sub: ${payload.sub}`,
        );
        throw new UnauthorizedException('User not found');
      }

      this.logger.log(`Token verified for user: ${user.email}`);

      return {
        token, // Return same token if still valid
        user: UserSerializer.serialize(user),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Token verification failed: ${errorMessage}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /**
   * Generates JWT token for authenticated user
   * @param user User entity
   * @returns Signed JWT token
   */
  generateJwt(user: User): string {
    const payload = {
      sub: user.id,
    };

    return this.jwtService.sign(payload);
  }

  /**
   * Generates auth response for a user without password validation
   * Used after user creation (signup) where password validation is not needed
   * @param user User entity
   * @returns AuthResponse with JWT token and user data
   */
  createAuthResponse(user: User): AuthResponseDto {
    const token = this.generateJwt(user);

    this.logger.log(`Auth response created for user: ${user.email}`);

    return {
      token,
      user: UserSerializer.serialize(user),
    };
  }
}
