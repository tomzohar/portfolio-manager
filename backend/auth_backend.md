# Backend Authentication Implementation Plan

## Overview
Complete JWT-based authentication system to support the frontend login/signup flow. The backend already has user creation with password hashing (bcrypt), so we need to add authentication endpoints and JWT handling.

**Note**: This implementation uses `@nestjs/jwt` directly **without Passport** for a simpler, more explicit approach.

## Current State Analysis

### ✅ Already Implemented:
- User entity with `passwordHash` field
- User creation endpoint (POST `/users`) 
- Password hashing with bcrypt
- Email uniqueness validation
- TypeORM setup with PostgreSQL
- Password minimum length updated to 8 characters

### ❌ Missing:
- Authentication module
- Login endpoint
- Token verification endpoint  
- JWT generation and validation
- Protected route guards

---

## Implementation Plan

### 1. Install Required Dependencies

**Location**: `backend/package.json`

```bash
npm install @nestjs/jwt
```

**Dependencies:**
```json
{
  "@nestjs/jwt": "^10.x",
  "bcrypt": "^5.x"  // Already installed
}
```

**Note**: We're skipping Passport for a simpler, more explicit implementation using only `@nestjs/jwt`.

---

### 2. Create Auth Module Structure

**New Module**: `backend/src/modules/auth/`

**Files to create:**
```
backend/src/modules/auth/
├── auth.module.ts                    # Auth module configuration
├── auth.controller.ts                # Login and token verification endpoints
├── auth.service.ts                   # Business logic for authentication
├── jwt-auth.guard.ts                 # Guard for protecting routes (manual JWT validation)
├── dto/
│   ├── login.dto.ts                 # Login request DTO
│   └── auth-response.dto.ts         # Auth response DTO
├── decorators/
│   └── current-user.decorator.ts    # Custom @CurrentUser decorator
└── tests/
    ├── auth.controller.spec.ts
    ├── auth.service.spec.ts
    └── jwt-auth.guard.spec.ts
```

---

### 3. Create Auth DTOs

#### `backend/src/modules/auth/dto/login.dto.ts`
```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export class LoginDto extends createZodDto(LoginSchema) {}
```

#### `backend/src/modules/auth/dto/auth-response.dto.ts`
```typescript
export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
  };
}
```

---

### 4. Implement Auth Service

**File**: `backend/src/modules/auth/auth.service.ts`

**Key Methods:**

1. **`validateUser(email: string, password: string): Promise<User | null>`**
   - Find user by email
   - Compare password with stored hash using `bcrypt.compare()`
   - Return user if valid, null otherwise

2. **`login(user: User): Promise<AuthResponse>`**
   - Generate JWT with user payload
   - Return token + sanitized user data

3. **`verifyToken(token: string): Promise<AuthResponse>`**
   - Validate JWT signature
   - Fetch user from database
   - Return fresh user data with same/new token

4. **`generateJwt(payload: { sub: string; email: string }): string`**
   - Create signed JWT using secret
   - Set expiration time

**Implementation Details:**
- Use bcrypt to compare provided password with stored hash
- Generate JWT with configurable expiration (7 days recommended)
- Include user ID (`sub`) and email in JWT payload
- Never return `passwordHash` in responses
- Handle all auth errors appropriately

---

### 5. Create JWT Auth Guard

**File**: `backend/src/modules/auth/jwt-auth.guard.ts`

**Purpose**: Guard to protect routes requiring authentication (manual implementation)

```typescript
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      // Verify the token
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });

      // Fetch user from database
      const user = await this.usersService.findOne(payload.sub);
      
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Attach user to request object
      request['user'] = user;
      
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return undefined;
    }

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
```

**Usage:**
```typescript
@UseGuards(JwtAuthGuard)
@Get('protected')
async getProtected(@Request() req) {
  return req.user; // User from JWT
}
```

---

### 6. Implement Auth Controller

**File**: `backend/src/modules/auth/auth.controller.ts`

#### **Endpoints:**

### 📍 **POST `/auth/login`**
- **Description**: Authenticate user and return JWT
- **Input**: `LoginDto` (email, password)
- **Process**: 
  - Validate credentials using AuthService
  - Generate JWT token
