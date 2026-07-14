import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ILLMStrategy, LLMGenerateOptions, LLMResponse, BusinessData, HugoGeneratedContent } from './llm-strategy.interface';
import { PromptBuilder } from '../prompt-builder';
import { DefaultContentBuilder } from '../default-content.builder';

@Injectable()
export class OpenRouterStrategy implements ILLMStrategy {
  private readonly logger = new Logger(OpenRouterStrategy.name);

  constructor(private readonly configService: ConfigService) {}

  private getApiKey(): string {
    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
    if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');
    return apiKey;
  }

  private getModel(): string {
    return this.configService.get<string>('OPENROUTER_MODEL', 'tencent/hy3:free');
  }

  async generateContent(prompt: string, options?: LLMGenerateOptions): Promise<LLMResponse> {
    const apiKey = this.getApiKey();
    const model = options?.model || this.getModel();

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': this.configService.get<string>('BASE_DOMAIN', 'sitenow.pp.ua'),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options?.maxTokens || 4096,
        temperature: options?.temperature || 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      model: string;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    const content = data.choices[0]?.message?.content || '';

    return {
      content,
      model: data.model || model,
      tokensUsed: (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0),
    };
  }

  async generateHugoStructure(businessData: BusinessData): Promise<HugoGeneratedContent> {
    const baseDomain = this.configService.get<string>('BASE_DOMAIN', 'sitenow.pp.ua');
    const prompt = this.buildHugoPrompt(businessData);
    const response = await this.generateContent(prompt, { maxTokens: 8192 });

    try {
      const parsed = JSON.parse(PromptBuilder.extractJson(response.content));
      if (!PromptBuilder.hasAllRequiredFields(parsed)) {
        return DefaultContentBuilder.build(businessData, baseDomain);
      }
      return {
        hugoToml: parsed.hugoToml,
        indexMd: parsed.indexMd,
        aboutMd: parsed.aboutMd,
        servicesMd: parsed.servicesMd,
        contactMd: parsed.contactMd,
        heroImagePrompt: parsed.heroImagePrompt || `Professional ${businessData.category || 'business'} environment, modern interior, warm lighting, clean composition, no text, no logos`,
        seoTitle: parsed.seoTitle || businessData.businessName,
        seoDescription: parsed.seoDescription || businessData.description || '',
      };
    } catch {
      return DefaultContentBuilder.build(businessData, baseDomain);
    }
  }

  private buildHugoPrompt(data: BusinessData): string {
    return new PromptBuilder(this.configService).buildHugoPrompt(data);
  }
}
