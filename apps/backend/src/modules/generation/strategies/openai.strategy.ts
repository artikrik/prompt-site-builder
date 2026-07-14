import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../../settings/settings.service';
import OpenAI from 'openai';
import { ILLMStrategy, LLMGenerateOptions, LLMResponse, BusinessData, HugoGeneratedContent } from './llm-strategy.interface';
import { PromptBuilder } from '../prompt-builder';
import { DefaultContentBuilder } from '../default-content.builder';

@Injectable()
export class OpenAIStrategy implements ILLMStrategy {
  private readonly logger = new Logger(OpenAIStrategy.name);

  constructor(
    private readonly settingsService: SettingsService,
    private readonly configService: ConfigService,
  ) {}

  private async getClient(): Promise<OpenAI> {
    const apiKey = await this.settingsService.getApiKey('openai');
    if (!apiKey) throw new Error('OpenAI API key not configured');
    return new OpenAI({ apiKey });
  }

  private async getModel(): Promise<string> {
    return this.settingsService.getEffectiveModel('openai', 'content');
  }

  async generateContent(prompt: string, options?: LLMGenerateOptions): Promise<LLMResponse> {
    const client = await this.getClient();
    const model = options?.model || (await this.getModel());
    const response = await client.chat.completions.create({
      model,
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature || 0.7,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.choices[0]?.message?.content || '';

    return {
      content,
      model: response.model,
      tokensUsed: (response.usage?.prompt_tokens || 0) + (response.usage?.completion_tokens || 0),
    };
  }

  async generateHugoStructure(businessData: BusinessData): Promise<HugoGeneratedContent> {
    const baseDomain = this.configService.get<string>('BASE_DOMAIN', 'sitenow.pp.ua');
    const prompt = this.buildHugoPrompt(businessData);
    const response = await this.generateContent(prompt, { maxTokens: 16384 });

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
