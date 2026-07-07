import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GenerationController } from './generation.controller';

describe('GenerationController.getStatus', () => {
  let controller: GenerationController;
  let projectsService: { findOne: ReturnType<typeof vi.fn> };
  let queueService: { addGenerationJob: ReturnType<typeof vi.fn> };
  let themeService: { listAvailableThemes: ReturnType<typeof vi.fn>; getDefaultTheme: ReturnType<typeof vi.fn> };
  let themeSelector: { selectThemeForBusiness: ReturnType<typeof vi.fn> };
  let cache: { getOrSet: ReturnType<typeof vi.fn> };
  let prisma: { generationJob: { findFirst: ReturnType<typeof vi.fn> } };

  const projectId = 'proj-1';

  beforeEach(() => {
    projectsService = { findOne: vi.fn() };
    queueService = { addGenerationJob: vi.fn() };
    themeService = {
      listAvailableThemes: vi.fn(),
      getDefaultTheme: vi.fn(),
    };
    themeSelector = { selectThemeForBusiness: vi.fn() };
    cache = { getOrSet: vi.fn() };
    prisma = { generationJob: { findFirst: vi.fn() } };

    controller = new GenerationController(
      prisma as any,
      projectsService as any,
      queueService as any,
      themeService as any,
      themeSelector as any,
      cache as any,
    );
  });

  it('should return job details when a generation job exists', async () => {
    const mockJob = {
      id: 'job-1',
      status: 'COMPLETED',
      result: { url: 'https://example.com' },
      error: null,
    };
    prisma.generationJob.findFirst.mockResolvedValue(mockJob);

    const result = await controller.getStatus(projectId);

    expect(prisma.generationJob.findFirst).toHaveBeenCalledWith({
      where: { projectId, type: 'GENERATE_SITE' },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toEqual({
      projectId,
      jobId: mockJob.id,
      status: mockJob.status,
      result: mockJob.result,
      error: mockJob.error,
    });
  });

  it('should return NO_JOB when no generation job exists', async () => {
    prisma.generationJob.findFirst.mockResolvedValue(null);

    const result = await controller.getStatus(projectId);

    expect(result).toEqual({
      projectId,
      status: 'NO_JOB',
      message: 'No generation job found',
    });
  });

  it('should query jobs directly via Prisma, not via projectsService', async () => {
    const mockJob = {
      id: 'job-2',
      status: 'FAILED',
      result: null,
      error: 'Build failed',
    };
    prisma.generationJob.findFirst.mockResolvedValue(mockJob);

    await controller.getStatus(projectId);

    // The status endpoint should NOT call projectsService.findOne
    expect(projectsService.findOne).not.toHaveBeenCalled();
  });
});
