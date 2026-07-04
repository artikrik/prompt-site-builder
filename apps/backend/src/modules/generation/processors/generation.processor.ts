import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { GenerationService } from '../generation.service';
import { SiteGenerationRequest } from '@prompt-site-builder/shared';

@Processor('generation')
export class GenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(GenerationProcessor.name);

  constructor(private readonly generationService: GenerationService) {
    super();
  }

  async process(job: Job<SiteGenerationRequest & { leadId: string }>): Promise<void> {
    this.logger.log(`Processing generation job ${job.id} for project ${job.data.projectId}`);

    try {
      await job.updateProgress(10);
      await this.generationService.generateSite(job.data);
      await job.updateProgress(100);
      this.logger.log(`Generation job ${job.id} completed`);
    } catch (error) {
      this.logger.error(`Generation job ${job.id} failed: ${error}`);
      throw error;
    }
  }
}
