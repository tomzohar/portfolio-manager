import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StateService } from './state.service';

describe('StateService', () => {
  let service: StateService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StateService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                DB_HOST: 'localhost',
                DB_PORT: 5432,
                DB_USERNAME: 'test',
                DB_PASSWORD: 'test',
                DB_DATABASE: 'test_db',
              };
              return config[key as keyof typeof config];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<StateService>(StateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSaver', () => {
    it.skip('should return a checkpointer instance', () => {
      // Skip: PostgresSaver requires valid DB connection which isn't available in unit tests
      // This is tested in E2E tests instead
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const saver = service.getSaver();
      expect(saver).toBeDefined();
      expect(typeof saver).toBe('object');
    });

    it.skip('should reuse the same saver instance (singleton)', () => {
      // Skip: PostgresSaver requires valid DB connection
      // This behavior is verified in E2E tests
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const saver1 = service.getSaver();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const saver2 = service.getSaver();
      expect(saver1).toBe(saver2);
    });
  });

  describe('scopeThreadId', () => {
    it('should scope threadId with userId', () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const threadId = 'thread-abc';

      const scoped = service.scopeThreadId(userId, threadId);

      expect(scoped).toBe(`${userId}:${threadId}`);
    });

    it('should handle undefined threadId', () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      const scoped = service.scopeThreadId(userId);

      expect(scoped).toContain(userId);
      expect(scoped).toMatch(/^[a-f0-9-]+:[a-f0-9-]+$/); // uuid:uuid pattern
    });

    it('should generate unique threadIds when undefined', () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      const scoped1 = service.scopeThreadId(userId);
      const scoped2 = service.scopeThreadId(userId);

      expect(scoped1).not.toBe(scoped2);
    });
  });

  describe('extractUserId', () => {
    it('should extract userId from scoped threadId', () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const scopedThreadId = `${userId}:thread-abc`;

      const extracted = service.extractUserId(scopedThreadId);

      expect(extracted).toBe(userId);
    });

    it('should return null for invalid format', () => {
      const invalidThreadId = 'just-a-thread-id';

      const extracted = service.extractUserId(invalidThreadId);

      expect(extracted).toBeNull();
    });
  });
});
