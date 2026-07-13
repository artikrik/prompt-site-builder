import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EnrichmentService } from '../enrichment.service';
import { LogsService } from '../../logs/logs.service';

@Processor('enrichment')
export class EnrichmentProcessor extends WorkerHost {
  private readonly logger = new Logger(EnrichmentProcessor.name);

  constructor(
    private readonly enrichmentService: EnrichmentService,
    private readonly logsService: LogsService,
  ) {
    super();
  }

  async process(job: Job<{ leadId: string; type: string }>): Promise<void> {
    if (job.data.type !== 'ENRICH_LEAD') return;
    this.logger.log(`Processing enrichment job ${job.id} for lead ${job.data.leadId}`);

    const start = Date.now();
    await this.logsService.logScraping({
      leadId: job.data.leadId,
      jobId: String(job.id),
      source: 'enrichment',
      action: 'enrich',
      status: 'started',
    });

    try {
      await job.updateProgress(10);
      await this.enrichmentService.enrichLead(job.data.leadId);
      const duration = Date.now() - start;
      await this.logsService.logScraping({
        leadId: job.data.leadId,
        jobId: String(job.id),
        source: 'enrichment',
        action: 'enrich',
        status: 'completed',
        duration,
      });
      await job.updateProgress(100);
      this.logger.log(`Enrichment job ${job.id} completed`);
    } catch (error) {
      const duration = Date.now() - start;
      await this.logsService.logScraping({
        leadId: job.data.leadId,
        jobId: String(job.id),
        source: 'enrichment',
        action: 'enrich',
        status: 'failed',
        message: String(error),
        duration,
      });
      this.logger.error(`Enrichment job ${job.id} failed: ${error}`);
      throw error;
    }
  }
}
