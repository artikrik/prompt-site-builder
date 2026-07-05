import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { CreateVariantDto, VariantListItem, SiteVariant } from '@prompt-site-builder/shared';

@Injectable()
export class VariantsService {
  private readonly logger = new Logger(VariantsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(projectId: string, dto: CreateVariantDto): Promise<SiteVariant> {
    const variantName = this.generateVariantName(dto.model, dto.imageModel, dto.theme);

    return this.prisma.siteVariant.create({
      data: {
        projectId,
        variantName,
        status: 'DRAFT',
        modelUsed: dto.model,
        imageModel: dto.imageModel,
        themeName: dto.theme,
      },
    });
  }

  async findByProject(projectId: string): Promise<VariantListItem[]> {
    return this.prisma.siteVariant.findMany({
      where: { projectId },
      select: {
        id: true,
        variantName: true,
        status: true,
        modelUsed: true,
        imageModel: true,
        themeName: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(variantId: string): Promise<any> {
    const variant = await this.prisma.siteVariant.findUnique({
      where: { id: variantId },
      include: { project: true, assets: true },
    });
    if (!variant) throw new NotFoundException(`Variant ${variantId} not found`);
    return variant;
  }

  async activate(variantId: string): Promise<void> {
    const variant = await this.prisma.siteVariant.findUnique({
      where: { id: variantId },
      include: { project: true },
    });
    if (!variant) throw new NotFoundException(`Variant ${variantId} not found`);
    if (variant.status === 'PUBLISHED') {
      throw new BadRequestException('Variant already active');
    }

    // Deactivate current active variant
    await this.prisma.siteVariant.updateMany({
      where: { projectId: variant.projectId, status: 'PUBLISHED' },
      data: { status: 'GENERATED' },
    });

    // Activate this variant
    await this.prisma.siteVariant.update({
      where: { id: variantId },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });

    // Update project
    const publishedUrl = `https://${variant.project.slug}.sitenow.pp.ua`;
    await this.prisma.project.update({
      where: { id: variant.projectId },
      data: {
        activeVariantId: variantId,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        publishedUrl,
      },
    });

    this.logger.log(`Variant ${variantId} activated for project ${variant.projectId}`);
  }

  async remove(variantId: string): Promise<void> {
    const variant = await this.prisma.siteVariant.findUnique({ where: { id: variantId } });
    if (!variant) throw new NotFoundException(`Variant ${variantId} not found`);
    if (variant.status === 'PUBLISHED') {
      throw new BadRequestException('Cannot delete active variant. Activate another first.');
    }
    await this.prisma.siteVariant.delete({ where: { id: variantId } });
  }

  private generateVariantName(model?: string, imageModel?: string, theme?: string): string {
    const parts = [model || 'default', imageModel || 'default', theme || 'auto'].filter(Boolean);
    return parts.join(' + ');
  }
}
