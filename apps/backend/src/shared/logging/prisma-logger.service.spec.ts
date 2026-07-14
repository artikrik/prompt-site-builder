import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaLogger } from './prisma-logger.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PrismaLogger', () => {
  let logger: PrismaLogger;
  let prismaMock: { systemLog: { create: ReturnType<typeof vi.fn> } };

  beforeEach(() => {
    prismaMock = {
      systemLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    };
    logger = new PrismaLogger(prismaMock as unknown as PrismaService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('log() saves INFO to database', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logger.log('server started', 'Bootstrap');

    expect(consoleSpy).toHaveBeenCalledWith('[Bootstrap] server started');

    // saveLog is fire-and-forget — wait for the microtask
    await vi.waitFor(() => {
      expect(prismaMock.systemLog.create).toHaveBeenCalledWith({
        data: {
          level: 'INFO',
          module: 'Bootstrap',
          message: 'server started',
          details: undefined,
        },
      });
    });
  });

  it('warn() saves WARN to database', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    logger.warn('deprecated config', 'Config');

    expect(consoleSpy).toHaveBeenCalledWith('[Config] deprecated config');

    await vi.waitFor(() => {
      expect(prismaMock.systemLog.create).toHaveBeenCalledWith({
        data: {
          level: 'WARN',
          module: 'Config',
          message: 'deprecated config',
          details: undefined,
        },
      });
    });
  });

  it('error() saves ERROR with trace to database', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logger.error('connection failed', 'Error: timeout\n  at db.ts:10', 'DB');

    expect(consoleSpy).toHaveBeenCalledWith('[DB] connection failed', 'Error: timeout\n  at db.ts:10');

    await vi.waitFor(() => {
      expect(prismaMock.systemLog.create).toHaveBeenCalledWith({
        data: {
          level: 'ERROR',
          module: 'DB',
          message: 'connection failed',
          details: { trace: 'Error: timeout\n  at db.ts:10' },
        },
      });
    });
  });

  it('database failures do not crash the app', async () => {
    prismaMock.systemLog.create.mockRejectedValue(new Error('DB down'));

    // Should not throw
    expect(() => {
      logger.log('test message');
      logger.warn('test warning');
      logger.error('test error');
    }).not.toThrow();

    // Give fire-and-forget promises time to settle
    await new Promise((r) => setTimeout(r, 50));
  });

  it('uses "App" as default context', async () => {
    logger.log('no context');

    await vi.waitFor(() => {
      expect(prismaMock.systemLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ module: 'App' }) }),
      );
    });
  });

  it('truncates messages over 1000 chars', async () => {
    const longMessage = 'x'.repeat(1500);

    logger.log(longMessage);

    await vi.waitFor(() => {
      expect(prismaMock.systemLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ message: 'x'.repeat(1000) }),
        }),
      );
    });
  });
});
