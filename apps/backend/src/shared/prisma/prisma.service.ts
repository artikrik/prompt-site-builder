import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('cleanDatabase is only allowed in test environment');
    }

    const modelNames = ['clientWidget', 'siteAsset', 'generationJob', 'project', 'lead', 'user'];

    for (const modelName of modelNames) {
      await this.$executeRawUnsafe(`DELETE FROM "${modelName}"`);
    }
  }
}
