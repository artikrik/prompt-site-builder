import { Controller, Post, Get, Param, Body, Query, HttpCode, HttpStatus, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CacheService } from '../../shared/redis/cache.service';
import { ProjectsService } from '../projects/projects.service';
import { QueueService } from '../queue/queue.service';
import { ThemeService } from './themes/theme.service';
import { ThemeSelector } from './themes/theme-selector';

interface ProjectRelations {
  lead?: {
    id: string;
    businessName: string;
    category: string | null;
    description: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    socialUrl: string | null;
  } | null;
  hugoConfig?: { theme?: string } | null;
  generationJobs?: Array<{ id: string; status: string; result?: unknown; error?: string | null }> | null;
}

const THEMES_CACHE_KEY = 'themes:list';
const THEMES_CACHE_TTL = 3600;

@ApiTags('Generation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('generation')
export class GenerationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly queueService: QueueService,
    private readonly themeService: ThemeService,
    private readonly themeSelector: ThemeSelector,
    private readonly cache: CacheService,
    private readonly configService: ConfigService,
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
    const projectRel = project as unknown as ProjectRelations;
    const lead = projectRel.lead;
    if (!lead) {
      throw new NotFoundException('Lead not found for project');
    }

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
      selectedTheme = projectRel.hugoConfig?.theme || this.themeService.getDefaultTheme();
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
      socialUrls: lead.socialUrl ? [lead.socialUrl] : [],
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

  @Get('models')
  @ApiOperation({ summary: 'List available LLM models' })
  async listModels(@Query('provider') provider?: string): Promise<Array<{ id: string; name: string }>> {
    if (provider === 'openrouter') {
      const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
      if (!apiKey) return [];

      try {
        const response = await fetch('https://openrouter.ai/api/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        const data = await response.json() as { data: Array<{ id: string; name: string }> };
        return data.data.map(m => ({ id: m.id, name: m.name }));
      } catch {
        return [];
      }
    }

    return [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
      { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      { id: 'tencent/hy3:free', name: 'Tencent HY3 (Free)' },
    ];
  }

  @Get(':projectId/status')
  @ApiOperation({ summary: 'Get generation job status' })
  @ApiResponse({ status: 200, description: 'Job status' })
  async getStatus(@Param('projectId') projectId: string) {
    // Query generation jobs directly — projectsService.findOne may not include them
    const latestJob = await this.prisma.generationJob.findFirst({
      where: { projectId, type: 'GENERATE_SITE' },
      orderBy: { createdAt: 'desc' },
    });

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

  @Get(':projectId/history')
  @ApiOperation({ summary: 'Get generation job history for a project' })
  async getHistory(@Param('projectId') projectId: string, @Query('limit') limit?: string) {
    const jobs = await this.prisma.generationJob.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit, 10) : 20,
    });
    return { projectId, jobs };
  }
}
