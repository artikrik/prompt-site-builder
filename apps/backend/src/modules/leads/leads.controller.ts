import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { LeadsService } from './leads.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CreateLeadDto, UpdateLeadDto, LeadFilter, Lead, ScrapeRequest } from '@prompt-site-builder/shared';

@ApiTags('Leads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new lead' })
  @ApiResponse({ status: 201, description: 'Lead created' })
  async create(@Body() dto: CreateLeadDto): Promise<Lead> {
    return this.leadsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all leads with filters' })
  @ApiResponse({ status: 200, description: 'List of leads' })
  async findAll(@Query() filter: LeadFilter): Promise<Lead[]> {
    return this.leadsService.findAll(filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lead by ID' })
  @ApiResponse({ status: 200, description: 'Lead found' })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  async findOne(@Param('id') id: string): Promise<Lead> {
    return this.leadsService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a lead' })
  @ApiResponse({ status: 200, description: 'Lead updated' })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  async update(@Param('id') id: string, @Body() dto: UpdateLeadDto): Promise<Lead> {
    return this.leadsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a lead' })
  @ApiResponse({ status: 204, description: 'Lead deleted' })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.leadsService.remove(id);
  }

  @Put('bulk/status')
  @ApiOperation({ summary: 'Bulk update lead status' })
  @ApiResponse({ status: 200, description: 'Number of updated leads' })
  async bulkUpdateStatus(
    @Body('ids') ids: string[],
    @Body('status') status: string,
  ): Promise<{ count: number }> {
    const count = await this.leadsService.bulkUpdateStatus(ids, status);
    return { count };
  }

  @Post(':id/scrape')
  @ApiOperation({ summary: 'Queue social media scraping for a lead' })
  @ApiResponse({ status: 202, description: 'Scraping queued' })
  async scrape(
    @Param('id') id: string,
    @Body() dto: ScrapeRequest,
  ): Promise<{ jobId: string }> {
    const result = await this.leadsService.queueScrape(id, dto.platforms);
    return { jobId: result.id };
  }

  @Get(':id/scrape-status')
  @ApiOperation({ summary: 'Get scraping job status and results' })
  @ApiResponse({ status: 200, description: 'Scraping status' })
  async getScrapeStatus(@Param('id') id: string): Promise<{
    jobs: Array<{ id: string; status: string; result?: unknown; error?: string }>;
  }> {
    return this.leadsService.getScrapeStatus(id);
  }
}
