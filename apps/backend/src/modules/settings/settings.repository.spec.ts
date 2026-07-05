import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsRepository } from './settings.repository';

describe('SettingsRepository', () => {
  let repo: SettingsRepository;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      setting: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        delete: vi.fn(),
        findMany: vi.fn(),
      },
    };
    repo = new SettingsRepository(mockPrisma);
  });

  describe('findByKey', () => {
    it('should call prisma.setting.findUnique with correct key', async () => {
      mockPrisma.setting.findUnique.mockResolvedValue({ key: 'llm_provider', value: 'openai' });
      const result = await repo.findByKey('llm_provider');
      expect(mockPrisma.setting.findUnique).toHaveBeenCalledWith({ where: { key: 'llm_provider' } });
      expect(result).toEqual({ key: 'llm_provider', value: 'openai' });
    });

    it('should return null when key not found', async () => {
      mockPrisma.setting.findUnique.mockResolvedValue(null);
      const result = await repo.findByKey('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('upsert', () => {
    it('should call prisma.setting.upsert with key and value', async () => {
      mockPrisma.setting.upsert.mockResolvedValue({ key: 'test_key', value: 'test_value' });
      const result = await repo.upsert('test_key', 'test_value');
      expect(mockPrisma.setting.upsert).toHaveBeenCalledWith({
        where: { key: 'test_key' },
        update: { value: 'test_value' },
        create: { key: 'test_key', value: 'test_value' },
      });
      expect(result).toEqual({ key: 'test_key', value: 'test_value' });
    });
  });

  describe('findAll', () => {
    it('should return all settings', async () => {
      const mockSettings = [
        { key: 'llm_provider', value: 'openai' },
        { key: 'llm_model', value: 'gpt-4o' },
      ];
      mockPrisma.setting.findMany.mockResolvedValue(mockSettings);
      const result = await repo.findAll();
      expect(result).toEqual(mockSettings);
    });
  });

  describe('deleteByKey', () => {
    it('should call prisma.setting.delete with correct key', async () => {
      await repo.deleteByKey('test_key');
      expect(mockPrisma.setting.delete).toHaveBeenCalledWith({ where: { key: 'test_key' } });
    });
  });
});
