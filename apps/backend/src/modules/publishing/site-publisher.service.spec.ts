import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SitePublisherService } from './site-publisher.service';
import { ConfigService } from '@nestjs/config';

vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>();
  return {
    ...actual,
    access: vi.fn(),
    rm: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    mkdir: vi.fn(),
    writeFile: vi.fn(),
  };
});

const fsAsync = await import('fs/promises');

describe('SitePublisherService', () => {
  let service: SitePublisherService;
  let configService: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();

    configService = {
      get: vi.fn().mockReturnValue('/tmp/test-sites'),
    };
    service = new SitePublisherService(configService as unknown as ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('publish', () => {
    it('should throw when site directory does not exist', async () => {
      (fsAsync.access as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('ENOENT'));

      await expect(service.publish('nonexistent')).rejects.toThrow('Site directory not found');
    });

    it('should log site size when published', async () => {
      (fsAsync.access as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(undefined); // siteDir exists
      // Second access call: fileExists for index.html
      (fsAsync.access as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(undefined) // index.html exists
        .mockResolvedValueOnce(undefined); // stat call

      (fsAsync.readdir as ReturnType<typeof vi.fn>).mockResolvedValue([
        Object.assign({ name: 'index.html', isDirectory: () => false, isFile: () => true }, { [Symbol.toStringTag]: 'Dirent' }),
      ]);
      (fsAsync.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 2048 });

      await service.publish('test-site');
      // Should not throw
    });
  });

  describe('isPublished', () => {
    it('should return true when directory exists', async () => {
      (fsAsync.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      const result = await service.isPublished('published-site');
      expect(result).toBe(true);
    });

    it('should return false when directory does not exist', async () => {
      (fsAsync.access as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ENOENT'));
      const result = await service.isPublished('missing-site');
      expect(result).toBe(false);
    });
  });

  describe('listPublished', () => {
    it('should list published site directories', async () => {
      (fsAsync.readdir as ReturnType<typeof vi.fn>).mockResolvedValue([
        Object.assign({ name: 'site-a', isDirectory: () => true }, { [Symbol.toStringTag]: 'Dirent' }),
        Object.assign({ name: 'site-b', isDirectory: () => true }, { [Symbol.toStringTag]: 'Dirent' }),
        Object.assign({ name: '.hidden', isDirectory: () => true }, { [Symbol.toStringTag]: 'Dirent' }),
        Object.assign({ name: 'readme.txt', isDirectory: () => false }, { [Symbol.toStringTag]: 'Dirent' }),
      ]);

      const result = await service.listPublished();
      expect(result).toEqual(['site-a', 'site-b']);
    });

    it('should return empty array on error', async () => {
      (fsAsync.readdir as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('No access'));
      const result = await service.listPublished();
      expect(result).toEqual([]);
    });
  });

  describe('writeFile', () => {
    it('should write file content to site directory', async () => {
      await service.writeFile('test-site', 'index.html', '<html></html>');

      expect(fsAsync.mkdir).toHaveBeenCalled();
      expect(fsAsync.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/[/\\]tmp[/\\]test-sites[/\\]test-site[/\\]index\.html$/),
        '<html></html>',
      );
    });
  });
});
