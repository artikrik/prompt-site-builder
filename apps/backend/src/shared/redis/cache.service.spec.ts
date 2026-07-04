import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CacheService } from './cache.service';
import { RedisService } from './redis.service';

describe('CacheService', () => {
  let service: CacheService;
  let mockClient: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
    keys: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockClient = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
      keys: vi.fn().mockResolvedValue([]),
    };

    const redisService = {
      getClient: vi.fn().mockReturnValue(mockClient),
    };

    service = new CacheService(redisService as unknown as RedisService);
  });

  describe('get', () => {
    it('should return null for missing key', async () => {
      const result = await service.get('missing');
      expect(result).toBeNull();
    });

    it('should parse JSON value', async () => {
      mockClient.get.mockResolvedValue('{"foo":"bar"}');
      const result = await service.get<{ foo: string }>('key');
      expect(result).toEqual({ foo: 'bar' });
    });

    it('should return raw string for non-JSON', async () => {
      mockClient.get.mockResolvedValue('plain-text');
      const result = await service.get('key');
      expect(result).toBe('plain-text');
    });
  });

  describe('set', () => {
    it('should serialize object values', async () => {
      await service.set('key', { a: 1 }, 60);
      expect(mockClient.set).toHaveBeenCalledWith('key', '{"a":1}', 'EX', 60);
    });

    it('should set string values directly', async () => {
      await service.set('key', 'value', 30);
      expect(mockClient.set).toHaveBeenCalledWith('key', 'value', 'EX', 30);
    });

    it('should set without TTL when ttl is 0', async () => {
      await service.set('key', 'value', 0);
      expect(mockClient.set).toHaveBeenCalledWith('key', 'value');
    });
  });

  describe('del', () => {
    it('should delete a key', async () => {
      await service.del('key');
      expect(mockClient.del).toHaveBeenCalledWith('key');
    });
  });

  describe('delByPrefix', () => {
    it('should delete all keys matching prefix', async () => {
      mockClient.keys.mockResolvedValue(['prefix:a', 'prefix:b']);
      await service.delByPrefix('prefix');
      expect(mockClient.keys).toHaveBeenCalledWith('prefix:*');
      expect(mockClient.del).toHaveBeenCalledWith('prefix:a', 'prefix:b');
    });

    it('should not call del if no keys match', async () => {
      mockClient.keys.mockResolvedValue([]);
      await service.delByPrefix('empty');
      expect(mockClient.del).not.toHaveBeenCalled();
    });
  });

  describe('getOrSet', () => {
    it('should return cached value on hit', async () => {
      mockClient.get.mockResolvedValue('{"cached":true}');
      const factory = vi.fn().mockResolvedValue({ cached: false });

      const result = await service.getOrSet('key', factory, 60);

      expect(result).toEqual({ cached: true });
      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory and cache on miss', async () => {
      mockClient.get.mockResolvedValue(null);
      const factory = vi.fn().mockResolvedValue({ fresh: true });

      const result = await service.getOrSet('key', factory, 60);

      expect(result).toEqual({ fresh: true });
      expect(factory).toHaveBeenCalled();
      expect(mockClient.set).toHaveBeenCalledWith('key', '{"fresh":true}', 'EX', 60);
    });
  });
});
