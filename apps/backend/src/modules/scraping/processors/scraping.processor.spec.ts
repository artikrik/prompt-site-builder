import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScrapingProcessor } from './scraping.processor';
import { ScrapingService } from '../scraping.service';

describe('ScrapingProcessor', () => {
  let processor: ScrapingProcessor;
  let mockService: ScrapingService;

  function makeJob(name: string, data: Record<string, unknown> = {}): any {
    return {
      id: 'job-1',
      name,
      data: { city: 'Kyiv', category: 'dentist', ...data },
      updateProgress: vi.fn().mockResolvedValue(undefined),
    };
  }

  beforeEach(() => {
    mockService = {
      scrapeAndCreateLeads: vi.fn().mockResolvedValue({ scraped: 5, created: 3, skipped: 2 }),
      scrapeLead: vi.fn().mockResolvedValue(undefined),
    } as unknown as ScrapingService;
    processor = new ScrapingProcessor(mockService);
  });

  it('should call scrapeLead for per-lead jobs with leadId and platforms', async () => {
    const job = makeJob('scrape-leads', { leadId: 'lead-1', platforms: ['googleMaps', 'instagram'] });

    await processor.process(job);

    expect(job.updateProgress).toHaveBeenCalledWith(10);
    expect(mockService.scrapeLead).toHaveBeenCalledWith('lead-1', ['googleMaps', 'instagram']);
    expect(mockService.scrapeAndCreateLeads).not.toHaveBeenCalled();
    expect(job.updateProgress).toHaveBeenCalledWith(100);
  });

  it('should call scrapeAndCreateLeads for bulk jobs without leadId', async () => {
    const job = makeJob('scrape-leads');

    await processor.process(job);

    expect(job.updateProgress).toHaveBeenCalledWith(10);
    expect(mockService.scrapeAndCreateLeads).toHaveBeenCalledWith(job.data);
    expect(mockService.scrapeLead).not.toHaveBeenCalled();
    expect(job.updateProgress).toHaveBeenCalledWith(100);
  });

  it('should call scrapeAndCreateLeads when leadId present but platforms empty', async () => {
    const job = makeJob('scrape-leads', { leadId: 'lead-1', platforms: [] });

    await processor.process(job);

    expect(mockService.scrapeAndCreateLeads).toHaveBeenCalledWith(job.data);
    expect(mockService.scrapeLead).not.toHaveBeenCalled();
  });

  it('should skip and return early when job name is not scrape-leads', async () => {
    const job = makeJob('enrich-lead');

    await processor.process(job);

    expect(mockService.scrapeAndCreateLeads).not.toHaveBeenCalled();
    expect(job.updateProgress).not.toHaveBeenCalled();
  });

  it('should skip unnamed jobs', async () => {
    const job = { id: 'job-1', name: undefined, data: {}, updateProgress: vi.fn() } as any;

    await processor.process(job);

    expect(mockService.scrapeAndCreateLeads).not.toHaveBeenCalled();
  });

  it('should rethrow errors from scrapeAndCreateLeads', async () => {
    const job = makeJob('scrape-leads');
    (mockService.scrapeAndCreateLeads as any).mockRejectedValue(new Error('Scraping API down'));

    await expect(processor.process(job)).rejects.toThrow('Scraping API down');

    expect(job.updateProgress).toHaveBeenCalledWith(10);
    expect(mockService.scrapeAndCreateLeads).toHaveBeenCalledWith(job.data);
  });

  it('should rethrow errors from scrapeLead for per-lead jobs', async () => {
    const job = makeJob('scrape-leads', { leadId: 'lead-1', platforms: ['googleMaps'] });
    (mockService.scrapeLead as any).mockRejectedValue(new Error('Enrichment failed'));

    await expect(processor.process(job)).rejects.toThrow('Enrichment failed');

    expect(job.updateProgress).toHaveBeenCalledWith(10);
    expect(mockService.scrapeLead).toHaveBeenCalledWith('lead-1', ['googleMaps']);
  });
});
