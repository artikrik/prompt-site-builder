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
    await this.queueService.addEnrichmentJob(id);
    return { message: 'Enrichment job queued' };
  }

  @Put(':id/enrichment-sources')
  async updateSources(@Param('id') id: string, @Body() dto: UpdateEnrichmentSourcesDto) {
    return { sources: dto.sources };
  }

  @Get(':id/enrichment')
  async getEnrichment(@Param('id') _id: string) {
    return { data: null, enrichedAt: null, sources: [] };
  }
}
