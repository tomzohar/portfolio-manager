# Backend Testing Guide

## Overview

This document provides testing best practices, common issues, and solutions specific to this NestJS backend project.

**Framework**: Jest  
**Test Runner**: `npm test`  
**Watch Mode**: `npm run test:watch`  
**Coverage**: `npm run test:cov`

---

## Table of Contents

1. [Test Structure](#test-structure)
2. [Unit Testing Best Practices](#unit-testing-best-practices)
3. [Common Issues & Solutions](#common-issues--solutions)
4. [Mocking Strategies](#mocking-strategies)
5. [TypeScript Strict Mode](#typescript-strict-mode)
6. [Testing Guards](#testing-guards)
7. [Testing Controllers](#testing-controllers)
8. [Testing Services](#testing-services)

---

## Test Structure

### File Organization

```
src/
├── modules/
│   └── auth/
│       ├── auth.service.ts
│       ├── auth.service.spec.ts       # Unit tests
│       ├── auth.controller.ts
│       └── auth.controller.spec.ts    # Unit tests
└── app.controller.spec.ts
```

### Naming Conventions

- **Test files**: `*.spec.ts`
- **Test suites**: `describe('ComponentName', () => {})`
- **Test cases**: `it('should do something', () => {})`

---

## Unit Testing Best Practices

### 1. Test Isolation

Each test should be independent and not rely on other tests:

```typescript
beforeEach(async () => {
  // Reset all mocks before each test
  jest.clearAllMocks();
  
  // Create fresh module for each test
  const module: TestingModule = await Test.createTestingModule({
    // ...
  }).compile();
});
```

### 2. Mock External Dependencies

Always mock services, repositories, and external libraries:

```typescript
const module: TestingModule = await Test.createTestingModule({
  providers: [
    ServiceToTest,
    {
      provide: DependencyService,
      useValue: {
        method: jest.fn(),
      },
    },
  ],
}).compile();
```

### 3. Use Descriptive Test Names

```typescript
// ✅ Good
it('should return user when credentials are valid', async () => {});

// ❌ Bad
it('test login', async () => {});
```

### 4. Arrange-Act-Assert Pattern

```typescript
it('should return auth response when credentials are valid', async () => {
  // Arrange
  const loginDto = { email: 'test@example.com', password: 'password123' };
  authService.login.mockResolvedValue(mockAuthResponse);

  // Act
  const result = await controller.login(loginDto);

  // Assert
  expect(result).toEqual(mockAuthResponse);
  expect(authService.login).toHaveBeenCalledWith(loginDto.email, loginDto.password);
});
```

---

## Common Issues & Solutions

### Issue 1: bcrypt Spy Redefinition Error

**Problem:**
```
TypeError: Cannot redefine property: compare
```

**Cause:** Using `jest.spyOn()` on bcrypt multiple times causes property redefinition errors.

**❌ Wrong Approach:**
```typescript
let bcryptCompareSpy: jest.SpyInstance;

beforeEach(() => {
  bcryptCompareSpy = jest.spyOn(bcrypt, 'compare'); // ❌ Fails on reruns
});
```

**✅ Correct Approach - Module-Level Mocking:**
```typescript
// Mock bcrypt at module level BEFORE import
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  genSalt: jest.fn(),
  hash: jest.fn(),
}));

import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks(); // Reset mock state
  });

  it('should validate password', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    // ... test code
  });
});
```

**Why This Works:**
- Module mocks are created before the module loads
- No property redefinition issues
- Each test gets fresh mock state with `clearAllMocks()`

---

### Issue 2: Guard Dependency Resolution in Controller Tests

**Problem:**
```
Nest can't resolve dependencies of the JwtAuthGuard (?, UsersService, ConfigService)
```

**Cause:** Controllers using `@UseGuards()` cause NestJS to try instantiating the guard during tests.

**✅ Solution - Override Guards:**
```typescript
import { ExecutionContext } from '@nestjs/common';

const module: TestingModule = await Test.createTestingModule({
  controllers: [AuthController],
  providers: [
    {
      provide: AuthService,
      useValue: {
        login: jest.fn(),
      },
    },
  ],
})
  .overrideGuard(JwtAuthGuard)
  .useValue({
    canActivate: (context: ExecutionContext) => {
      const request = context.switchToHttp().getRequest();
      request.user = mockUser; // Attach mock user
      return true;
    },
  })
  .compile();
```

---

### Issue 3: Jest Module Resolution Errors

**Problem:**
```
Error: Cannot find module '@jest/test-sequencer'
```

**Solutions:**

1. **Install missing dependency:**
```bash
npm install --save-dev @jest/test-sequencer
```

2. **Clean reinstall:**
```bash
rm -rf node_modules package-lock.json
npm install
```

---

### Issue 4: TypeScript Strict Mode Errors in Tests

**Problem:**
```
error: Unsafe assignment of an 'any' value
error: A method that is not declared with `this: void` may cause unintentional scoping
```

**✅ Solution - Disable Rules in Test Files:**
```typescript
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Test, TestingModule } from '@nestjs/testing';
// ... test code
```

**Why:** Jest mocks don't use `this` context, so these warnings are safe to ignore in test files.

---

## Mocking Strategies

### 1. Mocking Services

```typescript
{
  provide: UsersService,
  useValue: {
    findByEmail: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  },
}
```

### 2. Mocking TypeORM Repositories

```typescript
{
  provide: getRepositoryToken(User),
  useValue: {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  },
}
```

### 3. Mocking External Libraries (e.g., bcrypt)

```typescript
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
  genSalt: jest.fn(),
}));
```

### 4. Mocking JwtService

```typescript
{
  provide: JwtService,
  useValue: {
    sign: jest.fn(),
    verify: jest.fn(),
    verifyAsync: jest.fn(),
  },
}
```

### 5. Mocking ConfigService

```typescript
{
  provide: ConfigService,
  useValue: {
    get: jest.fn((key: string) => {
      const config = {
        JWT_SECRET: 'test-secret',
        JWT_EXPIRATION: '7d',
      };
      return config[key];
    }),
  },
}
```

---

## TypeScript Strict Mode

### Properly Type JWT Payloads

```typescript
interface JwtPayload {
  sub: string;
}

const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
  secret: this.configService.get<string>('JWT_SECRET'),
});
```

### Handle Errors Properly

```typescript
catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  this.logger.error(`Operation failed: ${errorMessage}`);
  throw new UnauthorizedException('Error message');
}
```

### Extend Express Request Type

Create `types/express.d.ts`:
```typescript
import { User } from '../users/entities/user.entity';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}
```

---

## Testing Guards

### Basic Guard Test Structure

```typescript
describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: jest.Mocked<JwtService>;
  let usersService: jest.Mocked<UsersService>;

  const mockExecutionContext = (token?: string) => {
    const mockRequest = {
      headers: {
        authorization: token ? `Bearer ${token}` : undefined,
      },
      user: undefined,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;
  };

  it('should return true and attach user when token is valid', async () => {
    const context = mockExecutionContext('valid.token');
    jwtService.verifyAsync.mockResolvedValue({ sub: 'user-id', email: 'test@example.com' });
    usersService.findOne.mockResolvedValue(mockUser);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(context.switchToHttp().getRequest().user).toEqual(mockUser);
  });
});
```

### Testing Error Handling in Guards

```typescript
it('should throw UnauthorizedException when token is invalid', async () => {
  const context = mockExecutionContext('invalid.token');
  jwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

  await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
});
```

---

## Testing Controllers

### Basic Controller Test Structure

```typescript
describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn(),
            verifyToken: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard) // Override guards if needed
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  it('should call service method with correct parameters', async () => {
    const dto = { email: 'test@example.com', password: 'password' };
    authService.login.mockResolvedValue(mockResponse);

    await controller.login(dto);

    expect(authService.login).toHaveBeenCalledWith(dto.email, dto.password);
  });
});
```

---

## Testing Services

### Service with External Dependencies

```typescript
describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
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
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
  });

  it('should validate user credentials', async () => {
    usersService.findByEmail.mockResolvedValue(mockUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await service.validateUser('test@example.com', 'password');

    expect(result).toEqual(mockUser);
  });
});
```

---

## Best Practices Checklist

- [ ] Each test is isolated and independent
- [ ] All external dependencies are mocked
- [ ] Test names clearly describe what is being tested
- [ ] Use Arrange-Act-Assert pattern
- [ ] Mock at the module level for external libraries (bcrypt, etc.)
- [ ] Override guards in controller tests
- [ ] Clear mocks between tests with `jest.clearAllMocks()`
- [ ] Properly type JWT payloads and error objects
- [ ] Disable unnecessary ESLint rules in test files
- [ ] Test both success and error cases
- [ ] Verify method calls with correct parameters

---

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Specific Test File
```bash
npm test -- auth.service.spec.ts
```

### Run Tests with Coverage
```bash
npm run test:cov
```

### View Coverage Report
```bash
open coverage/lcov-report/index.html
```

---

## Debugging Tests

### Enable Verbose Output
```bash
npm test -- --verbose
```

### Run Tests in Debug Mode
```bash
npm run test:debug
```

Then attach your debugger to the Node process.

### Check for Unhandled Promise Rejections
```bash
node --trace-warnings node_modules/.bin/jest
```

---

## Common Patterns

### Testing Async Operations
```typescript
it('should handle async operations', async () => {
  service.asyncMethod.mockResolvedValue(result);
  
  const output = await controller.someMethod();
  
  expect(output).toEqual(expectedResult);
});
```

### Testing Error Throwing
```typescript
it('should throw error when validation fails', async () => {
  service.method.mockRejectedValue(new Error('Validation failed'));
  
  await expect(controller.method()).rejects.toThrow('Validation failed');
});
```

### Testing with Multiple Mock Scenarios
```typescript
describe('validateUser', () => {
  it('should return user when valid', async () => {
    // Setup mocks for success case
  });

  it('should return null when user not found', async () => {
    // Setup mocks for not found case
  });

  it('should return null when password incorrect', async () => {
    // Setup mocks for incorrect password case
  });
});
```

---

## Resources

- [NestJS Testing Documentation](https://docs.nestjs.com/fundamentals/testing)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Jest Mock Functions](https://jestjs.io/docs/mock-functions)
- [TypeScript ESLint Rules](https://typescript-eslint.io/rules/)

---

**Last Updated:** December 2, 2024  
**Maintainer:** Development Team

