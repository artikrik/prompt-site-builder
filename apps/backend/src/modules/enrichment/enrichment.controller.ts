import { Controller, Get, Post, Put, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { EnrichmentService } from './enrichment.service';
import { QueueService } from '../queue/queue.service';
import { UpdateEnrichmentSourcesDto } from '@prompt-site-builder/shared';

@Controller('leads')
@UseGuards(JwtAuthGuard)
export class EnrichmentController {
  constructor(
    private readonly enrichmentService: EnrichmentService,
    private readonly queueService: QueueService,
  ) {}

  @Post(':id/enrich')
  async enrichLead(@Param('id') id: string) {
    const job = await this.queueService.addEnrichmentJob(id);
    return { jobId: job.id };
  }

  @Put(':id/enrichment-sources')
  async updateSources(@Param('id') id: string, @Body() dto: UpdateEnrichmentSourcesDto) {
    return this.enrichmentService.updateEnrichmentSources(id, dto.sources);
  }

  @Get(':id/enrichment')
  async getEnrichment(@Param('id') id: string) {
    return this.enrichmentService.getEnrichmentData(id);
  }
}
