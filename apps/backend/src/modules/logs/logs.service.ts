import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface CreateScrapingLogDto {
  leadId?: string;
  jobId?: string;
  source: string;
  action: string;
  status: 'started' | 'completed' | 'failed';
  message?: string;
  details?: Record<string, Prisma.InputJsonValue>;
  duration?: number;
}

@Injectable()
export class LogsService {
  constructor(private readonly prisma: PrismaService) {}

  async logScraping(data: CreateScrapingLogDto) {
    return this.prisma.scrapingLog.create({
      data: {
        ...data,
        message: data.message?.slice(0, 1000),
      },
    });
  }

  async getScrapingLogs(params: {
    leadId?: string;
    source?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: Record<string, unknown> = {};
    if (params.leadId) where.leadId = params.leadId;
    if (params.source) where.source = params.source;
    if (params.status) where.status = params.status;

    const [logs, total] = await Promise.all([
      this.prisma.scrapingLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.limit || 50,
        skip: params.offset || 0,
      }),
      this.prisma.scrapingLog.count({ where }),
    ]);

    return { logs, total };
  }
}
