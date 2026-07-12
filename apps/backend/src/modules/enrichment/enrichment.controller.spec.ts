import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnrichmentController } from './enrichment.controller';
import { EnrichmentService } from './enrichment.service';
import { QueueService } from '../queue/queue.service';

describe('EnrichmentController', () => {
  let controller: EnrichmentController;
  let mockService: { getEnrichmentData: ReturnType<typeof vi.fn>; updateEnrichmentSources: ReturnType<typeof vi.fn> };
  let mockQueue: { addEnrichmentJob: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockService = {
      getEnrichmentData: vi.fn(),
      updateEnrichmentSources: vi.fn(),
    };

    mockQueue = {
      addEnrichmentJob: vi.fn(),
    };

    controller = new EnrichmentController(
      mockService as unknown as EnrichmentService,
      mockQueue as unknown as QueueService,
    );
  });

  describe('enrichLead', () => {
    it('should return {jobId} contract (not {message})', async () => {
      mockQueue.addEnrichmentJob.mockResolvedValue({ id: 'job-123' });

      const result = await controller.enrichLead('lead-1');

      expect(result).toEqual({ jobId: 'job-123' });
      expect(result).not.toHaveProperty('message');
      expect(mockQueue.addEnrichmentJob).toHaveBeenCalledWith('lead-1');
    });
  });

  describe('getEnrichment', () => {
    it('should return enrichment data for a lead', async () => {
      const mockData = {
        brandColors: { primary: '#ff0000', secondary: '#00ff00' },
        services: [{ name: 'Service 1', price: '100 UAH' }],
      };
      mockService.getEnrichmentData.mockResolvedValue(mockData);

      const result = await controller.getEnrichment('lead-1');

      expect(result).toEqual(mockData);
      expect(mockService.getEnrichmentData).toHaveBeenCalledWith('lead-1');
    });
  });

  describe('updateSources', () => {
    it('should update enrichment sources', async () => {
      mockService.updateEnrichmentSources.mockResolvedValue({ sources: ['instagram', 'facebook'] });

      const result = await controller.updateSources('lead-1', { sources: ['instagram', 'facebook'] });

      expect(result).toEqual({ sources: ['instagram', 'facebook'] });
      expect(mockService.updateEnrichmentSources).toHaveBeenCalledWith('lead-1', ['instagram', 'facebook']);
    });
  });
});
