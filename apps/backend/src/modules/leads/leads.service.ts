import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CacheService } from '../../shared/redis/cache.service';
import { EncryptionService } from '../settings/encryption.service';
import { QueueService } from '../queue/queue.service';
import { CreateLeadDto, UpdateLeadDto, LeadFilter, Lead } from '@prompt-site-builder/shared';

const CACHE_TTL = 60;
const CACHE_PREFIX = 'leads';
const ENCRYPTED_LEAD_FIELDS = ['easyweekApiKey', 'wayforpaySecret', 'monobankApiKey'];

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly encryption: EncryptionService,
    private readonly configService: ConfigService,
    private readonly queueService: QueueService,
  ) {}

  private encryptPaymentFields(dto: any): any {
    const result = { ...dto };
    for (const field of ENCRYPTED_LEAD_FIELDS) {
      if (result[field]) {
        result[field] = this.encryption.encrypt(result[field]);
      }
    }
    return result;
  }

  private decryptPaymentFields<T>(data: T): T {
    const result = { ...data } as any;
    for (const field of ENCRYPTED_LEAD_FIELDS) {
      if (result[field]) {
        try {
          result[field] = this.encryption.decrypt(result[field]);
        } catch {
          // Leave as-is if decryption fails (might be plaintext)
        }
      }
    }
    return result as T;
  }

  private toLead(data: any): Lead {
    const decrypted = this.decryptPaymentFields(data);
    return {
      ...decrypted,
      enrichmentData: (decrypted.enrichmentData as any) ?? null,
      scrapedData: decrypted.scrapedData ?? {},
    } as Lead;
  }

  async create(dto: CreateLeadDto): Promise<Lead> {
    const slug = this.generateSlug(dto.businessName);
    const encryptedData = this.encryptPaymentFields(dto);

    // Apply default enrichment sources from env if not provided
    const defaultSources = this.configService.get<string>('ENRICHMENT_DEFAULT_SOURCES');
    const enrichmentSources = dto.enrichmentSources
      ?? (defaultSources ? defaultSources.split(',').map((s) => s.trim()) : []);

    const lead = await this.prisma.lead.create({
      data: {
        ...encryptedData,
        slug,
        tags: dto.tags || [],
        scrapedData: dto.scrapedData || {},
        enrichmentSources,
      },
    });

    // Auto-run enrichment if configured
    const autoRun = this.configService.get<string>('ENRICHMENT_AUTO_RUN');
    if (autoRun === 'true' && enrichmentSources.length > 0) {
      this.queueService.addEnrichmentJob(lead.id)
        .then((job) => this.logger.log(`Auto-enrichment queued: ${job.id} for lead ${lead.id}`))
        .catch((err) => this.logger.warn(`Auto-enrichment failed for lead ${lead.id}: ${err}`));
    }

    await this.cache.delByPrefix(CACHE_PREFIX);
    return this.toLead(lead);
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
      const leads: Lead[] = await this.cache.getOrSet<Lead[]>(
        `${CACHE_PREFIX}:all`,
        () => this.prisma.lead.findMany({ orderBy: { createdAt: 'desc' } }) as Promise<Lead[]>,
        CACHE_TTL,
      );
      return leads.map(lead => this.toLead(lead));
    }

    const cacheKey = `${CACHE_PREFIX}:filtered:${JSON.stringify(filter, Object.keys(filter).sort())}`;
    const leads: Lead[] = await this.cache.getOrSet<Lead[]>(
      cacheKey,
      () => this.findAllFromDb(filter),
      CACHE_TTL,
    );
    return leads.map(lead => this.toLead(lead));
  }

  private async findAllFromDb(filter: LeadFilter): Promise<Lead[]> {
    const where: Record<string, unknown> = {};

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
    }) as unknown as Lead[];
  }

  async findOne(id: string): Promise<Lead> {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: { projects: true },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID ${id} not found`);
    }

    return this.toLead(lead);
  }

  async findBySlug(slug: string): Promise<Lead> {
    const lead = await this.prisma.lead.findUnique({
      where: { slug },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with slug ${slug} not found`);
    }

    return this.toLead(lead);
  }

  async update(id: string, dto: UpdateLeadDto): Promise<Lead> {
    await this.findOne(id);
    const encryptedData = this.encryptPaymentFields(dto);

    const lead = await this.prisma.lead.update({
      where: { id },
      data: encryptedData,
    });

    await this.cache.delByPrefix(CACHE_PREFIX);
    return this.toLead(lead);
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
