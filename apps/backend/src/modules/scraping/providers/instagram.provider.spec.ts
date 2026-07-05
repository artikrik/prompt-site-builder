import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InstagramProvider } from './instagram.provider';

function makeProfileResponse(overrides: Record<string, unknown> = {}): unknown {
  return {
    data: {
      user: {
        username: 'test_salon',
        full_name: 'Test Salon Kyiv',
        biography:
          'Перукарські послуги Київ ✨\nЖіноча стрижка 500₴  \nЧоловіча стрижка 300 грн\nФарбування 1200грн\nЗапис через Direct або Viber 📞',
        edge_followed_by: { count: 1250 },
        edge_follow: { count: 320 },
        edge_owner_to_timeline_media: {
          count: 45,
          edges: [
            {
              node: {
                edge_media_to_caption: {
                  edges: [{ node: { text: 'Нове фарбування! 💇‍♀️ Колір місяця — карамель 😍 Записуйтесь у Direct!' } }],
                },
                edge_liked_by: { count: 87 },
                taken_at_timestamp: 1717000000,
              },
            },
            {
              node: {
                edge_media_to_caption: {
                  edges: [{ node: { text: 'Манікюр 400₴ 💅 Оплата на картку. Працюємо щодня з 10:00' } }],
                },
                edge_liked_by: { count: 54 },
                taken_at_timestamp: 1716900000,
              },
            },
            {
              node: {
                edge_media_to_caption: { edges: [{ node: { text: 'Дякуємо нашим клієнтам! Ви найкращі ❤️' } }] },
                edge_liked_by: { count: 120 },
                taken_at_timestamp: 1716800000,
              },
            },
          ],
        },
        is_verified: false,
        profile_pic_url_hd: 'https://example.com/pic_hd.jpg',
        profile_pic_url: 'https://example.com/pic.jpg',
        ...overrides,
      },
    },
  };
}

function makeMinimalProfileResponse(): unknown {
  return {
    data: {
      user: {
        username: 'minimal_shop',
        full_name: 'Minimal Shop',
        biography: 'Сувеніри та подарунки ручної роботи',
        edge_followed_by: { count: 500 },
        edge_follow: { count: 100 },
        edge_owner_to_timeline_media: { count: 10, edges: [] },
        is_verified: false,
        profile_pic_url_hd: null,
        profile_pic_url: null,
      },
    },
  };
}

function mockFetchOk(body: unknown): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue(body),
  });
}

function mockFetchError(status: number): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
  });
}

