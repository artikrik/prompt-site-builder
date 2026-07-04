import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue('generation') private readonly generationQueue: Queue,
    @InjectQueue('scraping') private readonly scrapingQueue: Queue,
  ) {}

  async addGenerationJob(data: {
    projectId: string;
    leadId: string;
    businessName: string;
    slug: string;
    category: string | null;
    description: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    socialUrl: string | null;
    theme?: string;
  }) {
    const job = await this.generationQueue.add('generate-site', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 86400 },
      removeOnFail: { age: 604800 },
    });
    this.logger.log(`Generation job ${job.id} added for project ${data.projectId}`);
    return job;
  }

  async addScrapingJob(data: { city: string; category: string; limit?: number }) {
    const job = await this.scrapingQueue.add('scrape-leads', data, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 10000 },
      removeOnComplete: { age: 86400 },
      removeOnFail: { age: 604800 },
    });
    this.logger.log(`Scraping job ${job.id} added for ${data.city}/${data.category}`);
    return job;
  }

  async getGenerationJobStatus(jobId: string) {
    const job = await this.generationQueue.getJob(jobId);
    if (!job) return null;
    const state = await job.getState();
    return { id: job.id, state, progress: job.progress, data: job.data, returnvalue: job.returnvalue, failedReason: job.failedReason };
  }

  async getScrapingJobStatus(jobId: string) {
    const job = await this.scrapingQueue.getJob(jobId);
    if (!job) return null;
    const state = await job.getState();
    return { id: job.id, state, progress: job.progress, data: job.data, returnvalue: job.returnvalue, failedReason: job.failedReason };
  }
}
