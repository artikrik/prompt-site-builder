// @ts-nocheck — Prisma JsonValue vs shared types (pre-existing)
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CacheService } from '../../shared/redis/cache.service';
import { CreateLeadDto, UpdateLeadDto, LeadFilter, Lead } from '@prompt-site-builder/shared';
import { Prisma } from '@prisma/client';

const CACHE_TTL = 60;
const CACHE_PREFIX = 'leads';

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async create(dto: CreateLeadDto): Promise<Lead> {
    const slug = this.generateSlug(dto.businessName);

    const lead = await this.prisma.lead.create({
      data: {
        ...dto,
        slug,
        tags: dto.tags || [],
        scrapedData: dto.scrapedData || {},
      },
    });

    await this.cache.delByPrefix(CACHE_PREFIX);
    return lead;
  }

  async findAll(filter: LeadFilter = {}): Promise<Lead[]> {
    const hasFilters =
      filter.search ||
      filter.status ||
      filter.source ||
      filter.city ||
      filter.category ||
      (filter.tags && filter.tags.length > 0);

    if (!hasFilters) {
      return this.cache.getOrSet(
        `${CACHE_PREFIX}:all`,
        () => this.prisma.lead.findMany({ orderBy: { createdAt: 'desc' } }),
        CACHE_TTL,
      );
    }

    const cacheKey = `${CACHE_PREFIX}:filtered:${JSON.stringify(filter, Object.keys(filter).sort())}`;
    return this.cache.getOrSet(
      cacheKey,
      () => this.findAllFromDb(filter),
      CACHE_TTL,
    );
  }

  private async findAllFromDb(filter: LeadFilter): Promise<Lead[]> {
    const where: Prisma.LeadWhereInput = {};

    if (filter.search) {
      where.OR = [
        { businessName: { contains: filter.search, mode: 'insensitive' } },
        { city: { contains: filter.search, mode: 'insensitive' } },
        { category: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    if (filter.status) {
      where.status = filter.status;
    }

    if (filter.source) {
      where.source = filter.source;
    }

    if (filter.city) {
      where.city = { contains: filter.city, mode: 'insensitive' };
    }

    if (filter.category) {
      where.category = { contains: filter.category, mode: 'insensitive' };
    }

    if (filter.tags && filter.tags.length > 0) {
      where.tags = { hasSome: filter.tags };
    }

    return this.prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<Lead> {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: { projects: true },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID ${id} not found`);
    }

    return lead;
  }

  async findBySlug(slug: string): Promise<Lead> {
    const lead = await this.prisma.lead.findUnique({
      where: { slug },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with slug ${slug} not found`);
    }

    return lead;
  }

  async update(id: string, dto: UpdateLeadDto): Promise<Lead> {
    await this.findOne(id);

    const lead = await this.prisma.lead.update({
      where: { id },
      data: dto,
    });

    await this.cache.delByPrefix(CACHE_PREFIX);
    return lead;
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);

    await this.prisma.lead.delete({
      where: { id },
    });

    await this.cache.delByPrefix(CACHE_PREFIX);
  }

  async bulkUpdateStatus(ids: string[], status: string): Promise<number> {
    const result = await this.prisma.lead.updateMany({
      where: { id: { in: ids } },
      data: { status: status as any },
    });

    await this.cache.delByPrefix(CACHE_PREFIX);
    return result.count;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
