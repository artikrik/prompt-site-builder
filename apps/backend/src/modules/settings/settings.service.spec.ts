import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsService } from './settings.service';
import { ConfigService } from '@nestjs/config';

describe('SettingsService', () => {
  let service: SettingsService;
  let configService: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    configService = {
      get: vi.fn().mockImplementation((key: string, defaultVal?: unknown) => {
        const env: Record<string, string | undefined> = {
          LLM_PROVIDER: 'openai',
          BASE_DOMAIN: 'sitenow.pp.ua',
          HUGO_SITES_PATH: '/var/www/client-sites',
          EASYWEEK_API_KEY: 'ew-key-123',
          WAYFORPAY_MERCHANT: 'wf-merchant',
          MONOBANK_API_KEY: undefined,
        };
        return env[key] ?? defaultVal ?? null;
      }),
    };

    service = new SettingsService(configService as unknown as ConfigService);
  });

  describe('getSettings', () => {
    it('should return all app settings', () => {
      const settings = service.getSettings();

      expect(settings.llmProvider).toBe('openai');
      expect(settings.defaultTheme).toBe('hugo-theme-zen');
      expect(settings.baseDomain).toBe('sitenow.pp.ua');
      expect(settings.hugoSitesPath).toBe('/var/www/client-sites');
      expect(settings.widgets.easyweekEnabled).toBe(true);
      expect(settings.widgets.wayforpayEnabled).toBe(true);
      expect(settings.widgets.monobankEnabled).toBe(false);
    });

    it('should use defaults when env vars are missing', () => {
      configService.get.mockImplementation((_key: string, defaultVal?: unknown) => defaultVal ?? null);
      const settings = service.getSettings();
      expect(settings.llmProvider).toBe('openai');
      expect(settings.baseDomain).toBe('sitenow.pp.ua');
    });
  });

  describe('updateSettings', () => {
    it('should log and return current settings', () => {
      const settings = service.updateSettings({ llmProvider: 'anthropic' });
      expect(settings.llmProvider).toBe('openai'); // env-based, not mutable
    });
  });
});
