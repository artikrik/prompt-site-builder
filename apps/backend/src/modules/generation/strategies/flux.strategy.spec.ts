import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FluxStrategy } from './flux.strategy';

const mockedFetch = vi.fn();

vi.stubGlobal('fetch', mockedFetch);

describe('FluxStrategy', () => {
  let strategy: FluxStrategy;

  beforeEach(() => {
    mockedFetch.mockClear();

    const mockSettingsService = {
      getApiKey: vi.fn().mockResolvedValue('test-bfl-key'),
      getEffectiveModel: vi.fn(),
    };

    strategy = new FluxStrategy(mockSettingsService as any);
  });

  it('should construct with settings service', () => {
    expect(strategy).toBeDefined();
  });

  it('should generate an image via FAL.AI', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      statusText: 'OK',
      json: () =>
        Promise.resolve({
          images: [{ url: 'https://example.com/flux.png' }],
        }),
    });

    const result = await strategy.generateImage('A test image');

    expect(result.url).toBe('https://example.com/flux.png');
    expect(result.revisedPrompt).toBe('A test image');
    expect(mockedFetch).toHaveBeenCalledWith(
      'https://fal.run/fal-ai/flux-pro',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('should throw if FAL.AI API returns error', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Unauthorized',
    });

    await expect(strategy.generateImage('test')).rejects.toThrow(
      'Flux API error: Unauthorized',
    );
  });

  it('should throw if no API key configured', async () => {
    const noKeySettings = {
      getApiKey: vi.fn().mockResolvedValue(null),
      getEffectiveModel: vi.fn(),
    };
    const noKeyStrategy = new FluxStrategy(noKeySettings as any);
    await expect(noKeyStrategy.generateImage('test')).rejects.toThrow(
      'BFL API key not configured',
    );
  });

  it('should generate hero image for a business', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      statusText: 'OK',
      json: () =>
        Promise.resolve({
          images: [{ url: 'https://example.com/flux-hero.png' }],
        }),
    });

    const result = await strategy.generateHeroImage('Test Salon', 'Beauty');

    expect(result.url).toBe('https://example.com/flux-hero.png');
    expect(mockedFetch).toHaveBeenCalledWith(
      'https://fal.run/fal-ai/flux-pro',
      expect.objectContaining({
        body: expect.stringContaining('Test Salon'),
      }),
    );
  });

  it('should generate placeholder for a category', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      statusText: 'OK',
      json: () =>
        Promise.resolve({
          images: [{ url: 'https://example.com/flux-placeholder.png' }],
        }),
    });

    const result = await strategy.generatePlaceholder('Restaurant');

    expect(result.url).toBe('https://example.com/flux-placeholder.png');
  });
});
