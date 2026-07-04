import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CacheService } from '../../shared/redis/cache.service';
import { CreateProjectDto, UpdateProjectDto, Project, ProjectStatus } from '@prompt-site-builder/shared';

const CACHE_TTL = 120;
const CACHE_PREFIX = 'projects';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async create(dto: CreateProjectDto, userId?: string): Promise<Project> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: dto.leadId },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID ${dto.leadId} not found`);
    }

    const existingProject = await this.prisma.project.findFirst({
      where: { leadId: dto.leadId },
    });

    if (existingProject) {
      throw new BadRequestException(`Project already exists for lead ${dto.leadId}`);
    }

    const slug = lead.slug;
    const defaultHugoConfig = {
      title: lead.businessName,
      description: lead.description || `${lead.businessName} - Professional services`,
      theme: 'hugo-theme-zen',
      languageCode: 'uk',
      baseUrl: `https://${slug}.sitenow.pp.ua`,
      params: {
        businessName: lead.businessName,
        phone: lead.phone,
        email: lead.email,
        address: lead.address,
        category: lead.category,
      },
    };

    const project = await this.prisma.project.create({
      data: {
        leadId: dto.leadId,
        slug,
        userId,
        hugoConfig: { ...defaultHugoConfig, ...dto.hugoConfig },
      },
    });

    await this.cache.delByPrefix(CACHE_PREFIX);
    return project;
  }

  async findAll(): Promise<Project[]> {
    return this.cache.getOrSet(
      `${CACHE_PREFIX}:all`,
      () =>
        this.prisma.project.findMany({
          include: { lead: true },
          orderBy: { createdAt: 'desc' },
        }),
      CACHE_TTL,
    );
  }

  async findOne(id: string): Promise<Project> {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        lead: true,
        jobs: { orderBy: { createdAt: 'desc' }, take: 5 },
        assets: true,
        widgets: true,
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    return project;
  }

  async update(id: string, dto: UpdateProjectDto): Promise<Project> {
    await this.findOne(id);

    const project = await this.prisma.project.update({
      where: { id },
      data: dto,
    });

    await this.cache.delByPrefix(CACHE_PREFIX);
    return project;
  }

  async updateStatus(id: string, status: ProjectStatus): Promise<Project> {
    const project = await this.findOne(id);

    const updateData: Record<string, unknown> = { status };

    if (status === ProjectStatus.GENERATED) {
      updateData.generatedAt = new Date();
    } else if (status === ProjectStatus.PUBLISHED) {
      updateData.publishedAt = new Date();
      updateData.publishedUrl = `https://${project.slug}.sitenow.pp.ua`;
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: updateData,
    });

    await this.cache.delByPrefix(CACHE_PREFIX);
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);

    await this.prisma.project.delete({
      where: { id },
    });

    await this.cache.delByPrefix(CACHE_PREFIX);
  }
}
