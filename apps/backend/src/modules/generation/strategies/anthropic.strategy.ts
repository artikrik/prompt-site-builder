import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../../settings/settings.service';
import Anthropic from '@anthropic-ai/sdk';
import { ILLMStrategy, LLMGenerateOptions, LLMResponse, BusinessData, HugoGeneratedContent } from './llm-strategy.interface';
import { PromptBuilder } from '../prompt-builder';
import { DefaultContentBuilder } from '../default-content.builder';

@Injectable()
export class AnthropicStrategy implements ILLMStrategy {
  private readonly logger = new Logger(AnthropicStrategy.name);

  constructor(
    private readonly settingsService: SettingsService,
    private readonly configService: ConfigService,
  ) {}

  private async getClient(): Promise<Anthropic> {
    const apiKey = await this.settingsService.getApiKey('anthropic');
    if (!apiKey) throw new Error('Anthropic API key not configured');
    return new Anthropic({ apiKey });
  }

  private async getModel(): Promise<string> {
    return this.settingsService.getEffectiveModel('anthropic', 'content');
  }

  async generateContent(prompt: string, options?: LLMGenerateOptions): Promise<LLMResponse> {
    const client = await this.getClient();
    const model = options?.model || (await this.getModel());
    const response = await client.messages.create({
      model,
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature || 0.7,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    const content = textBlock ? textBlock.text : '';

    return {
      content,
      model: response.model,
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
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
