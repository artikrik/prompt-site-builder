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

    const results: Partial<EnrichmentData>[] = [];

    for (const source of sources) {
      const provider = this.factory.createForProvider(source as EnrichmentSource);
      if (!provider) {
        this.logger.warn(`No provider for source: ${source}`);
        continue;
      }
      try {
        this.logger.log(`Enriching lead ${leadId} from ${source}`);
        const data = await provider.enrich(lead.businessName, lead.city || undefined);
        results.push(data);
      } catch (err) {
        this.logger.warn(`Provider ${source} failed for lead ${leadId}: ${err}`);
      }
    }

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
