import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByKey(key: string) {
    return this.prisma.setting.findUnique({ where: { key } });
  }

  async upsert(key: string, value: string) {
    return this.prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  async findAll() {
    return this.prisma.setting.findMany();
  }

  async deleteByKey(key: string) {
    return this.prisma.setting.delete({ where: { key } });
  }
}
