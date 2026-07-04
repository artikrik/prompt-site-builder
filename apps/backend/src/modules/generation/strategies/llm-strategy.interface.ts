export interface LLMGenerateOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  tokensUsed: number;
}

export interface ILLMStrategy {
  generateContent(prompt: string, options?: LLMGenerateOptions): Promise<LLMResponse>;
  generateHugoStructure(businessData: BusinessData): Promise<HugoGeneratedContent>;
}

export interface BusinessData {
  businessName: string;
  category: string | null;
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  socialUrl: string | null;
  theme?: string;
}

export interface HugoGeneratedContent {
  hugoToml: string;
  indexMd: string;
  aboutMd: string;
  servicesMd: string;
  contactMd: string;
  heroImagePrompt: string;
  seoTitle: string;
  seoDescription: string;
}
