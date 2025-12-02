import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { UsersService } from '../users/users.service';

interface JwtPayload {
  sub: string;
}

/**
 * JWT Authentication Guard
 * Validates Bearer token in Authorization header and attaches user to request
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Validates JWT token and attaches user to request
   * @param context Execution context
   * @returns true if authentication successful
   * @throws UnauthorizedException if token is invalid or missing
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      this.logger.warn('No token provided in request');
      throw new UnauthorizedException('No token provided');
    }

    try {
      // Verify the token signature and expiration
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // Fetch user from database to ensure they still exist
      const user = await this.usersService.findOne(payload.sub);

      if (!user) {
        this.logger.warn(`User not found for token sub: ${payload.sub}`);
        throw new UnauthorizedException('User not found');
      }

      // Attach user to request object for use in controllers
      request['user'] = user;

      this.logger.log(`Authentication successful for user: ${user.email}`);
      return true;
    } catch (error) {
      // Re-throw if it's already an UnauthorizedException we threw
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      // Otherwise, it's a JWT verification error
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Authentication failed: ${errorMessage}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /**
   * Extracts JWT token from Authorization header
   * @param request Express request object
   * @returns JWT token string or undefined
   */
  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return undefined;
    }

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
