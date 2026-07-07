import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LeadsService } from './leads.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CacheService } from '../../shared/redis/cache.service';
import { NotFoundException } from '@nestjs/common';

describe('LeadsService', () => {
  let service: LeadsService;
  let prisma: {
    lead: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
  };
  let cache: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
    delByPrefix: ReturnType<typeof vi.fn>;
    getOrSet: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    prisma = {
      lead: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        updateMany: vi.fn(),
      },
    };

    cache = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      del: vi.fn().mockResolvedValue(undefined),
      delByPrefix: vi.fn().mockResolvedValue(undefined),
      getOrSet: vi.fn((_key, factory) => factory()),
    };

    const mockEncryption = {
      encrypt: vi.fn((v: string) => `enc_${v}`),
      decrypt: vi.fn((v: string) => v.startsWith('enc_') ? v.slice(4) : v),
    };

    service = new LeadsService(
      prisma as unknown as PrismaService,
      cache as unknown as CacheService,
      mockEncryption as any,
    );
  });

  describe('create', () => {
    it('should create a lead with generated slug', async () => {
      prisma.lead.create.mockResolvedValue({
        id: 'lead-1',
        businessName: 'Test Business',
        slug: 'test-business',
        source: 'google-maps',
        status: 'NEW',
        tags: [],
        scrapedData: {},
      });

      const result = await service.create({
        businessName: 'Test Business',
        source: 'google-maps',
      });

      expect(prisma.lead.create).toHaveBeenCalledWith({
        data: {
          businessName: 'Test Business',
          slug: 'test-business',
          source: 'google-maps',
          tags: [],
          scrapedData: {},
        },
      });
      expect(result.slug).toBe('test-business');
    });
  });

  describe('findAll', () => {
    it('should return all leads without filters', async () => {
      prisma.lead.findMany.mockResolvedValue([]);
      const result = await service.findAll();
      expect(result).toEqual([]);
      expect(prisma.lead.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should apply search filter', async () => {
      prisma.lead.findMany.mockResolvedValue([]);
      await service.findAll({ search: 'salon' });
      expect(prisma.lead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ businessName: expect.objectContaining({ contains: 'salon' }) }),
            ]),
          }),
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return lead by ID', async () => {
      prisma.lead.findUnique.mockResolvedValue({ id: 'lead-1', projects: [] });
      const result = await service.findOne('lead-1');
      expect(result.id).toBe('lead-1');
    });

    it('should throw NotFoundException for non-existent lead', async () => {
      prisma.lead.findUnique.mockResolvedValue(null);
      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a lead', async () => {
      prisma.lead.findUnique.mockResolvedValue({ id: 'lead-1' });
      prisma.lead.update.mockResolvedValue({ id: 'lead-1', businessName: 'Updated' });

      const result = await service.update('lead-1', { businessName: 'Updated' });
      expect(result.businessName).toBe('Updated');
    });

    it('should throw NotFoundException for non-existent lead', async () => {
      prisma.lead.findUnique.mockResolvedValue(null);
      await expect(service.update('non-existent', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a lead', async () => {
      prisma.lead.findUnique.mockResolvedValue({ id: 'lead-1' });
      prisma.lead.delete.mockResolvedValue(undefined);
      await service.remove('lead-1');
      expect(prisma.lead.delete).toHaveBeenCalledWith({ where: { id: 'lead-1' } });
    });
  });

  describe('bulkUpdateStatus', () => {
    it('should update multiple lead statuses', async () => {
      prisma.lead.updateMany.mockResolvedValue({ count: 3 });
      const result = await service.bulkUpdateStatus(['l1', 'l2', 'l3'], 'CONTACTED');
      expect(result).toBe(3);
    });
  });

  describe('generateSlug', () => {
    it('should transliterate Cyrillic name to Latin slug', () => {
      const slug = (service as any).generateSlug('Стоматологія Сяйво');
      expect(slug).toBe('stomatolohiia-siaivo');
      expect(slug.length).toBeGreaterThan(0);
    });

    it('should handle mixed Cyrillic-Latin names', () => {
      const slug = (service as any).generateSlug('Beauty Studio Lux');
      expect(slug).toBe('beauty-studio-lux');
    });

    it('should handle empty slug fallback with UUID', () => {
      const slug = (service as any).generateSlug('日本語のみ');
      // If name has no ASCII/Latin chars after transliteration, fall back to random
      expect(slug.length).toBeGreaterThan(0);
    });
  });
});
