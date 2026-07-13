import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ScrapingService } from '../scraping.service';

@Processor('scraping')
export class ScrapingProcessor extends WorkerHost {
  private readonly logger = new Logger(ScrapingProcessor.name);

  constructor(private readonly scrapingService: ScrapingService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== 'scrape-leads') return;

    // Per-lead scraping: enrich the existing lead with selected platforms
    if (job.data.leadId && job.data.platforms?.length > 0) {
      this.logger.log(`Processing per-lead scraping job ${job.id} for lead ${job.data.leadId}, platforms: ${job.data.platforms.join(', ')}`);

      try {
        await job.updateProgress(10);
        await this.scrapingService.scrapeLead(job.data.leadId, job.data.platforms);
        await job.updateProgress(100);
        this.logger.log(`Per-lead scraping job ${job.id} completed for lead ${job.data.leadId}`);
      } catch (error) {
        this.logger.error(`Per-lead scraping job ${job.id} failed: ${error}`);
        throw error;
      }
      return;
    }

    // Bulk scraping: discover and create new leads
    this.logger.log(`Processing bulk scraping job ${job.id} for ${job.data.city}/${job.data.category}`);

    try {
      await job.updateProgress(10);
      const result = await this.scrapingService.scrapeAndCreateLeads(job.data);
      await job.updateProgress(100);
      this.logger.log(`Bulk scraping job ${job.id} completed: ${result.created} leads created`);
    } catch (error) {
      this.logger.error(`Bulk scraping job ${job.id} failed: ${error}`);
      throw error;
    }
  }
}
