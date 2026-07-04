import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { RedisService } from '../../shared/redis/redis.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service health status' })
  async check() {
    const checks: Record<string, { status: string; latency?: number; error?: string }> = {};
    let overallStatus = 'ok';

    // Database check
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'ok', latency: Date.now() - start };
    } catch (error) {
      checks.database = { status: 'error', error: String(error) };
      overallStatus = 'error';
    }

    // Redis check
    try {
      const start = Date.now();
      const client = this.redis.getClient();
      await client.ping();
      checks.redis = { status: 'ok', latency: Date.now() - start };
    } catch (error) {
      checks.redis = { status: 'error', error: String(error) };
      overallStatus = 'error';
    }

    // Hugo check
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      const start = Date.now();
      await execAsync('hugo version');
      checks.hugo = { status: 'ok', latency: Date.now() - start };
    } catch (error) {
      checks.hugo = { status: 'warning', error: 'Hugo not found in PATH' };
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}
