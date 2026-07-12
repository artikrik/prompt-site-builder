import type { ContentProvider, ImageProvider } from './models';

export interface AppSettings {
  llmProvider: ContentProvider;
  llmModel: string;
  imageProvider: ImageProvider;
  imageModel: string;
  openaiApiKey: string | null;
  anthropicApiKey: string | null;
  googleApiKey: string | null;
  deepseekApiKey: string | null;
  mimoApiKey: string | null;
  bflApiKey: string | null;
  // Enrichment API keys
  facebookAppId: string | null;
  facebookAppSecret: string | null;
  facebookAccessToken: string | null;
  googleMapsApiKey: string | null;
  instagramAccessToken: string | null;
  enrichmentAutoRun: boolean;
  enrichmentDefaultSources: string;
  // Integrations
  easyweekEnabled: boolean;
  easyweekApiKey: string | null;
  wayforpayEnabled: boolean;
  wayforpayMerchant: string | null;
  wayforpaySecret: string | null;
  monobankEnabled: boolean;
  monobankApiKey: string | null;
}

export interface UpdateSettingsDto {
  llmProvider?: string;
  llmModel?: string;
  imageProvider?: string;
  imageModel?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  googleApiKey?: string;
  deepseekApiKey?: string;
  mimoApiKey?: string;
  bflApiKey?: string;
  // Enrichment API keys
  facebookAppId?: string;
  facebookAppSecret?: string;
  facebookAccessToken?: string;
  googleMapsApiKey?: string;
  instagramAccessToken?: string;
  enrichmentAutoRun?: string;
  enrichmentDefaultSources?: string;
}

export interface SettingsResponse {
  settings: AppSettings;
  source: Record<string, 'db' | 'env' | 'default'>;
}

export interface SettingsModelsResponse {
  content: Array<{
    id: string;
    provider: string;
    label: string;
    inputPrice: number;
    outputPrice: number;
    contextWindow: number;
    role: string;
  }>;
  image: Array<{
    id: string;
    provider: string;
    label: string;
    pricePerImage: string;
    role: string;
  }>;
}
