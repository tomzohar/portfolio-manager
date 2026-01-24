import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GeminiLlmService } from './gemini-llm.service';
import { LLMModels } from '../types/lll-models.enum';

// Mock @google/genai at module level
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: jest.fn(),
    },
  })),
}));

import { GoogleGenAI } from '@google/genai';

describe('GeminiLlmService', () => {
  let service: GeminiLlmService;
  let configService: jest.Mocked<ConfigService>;
  let mockGenerateContent: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Setup mock for generateContent
    mockGenerateContent = jest.fn();

    // Mock the GoogleGenAI class
    (GoogleGenAI as unknown as jest.Mock).mockImplementation(() => ({
      models: {
        generateContent: mockGenerateContent,
      },
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeminiLlmService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                GEMINI_API_KEY: 'test-api-key',
                GEMINI_MODEL: LLMModels.GEMINI_FLASH_LATEST,
              };
              return config[key as keyof typeof config];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<GeminiLlmService>(GeminiLlmService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateContent', () => {
    it('should successfully generate content', async () => {
      const mockResponse = {
        text: 'Generated content',
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 50,
          totalTokenCount: 150,
        },
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

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
        text: 'Generated content',
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 50,
          totalTokenCount: 150,
        },
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      await service.generateContent('Test prompt', LLMModels.GEMINI_PRO_LATEST);

      expect(mockGenerateContent).toHaveBeenCalledWith({
        model: LLMModels.GEMINI_PRO_LATEST,
        contents: 'Test prompt',
      });
    });

    it('should handle missing usage metadata gracefully', async () => {
      const mockResponse = {
        text: 'Generated content',
        usageMetadata: undefined,
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

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
        text: 'Generated content after retry',
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 50,
          totalTokenCount: 150,
        },
      };

      mockGenerateContent
        .mockRejectedValueOnce(new Error('Service temporarily unavailable'))
        .mockResolvedValueOnce(mockResponse);

      const result = await service.generateContent('Test prompt');

      expect(result.text).toBe('Generated content after retry');
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max retries', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Persistent error'));

      await expect(service.generateContent('Test prompt')).rejects.toThrow(
        'Persistent error',
      );

      // Should have tried 3 times (initial + 2 retries)
      expect(mockGenerateContent).toHaveBeenCalledTimes(3);
    });

    it('should throw error when API key is not configured', async () => {
      configService.get.mockReturnValue(undefined);

      // Create new service instance without API key
      const moduleWithoutKey: TestingModule = await Test.createTestingModule({
        providers: [
          GeminiLlmService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(undefined),
            },
          },
        ],
      }).compile();

      const serviceWithoutKey =
        moduleWithoutKey.get<GeminiLlmService>(GeminiLlmService);

      await expect(
        serviceWithoutKey.generateContent('Test prompt'),
      ).rejects.toThrow('GEMINI_API_KEY is not configured');
    });
  });

  describe('lazy client initialization', () => {
    it('should initialize client only on first use', async () => {
      const mockResponse = {
        text: 'Content',
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15,
        },
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      // Make first call
      await service.generateContent('Prompt 1');

      const callCountAfterFirst = (GoogleGenAI as unknown as jest.Mock).mock
        .calls.length;

      // Make second call
      await service.generateContent('Prompt 2');

      // Client should only be initialized once (reused)
      expect(GoogleGenAI).toHaveBeenCalledTimes(callCountAfterFirst);
    });
  });
});
