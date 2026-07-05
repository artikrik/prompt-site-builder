import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GeminiStrategy } from './gemini.strategy';

const mockedChatCreate = vi.fn().mockResolvedValue({
  choices: [{ message: { content: 'Generated content' } }],
  usage: { prompt_tokens: 100, completion_tokens: 50 },
  model: 'gemini-2.5-pro',
});

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockedChatCreate } },
  })),
}));

describe('GeminiStrategy', () => {
  let strategy: GeminiStrategy;

  beforeEach(() => {
    mockedChatCreate.mockClear();

    const mockSettingsService = {
      getApiKey: vi.fn().mockResolvedValue('test-gemini-key'),
      getEffectiveModel: vi.fn().mockResolvedValue('gemini-2.5-pro'),
    };

    strategy = new GeminiStrategy(mockSettingsService as any);
  });

  it('should construct with settings service', () => {
    expect(strategy).toBeDefined();
  });

  it('should generate content via Gemini API', async () => {
    const result = await strategy.generateContent('Test prompt');
    expect(result.content).toBe('Generated content');
    expect(result.tokensUsed).toBe(150);
  });

  it('should use override model when provided', async () => {
    await strategy.generateContent('Test', { model: 'gemini-2.5-flash' });
    expect(mockedChatCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-2.5-flash' }),
    );
  });

  it('should throw if no API key configured', async () => {
    const noKeySettings = {
      getApiKey: vi.fn().mockResolvedValue(null),
      getEffectiveModel: vi.fn().mockResolvedValue('gemini-2.5-pro'),
    };
    const noKeyStrategy = new GeminiStrategy(noKeySettings as any);
    await expect(noKeyStrategy.generateContent('test')).rejects.toThrow(
      'Google API key not configured',
    );
  });

  it('should generate Hugo structure from business data', async () => {
    mockedChatCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              hugoToml: 'baseURL = "/"',
              indexMd: '# Home',
              aboutMd: '# About',
              servicesMd: '# Services',
              contactMd: '# Contact',
              heroImagePrompt: 'A hero image',
              seoTitle: 'Test Biz',
              seoDescription: 'Best biz',
            }),
          },
        },
      ],
      usage: { prompt_tokens: 200, completion_tokens: 300 },
      model: 'gemini-2.5-pro',
    });

    const result = await strategy.generateHugoStructure({
      businessName: 'Test Biz',
      category: 'Retail',
      description: 'Best biz',
      address: null,
      phone: null,
      email: null,
      socialUrl: null,
    });

    expect(result.hugoToml).toBe('baseURL = "/"');
    expect(result.indexMd).toBe('# Home');
    expect(result.seoTitle).toBe('Test Biz');
  });
});
