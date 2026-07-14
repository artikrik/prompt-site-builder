import { Injectable, Logger } from '@nestjs/common';
import { EnrichmentFactory } from './providers/enrichment-factory';
import { EnrichmentSource } from './providers/types';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { EnrichmentAnalysisService } from './enrichment-analysis.service';
import { EnrichmentData } from '@prompt-site-builder/shared';
import { LogsService } from '../logs/logs.service';

@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name);

  constructor(
    private readonly factory: EnrichmentFactory,
    private readonly prisma: PrismaService,
    private readonly analysisService: EnrichmentAnalysisService,
    private readonly logsService: LogsService,
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

    await this.enrichLeadWithSources(leadId, sources);
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

  async enrichLeadWithSources(leadId: string, sources: string[]): Promise<void> {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      this.logger.warn(`Lead ${leadId} not found`);
      return;
    }

    this.logger.log(`Enriching lead ${leadId} with sources: ${sources.join(', ')}`);

    const providerResults = await Promise.all(
      sources.map(async (source) => {
        const provider = this.factory.createForProvider(source as EnrichmentSource);
        if (!provider) {
          this.logger.warn(`No provider for source: ${source}`);
          return null;
        }

        const start = Date.now();
        await this.logsService.logScraping({
          leadId,
          source,
          action: 'api_call',
          status: 'started',
        });

        try {
          this.logger.log(`Enriching lead ${leadId} from ${source}`);
          const data = await provider.enrich(lead.businessName, lead.city || undefined);
          const duration = Date.now() - start;
          await this.logsService.logScraping({
            leadId,
            source,
            action: 'api_call',
            status: 'completed',
            duration,
          });
          return { source, data };
        } catch (err) {
          const duration = Date.now() - start;
          await this.logsService.logScraping({
            leadId,
            source,
            action: 'api_call',
            status: 'failed',
            message: String(err),
            duration,
          });
          this.logger.warn(`Provider ${source} failed for lead ${leadId}: ${err}`);
          return null;
        }
      }),
    );

    const validResults = providerResults.filter((r): r is { source: string; data: Partial<EnrichmentData> } => r !== null);

    const merged = this.mergeResults(validResults.map((r) => r.data));
    const analyzed = await this.analysisService.analyze(
      validResults.map((r) => ({ source: r.source, data: r.data as Record<string, unknown> })),
      merged,
    );

    const finalData = this.mergeResults([merged, analyzed]);

    await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        enrichmentData: finalData as any,
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
