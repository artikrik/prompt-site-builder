import { Injectable, LoggerService } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaLogger implements LoggerService {
  constructor(private readonly prisma: PrismaService) {}

  log(message: string, context?: string) {
    console.log(`[${context || 'App'}] ${message}`);
  }

  warn(message: string, context?: string) {
    console.warn(`[${context || 'App'}] ${message}`);
    this.saveLog('WARN', message, context).catch(() => {});
  }

  error(message: string, trace?: string, context?: string) {
    console.error(`[${context || 'App'}] ${message}`, trace);
    this.saveLog('ERROR', message, context, trace).catch(() => {});
  }

  private async saveLog(level: string, message: string, context?: string, trace?: string) {
    try {
      await this.prisma.systemLog.create({
        data: {
          level,
          module: context || 'App',
          message: message.slice(0, 1000),
          details: trace ? { trace: trace.slice(0, 5000) } : undefined,
        },
      });
    } catch {
      // Don't let logging failures crash the app
    }
  }
}
