import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ScrapingService } from '../scraping.service';
import { LogsService } from '../../logs/logs.service';

@Processor('scraping')
export class ScrapingProcessor extends WorkerHost {
  private readonly logger = new Logger(ScrapingProcessor.name);

  constructor(
    private readonly scrapingService: ScrapingService,
    private readonly logsService: LogsService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== 'scrape-leads') return;

    // Per-lead scraping: enrich the existing lead with selected platforms
    if (job.data.leadId && job.data.platforms?.length > 0) {
      this.logger.log(`Processing per-lead scraping job ${job.id} for lead ${job.data.leadId}, platforms: ${job.data.platforms.join(', ')}`);

      const platforms = job.data.platforms;
      for (let i = 0; i < platforms.length; i++) {
        const platform = platforms[i];
        const start = Date.now();
        await job.updateProgress(Math.round(((i) / platforms.length) * 80) + 10);
        await this.logsService.logScraping({
          leadId: job.data.leadId,
          jobId: String(job.id),
          source: platform,
          action: 'scrape',
          status: 'started',
        });

        try {
          await this.scrapingService.scrapeLead(job.data.leadId, [platform]);
          const duration = Date.now() - start;
          await this.logsService.logScraping({
            leadId: job.data.leadId,
            jobId: String(job.id),
            source: platform,
            action: 'scrape',
            status: 'completed',
            duration,
          });
          await job.updateProgress(Math.round(((i + 1) / platforms.length) * 80) + 10);
        } catch (error) {
          const duration = Date.now() - start;
          await this.logsService.logScraping({
            leadId: job.data.leadId,
            jobId: String(job.id),
            source: platform,
            action: 'scrape',
            status: 'failed',
            message: String(error),
            duration,
          });
          this.logger.error(`Per-lead scraping job ${job.id} failed for platform ${platform}: ${error}`);
          throw error;
        }
      }
      await job.updateProgress(100);
      this.logger.log(`Per-lead scraping job ${job.id} completed for lead ${job.data.leadId}`);
      return;
    }

    // Bulk scraping: discover and create new leads
    this.logger.log(`Processing bulk scraping job ${job.id} for ${job.data.city}/${job.data.category}`);

    const start = Date.now();
    await this.logsService.logScraping({
      jobId: String(job.id),
      source: job.data.source || 'unknown',
      action: 'search',
      status: 'started',
      details: { city: job.data.city, category: job.data.category },
    });

    try {
      await job.updateProgress(10);
      const result = await this.scrapingService.scrapeAndCreateLeads(job.data);
      const duration = Date.now() - start;
      await this.logsService.logScraping({
        jobId: String(job.id),
        source: job.data.source || 'unknown',
        action: 'search',
        status: 'completed',
        message: `${result.created} leads created`,
        duration,
      });
      await job.updateProgress(100);
      this.logger.log(`Bulk scraping job ${job.id} completed: ${result.created} leads created`);
    } catch (error) {
      const duration = Date.now() - start;
      await this.logsService.logScraping({
        jobId: String(job.id),
        source: job.data.source || 'unknown',
        action: 'search',
        status: 'failed',
        message: String(error),
        duration,
      });
      this.logger.error(`Bulk scraping job ${job.id} failed: ${error}`);
      throw error;
    }
  }
}
