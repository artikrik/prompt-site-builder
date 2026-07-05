export interface ContentModel {
  id: string;
  provider: 'openai' | 'anthropic' | 'google' | 'deepseek' | 'mimo';
  label: string;
  inputPrice: number;
  outputPrice: number;
  contextWindow: number;
  role: string;
}

export interface ImageModel {
  id: string;
  provider: 'openai' | 'google' | 'bfl';
  label: string;
  pricePerImage: string;
  role: string;
}

export type ContentProvider = ContentModel['provider'];
export type ImageProvider = ImageModel['provider'];

export const MODEL_REGISTRY = {
  content: [
    { id: 'gpt-4.1', provider: 'openai', label: 'GPT-4.1', inputPrice: 2.00, outputPrice: 8.00, contextWindow: 1_000_000, role: 'Новий флагман' },
    { id: 'gpt-4o', provider: 'openai', label: 'GPT-4o', inputPrice: 2.50, outputPrice: 10.00, contextWindow: 128_000, role: 'Флагман' },
    { id: 'gpt-4o-mini', provider: 'openai', label: 'GPT-4o Mini', inputPrice: 0.15, outputPrice: 0.60, contextWindow: 128_000, role: 'Економ' },
    { id: 'claude-opus-4', provider: 'anthropic', label: 'Claude Opus 4', inputPrice: 15.00, outputPrice: 75.00, contextWindow: 200_000, role: 'Макс. якість' },
    { id: 'claude-sonnet-4', provider: 'anthropic', label: 'Claude Sonnet 4', inputPrice: 3.00, outputPrice: 15.00, contextWindow: 200_000, role: 'Преміум якість' },
    { id: 'claude-haiku-4-5', provider: 'anthropic', label: 'Claude Haiku 4.5', inputPrice: 0.80, outputPrice: 4.00, contextWindow: 200_000, role: 'Економ' },
    { id: 'gemini-2.5-pro', provider: 'google', label: 'Gemini 2.5 Pro', inputPrice: 1.25, outputPrice: 10.00, contextWindow: 1_000_000, role: 'Дешевий флагман' },
    { id: 'gemini-2.5-flash', provider: 'google', label: 'Gemini 2.5 Flash', inputPrice: 0.15, outputPrice: 0.60, contextWindow: 1_000_000, role: 'Найдешевший' },
    { id: 'deepseek-chat', provider: 'deepseek', label: 'DeepSeek Chat', inputPrice: 0.27, outputPrice: 1.10, contextWindow: 128_000, role: 'Бюджет' },
    { id: 'mimo-v2.5', provider: 'mimo', label: 'MiMo v2.5', inputPrice: 0.14, outputPrice: 0.28, contextWindow: 1_000_000, role: 'Найдешевший + multimodal' },
  ],
  image: [
    { id: 'gpt-image-1', provider: 'openai', label: 'GPT-image-1', pricePerImage: '0.02–0.12', role: 'Новий OpenAI image' },
    { id: 'dall-e-3', provider: 'openai', label: 'DALL-E 3', pricePerImage: '0.04–0.08', role: 'Поточний default' },
    { id: 'imagen-4', provider: 'google', label: 'Imagen 4', pricePerImage: '0.02–0.04', role: 'Дешевий + якісний' },
    { id: 'flux-1-pro', provider: 'bfl', label: 'FLUX.1 Pro', pricePerImage: '0.05', role: 'Найкращий фотореалізм' },
  ],
} as const;

export function getModelsByProvider(provider: string, type: 'content' | 'image') {
  const models = MODEL_REGISTRY[type] as readonly (ContentModel | ImageModel)[];
  return models.filter((m) => m.provider === provider);
}

export function getDefaultModel(provider: string, type: 'content' | 'image'): string {
  const models = getModelsByProvider(provider, type);
  return models.length > 0 ? models[0].id : '';
}
