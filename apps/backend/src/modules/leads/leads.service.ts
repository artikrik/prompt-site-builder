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
      socialUrls: decrypted.socialUrls ?? [],
      scrapedPhotos: decrypted.scrapedPhotos ?? [],
      scrapedReviews: decrypted.scrapedReviews ?? [],
      scrapedContacts: decrypted.scrapedContacts ?? {},
      scrapedHours: decrypted.scrapedHours ?? {},
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
    // Normalize: treat empty strings and whitespace-only as undefined
    const normalizedFilter: LeadFilter = {};
    if (filter.search && filter.search.trim()) normalizedFilter.search = filter.search.trim();
    if (filter.status) normalizedFilter.status = filter.status;
    if (filter.source) normalizedFilter.source = filter.source;
    if (filter.city) normalizedFilter.city = filter.city;
    if (filter.category) normalizedFilter.category = filter.category;
    if (filter.tags && filter.tags.length > 0) normalizedFilter.tags = filter.tags;

    const hasFilters = Object.keys(normalizedFilter).length > 0;

    if (!hasFilters) {
      const leads: Lead[] = await this.cache.getOrSet<Lead[]>(
        `${CACHE_PREFIX}:all`,
        () => this.prisma.lead.findMany({ orderBy: { createdAt: 'desc' } }) as unknown as Promise<Lead[]>,
        CACHE_TTL,
      );
      return leads.map(lead => this.toLead(lead));
    }

    // Use sorted keys for deterministic cache key
    const cacheKey = `${CACHE_PREFIX}:filtered:${JSON.stringify(normalizedFilter, Object.keys(normalizedFilter).sort())}`;
    const leads: Lead[] = await this.cache.getOrSet<Lead[]>(
      cacheKey,
      () => this.findAllFromDb(normalizedFilter),
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

  async queueScrape(leadId: string, platforms: string[]): Promise<{ id: string }> {
    await this.findOne(leadId);

    // Queue scraping job via BullMQ
    const job = await this.queueService.addScrapeJob(leadId, platforms);

    // Mark scraping as enabled
    await this.prisma.lead.update({
      where: { id: leadId },
      data: { scrapingEnabled: true },
    });

    return { id: job.id };
  }

  async getScrapeStatus(leadId: string): Promise<{
    jobs: Array<{ id: string; status: string; result?: unknown; error?: string }>;
  }> {
    // Find projects for this lead, then find scrape jobs for those projects
    const projects = await this.prisma.project.findMany({
      where: { leadId },
      select: { id: true },
    });

    const projectIds = projects.map(p => p.id);

    const jobs = await this.prisma.generationJob.findMany({
      where: {
        projectId: { in: projectIds },
        type: 'SCRAPE_LEAD',
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, status: true, result: true, error: true },
    });

    return { jobs };
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
    // Transliterate Cyrillic and other non-Latin chars to Latin
    const transliterated = this.transliterate(name);
    const slug = transliterated
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Fallback: if slug is empty (all non-transliteratable chars), use random suffix
    if (!slug) {
      const randomSuffix = Math.random().toString(36).substring(2, 10);
      return `lead-${randomSuffix}`;
    }

    return slug;
  }

  private transliterate(text: string): string {
    const cyrillicMap: Record<string, string> = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'h', 'ґ': 'g', 'д': 'd', 'е': 'e',
      'є': 'ie', 'ж': 'zh', 'з': 'z', 'и': 'y', 'і': 'i', 'ї': 'i',
      'й': 'i', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
      'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f',
      'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
      'ь': '', 'ю': 'iu', 'я': 'ia',
      'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'H', 'Ґ': 'G', 'Д': 'D',
      'Е': 'E', 'Є': 'Ie', 'Ж': 'Zh', 'З': 'Z', 'И': 'Y', 'І': 'I',
      'Ї': 'I', 'Й': 'I', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N',
      'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
      'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh',
      'Щ': 'Shch', 'Ь': '', 'Ю': 'Iu', 'Я': 'Ia',
    };

    return text
      .split('')
      .map((char) => cyrillicMap[char] || char)
      .join('');
  }
}
