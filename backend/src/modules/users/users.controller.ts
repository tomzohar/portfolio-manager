import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from './entities/user.entity';
import { SerializedUser } from './serializers/user.serializer';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  @Post()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 signups per 60 seconds
  @ApiOperation({ summary: 'Create a new user and return JWT token' })
  @ApiResponse({
    status: 201,
    description: 'User created successfully with authentication token.',
  })
  @ApiResponse({
    status: 409,
    description: 'User with this email already exists.',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - rate limit exceeded',
  })
  async create(@Body() createUserDto: CreateUserDto) {
    const serializedUser = await this.usersService.create(createUserDto);

    // Convert SerializedUser back to User entity for JWT generation
    // This is safe because createAuthResponse only needs id and email
    const userForAuth = {
      id: serializedUser.id,
      email: serializedUser.email,
      createdAt: serializedUser.createdAt,
      updatedAt: serializedUser.updatedAt,
    } as User;

    // Generate JWT and return auth response (token + user data)
    return this.authService.createAuthResponse(userForAuth);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user by ID (requires authentication)' })
  @ApiResponse({ status: 200, description: 'User found.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async findOne(
    @CurrentUser() currentUser: User,
    @Param('id') id: string,
  ): Promise<SerializedUser> {
    const user = await this.usersService.findOneSerialized(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
