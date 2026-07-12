import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { SitePublisherService } from '../../publishing/site-publisher.service';
import { CreateVariantDto, VariantListItem, SiteVariant } from '@prompt-site-builder/shared';

@Injectable()
export class VariantsService {
  private readonly logger = new Logger(VariantsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: SitePublisherService,
  ) {}

  async create(projectId: string, dto: CreateVariantDto): Promise<SiteVariant> {
    const variantName = this.generateVariantName(dto.model, dto.imageModel, dto.theme);

    const variant = await this.prisma.siteVariant.create({
      data: {
        projectId,
        variantName,
        status: 'DRAFT',
        modelUsed: dto.model,
        imageModel: dto.imageModel,
        themeName: dto.theme,
      },
    });
    return this.toSiteVariant(variant);
  }

  async findByProject(projectId: string): Promise<VariantListItem[]> {
    const variants = await this.prisma.siteVariant.findMany({
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
    return variants.map((v: any) => this.toVariantListItem(v));
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

    await this.publisher.switchActiveVariant(variant.project.slug, variantId);

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

  async migrateExistingProjects(): Promise<{ migrated: number; skipped: number }> {
    const projectsWithoutVariants = await this.prisma.project.findMany({
      where: { variants: { none: {} } },
      select: { id: true, status: true, hugoConfig: true },
    });

    let migrated = 0;
    let skipped = 0;

    for (const project of projectsWithoutVariants) {
      try {
        const variantStatus = project.status === 'PUBLISHED' ? 'GENERATED' : 'DRAFT';
        const themeName = (project.hugoConfig as any)?.theme || undefined;

        const variant = await this.prisma.siteVariant.create({
          data: {
            projectId: project.id,
            variantName: `default + default + ${themeName || 'auto'}`,
            status: variantStatus,
            themeName,
            hugoConfig: project.hugoConfig as any,
          },
        });

        await this.prisma.project.update({
          where: { id: project.id },
          data: { activeVariantId: variant.id },
        });

        migrated++;
        this.logger.log(`Migrated project ${project.id} → variant ${variant.id}`);
      } catch (error) {
        this.logger.warn(`Skipping project ${project.id}: ${error}`);
        skipped++;
      }
    }

    return { migrated, skipped };
  }

  private generateVariantName(model?: string, imageModel?: string, theme?: string): string {
    const parts = [model || 'default', imageModel || 'default', theme || 'auto'].filter(Boolean);
    return parts.join(' + ');
  }

  private nullToUndefined<T>(value: T | null): T | undefined {
    return value === null ? undefined : value;
  }

  private toVariantListItem(v: any): VariantListItem {
    return {
      id: v.id,
      variantName: v.variantName,
      status: v.status,
      modelUsed: this.nullToUndefined(v.modelUsed),
      imageModel: this.nullToUndefined(v.imageModel),
      themeName: this.nullToUndefined(v.themeName),
      createdAt: v.createdAt,
    };
  }

  private toSiteVariant(v: any): SiteVariant {
    return {
      id: v.id,
      projectId: v.projectId,
      variantName: v.variantName,
      status: v.status,
      hugoConfig: v.hugoConfig ?? {},
      content: v.content ?? {},
      modelUsed: this.nullToUndefined(v.modelUsed),
      imageModel: this.nullToUndefined(v.imageModel),
      themeName: this.nullToUndefined(v.themeName),
      previewUrl: this.nullToUndefined(v.previewUrl),
      publishedAt: v.publishedAt,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    };
  }
}