describe('InstagramProvider', () => {
  let provider: InstagramProvider;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    provider = new InstagramProvider();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('enrichFull', () => {
    it('should return structured enrichment from valid profile', async () => {
      globalThis.fetch = mockFetchOk(makeProfileResponse());

      const result = await provider.enrichFull('test_salon');

      expect(result).not.toBeNull();
      expect(result!.sourceUrl).toBe('https://www.instagram.com/test_salon/');
      expect(result!.bio).toContain('Перукарські послуги');
      expect(result!.followers).toBe(1250);
      expect(result!.postsCount).toBe(45);
      expect(result!.logoUrl).toBe('https://example.com/pic_hd.jpg');
      expect(result!.photos).toEqual(['https://example.com/pic_hd.jpg']);
      expect(result!.videos).toEqual([]);
      expect(result!.category).toBeNull();

      expect(result!.services.length).toBeGreaterThan(0);
      expect(result!.recentPostTexts.length).toBe(3);

      expect(result!.customerJourney.bookingChannels).toContain('Direct');
      expect(result!.customerJourney.paymentMethods).toContain('оплата');
      expect(result!.customerJourney.paymentMethods).toContain('картка');
      expect(result!.customerJourney.messagingApps).toContain('Viber');

      expect(result!.toneOfVoice).not.toBeNull();
      expect(result!.toneOfVoice!.emojiUsage).toBe('moderate');
    });

    it('should return null when profile not found', async () => {
      globalThis.fetch = mockFetchError(404);

      const result = await provider.enrichFull('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when fetch throws', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await provider.enrichFull('error_user');

      expect(result).toBeNull();
    });

    it('should handle minimal profile without posts', async () => {
      globalThis.fetch = mockFetchOk(makeMinimalProfileResponse());

      const result = await provider.enrichFull('minimal_shop');

      expect(result).not.toBeNull();
      expect(result!.recentPostTexts).toEqual([]);
      expect(result!.photos).toEqual([]);
      expect(result!.logoUrl).toBeNull();
    });
  });

  describe('extractServices', () => {
    it('should parse price patterns in UAH (₴, грн, грн.)', () => {
      const text = 'Жіноча стрижка 500₴\nЧоловіча стрижка 300 грн\nФарбування 1200грн.';

      const services = (provider as any).extractServices(text);

      expect(services.length).toBeGreaterThanOrEqual(3);
      const withPrices = services.filter((s: any) => s.price);
      expect(withPrices.length).toBeGreaterThanOrEqual(3);

      const prices = withPrices.map((s: any) => s.price.toLowerCase());
      expect(prices.some((p: string) => p.includes('500'))).toBe(true);
      expect(prices.some((p: string) => p.includes('300'))).toBe(true);
      expect(prices.some((p: string) => p.includes('1200'))).toBe(true);
    });

    it('should parse USD and EUR prices', () => {
      const text = 'Консультація 50 USD\nVIP пакет 200 EUR\nБазовий 25$';

      const services = (provider as any).extractServices(text);

      const withPrices = services.filter((s: any) => s.price);
      expect(withPrices.length).toBeGreaterThanOrEqual(3);
    });

    it('should include lines without prices as services', () => {
      const text = 'Стрижка\nМанікюр\nПедикюр';

      const services = (provider as any).extractServices(text);

      expect(services.length).toBe(3);
      expect(services.map((s: any) => s.name)).toEqual(['Стрижка', 'Манікюр', 'Педикюр']);
    });

    it('should skip very short and very long lines', () => {
      const text = 'Аб\nЦе дуже довгий рядок який не повинен бути сервісом тому що він перевищує сто двадцять символів і це просто якийсь опис а не назва послуги\nНормальна послуга';

      const services = (provider as any).extractServices(text);

      const names = services.map((s: any) => s.name);
      expect(names).not.toContain('Аб');
      expect(names).toContain('Нормальна послуга');
    });
  });

  describe('detectCustomerJourney', () => {
    it('should detect booking channels', () => {
      const text = 'Запис через Direct або за дзвінком. Бронювання за телефоном.';

      const journey = (provider as any).detectCustomerJourney(text);

      expect(journey.bookingChannels).toContain('запис');
      expect(journey.bookingChannels).toContain('Direct');
      expect(journey.bookingChannels).toContain('дзвінок');
      expect(journey.bookingChannels).toContain('бронювання');
    });

    it('should detect payment methods', () => {
      const text = 'Оплата на картку. Можливий переказ. Приймаємо готівку.';

      const journey = (provider as any).detectCustomerJourney(text);

      expect(journey.paymentMethods).toContain('оплата');
      expect(journey.paymentMethods).toContain('картка');
      expect(journey.paymentMethods).toContain('переказ');
      expect(journey.paymentMethods).toContain('готівка');
    });

    it('should detect messaging apps', () => {
      const text = 'Пишіть у Viber або Telegram. Також є WhatsApp.';

      const journey = (provider as any).detectCustomerJourney(text);

      expect(journey.messagingApps).toContain('Viber');
      expect(journey.messagingApps).toContain('Telegram');
      expect(journey.messagingApps).toContain('WhatsApp');
    });

    it('should return empty arrays when no keywords found', () => {
      const text = 'Якийсь звичайний текст без ключових слів.';

      const journey = (provider as any).detectCustomerJourney(text);

      expect(journey.bookingChannels).toEqual([]);
      expect(journey.paymentMethods).toEqual([]);
      expect(journey.messagingApps).toEqual([]);
    });
  });

  describe('analyzeTone', () => {
    it('should detect emoji usage as heavy', () => {
      const bio = 'Салон краси ✨💇‍♀️💅❤️😍🔥🎉🌟🎀💄';
      const tone = (provider as any).analyzeTone(bio, bio);

      expect(tone).not.toBeNull();
      expect(tone.emojiUsage).toBe('heavy');
    });

    it('should detect no emoji usage', () => {
      const bio = 'Салон краси. Працюємо з 10:00 до 20:00.';
      const tone = (provider as any).analyzeTone(bio, bio);

      expect(tone).not.toBeNull();
      expect(tone.emojiUsage).toBe('none');
    });

    it('should detect formal tone (Ви)', () => {
      const bio = 'Запрошуємо Вас відвідати наш салон. Ви будете задоволені.';
      const tone = (provider as any).analyzeTone(bio, bio);

      expect(tone).not.toBeNull();
      expect(tone.formality).toBe('formal (Ви)');
    });

    it('should detect informal tone (ти)', () => {
      const bio = 'Приходь до нас! Ти будеш у захваті від результату.';
      const tone = (provider as any).analyzeTone(bio, bio);

      expect(tone).not.toBeNull();
      expect(tone.formality).toBe('informal (ти)');
    });

    it('should detect mixed formality', () => {
      const bio = 'Ви можете записатись. Ти точно залишишся задоволена!';
      const tone = (provider as any).analyzeTone(bio, bio);

      expect(tone).not.toBeNull();
      expect(tone.formality).toBe('mixed');
    });

    it('should return sampleBio truncated to 200 chars', () => {
      const bio = 'A'.repeat(300);
      const tone = (provider as any).analyzeTone(bio, bio);

      expect(tone).not.toBeNull();
      expect(tone.sampleBio.length).toBe(200);
    });

    it('should return null for empty text', () => {
      const tone = (provider as any).analyzeTone('', '');
      expect(tone).toBeNull();
    });
  });

  describe('extractUsernameFromUrl', () => {
    it('should extract username from Instagram URL', () => {
      expect(provider.extractUsernameFromUrl('https://www.instagram.com/testuser/')).toBe('testuser');
      expect(provider.extractUsernameFromUrl('https://instagram.com/another_user')).toBe('another_user');
      expect(provider.extractUsernameFromUrl('https://www.instagram.com/user.name/?utm=src')).toBe(
        'user.name',
      );
    });

    it('should return null for non-Instagram URLs', () => {
      expect(provider.extractUsernameFromUrl('https://facebook.com/user')).toBeNull();
      expect(provider.extractUsernameFromUrl('not-a-url')).toBeNull();
    });
  });
});
