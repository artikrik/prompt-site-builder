import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GoogleMapsProvider } from './google-maps.provider';

function makeFindPlaceResponse(placeId = 'ChIJtest123'): unknown {
  return {
    candidates: [{ place_id: placeId }],
    status: 'OK',
  };
}

function makeDetailsResponse(overrides: Record<string, unknown> = {}): unknown {
  return {
    result: {
      photos: [
        { photo_reference: 'photo-ref-1' },
        { photo_reference: 'photo-ref-2' },
      ],
      reviews: [
        {
          author_name: 'Olena K.',
          text: 'Чудовий салон! Дуже задоволена сервісом.',
          rating: 5,
        },
        {
          author_name: 'Ivan P.',
          text: 'Гарне місце, приємні ціни.',
          rating: 4,
        },
        {
          author_name: 'Maria S.',
          text: 'Манікюр зробили добре, але довелося чекати.',
          rating: 3,
        },
      ],
      rating: 4.5,
      user_ratings_total: 128,
      opening_hours: {
        weekday_text: [
          'Monday: 9:00 AM – 8:00 PM',
          'Tuesday: 9:00 AM – 8:00 PM',
          'Wednesday: 9:00 AM – 8:00 PM',
          'Thursday: 9:00 AM – 8:00 PM',
          'Friday: 9:00 AM – 7:00 PM',
          'Saturday: 10:00 AM – 6:00 PM',
        ],
      },
      website: 'https://testsalon.ua',
      formatted_phone_number: '+380441234567',
      formatted_address: 'Khreshchatyk 1, Kyiv, Ukraine',
      types: ['beauty_salon', 'hair_care', 'point_of_interest', 'establishment'],
      geometry: {
        location: { lat: 50.4501, lng: 30.5234 },
      },
      ...overrides,
    },
    status: 'OK',
  };
}

