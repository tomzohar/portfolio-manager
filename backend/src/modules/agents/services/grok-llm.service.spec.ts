import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GrokModels } from '../types/grok-models.enum';
import { GrokLlmService } from './grok-llm.service';

// Create mock instance for OpenAI
const mockCreate = jest.fn();

// Mock openai module
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
  };
});

// Import after mock
import OpenAI from 'openai';

describe('GrokLlmService', () => {
  let service: GrokLlmService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GrokLlmService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                XAI_API_KEY: 'test-api-key',
                GROK_MODEL: GrokModels.GROK_4_FAST_NON_REASONING,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<GrokLlmService>(GrokLlmService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateContent', () => {
    it('should successfully generate content', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Generated content',
            },
          },
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await service.generateContent('Test prompt');

      expect(result.text).toBe('Generated content');
      expect(result.usage).toEqual({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      });
    });

    it('should use custom model when provided', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Generated content',
            },
          },
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      };

      mockCreate.mockResolvedValue(mockResponse);

      await service.generateContent(
        'Test prompt',
        GrokModels.GROK_4_FAST_REASONING,
      );

      expect(mockCreate).toHaveBeenCalledWith({
        model: GrokModels.GROK_4_FAST_REASONING,
        messages: [{ role: 'user', content: 'Test prompt' }],
      });
    });

    it('should handle missing usage metadata gracefully', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Generated content',
            },
          },
        ],
        usage: undefined,
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await service.generateContent('Test prompt');

      expect(result.text).toBe('Generated content');
      expect(result.usage).toEqual({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      });
    });

    it('should retry on transient errors', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Generated content after retry',
            },
          },
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      };

      mockCreate
        .mockRejectedValueOnce(new Error('Service temporarily unavailable'))
        .mockResolvedValueOnce(mockResponse);

      const result = await service.generateContent('Test prompt');

      expect(result.text).toBe('Generated content after retry');
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max retries', async () => {
      mockCreate.mockRejectedValue(new Error('Persistent error'));

      await expect(service.generateContent('Test prompt')).rejects.toThrow(
        'Persistent error',
      );

      // Should have tried 3 times (initial + 2 retries)
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });

    it('should throw error when API key is not configured', async () => {
      // Create new service instance without API key
      const moduleWithoutKey: TestingModule = await Test.createTestingModule({
        providers: [
          GrokLlmService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(undefined),
            },
          },
        ],
      }).compile();

      const serviceWithoutKey =
        moduleWithoutKey.get<GrokLlmService>(GrokLlmService);

      await expect(
        serviceWithoutKey.generateContent('Test prompt'),
      ).rejects.toThrow('XAI_API_KEY is not configured');
    });

    it('should handle empty response content', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 0,
          total_tokens: 10,
        },
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await service.generateContent('Test prompt');

      expect(result.text).toBe('');
    });
  });

  describe('lazy client initialization', () => {
    it('should initialize client only on first use', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Content',
            },
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };

      mockCreate.mockResolvedValue(mockResponse);

      // Make first call
      await service.generateContent('Prompt 1');

      const callCountAfterFirst = (OpenAI as unknown as jest.Mock).mock.calls
        .length;

      // Make second call
      await service.generateContent('Prompt 2');

      // Client should only be initialized once (reused)
      expect(OpenAI).toHaveBeenCalledTimes(callCountAfterFirst);
    });
  });

  describe('getChatModel', () => {
    it('should return a ChatOpenAI instance configured for xAI', () => {
      const chatModel = service.getChatModel();

      expect(chatModel).toBeDefined();
      // The returned model should be a LangChain ChatOpenAI instance
      expect(chatModel.constructor.name).toBe('ChatOpenAI');
    });

    it('should accept custom options', () => {
      const chatModel = service.getChatModel({
        streaming: true,
        temperature: 0.5,
        model: GrokModels.GROK_4_FAST_REASONING,
      });

      expect(chatModel).toBeDefined();
    });
  });

  describe('countTokens', () => {
    it('should estimate token count based on text length', async () => {
      const text = 'This is a test prompt with some content';
      const result = await service.countTokens(text);

      // Rough estimate: ~4 characters per token
      expect(result.totalTokens).toBe(Math.ceil(text.length / 4));
      expect(result.promptTokens).toBe(0);
      expect(result.completionTokens).toBe(0);
    });
  });
});
