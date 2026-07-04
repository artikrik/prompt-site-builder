import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueueService } from './queue.service';

describe('QueueService', () => {
  let service: QueueService;
  let generationQueue: { add: ReturnType<typeof vi.fn>; getJob: ReturnType<typeof vi.fn> };
  let scrapingQueue: { add: ReturnType<typeof vi.fn>; getJob: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    generationQueue = { add: vi.fn(), getJob: vi.fn() };
    scrapingQueue = { add: vi.fn(), getJob: vi.fn() };
    service = new QueueService(generationQueue as any, scrapingQueue as any);
  });

  describe('addGenerationJob', () => {
    it('should add a job to generation queue', async () => {
      const jobData = {
        projectId: 'proj-1',
        leadId: 'lead-1',
        businessName: 'Test Salon',
        slug: 'test-salon',
        category: 'Beauty',
        description: 'A beauty salon',
        address: 'Kyiv',
        phone: '+380123456789',
        email: 'test@test.com',
        socialUrl: null,
      };
      generationQueue.add.mockResolvedValue({ id: 'job-1', data: jobData });

      const result = await service.addGenerationJob(jobData);

      expect(generationQueue.add).toHaveBeenCalledWith('generate-site', jobData, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 86400 },
        removeOnFail: { age: 604800 },
      });
      expect(result.id).toBe('job-1');
    });
  });

  describe('addScrapingJob', () => {
    it('should add a job to scraping queue', async () => {
      const jobData = { city: 'Kyiv', category: 'salon', limit: 10 };
      scrapingQueue.add.mockResolvedValue({ id: 'job-2', data: jobData });

      const result = await service.addScrapingJob(jobData);

      expect(scrapingQueue.add).toHaveBeenCalledWith('scrape-leads', jobData, {
        attempts: 2,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: { age: 86400 },
        removeOnFail: { age: 604800 },
      });
      expect(result.id).toBe('job-2');
    });
  });

  describe('getGenerationJobStatus', () => {
    it('should return job status', async () => {
      const mockJob = {
        id: 'job-1',
        getState: vi.fn().mockResolvedValue('completed'),
        progress: 100,
        data: { projectId: 'proj-1' },
        returnvalue: null,
        failedReason: null,
      };
      generationQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.getGenerationJobStatus('job-1');

      expect(result).toEqual({
        id: 'job-1',
        state: 'completed',
        progress: 100,
        data: { projectId: 'proj-1' },
        returnvalue: null,
        failedReason: null,
      });
    });

    it('should return null for non-existent job', async () => {
      generationQueue.getJob.mockResolvedValue(null);
      const result = await service.getGenerationJobStatus('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getScrapingJobStatus', () => {
    it('should return job status', async () => {
      const mockJob = {
        id: 'job-2',
        getState: vi.fn().mockResolvedValue('active'),
        progress: 50,
        data: { city: 'Kyiv' },
        returnvalue: null,
        failedReason: null,
      };
      scrapingQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.getScrapingJobStatus('job-2');

      expect(result).toEqual({
        id: 'job-2',
        state: 'active',
        progress: 50,
        data: { city: 'Kyiv' },
        returnvalue: null,
        failedReason: null,
      });
    });
  });
});
