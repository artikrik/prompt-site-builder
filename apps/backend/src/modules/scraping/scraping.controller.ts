import { Controller, Post, Get, Param, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '@prompt-site-builder/shared';
import { ScrapingService } from './scraping.service';
import { QueueService } from '../queue/queue.service';

interface BatchScrapeItem {
  city: string;
  category: string;
  limit?: number;
}

@ApiTags('Scraping')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('scraping')
export class ScrapingController {
  constructor(
    private readonly scrapingService: ScrapingService,
    private readonly queueService: QueueService,
  ) {}

  @Post('google-maps')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Start Google Maps scraping for leads' })
  @ApiBody({
    schema: {
      properties: {
        city: { type: 'string', example: 'Київ' },
        category: { type: 'string', example: 'салон краси' },
        limit: { type: 'number', example: 20 },
      },
      required: ['city', 'category'],
    },
  })
  @ApiResponse({ status: 202, description: 'Scraping queued' })
  async scrapeGoogleMaps(
    @Body('city') city: string,
    @Body('category') category: string,
    @Body('limit') limit?: number,
  ) {
    const job = await this.queueService.addScrapingJob({ city, category, limit });

    return {
      message: 'Scraping job queued',
      jobId: job.id,
      city,
      category,
      limit: limit || 20,
    };
  }

  @Post('batch')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Batch scrape multiple cities/categories' })
  @ApiBody({
    schema: {
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              city: { type: 'string' },
              category: { type: 'string' },
              limit: { type: 'number' },
            },
            required: ['city', 'category'],
          },
        },
      },
      required: ['items'],
    },
  })
  @ApiResponse({ status: 202, description: 'Batch scraping queued' })
  async batchScrape(@Body('items') items: BatchScrapeItem[]) {
    const maxConcurrent = 5;
    const itemsToProcess = items.slice(0, maxConcurrent);

    const jobs = await Promise.all(
      itemsToProcess.map(async (item) => {
        const job = await this.queueService.addScrapingJob({
          city: item.city,
          category: item.category,
          limit: item.limit || 20,
        });
        return {
          jobId: job.id,
          city: item.city,
          category: item.category,
          limit: item.limit || 20,
        };
      }),
    );

    return {
      message: `${jobs.length} scraping jobs queued`,
      jobs,
      skipped: items.length - itemsToProcess.length,
    };
  }

  @Post('enrich/:leadId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enrich lead with Instagram data' })
  @ApiResponse({ status: 200, description: 'Lead enriched' })
  async enrichLead(@Param('leadId') leadId: string) {
    const success = await this.scrapingService.enrichLeadWithInstagram(leadId);
    return {
      leadId,
      enriched: success,
      message: success ? 'Lead enriched with Instagram data' : 'Enrichment failed or no Instagram URL',
    };
  }

  @Get('jobs')
  @ApiOperation({ summary: 'List scraping jobs status' })
  @ApiResponse({ status: 200, description: 'Jobs list' })
  async listJobs() {
    return {
      message: 'Use the queue service to check individual job statuses',
    };
  }
}
