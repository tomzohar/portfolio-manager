import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GrokModels } from '../types/grok-models.enum';
import { GrokLlmService } from './grok-llm.service';

// Mock AI SDK
const mockGenerateText = jest.fn();
jest.mock('ai', () => ({
    generateText: (args: unknown) => mockGenerateText(args) as Promise<unknown>,
}));

const mockXaiModel = jest.fn();
const mockXaiResponses = jest.fn();
const mockXaiSearch = jest.fn();
const mockWebSearch = jest.fn();

jest.mock('@ai-sdk/xai', () => ({
    createXai: jest.fn().mockImplementation(() => {
        const provider = (modelId: string) => mockXaiModel(modelId) as unknown;
        return Object.assign(provider, {
            responses: mockXaiResponses,
            tools: {
                xSearch: mockXaiSearch,
                webSearch: mockWebSearch,
            },
        });
    }),
}));

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
            mockGenerateText.mockResolvedValue({
                text: 'Generated content',
                usage: {
                    promptTokens: 100,
                    completionTokens: 50,
                    totalTokens: 150,
                },
            });

            const result = await service.generateContent('Test prompt');

            expect(result.text).toBe('Generated content');
            expect(result.usage).toEqual({
                promptTokens: 100,
                completionTokens: 50,
                totalTokens: 150,
            });
            expect(mockGenerateText).toHaveBeenCalled();
        });

        it('should retry on transient errors', async () => {
            mockGenerateText
                .mockRejectedValueOnce(new Error('Transient error'))
                .mockResolvedValueOnce({
                    text: 'Success after retry',
                    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                });

            const result = await service.generateContent('Test prompt');

            expect(result.text).toBe('Success after retry');
            expect(mockGenerateText).toHaveBeenCalledTimes(2);
        });

        it('should throw error after max retries', async () => {
            mockGenerateText.mockRejectedValue(new Error('Persistent error'));

            await expect(service.generateContent('Test prompt')).rejects.toThrow(
                'Persistent error',
            );
            expect(mockGenerateText).toHaveBeenCalledTimes(3);
        });
    });

    describe('generateWithXSearch', () => {
        it('should call x_search tool', async () => {
            mockGenerateText.mockResolvedValue({
                text: 'X content',
                sources: [{ url: 'https://x.com/post/1' }],
                usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
            });

            const result = await service.generateWithXSearch('Search X', {
                fromDate: '2026-01-01',
            });

            expect(result.text).toBe('X content');
            expect(result.sources).toContain('https://x.com/post/1');
            expect(mockGenerateText).toHaveBeenCalledWith(
                expect.objectContaining({
                    tools: expect.objectContaining({
                        x_search: undefined, // because mockXaiSearch returned undefined in this setup
                    }),
                }),
            );
        });
    });

    describe('generateWithWebSearch', () => {
        it('should call web_search tool', async () => {
            mockGenerateText.mockResolvedValue({
                text: 'Web content',
                sources: [{ url: 'https://example.com' }],
                usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
            });

            const result = await service.generateWithWebSearch('Search Web');

            expect(result.text).toBe('Web content');
            expect(result.sources).toContain('https://example.com');
        });
    });

    describe('countTokens', () => {
        it('should estimate token count', async () => {
            const text = 'Hello world';
            const result = await service.countTokens(text);
            expect(result.totalTokens).toBe(Math.ceil(text.length / 4));
        });
    });
});
