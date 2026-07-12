import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { AddonType, AddonStatus, Prisma } from '@prisma/client';

const ADDON_PRICES: Record<string, number> = {
  ONLINE_PAYMENT: 499,
  ONLINE_BOOKING: 299,
  CONTENT_MANAGEMENT: 799,
};

@Injectable()
export class AddonService {
  private readonly logger = new Logger(AddonService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listByProject(projectId: string) {
    return this.prisma.projectAddon.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async activate(projectId: string, addonType: AddonType, config: Prisma.InputJsonValue = {}) {
    const existing = await this.prisma.projectAddon.findUnique({
      where: { projectId_addonType: { projectId, addonType } },
    });

    if (existing) {
      throw new ConflictException(`Add-on ${addonType} already exists for this project`);
    }

    return this.prisma.projectAddon.create({
      data: {
        projectId,
        addonType,
        config,
        status: 'ACTIVE',
        priceMonthly: ADDON_PRICES[addonType] || 0,
      },
    });
  }

  async updateConfig(projectId: string, addonType: AddonType, config: Prisma.InputJsonValue) {
    const addon = await this.prisma.projectAddon.findUnique({
      where: { projectId_addonType: { projectId, addonType } },
    });
    if (!addon) throw new NotFoundException(`Add-on ${addonType} not found`);

    return this.prisma.projectAddon.update({
      where: { projectId_addonType: { projectId, addonType } },
      data: { config },
    });
  }

  async deactivate(projectId: string, addonType: AddonType) {
    const addon = await this.prisma.projectAddon.findUnique({
      where: { projectId_addonType: { projectId, addonType } },
    });
    if (!addon) throw new NotFoundException(`Add-on ${addonType} not found`);

    return this.prisma.projectAddon.update({
      where: { projectId_addonType: { projectId, addonType } },
      data: { status: 'INACTIVE' as AddonStatus },
    });
  }

  async getActiveAddons(projectId: string) {
    return this.prisma.projectAddon.findMany({
      where: { projectId, status: 'ACTIVE' },
    });
  }
}
