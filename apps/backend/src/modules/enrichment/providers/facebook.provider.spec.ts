import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FacebookProvider } from './facebook.provider';

function makePageResponse(overrides: Record<string, unknown> = {}): unknown {
  return {
    id: '123456789',
    name: 'Test Salon Kyiv',
    about: 'Professional beauty salon in Kyiv center',
    description: 'We offer hair, nails, and makeup services since 2015.',
    category: 'Beauty Salon',
    phone: '+380441234567',
    emails: ['info@testsalon.ua'],
    website: 'https://testsalon.ua',
    location: { city: 'Kyiv', street: 'Khreshchatyk 1', zip: '01001' },
    cover: { source: 'https://example.com/cover.jpg' },
    rating_count: 42,
    overall_star_rating: 4.5,
    hours: {
      mon_1_open: '09:00',
      mon_1_close: '20:00',
      tue_1_open: '09:00',
      tue_1_close: '20:00',
      wed_1_open: '09:00',
      wed_1_close: '20:00',
      thu_1_open: '09:00',
      thu_1_close: '20:00',
      fri_1_open: '09:00',
      fri_1_close: '19:00',
      sat_1_open: '10:00',
      sat_1_close: '18:00',
    },
    ...overrides,
  };
}

function makePostsResponse(overrides: unknown[] = []): unknown {
  const base = [
    {
      message: 'Жіноча стрижка 500₴\nЧоловіча стрижка 300 грн\nФарбування 1200грн.',
      created_time: '2026-06-01T10:00:00Z',
    },
    {
      message: 'Манікюр 400₴ 💅\nПедикюр 350 грн\nПрацюємо щодня!',
      created_time: '2026-06-02T10:00:00Z',
    },
    {
      message: 'Дякуємо нашим клієнтам за довіру! ❤️',
      created_time: '2026-05-28T10:00:00Z',
    },
    ...overrides,
  ];
  return { data: base };
}

function makeRatingsResponse(overrides: unknown[] = []): unknown {
  const base = [
    {
      reviewer: { name: 'Anna K.' },
      review_text: 'Найкращий салон у Києві! Дуже задоволена стрижкою та фарбуванням.',
      rating: 5,
      created_time: '2026-06-15T14:30:00Z',
    },
    {
      reviewer: { name: 'Ivan P.' },
      review_text: 'Хороший сервіс, приємні ціни. Рекомендую!',
      rating: 4,
      created_time: '2026-06-10T11:00:00Z',
    },
    {
      reviewer: { name: 'Olena S.' },
      review_text: 'Манікюр зробили чудово, але чекала довше ніж обіцяли.',
      rating: 3,
      created_time: '2026-06-05T16:00:00Z',
    },
    ...overrides,
  ];
  return { data: base };
}

function makeSearchResponse(overrides: Array<{ id: string }> = []): unknown {
  const base = overrides.length > 0 ? overrides : [{ id: '123456789' }];
  return { data: base };
}

function mockFetchOk(body: unknown): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue(body),
  });
}

function mockFetchSequence(
  responses: Array<{ ok: boolean; body: unknown; status?: number }>,
): ReturnType<typeof vi.fn> {
  const fn = vi.fn();
  for (const r of responses) {
    fn.mockResolvedValueOnce({
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 500),
      json: vi.fn().mockResolvedValue(r.body),
    });
  }
  return fn;
}

