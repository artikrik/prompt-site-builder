import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WidgetsService } from './widgets.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { WidgetType } from '@prompt-site-builder/shared';

describe('WidgetsService', () => {
  let service: WidgetsService;
  let prisma: {
    clientWidget: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    prisma = {
      clientWidget: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
    service = new WidgetsService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('should create a booking widget', async () => {
      prisma.clientWidget.create.mockResolvedValue({
        id: 'widget-1',
        projectId: 'project-1',
        type: 'BOOKING',
        config: { provider: 'easyweek', accountId: '123' },
        enabled: true,
      });

      const result = await service.create({
        projectId: 'project-1',
        type: WidgetType.BOOKING,
        config: { provider: 'easyweek', accountId: '123' },
      });

      expect(result.type).toBe('BOOKING');
      expect(prisma.clientWidget.create).toHaveBeenCalled();
    });
  });

  describe('findByProject', () => {
    it('should return all widgets for a project', async () => {
      prisma.clientWidget.findMany.mockResolvedValue([]);
      const result = await service.findByProject('project-1');
      expect(result).toEqual([]);
    });
  });

  describe('toggleEnabled', () => {
    it('should toggle widget enabled state', async () => {
      prisma.clientWidget.findUnique.mockResolvedValue({ id: 'widget-1' });
      prisma.clientWidget.update.mockResolvedValue({ id: 'widget-1', enabled: false });

      const result = await service.toggleEnabled('widget-1', false);
      expect(result.enabled).toBe(false);
    });
  });

  describe('getWidgetHtml', () => {
    it('should generate booking widget HTML', async () => {
      prisma.clientWidget.findMany.mockResolvedValue([
        {
          id: 'w1',
          type: 'BOOKING',
          enabled: true,
          config: { provider: 'easyweek', accountId: '123' },
        },
      ]);

      const html = await service.getWidgetHtml('project-1');
      expect(html).toContain('easyweek-widget');
      expect(html).toContain('data-account="123"');
    });

    it('should generate payment widget HTML', async () => {
      prisma.clientWidget.findMany.mockResolvedValue([
        {
          id: 'w1',
          type: 'PAYMENT',
          enabled: true,
          config: { provider: 'wayforpay', merchantId: 'mp-123' },
        },
      ]);

      const html = await service.getWidgetHtml('project-1');
      expect(html).toContain('wayforpay-widget');
    });

    it('should not include disabled widgets', async () => {
      prisma.clientWidget.findMany.mockResolvedValue([
        {
          id: 'w1',
          type: 'BOOKING',
          enabled: false,
          config: { provider: 'easyweek', accountId: '123' },
        },
      ]);

      const html = await service.getWidgetHtml('project-1');
      expect(html).toBe('');
    });
  });
});
