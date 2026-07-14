import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnrichmentService } from './enrichment.service';
import { EnrichmentFactory } from './providers/enrichment-factory';
import { IEnrichmentProvider } from './providers/types';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { EnrichmentAnalysisService } from './enrichment-analysis.service';
import { EnrichmentData } from '@prompt-site-builder/shared';
import { LogsService } from '../logs/logs.service';

function makeMockFactory(providers: Record<string, IEnrichmentProvider>): EnrichmentFactory {
  return {
    createForProvider: vi.fn((source: string) => providers[source] || null),
  } as unknown as EnrichmentFactory;
}

function makeMockPrisma(_leadData: Record<string, unknown> = {}): PrismaService {
  return {
    lead: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  } as unknown as PrismaService;
}

function makeMockAnalysisService(): EnrichmentAnalysisService {
  return {
    analyze: vi.fn().mockResolvedValue({}),
  } as unknown as EnrichmentAnalysisService;
}

function makeMockLogsService(): LogsService {
  return {
    logScraping: vi.fn().mockResolvedValue({}),
    getScrapingLogs: vi.fn().mockResolvedValue({ logs: [], total: 0 }),
  } as unknown as LogsService;
}

function makeProvider(
  source: string,
  data: Partial<EnrichmentData>,
  shouldThrow = false,
): IEnrichmentProvider {
  return {
    source: source as IEnrichmentProvider['source'],
    enrich: shouldThrow
      ? vi.fn().mockRejectedValue(new Error(`${source} failed`))
      : vi.fn().mockResolvedValue(data),
  };
}

function makeLead(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'lead-1',
    businessName: 'Test Salon',
    city: 'Kyiv',
    enrichmentSources: ['facebook', 'googleMaps'],
    enrichmentData: {},
    enrichedAt: null,
    ...overrides,
  };
}

