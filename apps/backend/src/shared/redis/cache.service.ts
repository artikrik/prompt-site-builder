import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(private readonly redis: RedisService) {}

  async get<T>(key: string): Promise<T | null> {
    const client = this.redis.getClient();
    const raw = await client.get(key);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }

  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    const client = this.redis.getClient();
    const serialized =
      typeof value === 'string' ? value : JSON.stringify(value);

    try {
      if (ttlSeconds > 0) {
        await client.set(key, serialized, 'EX', ttlSeconds);
      } else {
        await client.set(key, serialized);
      }
    } catch (err) {
      this.logger.warn(`Cache set failed for key "${key}":`, err);
    }
  }

  async del(key: string): Promise<void> {
    const client = this.redis.getClient();
    try {
      await client.del(key);
    } catch (err) {
      this.logger.warn(`Cache del failed for key "${key}":`, err);
    }
  }

  async delByPrefix(prefix: string): Promise<void> {
    const client = this.redis.getClient();
    try {
      const keys = await client.keys(`${prefix}:*`);
      if (keys.length > 0) {
        await client.del(...keys);
        this.logger.debug(`Invalidated ${keys.length} cache keys for prefix "${prefix}"`);
      }
    } catch (err) {
      this.logger.warn(`Cache delByPrefix failed for prefix "${prefix}":`, err);
    }
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds = 300,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      this.logger.debug(`Cache hit for "${key}"`);
      return cached;
    }

    this.logger.debug(`Cache miss for "${key}"`);
    const value = await factory();

    this.set(key, value, ttlSeconds).catch(() => {});

    return value;
  }
}
