import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GenerationProcessor } from './generation.processor';

describe('GenerationProcessor', () => {
  let processor: GenerationProcessor;
  let generationService: { generateSite: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    generationService = { generateSite: vi.fn().mockResolvedValue(undefined) };
    processor = new GenerationProcessor(generationService as any);
  });

  describe('process', () => {
    it('should process generation job successfully', async () => {
      const job = {
        id: 'job-1',
        data: {
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
        },
        updateProgress: vi.fn().mockResolvedValue(undefined),
      };

      await processor.process(job as any);

      expect(generationService.generateSite).toHaveBeenCalledWith(job.data);
      expect(job.updateProgress).toHaveBeenCalledWith(10);
      expect(job.updateProgress).toHaveBeenCalledWith(100);
    });

    it('should throw error if generation fails', async () => {
      const job = {
        id: 'job-2',
        data: { projectId: 'proj-2', leadId: 'lead-2', businessName: 'Fail', slug: 'fail', category: null, description: null, address: null, phone: null, email: null, socialUrl: null },
        updateProgress: vi.fn().mockResolvedValue(undefined),
      };
      generationService.generateSite.mockRejectedValue(new Error('LLM failed'));

      await expect(processor.process(job as any)).rejects.toThrow('LLM failed');
    });
  });
});
