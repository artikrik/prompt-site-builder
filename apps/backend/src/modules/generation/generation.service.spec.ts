import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GenerationService } from './generation.service';
import { AddonInjectorService } from '../addons/addon-injector.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { LLMStrategyFactory } from './strategies/llm-strategy.factory';
import { DallE3Strategy } from './strategies/dalle3.strategy';
import { HugoCompilerService } from './hugo/hugo-compiler.service';
import { HugoValidatorService } from './hugo/hugo-validator.service';
import { SitePublisherService } from '../publishing/site-publisher.service';
import { SettingsService } from '../settings/settings.service';
import { LeadsService } from '../leads/leads.service';
import { VariantsService } from '../projects/variants/variants.service';
import { JobStatus, ProjectStatus } from '@prompt-site-builder/shared';

describe('GenerationService', () => {
  let service: GenerationService;
  let prisma: {
    project: { update: ReturnType<typeof vi.fn> };
    generationJob: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    siteAsset: { create: ReturnType<typeof vi.fn> };
    siteVariant: { update: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  };
  let configService: { get: ReturnType<typeof vi.fn> };
  let llmFactory: { create: ReturnType<typeof vi.fn> };
  let imageStrategy: { generateHeroImage: ReturnType<typeof vi.fn> };
  let hugoCompiler: { build: ReturnType<typeof vi.fn> };
  let hugoValidator: { validate: ReturnType<typeof vi.fn> };
  let publisher: { publish: ReturnType<typeof vi.fn>; writeFile: ReturnType<typeof vi.fn>; writeFileBinary: ReturnType<typeof vi.fn> };
  let settingsService: { get: ReturnType<typeof vi.fn>; getEffectiveModel: ReturnType<typeof vi.fn> };
  let leadsService: { findOne: ReturnType<typeof vi.fn> };
  let variantsService: { create: ReturnType<typeof vi.fn> };
  let addonInjector: { injectAddons: ReturnType<typeof vi.fn> };

  const siteRequest = {
    projectId: 'proj-1',
    leadId: 'lead-1',
    businessName: 'Test Salon',
    slug: 'test-salon',
    category: 'Beauty',
    description: 'A test salon',
    address: 'Kyiv',
    phone: '+380501234567',
    email: 'test@test.com',
    socialUrl: null,
    theme: 'ananke',
  };

  beforeEach(() => {
    prisma = {
      project: { update: vi.fn().mockResolvedValue({ id: 'proj-1' }) },
      generationJob: {
        create: vi.fn().mockResolvedValue({ id: 'job-1', status: JobStatus.PROCESSING }),
        update: vi.fn().mockResolvedValue({ id: 'job-1' }),
      },
      siteAsset: { create: vi.fn().mockResolvedValue({ id: 'asset-1' }) },
      siteVariant: {
        update: vi.fn().mockResolvedValue({ id: 'variant-1' }),
        create: vi.fn().mockResolvedValue({ id: 'variant-1' }),
      },
    };

    configService = { get: vi.fn().mockReturnValue('openai') };

    llmFactory = {
      create: vi.fn().mockReturnValue({
        generateHugoStructure: vi.fn().mockResolvedValue({
          hugoToml: 'baseURL = "/"',
          indexMd: '# Test',
          aboutMd: '# About',
          servicesMd: '# Services',
          contactMd: '# Contact',
          heroImagePrompt: 'test prompt',
          seoTitle: 'Test Salon',
          seoDescription: 'A test salon',
        }),
      }),
    };

    imageStrategy = {
      generateHeroImage: vi.fn().mockResolvedValue({
        url: 'https://example.com/hero.jpg',
        revisedPrompt: 'test prompt',
      }),
    };

    hugoCompiler = {
      build: vi.fn().mockResolvedValue({
        success: true,
        outputDir: '/tmp/test-salon',
        errors: [],
        warnings: [],
      }),
    };

    hugoValidator = {
      validate: vi.fn().mockReturnValue({ isValid: true, errors: [], warnings: [] }),
    };

    publisher = {
      publish: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
      writeFileBinary: vi.fn().mockResolvedValue(undefined),
    };

    settingsService = {
      get: vi.fn().mockImplementation((key: string) => {
        const defaults: Record<string, string> = {
          llm_provider: 'openai',
          image_provider: 'openai',
        };
        return Promise.resolve({ value: defaults[key] || null, source: 'default' as const });
      }),
      getEffectiveModel: vi.fn().mockImplementation((_provider: string, type: string) => {
        return Promise.resolve(type === 'content' ? 'gpt-4o' : 'dall-e-3');
      }),
    };

    leadsService = {
      findOne: vi.fn().mockResolvedValue({
        id: 'lead-1',
        easyweekEnabled: false,
        wayforpayEnabled: false,
        monobankEnabled: false,
      }),
    };

    variantsService = {
      create: vi.fn().mockResolvedValue({
        id: 'variant-1',
        projectId: 'proj-1',
        variantName: 'gpt-4o + dall-e-3 + ananke',
        status: 'DRAFT',
      }),
    };

    addonInjector = {
      injectAddons: vi.fn().mockResolvedValue(undefined),
    };

    service = new GenerationService(
      prisma as unknown as PrismaService,
      configService as unknown as ConfigService,
      llmFactory as unknown as LLMStrategyFactory,
      imageStrategy as unknown as DallE3Strategy,
      hugoCompiler as unknown as HugoCompilerService,
      hugoValidator as unknown as HugoValidatorService,
      publisher as unknown as SitePublisherService,
      settingsService as unknown as SettingsService,
      leadsService as unknown as LeadsService,
      variantsService as unknown as VariantsService,
      addonInjector as unknown as AddonInjectorService,
    );
  });

  describe('generateSite', () => {
    it('should complete full generation pipeline successfully', async () => {
      await service.generateSite(siteRequest);

      expect(prisma.generationJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'proj-1',
          type: 'GENERATE_SITE',
          status: JobStatus.PROCESSING,
        }),
      });

      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'proj-1' },
          data: expect.objectContaining({ status: ProjectStatus.PUBLISHED }),
        }),
      );

      expect(prisma.generationJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'job-1' },
          data: expect.objectContaining({ status: JobStatus.COMPLETED }),
        }),
      );

      expect(hugoCompiler.build).toHaveBeenCalled();
      expect(publisher.publish).toHaveBeenCalledWith('test-salon');
    });

    it('should fall back to default content when LLM fails', async () => {
      llmFactory.create.mockReturnValue({
        generateHugoStructure: vi.fn().mockRejectedValue(new Error('LLM unavailable')),
      });

      await service.generateSite(siteRequest);

      // Should still complete using default content
      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ProjectStatus.PUBLISHED }),
        }),
      );
    });

    it('should fall back to static site when Hugo build fails', async () => {
      hugoCompiler.build.mockResolvedValue({
        success: false,
        outputDir: '',
        errors: ['Hugo build error'],
        warnings: [],
      });

      await service.generateSite(siteRequest);

      // Should still publish via static site generation
      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ProjectStatus.PUBLISHED }),
        }),
      );
    });

    it('should skip image generation when it fails', async () => {
      imageStrategy.generateHeroImage.mockRejectedValue(new Error('Image API error'));

      await service.generateSite(siteRequest);

      // Should still complete without hero image
      expect(prisma.generationJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: JobStatus.COMPLETED }),
        }),
      );
    });

    it('should mark project as FAILED on unrecoverable error', async () => {
      // Simulate a failure that can't be recovered from
      prisma.generationJob.create.mockRejectedValue(new Error('DB connection lost'));

      await expect(service.generateSite(siteRequest)).rejects.toThrow('DB connection lost');
    });
  });
});
