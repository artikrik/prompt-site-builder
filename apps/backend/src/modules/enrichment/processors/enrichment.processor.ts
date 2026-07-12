import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EnrichmentService } from '../enrichment.service';

@Processor('enrichment')
export class EnrichmentProcessor extends WorkerHost {
  private readonly logger = new Logger(EnrichmentProcessor.name);

  constructor(private readonly enrichmentService: EnrichmentService) {
    super();
  }

  async process(job: Job<{ leadId: string; type: string }>): Promise<void> {
    if (job.data.type !== 'ENRICH_LEAD') return;
    this.logger.log(`Processing enrichment job ${job.id} for lead ${job.data.leadId}`);
    try {
      await job.updateProgress(10);
      await this.enrichmentService.enrichLead(job.data.leadId);
      await job.updateProgress(100);
      this.logger.log(`Enrichment job ${job.id} completed`);
    } catch (error) {
      this.logger.error(`Enrichment job ${job.id} failed: ${error}`);
      throw error;
    }
  }
}
