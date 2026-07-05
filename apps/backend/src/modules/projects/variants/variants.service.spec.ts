import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VariantsService } from './variants.service';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('VariantsService', () => {
  let service: VariantsService;
  let prisma: {
    siteVariant: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    project: {
      update: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    prisma = {
      siteVariant: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
      },
      project: {
        update: vi.fn(),
      },
    };

    service = new VariantsService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('should create a variant with auto-generated name', async () => {
      prisma.siteVariant.create.mockResolvedValue({
        id: 'variant-1',
        projectId: 'project-1',
        variantName: 'claude + dalle + hugo-theme-zen',
        status: 'DRAFT',
        modelUsed: 'claude',
        imageModel: 'dalle',
        themeName: 'hugo-theme-zen',
      });

      const result = await service.create('project-1', {
        model: 'claude',
        imageModel: 'dalle',
        theme: 'hugo-theme-zen',
      });

      expect(result.variantName).toBe('claude + dalle + hugo-theme-zen');
      expect(result.status).toBe('DRAFT');
      expect(prisma.siteVariant.create).toHaveBeenCalledWith({
        data: {
          projectId: 'project-1',
          variantName: 'claude + dalle + hugo-theme-zen',
          status: 'DRAFT',
          modelUsed: 'claude',
          imageModel: 'dalle',
          themeName: 'hugo-theme-zen',
        },
      });
    });

    it('should use default values when fields are missing', async () => {
      prisma.siteVariant.create.mockResolvedValue({
        id: 'variant-2',
        variantName: 'default + default + auto',
      });

      await service.create('project-1', {});

      expect(prisma.siteVariant.create).toHaveBeenCalledWith({
        data: {
          projectId: 'project-1',
          variantName: 'default + default + auto',
          status: 'DRAFT',
          modelUsed: undefined,
          imageModel: undefined,
          themeName: undefined,
        },
      });
    });
  });

  describe('findByProject', () => {
    it('should return variants ordered by createdAt desc', async () => {
      const mockVariants = [
        { id: 'v2', variantName: 'Second', createdAt: new Date('2024-02-01') },
        { id: 'v1', variantName: 'First', createdAt: new Date('2024-01-01') },
      ];
      prisma.siteVariant.findMany.mockResolvedValue(mockVariants);

      const result = await service.findByProject('project-1');

      expect(result).toEqual(mockVariants);
      expect(prisma.siteVariant.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
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
    });

    it('should return empty array when no variants exist', async () => {
      prisma.siteVariant.findMany.mockResolvedValue([]);
      const result = await service.findByProject('empty-project');
      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return variant with relations', async () => {
      const mockVariant = {
        id: 'variant-1',
        variantName: 'Test',
        project: { id: 'project-1', slug: 'test' },
        assets: [],
      };
      prisma.siteVariant.findUnique.mockResolvedValue(mockVariant);

      const result = await service.findById('variant-1');

      expect(result).toEqual(mockVariant);
      expect(prisma.siteVariant.findUnique).toHaveBeenCalledWith({
        where: { id: 'variant-1' },
        include: { project: true, assets: true },
      });
    });

    it('should throw NotFoundException for non-existent variant', async () => {
      prisma.siteVariant.findUnique.mockResolvedValue(null);
      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('activate', () => {
    it('should activate variant, deactivate previous, update project', async () => {
      prisma.siteVariant.findUnique.mockResolvedValue({
        id: 'variant-2',
        projectId: 'project-1',
        status: 'GENERATED',
        project: { slug: 'my-slug' },
      });
      prisma.siteVariant.updateMany.mockResolvedValue({ count: 1 });
      prisma.siteVariant.update.mockResolvedValue({ id: 'variant-2', status: 'PUBLISHED' });
      prisma.project.update.mockResolvedValue({ id: 'project-1', status: 'PUBLISHED' });

      await service.activate('variant-2');

      expect(prisma.siteVariant.updateMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1', status: 'PUBLISHED' },
        data: { status: 'GENERATED' },
      });
      expect(prisma.siteVariant.update).toHaveBeenCalledWith({
        where: { id: 'variant-2' },
        data: { status: 'PUBLISHED', publishedAt: expect.any(Date) },
      });
      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { id: 'project-1' },
        data: {
          activeVariantId: 'variant-2',
          status: 'PUBLISHED',
          publishedAt: expect.any(Date),
          publishedUrl: 'https://my-slug.sitenow.pp.ua',
        },
      });
    });

    it('should throw BadRequestException if variant already PUBLISHED', async () => {
      prisma.siteVariant.findUnique.mockResolvedValue({
        id: 'variant-1',
        projectId: 'project-1',
        status: 'PUBLISHED',
        project: { slug: 'test' },
      });

      await expect(service.activate('variant-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent variant', async () => {
      prisma.siteVariant.findUnique.mockResolvedValue(null);
      await expect(service.activate('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete variant if not active', async () => {
      prisma.siteVariant.findUnique.mockResolvedValue({
        id: 'variant-1',
        status: 'DRAFT',
      });
      prisma.siteVariant.delete.mockResolvedValue({ id: 'variant-1' });

      await service.remove('variant-1');

      expect(prisma.siteVariant.delete).toHaveBeenCalledWith({ where: { id: 'variant-1' } });
    });

    it('should throw BadRequestException if variant is PUBLISHED', async () => {
      prisma.siteVariant.findUnique.mockResolvedValue({
        id: 'variant-1',
        status: 'PUBLISHED',
      });

      await expect(service.remove('variant-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent variant', async () => {
      prisma.siteVariant.findUnique.mockResolvedValue(null);
      await expect(service.remove('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateVariantName', () => {
    it('should construct name from all parts', async () => {
      prisma.siteVariant.create.mockResolvedValue({
        id: 'v1',
        variantName: 'gpt4 + dalle3 + ananke',
      });

      const result = await service.create('p1', {
        model: 'gpt4',
        imageModel: 'dalle3',
        theme: 'ananke',
      });

      expect(result.variantName).toBe('gpt4 + dalle3 + ananke');
    });

    it('should use defaults for missing parts', async () => {
      prisma.siteVariant.create.mockResolvedValue({
        id: 'v2',
        variantName: 'default + default + auto',
      });

      const result = await service.create('p1', {});

      expect(result.variantName).toBe('default + default + auto');
    });

    it('should use defaults for partial missing parts', async () => {
      prisma.siteVariant.create.mockResolvedValue({
        id: 'v3',
        variantName: 'claude + default + auto',
      });

      const result = await service.create('p1', { model: 'claude' });

      expect(result.variantName).toBe('claude + default + auto');
    });
  });
});