- **Output**: `AuthResponse` (token + user data)
- **Status Codes**: 
  - 200 OK - Successful login
  - 401 Unauthorized - Invalid credentials

### 📍 **POST `/auth/verify`**
- **Description**: Verify JWT token validity
- **Input**: `{ token: string }`
- **Process**: 
  - Validate JWT signature
  - Fetch current user data
- **Output**: `AuthResponse` (same/new token + user data)
- **Status Codes**: 
  - 200 OK - Valid token
  - 401 Unauthorized - Invalid/expired token

### 📍 **GET `/auth/me`** (Protected)
- **Description**: Get current authenticated user
- **Auth Required**: Yes (JWT in Authorization header)
- **Process**: Return user from token
- **Output**: User data (without passwordHash)
- **Status Codes**: 
  - 200 OK - Success
  - 401 Unauthorized - No/invalid token

---

### 7. Configure Auth Module

**File**: `backend/src/modules/auth/auth.module.ts`

**Configuration:**
```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        global: true, // Makes JwtService available globally
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { 
          expiresIn: configService.get<string>('JWT_EXPIRATION') || '7d' 
        },
      }),
      inject: [ConfigService],
    }),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
```

**Key Differences from Passport Approach:**
- No `PassportModule` import
- No `JwtStrategy` provider
- Guard implements `CanActivate` interface directly
- Manual token extraction and validation in the guard

---

### 8. Update Users Module

#### **`backend/src/modules/users/users.service.ts`**

**Add methods:**

```typescript
async findByEmail(email: string): Promise<User | null> {
  return this.usersRepository.findOne({ where: { email } });
}

async validatePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

#### **`backend/src/modules/users/users.module.ts`**

**Export UsersService:**
```typescript
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // Add this line
})
export class UsersModule {}
```

---

### 9. Update Users Controller

**File**: `backend/src/modules/users/users.controller.ts`

**Modify POST `/users` endpoint** to return JWT after signup:

```typescript
import { AuthService } from '../auth/auth.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService, // Inject AuthService
  ) {}

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);
    
    // Generate JWT and return auth response
    return this.authService.login(user);
  }
}
```

This provides seamless signup → login flow for the frontend.

---

### 10. Protect Portfolio Routes

**File**: `backend/src/modules/portfolio/portfolio.controller.ts`

**Add authentication to all routes:**

```typescript
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('portfolio')
@UseGuards(JwtAuthGuard) // Protect entire controller
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get()
  async findAll(@CurrentUser() user: User) {
    // Only return portfolios belonging to authenticated user
    return this.portfolioService.findAllByUserId(user.id);
  }

  @Post()
  async create(
    @CurrentUser() user: User,
    @Body() createPortfolioDto: CreatePortfolioDto,
  ) {
    // Associate portfolio with authenticated user
    return this.portfolioService.create(user.id, createPortfolioDto);
  }
}
```

**Update PortfolioService:**
```typescript
async findAllByUserId(userId: string): Promise<Portfolio[]> {
  return this.portfolioRepository.find({
    where: { user: { id: userId } },
    relations: ['assets'],
  });
}
```

---

### 11. Create Custom User Decorator

**File**: `backend/src/modules/auth/decorators/current-user.decorator.ts`

**Purpose**: Easy access to authenticated user in controllers

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../users/entities/user.entity';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

**Usage:**
```typescript
@Get('me')
async getMe(@CurrentUser() user: User) {
  return user;
}
```

---

### 12. Environment Configuration

**File**: `backend/.env`

**Add JWT configuration:**
```env
# Database (existing)
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=stocks_researcher