function makeNearbyResponse(overrides: unknown[] = []): unknown {
  const base = [
    {
      name: 'Competitor Salon 1',
      place_id: 'ChIJcomp1',
      rating: 4.2,
      user_ratings_total: 85,
      vicinity: 'Vul. Khreshchatyk 15',
      types: ['beauty_salon'],
    },
    {
      name: 'Competitor Salon 2',
      place_id: 'ChIJcomp2',
      rating: 3.8,
      user_ratings_total: 42,
      vicinity: 'Vul. Khreshchatyk 25',
      types: ['hair_care'],
    },
    ...overrides,
  ];
  return { results: base, status: 'OK' };
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

describe('GoogleMapsProvider', () => {
  let provider: GoogleMapsProvider;
  const originalEnv = process.env;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv, GOOGLE_MAPS_API_KEY: 'test-api-key-123' };
    provider = new GoogleMapsProvider({ get: (key: string) => process.env[key] || '' } as any);
  });

  afterEach(() => {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  });

  describe('enrich', () => {
    it('should return structured data from valid Google Maps place', async () => {
      globalThis.fetch = mockFetchSequence([
        { ok: true, body: makeFindPlaceResponse() },
        { ok: true, body: makeDetailsResponse() },
        { ok: true, body: makeNearbyResponse() },
      ]);

      const result = await provider.enrich('Test Salon', 'Kyiv');

      expect(result.photos).toBeDefined();
      expect(result.photos!.length).toBe(2);
      expect(result.photos![0]).toContain('maxwidth=1600');
      expect(result.photos![0]).toContain('photoreference=photo-ref-1');
      expect(result.photos![0]).toContain('key=test-api-key-123');
      expect(result.reviews).toBeDefined();
      expect(result.reviews!.length).toBe(3);
      expect(result.workingHours).toBeDefined();
      expect(result.workingHours!.length).toBe(6);
      expect(result.coverPhotoUrl).toBe(result.photos![0]);
      expect(result.sourceUrls).toEqual({
        googleMaps: 'https://www.google.com/maps/place/?q=place_id:ChIJtest123',
      });
      expect(result.stats).toEqual({
        googleRating: 4.5,
        googleReviewCount: 128,
      });
      expect(result.competitors).toBeDefined();
      expect(result.competitors!.length).toBe(2);
    });

    it('should return empty object when no GOOGLE_MAPS_API_KEY', async () => {
      delete process.env.GOOGLE_MAPS_API_KEY;
      provider = new GoogleMapsProvider({ get: (key: string) => process.env[key] || '' } as any);
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

    it('should return empty object when findplace returns no candidates', async () => {
      globalThis.fetch = mockFetchSequence([
        { ok: true, body: { candidates: [], status: 'ZERO_RESULTS' } },
      ]);

      const result = await provider.enrich('Nonexistent', 'Nowhere');

      expect(result).toEqual({});
    });

    it('should return empty object when place details fail', async () => {
      globalThis.fetch = mockFetchSequence([
        { ok: true, body: makeFindPlaceResponse() },
        { ok: true, body: { result: {}, status: 'NOT_FOUND' } },
      ]);

      const result = await provider.enrich('Test Salon', 'Kyiv');

      expect(result).toEqual({});
    });

    it('should return empty competitors when nearbysearch fails', async () => {
      globalThis.fetch = mockFetchSequence([
        { ok: true, body: makeFindPlaceResponse() },
        { ok: true, body: makeDetailsResponse() },
        { ok: false, body: {}, status: 500 },
      ]);

      const result = await provider.enrich('Test Salon', 'Kyiv');

      expect(result.competitors).toEqual([]);
      expect(result.reviews).toBeDefined();
      expect(result.photos).toBeDefined();
    });
  });

  describe('buildPhotoUrls', () => {
    it('should construct photo URLs with maxwidth, photoreference, and api key', () => {
      const photos = [
        { photo_reference: 'ref-abc' },
        { photo_reference: 'ref-xyz' },
      ];

      const urls = (provider as any).buildPhotoUrls(photos);

      expect(urls).toHaveLength(2);
      expect(urls[0]).toBe(
        'https://maps.googleapis.com/maps/api/place/photo?maxwidth=1600&photoreference=ref-abc&key=test-api-key-123',
      );
      expect(urls[1]).toBe(
        'https://maps.googleapis.com/maps/api/place/photo?maxwidth=1600&photoreference=ref-xyz&key=test-api-key-123',
      );
    });

    it('should return empty array for undefined photos', () => {
      const urls = (provider as any).buildPhotoUrls(undefined);

      expect(urls).toEqual([]);
    });

    it('should return empty array for empty photos array', () => {
      const urls = (provider as any).buildPhotoUrls([]);

      expect(urls).toEqual([]);
    });
  });

  describe('mapReviews', () => {
    it('should map Google reviews to EnrichmentReview[]', () => {
      const reviews = [
        { author_name: 'Anna', text: 'Great!', rating: 5 },
        { author_name: 'Ivan', text: 'Good.', rating: 4 },
      ];

      const result = (provider as any).mapReviews(reviews);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ author: 'Anna', text: 'Great!', rating: 5 });
      expect(result[1]).toEqual({ author: 'Ivan', text: 'Good.', rating: 4 });
    });

    it('should use "Anonymous" when author_name is missing', () => {
      const reviews = [
        { text: 'No author', rating: 3 } as any,
      ];

      const result = (provider as any).mapReviews(reviews);

      expect(result[0].author).toBe('Anonymous');
    });

    it('should filter out reviews without text or author_name', () => {
      const reviews = [
        { author_name: '', text: '', rating: 4 },
        { author_name: 'Test', text: 'OK', rating: 4 },
      ];

      const result = (provider as any).mapReviews(reviews);

      expect(result).toHaveLength(1);
      expect(result[0].author).toBe('Test');
    });

    it('should return empty array for undefined reviews', () => {
      const result = (provider as any).mapReviews(undefined);

      expect(result).toEqual([]);
    });
  });

  describe('mapHours', () => {
    it('should parse weekday_text into EnrichmentWorkingHours[]', () => {
      const hours = {
        weekday_text: [
          'Monday: 9:00 AM – 8:00 PM',
          'Tuesday: 9:00 AM – 8:00 PM',
          'Wednesday: 9:00 AM – 8:00 PM',
        ],
      };

      const result = (provider as any).mapHours(hours);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ day: 'Monday', open: '9:00 AM', close: '8:00 PM' });
      expect(result[1]).toEqual({ day: 'Tuesday', open: '9:00 AM', close: '8:00 PM' });
      expect(result[2]).toEqual({ day: 'Wednesday', open: '9:00 AM', close: '8:00 PM' });
    });

    it('should skip malformed lines without proper separator', () => {
      const hours = {
        weekday_text: [
          'Monday: 9:00 AM – 8:00 PM',
          'Tuesday 9 AM - 8 PM',
          'Wednesday: 9:00 AM – 8:00 PM',
        ],
      };

      const result = (provider as any).mapHours(hours);

      expect(result).toHaveLength(2);
      expect(result[0].day).toBe('Monday');
      expect(result[1].day).toBe('Wednesday');
    });

    it('should return empty array for undefined hours', () => {
      const result = (provider as any).mapHours(undefined);

      expect(result).toEqual([]);
    });

    it('should return empty array for hours without weekday_text', () => {
      const result = (provider as any).mapHours({});

      expect(result).toEqual([]);
    });
  });

  describe('mapCompetitor', () => {
    it('should map nearby result to CompetitorInfo', () => {
      const nearby = {
        name: 'Test Competitor',
        place_id: 'ChIJcomp1',
        rating: 4.2,
        user_ratings_total: 85,
        vicinity: 'Vul. Khreshchatyk 15',
        types: ['beauty_salon'],
      };

      const result = (provider as any).mapCompetitor(nearby);

      expect(result).toEqual({
        name: 'Test Competitor',
        googleMapsUrl: 'https://www.google.com/maps/place/?q=place_id:ChIJcomp1',
        rating: 4.2,
        reviewCount: 85,
        distance: 'Vul. Khreshchatyk 15',
        services: [],
        positioning: '',
        uniqueSellingPoints: [],
      });
    });

    it('should default rating and reviewCount to 0 when missing', () => {
      const nearby = {
        name: 'No Rating Competitor',
        place_id: 'ChIJnoRating',
      };

      const result = (provider as any).mapCompetitor(nearby);

      expect(result.rating).toBe(0);
      expect(result.reviewCount).toBe(0);
    });
  });
});
