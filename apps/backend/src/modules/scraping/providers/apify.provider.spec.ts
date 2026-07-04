import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApifyProvider } from './apify.provider';

describe('ApifyProvider', () => {
  let provider: ApifyProvider;
  let configService: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    configService = { get: vi.fn().mockReturnValue('test-token') };
    provider = new ApifyProvider(configService as any);
  });

  describe('scrapeGoogleMaps', () => {
    it('should return mock results when API fails', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await provider.scrapeGoogleMaps({
        city: 'Київ',
        category: 'салон краси',
        limit: 3,
      });

      expect(result).toHaveLength(3);
      expect(result[0].businessName).toContain('Київ');
      expect(result[0].city).toBe('Київ');
      expect(result[0].category).toBe('салон краси');
    });

    it('should filter businesses without websites in mock', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('API error'));

      const result = await provider.scrapeGoogleMaps({
        city: 'Львів',
        category: 'ресторан',
        limit: 5,
      });

      result.forEach((business) => {
        expect(business.website).toBeNull();
      });
    });
  });
});
