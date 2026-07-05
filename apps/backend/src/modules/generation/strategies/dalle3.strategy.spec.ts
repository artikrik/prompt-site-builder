import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DallE3Strategy } from './dalle3.strategy';

// Capture the mocked generate function from global setup
const mockedImagesGenerate = vi.fn().mockResolvedValue({
  data: [{ url: 'https://example.com/image.png', revised_prompt: 'revised prompt' }],
});

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    images: { generate: mockedImagesGenerate },
  })),
}));

describe('DallE3Strategy', () => {
  let strategy: DallE3Strategy;

  beforeEach(() => {
    mockedImagesGenerate.mockClear();

    const mockSettingsService = {
      getApiKey: vi.fn().mockResolvedValue('sk-test-key'),
      getEffectiveModel: vi.fn().mockResolvedValue('dall-e-3'),
    };

    strategy = new DallE3Strategy(mockSettingsService as any);
  });

  it('should generate an image with default options', async () => {
    const result = await strategy.generateImage('A professional business logo');

    expect(result.url).toBe('https://example.com/image.png');
    expect(result.revisedPrompt).toBe('revised prompt');
    expect(mockedImagesGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'dall-e-3',
        prompt: 'A professional business logo',
      }),
    );
  });

  it('should generate hero image for a business', async () => {
    const result = await strategy.generateHeroImage('Test Salon', 'Beauty');

    expect(result.url).toBe('https://example.com/image.png');
    expect(mockedImagesGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'dall-e-3',
        size: '1792x1024',
        quality: 'hd',
        style: 'natural',
      }),
    );
  });

  it('should generate placeholder for a category', async () => {
    const result = await strategy.generatePlaceholder('Restaurant');

    expect(result.url).toBe('https://example.com/image.png');
  });
});
