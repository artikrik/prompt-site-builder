import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CacheService } from '../../shared/redis/cache.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prisma: {
    lead: { findUnique: ReturnType<typeof vi.fn> };
    project: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
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
      lead: { findUnique: vi.fn() },
      project: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    cache = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      del: vi.fn().mockResolvedValue(undefined),
      delByPrefix: vi.fn().mockResolvedValue(undefined),
      getOrSet: vi.fn((_key, factory) => factory()),
    };

    service = new ProjectsService(
      prisma as unknown as PrismaService,
      cache as unknown as CacheService,
    );
  });

  describe('create', () => {
    it('should create a project for an existing lead', async () => {
      prisma.lead.findUnique.mockResolvedValue({
        id: 'lead-1',
        businessName: 'Test Salon',
        slug: 'test-salon',
        description: 'Beauty salon',
        phone: '+380501234567',
        email: 'test@example.com',
        address: 'Kyiv, Ukraine',
        category: 'Beauty',
      });
      prisma.project.findFirst.mockResolvedValue(null);
      prisma.project.create.mockResolvedValue({
        id: 'project-1',
        leadId: 'lead-1',
        slug: 'test-salon',
        status: 'DRAFT',
      });

      const result = await service.create({ leadId: 'lead-1' });

      expect(result.slug).toBe('test-salon');
      expect(prisma.project.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent lead', async () => {
      prisma.lead.findUnique.mockResolvedValue(null);
      await expect(service.create({ leadId: 'non-existent' })).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if project already exists', async () => {
      prisma.lead.findUnique.mockResolvedValue({ id: 'lead-1' });
      prisma.project.findFirst.mockResolvedValue({ id: 'existing-project' });
      await expect(service.create({ leadId: 'lead-1' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return all projects', async () => {
      prisma.project.findMany.mockResolvedValue([]);
      const result = await service.findAll();
      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return project by ID', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'project-1', lead: {}, jobs: [], assets: [], widgets: [] });
      const result = await service.findOne('project-1');
      expect(result.id).toBe('project-1');
    });

    it('should throw NotFoundException for non-existent project', async () => {
      prisma.project.findUnique.mockResolvedValue(null);
      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a project', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'project-1' });
      prisma.project.update.mockResolvedValue({
        id: 'project-1',
        status: 'GENERATED',
      });

      const result = await service.update('project-1', { status: 'GENERATED' });
      expect(result.status).toBe('GENERATED');
      expect(cache.delByPrefix).toHaveBeenCalledWith('projects');
    });

    it('should throw NotFoundException for non-existent project', async () => {
      prisma.project.findUnique.mockResolvedValue(null);
      await expect(service.update('non-existent', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('should update project status to GENERATED and set generatedAt', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'project-1', slug: 'test' });
      prisma.project.update.mockResolvedValue({ id: 'project-1', status: 'GENERATED' });

      const result = await service.updateStatus('project-1', 'GENERATED');
      expect(result.status).toBe('GENERATED');
      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'GENERATED', generatedAt: expect.any(Date) }),
        }),
      );
    });

    it('should update project status to PUBLISHED and set publishedUrl', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'project-1', slug: 'my-slug' });
      prisma.project.update.mockResolvedValue({ id: 'project-1', status: 'PUBLISHED' });

      const result = await service.updateStatus('project-1', 'PUBLISHED');
      expect(result.status).toBe('PUBLISHED');
      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PUBLISHED',
            publishedAt: expect.any(Date),
            publishedUrl: 'https://my-slug.sitenow.pp.ua',
          }),
        }),
      );
    });
  });

  describe('remove', () => {
    it('should delete a project', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'project-1' });
      prisma.project.delete.mockResolvedValue(undefined);

      await service.remove('project-1');

      expect(prisma.project.delete).toHaveBeenCalledWith({ where: { id: 'project-1' } });
      expect(cache.delByPrefix).toHaveBeenCalledWith('projects');
    });
  });
});
