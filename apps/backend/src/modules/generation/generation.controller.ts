import { Controller, Post, Get, Param, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CacheService } from '../../shared/redis/cache.service';
import { ProjectsService } from '../projects/projects.service';
import { QueueService } from '../queue/queue.service';
import { ThemeService } from './themes/theme.service';
import { ThemeSelector } from './themes/theme-selector';

const THEMES_CACHE_KEY = 'themes:list';
const THEMES_CACHE_TTL = 3600;

@ApiTags('Generation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('generation')
export class GenerationController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly queueService: QueueService,
    private readonly themeService: ThemeService,
    private readonly themeSelector: ThemeSelector,
    private readonly cache: CacheService,
  ) {}

  @Post(':projectId/generate')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Start site generation for a project' })
  @ApiBody({ schema: { properties: { theme: { type: 'string', description: 'Hugo theme name or "auto" for AI selection' }, variantId: { type: 'string', description: 'Optional — existing variant ID to regenerate' } } } })
  @ApiResponse({ status: 202, description: 'Generation queued' })
  async generate(
    @Param('projectId') projectId: string,
    @Body('theme') theme?: string,
    @Body('variantId') variantId?: string,
  ) {
    const project = await this.projectsService.findOne(projectId);
    const lead = (project as any).lead;

    let selectedTheme: string | undefined;
    if (theme === 'auto') {
      const aiTheme = await this.themeSelector.selectThemeForBusiness({
        businessName: lead.businessName,
        category: lead.category,
        description: lead.description,
      });
      selectedTheme = aiTheme.name;
    } else if (theme) {
      selectedTheme = theme;
    } else {
      selectedTheme = (project as any).hugoConfig?.theme || this.themeService.getDefaultTheme();
    }

    const job = await this.queueService.addGenerationJob({
      projectId,
      leadId: lead.id,
      businessName: lead.businessName,
      slug: project.slug,
      category: lead.category,
      description: lead.description,
      address: lead.address,
      phone: lead.phone,
      email: lead.email,
      socialUrl: lead.socialUrl,
      theme: selectedTheme,
      variantId,
    });

    return {
      message: 'Site generation queued',
      projectId,
      jobId: job.id,
      theme: selectedTheme,
      variantId: variantId || null,
      status: 'QUEUED',
    };
  }

  @Get('themes')
  @ApiOperation({ summary: 'List available Hugo themes' })
  @ApiResponse({ status: 200, description: 'List of themes' })
  async listThemes() {
    return await this.cache.getOrSet(
      THEMES_CACHE_KEY,
      async () => this.themeService.listAvailableThemes(),
      THEMES_CACHE_TTL,
    );
  }

  @Get(':projectId/status')
  @ApiOperation({ summary: 'Get generation job status' })
  @ApiResponse({ status: 200, description: 'Job status' })
  async getStatus(@Param('projectId') projectId: string) {
    const project = await this.projectsService.findOne(projectId);
    const latestJob = (project as any).generationJobs?.[0];

    if (!latestJob) {
      return { projectId, status: 'NO_JOB', message: 'No generation job found' };
    }

    return {
      projectId,
      jobId: latestJob.id,
      status: latestJob.status,
      result: latestJob.result,
      error: latestJob.error,
    };
  }
}
