import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ImagenStrategy } from './imagen.strategy';

const mockedImagesGenerate = vi.fn().mockResolvedValue({
  data: [{ url: 'https://example.com/imagen.png', revised_prompt: 'revised by imagen' }],
});

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    images: { generate: mockedImagesGenerate },
  })),
}));

describe('ImagenStrategy', () => {
  let strategy: ImagenStrategy;

  beforeEach(() => {
    mockedImagesGenerate.mockClear();

    const mockSettingsService = {
      getApiKey: vi.fn().mockResolvedValue('test-google-key'),
      getEffectiveModel: vi.fn().mockResolvedValue('imagen-4'),
    };

    strategy = new ImagenStrategy(mockSettingsService as any);
  });

  it('should construct with settings service', () => {
    expect(strategy).toBeDefined();
  });

  it('should generate an image with default options', async () => {
    const result = await strategy.generateImage('A test image');

    expect(result.url).toBe('https://example.com/imagen.png');
    expect(result.revisedPrompt).toBe('revised by imagen');
    expect(mockedImagesGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'A test image',
      }),
    );
  });

  it('should use override model when provided', async () => {
    await strategy.generateImage('Test', { model: 'imagen-3' });
    expect(mockedImagesGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'imagen-3' }),
    );
  });

  it('should throw if no API key configured', async () => {
    const noKeySettings = {
      getApiKey: vi.fn().mockResolvedValue(null),
      getEffectiveModel: vi.fn().mockResolvedValue('imagen-4'),
    };
    const noKeyStrategy = new ImagenStrategy(noKeySettings as any);
    await expect(noKeyStrategy.generateImage('test')).rejects.toThrow(
      'Google API key not configured',
    );
  });

  it('should generate hero image for a business', async () => {
    const result = await strategy.generateHeroImage('Test Salon', 'Beauty');

    expect(result.url).toBe('https://example.com/imagen.png');
    expect(mockedImagesGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('Test Salon'),
      }),
    );
  });

  it('should generate placeholder for a category', async () => {
    const result = await strategy.generatePlaceholder('Restaurant');

    expect(result.url).toBe('https://example.com/imagen.png');
    expect(mockedImagesGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('Restaurant'),
      }),
    );
  });
});
