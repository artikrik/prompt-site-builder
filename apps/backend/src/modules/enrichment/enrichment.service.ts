import { Injectable, Logger } from '@nestjs/common';
import { EnrichmentFactory } from './providers/enrichment-factory';
import { EnrichmentSource } from './providers/types';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { EnrichmentData } from '@prompt-site-builder/shared';

@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name);

  constructor(
    private readonly factory: EnrichmentFactory,
    private readonly prisma: PrismaService,
  ) {}

  async enrichLead(leadId: string): Promise<void> {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      this.logger.warn(`Lead ${leadId} not found`);
      return;
    }

    const sources = (lead.enrichmentSources as string[]) || [];
    if (sources.length === 0) {
      this.logger.warn(`No enrichment sources configured for lead ${leadId}`);
      return;
    }

    // Run all providers in parallel
    const providerResults = await Promise.all(
      sources.map(async (source) => {
        const provider = this.factory.createForProvider(source as EnrichmentSource);
        if (!provider) {
          this.logger.warn(`No provider for source: ${source}`);
          return null;
        }
        try {
          this.logger.log(`Enriching lead ${leadId} from ${source}`);
          return await provider.enrich(lead.businessName, lead.city || undefined);
        } catch (err) {
          this.logger.warn(`Provider ${source} failed for lead ${leadId}: ${err}`);
          return null;
        }
      }),
    );

    const results = providerResults.filter((r): r is Partial<EnrichmentData> => r !== null);

    const merged = this.mergeResults(results);

    await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        enrichmentData: merged as any,
        enrichedAt: new Date(),
      },
    });

    this.logger.log(`Enrichment complete for lead ${leadId} from ${sources.length} sources`);
  }

  async getEnrichmentData(leadId: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      select: { enrichmentData: true, enrichedAt: true, enrichmentSources: true },
    });
    if (!lead) return { data: null, enrichedAt: null, sources: [] };
    return {
      data: lead.enrichmentData,
      enrichedAt: lead.enrichedAt,
      sources: lead.enrichmentSources,
    };
  }

  async updateEnrichmentSources(leadId: string, sources: string[]) {
    await this.prisma.lead.update({
      where: { id: leadId },
      data: { enrichmentSources: sources },
    });
    return { sources };
  }

  private mergeResults(results: Partial<EnrichmentData>[]): Partial<EnrichmentData> {
    if (results.length === 0) return {};
    return results.reduce((acc, curr) => ({
      ...acc,
      ...curr,
      services: [...(acc.services || []), ...(curr.services || [])],
      reviews: [...(acc.reviews || []), ...(curr.reviews || [])],
      photos: [...(acc.photos || []), ...(curr.photos || [])],
      videos: [...(acc.videos || []), ...(curr.videos || [])],
      competitors: [...(acc.competitors || []), ...(curr.competitors || [])],
      salesOpportunities: [...(acc.salesOpportunities || []), ...(curr.salesOpportunities || [])],
      workingHours: [...(acc.workingHours || []), ...(curr.workingHours || [])],
      faq: [...(acc.faq || []), ...(curr.faq || [])],
    }), {} as Partial<EnrichmentData>);
  }
}
