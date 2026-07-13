import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { LogsService } from './logs.service';

@ApiTags('Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('logs')
export class LogsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logsService: LogsService,
  ) {}

  @Get('generation')
  @ApiOperation({ summary: 'Get generation job logs' })
  async getGenerationLogs(
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;

    const jobs = await this.prisma.generationJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit, 10) : 50,
      include: { project: { select: { slug: true } } },
    });

    return { jobs };
  }

  @Get('system')
  @ApiOperation({ summary: 'Get system logs' })
  async getSystemLogs(
    @Query('level') level?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const where: Record<string, unknown> = {};
    if (level) where.level = level;
    if (search) {
      where.OR = [
        { message: { contains: search, mode: 'insensitive' } },
        { module: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [logs, total] = await Promise.all([
      this.prisma.systemLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit ? parseInt(limit, 10) : 50,
        skip: offset ? parseInt(offset, 10) : 0,
      }),
      this.prisma.systemLog.count({ where }),
    ]);

    return { logs, total };
  }

  @Get('scraping')
  @ApiOperation({ summary: 'Get scraping activity logs' })
  async getScrapingLogs(
    @Query('leadId') leadId?: string,
    @Query('source') source?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.logsService.getScrapingLogs({
      leadId,
      source,
      status,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }
}