describe('EnrichmentService', () => {
  let service: EnrichmentService;
  let mockPrisma: PrismaService;
  let mockFactory: EnrichmentFactory;
  let mockAnalysis: EnrichmentAnalysisService;
  let mockLogs: LogsService;

  beforeEach(() => {
    mockPrisma = makeMockPrisma();
    mockFactory = makeMockFactory({});
    mockAnalysis = makeMockAnalysisService();
    mockLogs = makeMockLogsService();
    service = new EnrichmentService(mockFactory, mockPrisma, mockAnalysis, mockLogs);
  });

  describe('enrichLead', () => {
    it('should throw when lead not found', async () => {
      (mockPrisma.lead.findUnique as any).mockResolvedValue(null);

      await service.enrichLead('nonexistent');

      expect(mockPrisma.lead.findUnique).toHaveBeenCalledWith({ where: { id: 'nonexistent' } });
      expect(mockPrisma.lead.update).not.toHaveBeenCalled();
    });

    it('should call providers, merge results, and update lead', async () => {
      const facebookProvider = makeProvider('facebook', {
        services: [{ name: 'Haircut', price: '500', description: 'Haircut' }],
        reviews: [{ author: 'Anna K.', text: 'Great!', rating: 5 }],
      });
      const googleProvider = makeProvider('googleMaps', {
        photos: ['https://photo1.jpg'],
        reviews: [{ author: 'Ivan P.', text: 'Nice!', rating: 4 }],
        stats: { googleRating: 4.5 },
      });

      mockFactory = makeMockFactory({ facebook: facebookProvider, googleMaps: googleProvider });
      service = new EnrichmentService(mockFactory, mockPrisma, mockAnalysis, mockLogs);

      const lead = makeLead();
      (mockPrisma.lead.findUnique as any).mockResolvedValue(lead);
      (mockPrisma.lead.update as any).mockResolvedValue({ ...lead, enrichedAt: new Date() });

      await service.enrichLead('lead-1');

      expect(mockFactory.createForProvider).toHaveBeenCalledWith('facebook');
      expect(mockFactory.createForProvider).toHaveBeenCalledWith('googleMaps');
      expect(facebookProvider.enrich).toHaveBeenCalledWith('Test Salon', 'Kyiv');
      expect(googleProvider.enrich).toHaveBeenCalledWith('Test Salon', 'Kyiv');
      expect(mockPrisma.lead.update).toHaveBeenCalledTimes(1);

      const updateCall = (mockPrisma.lead.update as any).mock.calls[0][0];
      expect(updateCall.where.id).toBe('lead-1');
      expect(updateCall.data.enrichedAt).toBeInstanceOf(Date);
      expect(updateCall.data.enrichmentData.services).toHaveLength(1);
      expect(updateCall.data.enrichmentData.reviews).toHaveLength(2);
      expect(updateCall.data.enrichmentData.photos).toHaveLength(1);
      expect(updateCall.data.enrichmentData.stats.googleRating).toBe(4.5);
    });

    it('should log warn and return early when no enrichment sources', async () => {
      const lead = makeLead({ enrichmentSources: [] });
      (mockPrisma.lead.findUnique as any).mockResolvedValue(lead);

      await service.enrichLead('lead-1');

      expect(mockFactory.createForProvider).not.toHaveBeenCalled();
      expect(mockPrisma.lead.update).not.toHaveBeenCalled();
    });

    it('should continue with other providers when one fails', async () => {
      const failingProvider = makeProvider('facebook', {}, true);
      const successProvider = makeProvider('googleMaps', {
        photos: ['https://photo.jpg'],
        stats: { googleRating: 4.2 },
      });

      mockFactory = makeMockFactory({ facebook: failingProvider, googleMaps: successProvider });
      service = new EnrichmentService(mockFactory, mockPrisma, mockAnalysis, mockLogs);

      const lead = makeLead();
      (mockPrisma.lead.findUnique as any).mockResolvedValue(lead);
      (mockPrisma.lead.update as any).mockResolvedValue(lead);

      await service.enrichLead('lead-1');

      expect(failingProvider.enrich).toHaveBeenCalled();
      expect(successProvider.enrich).toHaveBeenCalled();
      expect(mockPrisma.lead.update).toHaveBeenCalledTimes(1);

      const updateCall = (mockPrisma.lead.update as any).mock.calls[0][0];
      expect(updateCall.data.enrichmentData.photos).toHaveLength(1);
      expect(updateCall.data.enrichmentData.stats.googleRating).toBe(4.2);
    });

    it('should skip unknown source provider gracefully', async () => {
      const lead = makeLead({ enrichmentSources: ['unknown-source'] });
      (mockPrisma.lead.findUnique as any).mockResolvedValue(lead);
      (mockPrisma.lead.update as any).mockResolvedValue(lead);

      await service.enrichLead('lead-1');

      expect(mockFactory.createForProvider).toHaveBeenCalledWith('unknown-source');
      expect(mockPrisma.lead.update).toHaveBeenCalledTimes(1);

      const updateCall = (mockPrisma.lead.update as any).mock.calls[0][0];
      expect(updateCall.data.enrichedAt).toBeDefined();
    });
  });

  describe('mergeResults', () => {
    it('should concatenate arrays from multiple providers', () => {
      const result = (service as any).mergeResults([
        { services: [{ name: 'A', description: 'A' }], reviews: [{ author: 'X', text: 'OK', rating: 5 }] },
        { services: [{ name: 'B', description: 'B' }], photos: ['img1.jpg'] },
      ]);

      expect(result.services).toHaveLength(2);
      expect(result.reviews).toHaveLength(1);
      expect(result.photos).toHaveLength(1);
    });

    it('should return empty object for empty array', () => {
      const result = (service as any).mergeResults([]);

      expect(result).toEqual({});
    });

    it('should handle providers returning mixed fields', () => {
      const result = (service as any).mergeResults([
        { logoUrl: 'logo.png', services: [{ name: 'S1', description: 'S1' }] },
        { coverPhotoUrl: 'cover.jpg', competitors: [{ name: 'Comp', googleMapsUrl: '', rating: 4, reviewCount: 10, distance: '', services: [], positioning: '', uniqueSellingPoints: [] }] },
      ]);

      expect(result.logoUrl).toBe('logo.png');
      expect(result.coverPhotoUrl).toBe('cover.jpg');
      expect(result.services).toHaveLength(1);
      expect(result.competitors).toHaveLength(1);
    });
  });
});
