import { Controller, Post, Get, Body, UseGuards, Logger } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { VerifyTokenDto } from './dto/verify-token.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * Login endpoint - authenticates user with email and password
   */
  @Post('login')
  @ApiOperation({
    summary: 'Login with email and password',
    description: 'Authenticates user and returns JWT token with user data',
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
  })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    this.logger.log(`Login attempt for email: ${loginDto.email}`);
    return this.authService.login(loginDto.email, loginDto.password);
  }

  /**
   * Token verification endpoint - validates JWT and returns user data
   */
  @Post('verify')
  @ApiOperation({
    summary: 'Verify JWT token validity',
    description: 'Validates JWT token and returns current user data',
  })
  @ApiResponse({
    status: 200,
    description: 'Token valid',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired token',
  })
  async verify(
    @Body() verifyTokenDto: VerifyTokenDto,
  ): Promise<AuthResponseDto> {
    this.logger.log('Token verification request');
    return this.authService.verifyToken(verifyTokenDto.token);
  }

  /**
   * Get current authenticated user endpoint
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current authenticated user',
    description: 'Returns the currently authenticated user data',
  })
  @ApiResponse({
    status: 200,
    description: 'User data retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing token',
  })
  getMe(@CurrentUser() user: User): { id: string; email: string } {
    this.logger.log(`Get current user request for: ${user.email}`);
    return {
      id: user.id,
      email: user.email,
    };
  }
}