describe('FacebookProvider', () => {
  let provider: FacebookProvider;
  const originalEnv = process.env;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv, FACEBOOK_ACCESS_TOKEN: 'test-token-123' };
    provider = new FacebookProvider();
  });

  afterEach(() => {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  });

  describe('enrich', () => {
    it('should return structured data from valid Facebook page', async () => {
      globalThis.fetch = mockFetchSequence([
        { ok: true, body: makeSearchResponse() },
        { ok: true, body: makePageResponse() },
        { ok: true, body: makePostsResponse() },
        { ok: true, body: makeRatingsResponse() },
      ]);

      const result = await provider.enrich('Test Salon', 'Kyiv');

      expect(result.services).toBeDefined();
      expect(result.services!.length).toBeGreaterThan(0);
      expect(result.reviews).toBeDefined();
      expect(result.reviews!.length).toBe(3);
      expect(result.workingHours).toBeDefined();
      expect(result.workingHours!.length).toBe(6);
      expect(result.coverPhotoUrl).toBe('https://example.com/cover.jpg');
      expect(result.sourceUrls).toEqual({ facebook: 'https://www.facebook.com/123456789' });
      expect(result.stats).toEqual({ facebookReviews: 42 });
    });

    it('should return empty object when no FACEBOOK_ACCESS_TOKEN', async () => {
      delete process.env.FACEBOOK_ACCESS_TOKEN;
      provider = new FacebookProvider();
      globalThis.fetch = vi.fn();

      const result = await provider.enrich('Test Salon', 'Kyiv');

      expect(result).toEqual({});
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('should return empty object on API error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await provider.enrich('Test Salon', 'Kyiv');

      expect(result).toEqual({});
    });

    it('should return empty object when page search fails', async () => {
      globalThis.fetch = mockFetchOk({ data: [] });

      const result = await provider.enrich('Nonexistent', 'Nowhere');

      expect(result).toEqual({});
    });

    it('should use url to find page when provided', async () => {
      globalThis.fetch = mockFetchSequence([
        { ok: true, body: makePageResponse() },
        { ok: true, body: makePostsResponse() },
        { ok: true, body: makeRatingsResponse() },
      ]);

      const result = await provider.enrich(
        'Test Salon',
        undefined,
        'https://www.facebook.com/123456789',
      );

      expect(result.coverPhotoUrl).toBe('https://example.com/cover.jpg');
      expect(result.reviews!.length).toBe(3);
    });
  });

  describe('extractServices', () => {
    it('should extract services with prices from posts', () => {
      const posts = [
        {
          message: 'Жіноча стрижка 500₴\nЧоловіча стрижка 300 грн\nФарбування 1200грн.',
          created_time: '2026-01-01T00:00:00Z',
        },
      ];

      const services = (provider as any).extractServices(posts);

      expect(services.length).toBeGreaterThanOrEqual(3);
      const withPrices = services.filter((s: any) => s.price);
      expect(withPrices.length).toBeGreaterThanOrEqual(3);

      const prices = withPrices.map((s: any) => s.price.toLowerCase());
      expect(prices.some((p: string) => p.includes('500'))).toBe(true);
      expect(prices.some((p: string) => p.includes('300'))).toBe(true);
      expect(prices.some((p: string) => p.includes('1200'))).toBe(true);
    });

    it('should parse USD and EUR prices', () => {
      const posts = [
        {
          message: 'Консультація 50 USD\nVIP пакет 200 EUR\nБазовий 25$',
          created_time: '2026-01-01T00:00:00Z',
        },
      ];

      const services = (provider as any).extractServices(posts);
      const withPrices = services.filter((s: any) => s.price);

      expect(withPrices.length).toBeGreaterThanOrEqual(3);
    });

    it('should skip very short and very long lines', () => {
      const posts = [
        {
          message:
            'Аб\nЦе дуже довгий рядок який не повинен бути сервісом тому що він перевищує сто двадцять символів і це просто якийсь опис а не назва послуги\nНормальна послуга',
          created_time: '2026-01-01T00:00:00Z',
        },
      ];

      const services = (provider as any).extractServices(posts);
      const names = services.map((s: any) => s.name);

      expect(names).not.toContain('Аб');
      expect(names).toContain('Нормальна послуга');
    });

    it('should return empty array for posts without messages', () => {
      const posts = [{ created_time: '2026-01-01T00:00:00Z' }];

      const services = (provider as any).extractServices(posts);

      expect(services).toEqual([]);
    });

    it('should deduplicate services by name', () => {
      const posts = [
        {
          message: 'Стрижка 500₴\nСтрижка 500₴\nМанікюр 400₴',
          created_time: '2026-01-01T00:00:00Z',
        },
      ];

      const services = (provider as any).extractServices(posts);

      const names = services.map((s: any) => s.name);
      expect(names.filter((n: string) => n === 'Стрижка').length).toBe(1);
    });
  });

  describe('mapRatings', () => {
    it('should map Facebook ratings to EnrichmentReview[]', () => {
      const ratings = [
        {
          reviewer: { name: 'Anna K.' },
          review_text: 'Чудовий сервіс!',
          rating: 5,
          created_time: '2026-06-01T00:00:00Z',
        },
        {
          reviewer: { name: 'Ivan P.' },
          review_text: 'Нормально',
          rating: 3,
          created_time: '2026-06-02T00:00:00Z',
        },
      ];

      const reviews = (provider as any).mapRatings(ratings);

      expect(reviews).toHaveLength(2);
      expect(reviews[0]).toEqual({
        author: 'Anna K.',
        text: 'Чудовий сервіс!',
        rating: 5,
      });
      expect(reviews[1]).toEqual({
        author: 'Ivan P.',
        text: 'Нормально',
        rating: 3,
      });
    });

    it('should use "Anonymous" when reviewer name is missing', () => {
      const ratings = [
        {
          review_text: 'Все добре',
          rating: 4,
        },
      ];

      const reviews = (provider as any).mapRatings(ratings);

      expect(reviews[0].author).toBe('Anonymous');
    });

    it('should filter out ratings without text or reviewer name', () => {
      const ratings = [
        { rating: 5 },
        { reviewer: { name: 'Test' }, review_text: 'OK', rating: 4 },
      ];

      const reviews = (provider as any).mapRatings(ratings);

      expect(reviews).toHaveLength(1);
      expect(reviews[0].author).toBe('Test');
    });
  });

  describe('mapHours', () => {
    it('should map Facebook hours object to EnrichmentWorkingHours[]', () => {
      const hours = {
        mon_1_open: '09:00',
        mon_1_close: '20:00',
        tue_1_open: '09:00',
        tue_1_close: '20:00',
        wed_1_open: '09:00',
        wed_1_close: '20:00',
      };

      const result = (provider as any).mapHours(hours);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ day: 'Monday', open: '09:00', close: '20:00' });
      expect(result[1]).toEqual({ day: 'Tuesday', open: '09:00', close: '20:00' });
      expect(result[2]).toEqual({ day: 'Wednesday', open: '09:00', close: '20:00' });
    });

    it('should skip days without both open and close time', () => {
      const hours = {
        mon_1_open: '09:00',
        mon_1_close: '20:00',
        tue_1_open: '09:00',
      };

      const result = (provider as any).mapHours(hours);

      expect(result).toHaveLength(1);
      expect(result[0].day).toBe('Monday');
    });

    it('should return empty array for undefined hours', () => {
      const result = (provider as any).mapHours(undefined);

      expect(result).toEqual([]);
    });
  });
});
