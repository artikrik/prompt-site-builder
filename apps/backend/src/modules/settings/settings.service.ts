import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsRepository } from './settings.repository';
import { EncryptionService } from './encryption.service';
import type { AppSettings, UpdateSettingsDto, ContentProvider, ImageProvider } from '@prompt-site-builder/shared';
import { getDefaultModel } from '@prompt-site-builder/shared';

const ENCRYPTED_KEYS = new Set([
  'openai_api_key', 'anthropic_api_key', 'google_api_key',
  'deepseek_api_key', 'mimo_api_key', 'bfl_api_key',
  'apify_api_key',
  'facebook_app_secret', 'facebook_access_token',
  'google_maps_api_key', 'instagram_access_token',
  'easyweek_api_key', 'wayforpay_secret', 'monobank_api_key',
]);

const ENV_KEY_MAP: Record<string, string> = {
  openai_api_key: 'OPENAI_API_KEY',
  anthropic_api_key: 'ANTHROPIC_API_KEY',
  google_api_key: 'GOOGLE_API_KEY',
  deepseek_api_key: 'DEEPSEEK_API_KEY',
  mimo_api_key: 'MIMO_API_KEY',
  bfl_api_key: 'BFL_API_KEY',
  apify_api_key: 'APIFY_TOKEN',
  llm_provider: 'LLM_PROVIDER',
  image_provider: 'IMAGE_PROVIDER',
  facebook_app_id: 'FACEBOOK_APP_ID',
  facebook_app_secret: 'FACEBOOK_APP_SECRET',
  facebook_access_token: 'FACEBOOK_ACCESS_TOKEN',
  google_maps_api_key: 'GOOGLE_MAPS_API_KEY',
  instagram_access_token: 'INSTAGRAM_ACCESS_TOKEN',
  enrichment_auto_run: 'ENRICHMENT_AUTO_RUN',
  enrichment_default_sources: 'ENRICHMENT_DEFAULT_SOURCES',
};

const DEFAULTS: Record<string, string | null> = {
  llm_provider: 'openai',
  image_provider: 'openai',
  llm_model: 'gpt-4o',
  image_model: 'dall-e-3',
};

function maskApiKey(key: string | null): string | null {
  if (!key) return null;
  if (key.length <= 8) return '••••••••';
  return `${key.slice(0, 3)}...${key.slice(-4)}`;
}

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private readonly repo: SettingsRepository,
    private readonly encryption: EncryptionService,
    private readonly configService: ConfigService,
  ) {}

  async get(key: string): Promise<{ value: string | null; source: 'db' | 'env' | 'default' }> {
    // 1. Try DB
    const record = await this.repo.findByKey(key);
    if (record) {
      const value = ENCRYPTED_KEYS.has(key) ? this.encryption.decrypt(record.value) : record.value;
      return { value, source: 'db' };
    }

    // 2. Try env
    const envKey = ENV_KEY_MAP[key] ?? key.toUpperCase();
    const envValue = this.configService.get<string>(envKey);
    if (envValue !== undefined && envValue !== null && envValue !== '') {
      return { value: envValue, source: 'env' };
    }

    // 3. Default
    const defaultVal = DEFAULTS[key] ?? null;
    return { value: defaultVal, source: 'default' };
  }

  async getSettings(): Promise<AppSettings> {
    const keys = [
      'llm_provider', 'llm_model', 'image_provider', 'image_model',
      'openai_api_key', 'anthropic_api_key', 'google_api_key',
      'deepseek_api_key', 'mimo_api_key', 'bfl_api_key', 'apify_api_key',
      'facebook_app_id', 'facebook_app_secret', 'facebook_access_token',
      'google_maps_api_key', 'instagram_access_token',
      'enrichment_auto_run', 'enrichment_default_sources',
      'easyweek_enabled', 'easyweek_api_key',
      'wayforpay_enabled', 'wayforpay_merchant', 'wayforpay_secret',
      'monobank_enabled', 'monobank_api_key',
    ];

    const results = await Promise.all(keys.map((k) => this.get(k)));
    const values: Record<string, string | null> = {};
    for (let i = 0; i < keys.length; i++) {
      values[keys[i]] = results[i].value;
    }

    return {
      llmProvider: (values.llm_provider ?? 'openai') as ContentProvider,
      llmModel: values.llm_model ?? 'gpt-4o',
      imageProvider: (values.image_provider ?? 'openai') as ImageProvider,
      imageModel: values.image_model ?? 'dall-e-3',
      openaiApiKey: maskApiKey(values.openai_api_key),
      anthropicApiKey: maskApiKey(values.anthropic_api_key),
      googleApiKey: maskApiKey(values.google_api_key),
      deepseekApiKey: maskApiKey(values.deepseek_api_key),
      mimoApiKey: maskApiKey(values.mimo_api_key),
      bflApiKey: maskApiKey(values.bfl_api_key),
      apifyApiKey: maskApiKey(values.apify_api_key),
      facebookAppId: values.facebook_app_id ?? null,
      facebookAppSecret: maskApiKey(values.facebook_app_secret),
      facebookAccessToken: maskApiKey(values.facebook_access_token),
      googleMapsApiKey: maskApiKey(values.google_maps_api_key),
      instagramAccessToken: maskApiKey(values.instagram_access_token),
      enrichmentAutoRun: values.enrichment_auto_run === 'true',
      enrichmentDefaultSources: values.enrichment_default_sources ?? 'instagram,facebook,googleMaps',
      easyweekEnabled: values.easyweek_enabled === 'true',
      easyweekApiKey: maskApiKey(values.easyweek_api_key),
      wayforpayEnabled: values.wayforpay_enabled === 'true',
      wayforpayMerchant: values.wayforpay_merchant ?? null,
      wayforpaySecret: maskApiKey(values.wayforpay_secret),
      monobankEnabled: values.monobank_enabled === 'true',
      monobankApiKey: maskApiKey(values.monobank_api_key),
    };
  }

  async updateSettings(dto: UpdateSettingsDto): Promise<{ saved: string[] }> {
    const entries = Object.entries(dto).filter(([, v]) => v !== undefined);
    const saved: string[] = [];

    for (const [camelKey, value] of entries) {
      // Convert camelCase to snake_case
      const key = camelKey.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
      if (value === null || value === '') {
        await this.repo.deleteByKey(key).catch(() => {});
        saved.push(key);
        continue;
      }

      const dbValue = ENCRYPTED_KEYS.has(key) ? this.encryption.encrypt(value as string) : (value as string);
      await this.repo.upsert(key, dbValue);
      saved.push(key);
    }

    this.logger.log(`Settings updated: ${saved.join(', ')}`);
    return { saved };
  }

  async getApiKey(provider: string): Promise<string | null> {
    const keyName = `${provider}_api_key`;
    const { value } = await this.get(keyName);
    return value;
  }

  async getEffectiveModel(provider: string, type: 'content' | 'image'): Promise<string> {
    const modelKey = type === 'content' ? 'llm_model' : 'image_model';
    const { value } = await this.get(modelKey);
    if (value) return value;
    return getDefaultModel(provider, type);
  }
}
