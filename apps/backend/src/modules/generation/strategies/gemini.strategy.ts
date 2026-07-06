import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { SettingsService } from '../../settings/settings.service';
import {
  ILLMStrategy,
  LLMGenerateOptions,
  LLMResponse,
  BusinessData,
  HugoGeneratedContent,
} from './llm-strategy.interface';

@Injectable()
export class GeminiStrategy implements ILLMStrategy {
  private readonly logger = new Logger(GeminiStrategy.name);

  constructor(
    private readonly settingsService: SettingsService,
    private readonly configService: ConfigService,
  ) {}

  private async getClient(): Promise<OpenAI> {
    const apiKey = await this.settingsService.getApiKey('google');
    if (!apiKey) throw new Error('Google API key not configured');
    return new OpenAI({
      apiKey,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    });
  }

  private async getModel(): Promise<string> {
    return this.settingsService.getEffectiveModel('google', 'content');
  }

  async generateContent(
    prompt: string,
    options?: LLMGenerateOptions,
  ): Promise<LLMResponse> {
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
      tokensUsed:
        (response.usage?.prompt_tokens || 0) +
        (response.usage?.completion_tokens || 0),
    };
  }

  async generateHugoStructure(
    businessData: BusinessData,
  ): Promise<HugoGeneratedContent> {
    const prompt = this.buildHugoPrompt(businessData);
    const response = await this.generateContent(prompt, { maxTokens: 8192 });

    try {
      const parsed = JSON.parse(response.content);
      return {
        hugoToml: parsed.hugoToml || this.getDefaultHugoToml(businessData),
        indexMd: parsed.indexMd || '',
        aboutMd: parsed.aboutMd || '',
        servicesMd: parsed.servicesMd || '',
        contactMd: parsed.contactMd || '',
        heroImagePrompt:
          parsed.heroImagePrompt ||
          `Professional ${businessData.category || 'business'} services`,
        seoTitle: parsed.seoTitle || businessData.businessName,
        seoDescription:
          parsed.seoDescription || businessData.description || '',
      };
    } catch {
      return this.generateDefaultStructure(businessData);
    }
  }

  private buildHugoPrompt(data: BusinessData): string {
    return `Generate a complete Hugo static website structure for a B2B business. Return ONLY a JSON object:

{
  "hugoToml": "TOML config",
  "indexMd": "Homepage markdown",
  "aboutMd": "About page markdown",
  "servicesMd": "Services page markdown",
  "contactMd": "Contact page markdown",
  "heroImagePrompt": "DALL-E 3 image prompt",
  "seoTitle": "SEO title",
  "seoDescription": "Meta description"
}

Business: ${data.businessName}
Category: ${data.category || 'General'}
Description: ${data.description || 'Professional services'}
Address: ${data.address || 'Ukraine'}
Phone: ${data.phone || 'N/A'}
Email: ${data.email || 'N/A'}

Requirements:
1. SEO-optimized text (Ukrainian if Ukraine-based, else English)
2. JSON-LD structured data on homepage
3. Open Graph meta tags
4. Theme: ${data.theme || 'hugo-theme-zen'}
5. Base URL: https://{slug}.${this.configService.get<string>('BASE_DOMAIN', 'sitenow.pp.ua')}`;
  }

  private getDefaultHugoToml(data: BusinessData): string {
    return `baseURL = "https://${data.businessName.toLowerCase().replace(/\s+/g, '-')}.${this.configService.get<string>('BASE_DOMAIN', 'sitenow.pp.ua')}"
languageCode = "uk"
title = "${data.businessName}"
theme = "${data.theme || 'hugo-theme-zen'}"

[params]
  description = "${data.description || data.businessName}"
  businessName = "${data.businessName}"
  phone = "${data.phone || ''}"
  email = "${data.email || ''}"
  address = "${data.address || ''}"

[markup]
  [markup.goldmark]
    [markup.goldmark.renderer]
      unsafe = true`;
  }

  private generateDefaultStructure(
    data: BusinessData,
  ): HugoGeneratedContent {
    return {
      hugoToml: this.getDefaultHugoToml(data),
      indexMd: `---
title: "${data.businessName}"
description: "${data.description || data.businessName}"
---

# ${data.businessName}

${data.description || 'Professional services you can trust.'}

[Contact Us](/contact/)`,
      aboutMd: `---
title: "About Us"
---

# About ${data.businessName}

Professional ${data.category || 'services'} provider.`,
      servicesMd: `---
title: "Services"
---

# Our Services

Professional ${data.category || 'services'}.`,
      contactMd: `---
title: "Contact"
---

# Contact Us

**Phone:** ${data.phone || 'N/A'}
**Email:** ${data.email || 'N/A'}
**Address:** ${data.address || 'Ukraine'}`,
      heroImagePrompt: `Professional ${data.category || 'business'} services`,
      seoTitle: `${data.businessName} | ${data.category || 'Services'}`,
      seoDescription:
        data.description ||
        `${data.businessName} - professional services`,
    };
  }
}
