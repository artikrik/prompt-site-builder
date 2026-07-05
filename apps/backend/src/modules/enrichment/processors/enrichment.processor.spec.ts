import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnrichmentProcessor } from './enrichment.processor';
import { EnrichmentService } from '../enrichment.service';

describe('EnrichmentProcessor', () => {
  let processor: EnrichmentProcessor;
  let mockService: EnrichmentService;

  function makeJob(data: { leadId: string; type: string }): any {
    return {
      id: 'job-1',
      data,
      updateProgress: vi.fn().mockResolvedValue(undefined),
    };
  }

  beforeEach(() => {
    mockService = {
      enrichLead: vi.fn().mockResolvedValue(undefined),
    } as unknown as EnrichmentService;
    processor = new EnrichmentProcessor(mockService);
  });

  it('should process ENRICH_LEAD job and call enrichmentService.enrichLead', async () => {
    const job = makeJob({ leadId: 'lead-1', type: 'ENRICH_LEAD' });

    await processor.process(job);

    expect(job.updateProgress).toHaveBeenCalledWith(10);
    expect(mockService.enrichLead).toHaveBeenCalledWith('lead-1');
    expect(job.updateProgress).toHaveBeenCalledWith(100);
  });

  it('should skip non-ENRICH_LEAD job types', async () => {
    const job = makeJob({ leadId: 'lead-1', type: 'SCRAPE_LEADS' });

    await processor.process(job);

    expect(mockService.enrichLead).not.toHaveBeenCalled();
    expect(job.updateProgress).not.toHaveBeenCalled();
  });

  it('should rethrow errors from enrichmentService', async () => {
    const job = makeJob({ leadId: 'lead-1', type: 'ENRICH_LEAD' });
    (mockService.enrichLead as any).mockRejectedValue(new Error('Enrichment failed'));

    await expect(processor.process(job)).rejects.toThrow('Enrichment failed');

    expect(job.updateProgress).toHaveBeenCalledWith(10);
    expect(mockService.enrichLead).toHaveBeenCalledWith('lead-1');
  });
});
