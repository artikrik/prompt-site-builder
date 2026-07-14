import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScrapingService } from './scraping.service';
import { ApifyProvider } from './providers/apify.provider';
import { InstagramProvider } from './providers/instagram.provider';
import { GoogleMapsScraperProvider } from './providers/google-maps-scraper.provider';
import { LeadsService } from '../leads/leads.service';

describe('ScrapingService', () => {
  let service: ScrapingService;
  let apifyProvider: { scrapeGoogleMaps: ReturnType<typeof vi.fn> };
  let instagramProvider: {
    extractUsernameFromUrl: ReturnType<typeof vi.fn>;
    enrichFromProfile: ReturnType<typeof vi.fn>;
  };
  let googleMapsScraper: { scrapeBusinesses: ReturnType<typeof vi.fn> };
  let leadsService: {
    create: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findAll: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    apifyProvider = {
      scrapeGoogleMaps: vi.fn(),
    };
    instagramProvider = {
      extractUsernameFromUrl: vi.fn(),
      enrichFromProfile: vi.fn(),
    };
    googleMapsScraper = {
      scrapeBusinesses: vi.fn(),
    };
    leadsService = {
      create: vi.fn(),
      findOne: vi.fn(),
      update: vi.fn(),
      findAll: vi.fn().mockResolvedValue([]),
    };

    service = new ScrapingService(
      apifyProvider as unknown as ApifyProvider,
      instagramProvider as unknown as InstagramProvider,
      googleMapsScraper as unknown as GoogleMapsScraperProvider,
      leadsService as unknown as LeadsService,
    );
  });

  describe('scrapeAndCreateLeads', () => {
    it('should scrape businesses and create leads for those without websites', async () => {
      googleMapsScraper.scrapeBusinesses.mockResolvedValue([]);
      apifyProvider.scrapeGoogleMaps.mockResolvedValue([
        { businessName: 'Biz A', website: null, phone: '+123', address: 'Addr A', city: 'Kyiv', category: 'Salon', placeId: 'p1', rating: 4.5, reviewCount: 10 },
        { businessName: 'Biz B', website: 'https://bizb.com', phone: '+456', address: 'Addr B', city: 'Kyiv', category: 'Salon', placeId: 'p2', rating: 4.0, reviewCount: 20 },
      ]);
      leadsService.create.mockResolvedValue({ id: 'lead-1' });

      const result = await service.scrapeAndCreateLeads({
        city: 'Kyiv',
        category: 'Salon',
        limit: 20,
      });

      expect(apifyProvider.scrapeGoogleMaps).toHaveBeenCalledWith({
        city: 'Kyiv',
        category: 'Salon',
        limit: 20,
      });
      expect(leadsService.create).toHaveBeenCalledTimes(1);
      expect(leadsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          businessName: 'Biz A',
          source: 'google-maps',
        }),
      );
      expect(result).toEqual({ scraped: 2, created: 1, skipped: 0 });
    });

    it('should skip businesses that already exist (duplicate leads)', async () => {
      googleMapsScraper.scrapeBusinesses.mockResolvedValue([]);
      apifyProvider.scrapeGoogleMaps.mockResolvedValue([
        { businessName: 'Biz A', website: null, phone: '+123', address: 'Addr', city: 'Kyiv', category: 'Salon', placeId: 'p1', rating: 4.0, reviewCount: 10 },
      ]);
      leadsService.create.mockRejectedValue(new Error('Duplicate'));

      const result = await service.scrapeAndCreateLeads({
        city: 'Kyiv',
        category: 'Salon',
      });

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(1);
    });
  });

  describe('enrichLeadWithInstagram', () => {
    it('should enrich lead with Instagram profile data', async () => {
      leadsService.findOne.mockResolvedValue({
        id: 'lead-1',
        socialUrl: 'https://instagram.com/testbiz',
        scrapedData: { geodata: true },
      });
      instagramProvider.extractUsernameFromUrl.mockReturnValue('testbiz');
      instagramProvider.enrichFromProfile.mockResolvedValue({
        username: 'testbiz',
        fullName: 'Test Biz',
        bio: 'A great business',
        followers: 1000,
        postsCount: 50,
        isVerified: true,
        recentPosts: [],
      });

      const result = await service.enrichLeadWithInstagram('lead-1');

      expect(result).toBe(true);
      expect(leadsService.update).toHaveBeenCalledWith('lead-1', {
        scrapedData: expect.objectContaining({
          instagram: expect.objectContaining({
            username: 'testbiz',
            fullName: 'Test Biz',
          }),
        }),
      });
    });

    it('should return false if lead has no Instagram URL', async () => {
      leadsService.findOne.mockResolvedValue({ id: 'lead-2', socialUrl: null, scrapedData: {} });
      const result = await service.enrichLeadWithInstagram('lead-2');
      expect(result).toBe(false);
    });

    it('should return false if username extraction fails', async () => {
      leadsService.findOne.mockResolvedValue({
        id: 'lead-3',
        socialUrl: 'https://instagram.com/broken',
        scrapedData: {},
      });
      instagramProvider.extractUsernameFromUrl.mockReturnValue(null);

      const result = await service.enrichLeadWithInstagram('lead-3');
      expect(result).toBe(false);
    });

    it('should return false if enrichment fails', async () => {
      leadsService.findOne.mockResolvedValue({
        id: 'lead-4',
        socialUrl: 'https://instagram.com/private',
        scrapedData: {},
      });
      instagramProvider.extractUsernameFromUrl.mockReturnValue('private');
      instagramProvider.enrichFromProfile.mockResolvedValue(null);

      const result = await service.enrichLeadWithInstagram('lead-4');
      expect(result).toBe(false);
    });
  });

  describe('scrapeLead', () => {
    it('should enrich existing lead with selected platforms', async () => {
      leadsService.findOne.mockResolvedValue({
        id: 'lead-1',
        businessName: 'Test Biz',
        city: 'Kyiv',
      });
      googleMapsScraper.scrapeBusinesses.mockResolvedValue([]);
      leadsService.update.mockResolvedValue(undefined);

      await service.scrapeLead('lead-1', ['googleMaps']);

      expect(leadsService.findOne).toHaveBeenCalledWith('lead-1');
      expect(googleMapsScraper.scrapeBusinesses).toHaveBeenCalled();
      expect(leadsService.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if lead not found', async () => {
      leadsService.findOne.mockRejectedValue(new Error('Lead not found'));

      await expect(service.scrapeLead('nonexistent', ['googleMaps'])).rejects.toThrow();
    });

    it('should handle single platform', async () => {
      leadsService.findOne.mockResolvedValue({
        id: 'lead-2',
        businessName: 'Salon',
        city: 'Odesa',
        socialUrls: ['https://instagram.com/salon'],
      });
      instagramProvider.extractUsernameFromUrl.mockReturnValue('salon');
      instagramProvider.enrichFromProfile.mockResolvedValue({
        username: 'salon',
        fullName: 'Salon',
        bio: 'Test',
        followers: 100,
        postsCount: 10,
        isVerified: false,
        recentPosts: [],
        profilePicUrl: 'pic.jpg',
      });
      leadsService.update.mockResolvedValue(undefined);

      await service.scrapeLead('lead-2', ['instagram']);

      expect(leadsService.findOne).toHaveBeenCalledWith('lead-2');
      expect(instagramProvider.extractUsernameFromUrl).toHaveBeenCalled();
      expect(leadsService.update).toHaveBeenCalled();
    });
  });
});
