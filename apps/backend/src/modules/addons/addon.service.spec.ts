import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AddonService } from './addon.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('AddonService', () => {
  let service: AddonService;
  let mockPrisma: {
    projectAddon: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    mockPrisma = {
      projectAddon: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    service = new AddonService(mockPrisma as unknown as PrismaService);
  });

  describe('activate', () => {
    it('should create an active addon with correct pricing', async () => {
      mockPrisma.projectAddon.create.mockResolvedValue({
        id: 'addon-1',
        projectId: 'proj-1',
        addonType: 'ONLINE_PAYMENT',
        status: 'ACTIVE',
        priceMonthly: 499,
        config: {},
      });

      await service.activate('proj-1', 'ONLINE_PAYMENT');

      expect(mockPrisma.projectAddon.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'proj-1',
          addonType: 'ONLINE_PAYMENT',
          status: 'ACTIVE',
          priceMonthly: 499,
        }),
      });
    });

    it('should throw ConflictException if addon already exists', async () => {
      mockPrisma.projectAddon.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.activate('proj-1', 'ONLINE_BOOKING')).rejects.toThrow(ConflictException);
    });

    it('should use correct pricing for each addon type', async () => {
      mockPrisma.projectAddon.create.mockResolvedValue({});
      await service.activate('proj-1', 'ONLINE_BOOKING');
      expect(mockPrisma.projectAddon.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ priceMonthly: 299 }) }),
      );

      mockPrisma.projectAddon.create.mockResolvedValue({});
      await service.activate('proj-2', 'CONTENT_MANAGEMENT');
      expect(mockPrisma.projectAddon.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ priceMonthly: 799 }) }),
      );
    });
  });

  describe('deactivate', () => {
    it('should set status to INACTIVE', async () => {
      mockPrisma.projectAddon.findUnique.mockResolvedValue({ id: 'addon-1', status: 'ACTIVE' });
      mockPrisma.projectAddon.update.mockResolvedValue({ id: 'addon-1', status: 'INACTIVE' });

      await service.deactivate('proj-1', 'ONLINE_PAYMENT');

      expect(mockPrisma.projectAddon.update).toHaveBeenCalledWith({
        where: { projectId_addonType: { projectId: 'proj-1', addonType: 'ONLINE_PAYMENT' } },
        data: { status: 'INACTIVE' },
      });
    });

    it('should throw NotFoundException for non-existent addon', async () => {
      mockPrisma.projectAddon.findUnique.mockResolvedValue(null);

      await expect(service.deactivate('proj-1', 'CONTENT_MANAGEMENT')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getActiveAddons', () => {
    it('should return only ACTIVE addons', async () => {
      mockPrisma.projectAddon.findMany.mockResolvedValue([
        { id: '1', addonType: 'ONLINE_PAYMENT', status: 'ACTIVE' },
      ]);

      const result = await service.getActiveAddons('proj-1');

      expect(result).toHaveLength(1);
      expect(mockPrisma.projectAddon.findMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1', status: 'ACTIVE' },
      });
    });
  });

  describe('listByProject', () => {
    it('should return all addons for a project ordered by createdAt desc', async () => {
      mockPrisma.projectAddon.findMany.mockResolvedValue([
        { id: '2', addonType: 'ONLINE_BOOKING' },
        { id: '1', addonType: 'ONLINE_PAYMENT' },
      ]);

      const result = await service.listByProject('proj-1');

      expect(result).toHaveLength(2);
      expect(mockPrisma.projectAddon.findMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('updateConfig', () => {
    it('should update config for existing addon', async () => {
      mockPrisma.projectAddon.findUnique.mockResolvedValue({ id: 'addon-1' });
      mockPrisma.projectAddon.update.mockResolvedValue({ id: 'addon-1', config: { foo: 'bar' } });

      await service.updateConfig('proj-1', 'ONLINE_PAYMENT', { foo: 'bar' });

      expect(mockPrisma.projectAddon.update).toHaveBeenCalledWith({
        where: { projectId_addonType: { projectId: 'proj-1', addonType: 'ONLINE_PAYMENT' } },
        data: { config: { foo: 'bar' } },
      });
    });

    it('should throw NotFoundException for non-existent addon', async () => {
      mockPrisma.projectAddon.findUnique.mockResolvedValue(null);

      await expect(service.updateConfig('proj-1', 'ONLINE_BOOKING', {})).rejects.toThrow(NotFoundException);
    });
  });
});
