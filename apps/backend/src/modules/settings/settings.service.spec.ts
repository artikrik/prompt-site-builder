import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let mockRepo: any;
  let mockEncryption: any;
  let mockConfig: any;

  beforeEach(() => {
    mockRepo = {
      findByKey: vi.fn(),
      upsert: vi.fn(),
      findAll: vi.fn(),
      deleteByKey: vi.fn(),
    };
    mockEncryption = {
      encrypt: vi.fn((v: string) => `enc_${v}`),
      decrypt: vi.fn((v: string) => v.startsWith('enc_') ? v.slice(4) : v),
    };
    // Mock env vars for fallback testing
    const env: Record<string, string> = {
      LLM_PROVIDER: 'anthropic',
      OPENAI_API_KEY: 'sk-env-key',
    };
    mockConfig = {
      get: vi.fn((key: string) => env[key] ?? null),
    };
    service = new SettingsService(mockRepo, mockEncryption, mockConfig);
  });

  describe('get', () => {
    it('should return DB value when present', async () => {
      mockRepo.findByKey.mockResolvedValue({ key: 'llm_provider', value: 'openai' });
      const result = await service.get('llm_provider');
      expect(result.value).toBe('openai');
      expect(result.source).toBe('db');
    });

    it('should fallback to env when DB is null', async () => {
      mockRepo.findByKey.mockResolvedValue(null);
      const result = await service.get('llm_provider');
      expect(result.value).toBe('anthropic');
      expect(result.source).toBe('env');
    });

    it('should fallback to default when both DB and env are null', async () => {
      mockRepo.findByKey.mockResolvedValue(null);
      const result = await service.get('google_api_key');
      expect(result.value).toBeNull();
      expect(result.source).toBe('default');
    });

    it('should decrypt API key values from DB', async () => {
      mockRepo.findByKey.mockResolvedValue({ key: 'openai_api_key', value: 'enc_sk-db-key' });
      const result = await service.get('openai_api_key');
      expect(result.value).toBe('sk-db-key');
      expect(result.source).toBe('db');
    });

    it('should NOT decrypt plain config values from DB', async () => {
      mockRepo.findByKey.mockResolvedValue({ key: 'llm_provider', value: 'openai' });
      await service.get('llm_provider');
      expect(mockEncryption.decrypt).not.toHaveBeenCalled();
    });
  });

  describe('getSettings', () => {
    it('should return full AppSettings with masked API keys', async () => {
      mockRepo.findByKey.mockImplementation((key: string) => {
        if (key === 'llm_provider') return Promise.resolve({ key: 'llm_provider', value: 'anthropic' });
        if (key === 'openai_api_key') return Promise.resolve({ key: 'openai_api_key', value: 'enc_sk-db-key' });
        return Promise.resolve(null);
      });
      const result = await service.getSettings();
      expect(result.llmProvider).toBe('anthropic');
      expect(result.openaiApiKey).toBe('sk-...bKey');
    });
  });

  describe('updateSettings', () => {
    it('should encrypt API keys before saving to DB', async () => {
      await service.updateSettings({ openaiApiKey: 'sk-new-key', llmModel: 'gpt-4o-mini' });
      expect(mockEncryption.encrypt).toHaveBeenCalledWith('sk-new-key');
      expect(mockRepo.upsert).toHaveBeenCalledWith('openai_api_key', 'enc_sk-new-key');
      expect(mockRepo.upsert).toHaveBeenCalledWith('llm_model', 'gpt-4o-mini');
    });

    it('should skip empty API key values', async () => {
      await service.updateSettings({ openaiApiKey: '', llmModel: 'gpt-4o' });
      expect(mockEncryption.encrypt).not.toHaveBeenCalled();
      expect(mockRepo.upsert).toHaveBeenCalledWith('llm_model', 'gpt-4o');
    });
  });
});
