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

  async process(job: Job<{ city: string; category: string; limit?: number }>): Promise<void> {
    this.logger.log(`Processing scraping job ${job.id} for ${job.data.city}/${job.data.category}`);

    try {
      await job.updateProgress(10);
      const result = await this.scrapingService.scrapeAndCreateLeads(job.data);
      await job.updateProgress(100);
      this.logger.log(`Scraping job ${job.id} completed: ${result.created} leads created`);
    } catch (error) {
      this.logger.error(`Scraping job ${job.id} failed: ${error}`);
      throw error;
    }
  }
}