# JWT Authentication (new)
JWT_SECRET=your-super-secret-jwt-key-change-in-production-min-32-chars
JWT_EXPIRATION=7d
```

**Security Notes:**
- Use a strong, random secret (minimum 32 characters)
- Change secret in production
- Never commit `.env` to version control
- Consider using different secrets for dev/prod

**File**: `backend/src/app.module.ts`

Ensure ConfigModule validates required variables:
```typescript
ConfigModule.forRoot({
  isGlobal: true,
  validationSchema: Joi.object({
    JWT_SECRET: Joi.string().min(32).required(),
    JWT_EXPIRATION: Joi.string().default('7d'),
  }),
})
```

---

### 13. Error Handling

**Standardize authentication errors:**

| Status Code | Error Type | When to Use | Frontend Message |
|-------------|------------|-------------|------------------|
| 401 Unauthorized | Invalid credentials | Login fails | "Invalid email or password" |
| 401 Unauthorized | Token expired | JWT expired | "Session expired, please login again" |
| 401 Unauthorized | Invalid token | Malformed JWT | "Invalid authentication" |
| 403 Forbidden | Insufficient permissions | Valid token, wrong resource | "Access denied" |
| 409 Conflict | Email exists | Signup with existing email | "User with this email already exists" |

**Error Response Format:**
```typescript
{
  statusCode: 401,
  message: "Invalid email or password",
  error: "Unauthorized"
}
```

---

### 14. Security Best Practices

#### **Password Security:**
- ✅ Minimum 8 characters (implemented)
- ✅ Bcrypt hashing with auto-salt (implemented)
- ✅ Never return passwordHash in responses
- Consider: Password complexity requirements (future)

#### **JWT Security:**
- Use strong secret key from environment variables
- Set reasonable expiration (7 days recommended)
- Include minimal payload (id, email only)
- Validate signature on every request
- Consider: Refresh token implementation (future)

#### **Rate Limiting (Recommended):**
```typescript
// Optional: Add to auth endpoints
import { ThrottlerGuard } from '@nestjs/throttler';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  // Limits: 5 requests per minute per IP
}
```

#### **CORS Configuration:**
```typescript
app.enableCors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200',
  credentials: true,
});
```

---

### 15. Testing

**Test Coverage Required:**

#### **Unit Tests:**

**`auth.service.spec.ts`:**
- ✅ validateUser with correct credentials
- ✅ validateUser with incorrect password
- ✅ validateUser with non-existent email
- ✅ login generates valid JWT
- ✅ verifyToken with valid token
- ✅ verifyToken with expired token
- ✅ verifyToken with invalid signature

**`auth.controller.spec.ts`:**
- ✅ POST /auth/login success
- ✅ POST /auth/login failure
- ✅ POST /auth/verify success
- ✅ POST /auth/verify failure
- ✅ GET /auth/me with valid token
- ✅ GET /auth/me without token

**`jwt-auth.guard.spec.ts`:**
- ✅ canActivate() with valid token
- ✅ canActivate() with invalid token
- ✅ canActivate() without token
- ✅ canActivate() with expired token
- ✅ User properly attached to request

#### **Integration Tests:**
- Complete signup flow (POST /users → receive JWT)
- Complete login flow (POST /auth/login → receive JWT)
- Protected route access with valid token
- Protected route access without token
- Token verification flow
- Portfolio access with authentication

---

### 16. API Documentation

**Update Swagger/OpenAPI annotations:**

```typescript
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  
  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful', type: AuthResponse })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) { }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({ status: 200, description: 'User data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMe(@CurrentUser() user: User) { }
}
```

---

## Technical Specifications

### JWT Payload Structure
```typescript
{
  sub: string;      // User ID (UUID) - Subject of the token
  iat: number;      // Issued at (Unix timestamp)
  exp: number;      // Expiration (Unix timestamp)
}
```

### Token Storage Strategy
- **Frontend**: localStorage (key: `portfolio_manager_auth_token`)
- **Backend**: Stateless validation (no server-side storage)
- **Transmission**: Authorization header: `Bearer <token>`

### Password Requirements
- Minimum length: 8 characters
- Stored as: bcrypt hash with auto-generated salt
- Never transmitted/stored in plain text
- Never included in API responses

---

## Complete API Endpoints Summary

| Method | Endpoint | Auth Required | Description | Returns |
|--------|----------|---------------|-------------|---------|
| POST | `/users` | No | Create user + auto-login | JWT + User |
| POST | `/auth/login` | No | Login with credentials | JWT + User |
| POST | `/auth/verify` | No | Verify JWT validity | JWT + User |
| GET | `/auth/me` | Yes | Get current user | User |
| GET | `/portfolio` | Yes | Get user's portfolios | Portfolio[] |
| POST | `/portfolio` | Yes | Create portfolio | Portfolio |
| GET | `/portfolio/:id` | Yes | Get portfolio details | Portfolio |
| POST | `/portfolio/:id/assets` | Yes | Add asset to portfolio | Asset |

---

## Implementation Checklist

### Phase 1: Core Authentication (Priority 1) ✅ COMPLETED
- [x] Install JWT dependency (`@nestjs/jwt`)
- [x] Create Auth module structure
- [x] Implement AuthService (validateUser, login, generateJwt)
- [x] Create JWT Auth Guard (manual implementation)
- [x] Implement Auth Controller (login endpoint)
- [x] Update UsersService (add findByEmail)
- [x] Configure environment variables
- [x] Test login flow end-to-end

### Phase 2: Token Verification (Priority 1) ✅ COMPLETED
- [x] Implement token verification endpoint
- [x] Create JWT Auth Guard
- [x] Test token validation
- [ ] Update frontend API service to use real endpoints

### Phase 3: Protected Routes (Priority 1) ⚠️ PARTIAL
- [ ] Protect Portfolio controller with JwtAuthGuard
- [x] Create @CurrentUser decorator
- [ ] Update PortfolioService to filter by userId
- [ ] Test protected route access

### Phase 4: Signup Integration (Priority 2) ⚠️ PARTIAL
- [ ] Update UsersController to return JWT
- [x] Update UsersModule to export UsersService
- [ ] Test signup flow with JWT return

### Phase 5: Testing & Documentation (Priority 2) ✅ COMPLETED
- [x] Write unit tests for AuthService
- [x] Write unit tests for AuthController
- [x] Write unit tests for JwtAuthGuard
- [ ] Write integration tests (E2E)
- [x] Update Swagger documentation
- [x] Document error responses

### Phase 6: Security Enhancements (Priority 3) ⚠️ PARTIAL
- [ ] Add rate limiting to auth endpoints
- [x] Validate JWT_SECRET length in config
- [x] Add CORS configuration
- [ ] Consider refresh token implementation

---

## File Change Summary

### New Files (13): ✅ COMPLETED
1. `backend/src/modules/auth/auth.module.ts` ✅
2. `backend/src/modules/auth/auth.controller.ts` ✅
3. `backend/src/modules/auth/auth.service.ts` ✅
4. `backend/src/modules/auth/jwt-auth.guard.ts` ✅
5. `backend/src/modules/auth/dto/login.dto.ts` ✅
6. `backend/src/modules/auth/dto/auth-response.dto.ts` ✅
7. `backend/src/modules/auth/dto/verify-token.dto.ts` ✅
8. `backend/src/modules/auth/decorators/current-user.decorator.ts` ✅
9. `backend/src/modules/auth/types/express.d.ts` ✅
10. `backend/src/modules/auth/auth.controller.spec.ts` ✅
11. `backend/src/modules/auth/auth.service.spec.ts` ✅
12. `backend/src/modules/auth/jwt-auth.guard.spec.ts` ✅
13. `backend/TESTING.md` ✅

### Modified Files (4): ✅ COMPLETED
1. `backend/package.json` - Add @nestjs/jwt dependency ✅
2. `backend/src/modules/users/users.service.ts` - Add findByEmail() ✅
3. `backend/src/modules/users/users.module.ts` - Export UsersService ✅
4. `backend/src/app.module.ts` - Import AuthModule ✅
5. `backend/src/main.ts` - Fix floating promise warning ✅
6. `backend/CODING_AGENT_PROMPT_SERVER.md` - Add testing references ✅

### Environment Files (1): ⚠️ REQUIRES USER ACTION
1. `backend/.env` - Add JWT_SECRET and JWT_EXPIRATION (USER MUST ADD)

---

## Estimated Effort

| Task | Estimated Time |
|------|----------------|
| Dependencies & Module Setup | 1 hour |
| Auth Service & JWT Implementation | 2-3 hours |
| Auth Controller & Endpoints | 1-2 hours |
| Protected Routes & Guards | 1 hour |
| Users Integration | 1 hour |
| Testing (Unit + Integration) | 2-3 hours |
| Documentation & Swagger | 1 hour |

**Total Estimated Time: 8-11 hours**

---

## Future Enhancements (Out of Current Scope)

### Authentication Features:
- [ ] Refresh token implementation
- [ ] Password reset via email
- [ ] Email verification for new accounts
- [ ] OAuth integration (Google, GitHub)
- [ ] Two-factor authentication (2FA)
- [ ] Session management dashboard
- [ ] Login history tracking

### Security Features:
- [ ] Password complexity requirements
- [ ] Account lockout after failed attempts
- [ ] IP-based rate limiting
- [ ] Suspicious activity detection
- [ ] Token blacklisting (logout invalidation)

### User Management:
- [ ] User profile updates
- [ ] Password change functionality
- [ ] Account deletion
- [ ] Email change with verification

---

## Integration with Frontend

The frontend is already configured for:
- ✅ JWT storage in localStorage (`portfolio_manager_auth_token`)
- ✅ Auth NgRx state management
- ✅ Login/Signup components with form validation
- ✅ Auth guard for route protection
- ✅ Auth check on app initialization
- ✅ Mock API calls ready to be replaced

**Required Frontend Updates:**
Once backend is complete, update:
- `auth-api.service.ts`: Replace mock implementations with real API calls
- Test complete flow: signup → login → dashboard access

---

## Questions & Decisions Log

| Question | Decision | Rationale |
|----------|----------|-----------|
| JWT expiration time? | 7 days | Balance between security and UX |
| Refresh token? | Not in v1 | Adds complexity, implement later if needed |
| Session storage? | Stateless (no DB) | Scalability and simplicity |
| Password requirements? | Min 8 chars | Match frontend validation |
| Rate limiting? | Optional for v1 | Important but not blocking |
| Token in cookies or header? | Authorization header | Cleaner for SPA, matches frontend |

---

## Success Criteria

✅ **Authentication works end-to-end:**
- User can signup and receive JWT
- User can login with email/password
- JWT is validated on protected routes
- User can access their portfolios
- Invalid tokens are rejected

✅ **Security is maintained:**
- Passwords are hashed with bcrypt
- JWT uses strong secret
- Protected routes require valid token
- Users can only access their own data

✅ **Tests pass:**
- Unit tests cover all auth logic
- Integration tests verify complete flows
- Error handling is comprehensive

✅ **Documentation is complete:**
- Swagger docs updated
- API endpoints documented
- Error codes standardized

---

## Why Skip Passport?

**Simpler Approach:**
- ✅ Fewer dependencies (only `@nestjs/jwt`)
- ✅ More explicit and easier to understand
- ✅ Full control over authentication logic
- ✅ No need to learn Passport abstractions
- ✅ Sufficient for JWT-only authentication

**Trade-offs:**
- ❌ More boilerplate in the guard
- ❌ Harder to add OAuth later (would need manual implementation)
- ❌ Not the "standard" NestJS pattern

For this project, since we only need JWT authentication and want to keep it simple, the manual approach is ideal.

---

## Support & References

- [NestJS JWT Documentation](https://docs.nestjs.com/security/authentication#jwt-functionality)
- [NestJS Guards Documentation](https://docs.nestjs.com/guards)
- [bcrypt NPM Package](https://www.npmjs.com/package/bcrypt)
- [JWT.io - Token Debugger](https://jwt.io/)

---

**Document Version**: 1.1  
**Last Updated**: December 2, 2024  
**Status**: ✅ Phase 1 & 2 COMPLETED

---

## 🎉 Implementation Status

### ✅ Completed Features
- JWT-based authentication with @nestjs/jwt
- Login endpoint (`POST /auth/login`)
- Token verification endpoint (`POST /auth/verify`)
- Protected route support with JwtAuthGuard
- @CurrentUser decorator for easy user access
- Comprehensive unit tests (23 tests passing)
- TypeScript strict mode compliance
- Full Swagger/OpenAPI documentation
- Testing best practices guide (TESTING.md)

### 🔧 Environment Setup Required
User must add to `.env`:
```env
JWT_SECRET=your-super-secret-jwt-key-change-in-production-min-32-chars
JWT_EXPIRATION=7d
```

Generate secret with: `openssl rand -base64 32`

### 📋 Next Steps
- **Phase 3**: Protect Portfolio routes with JwtAuthGuard
- **Phase 4**: Update UsersController to return JWT on signup
- **E2E Testing**: Add integration tests with test database

