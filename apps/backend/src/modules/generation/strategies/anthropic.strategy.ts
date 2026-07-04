import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { ILLMStrategy, LLMGenerateOptions, LLMResponse, BusinessData, HugoGeneratedContent } from './llm-strategy.interface';

@Injectable()
export class AnthropicStrategy implements ILLMStrategy {
  private client: Anthropic;
  private defaultModel = 'claude-3-5-sonnet-20241022';

  constructor(private readonly configService: ConfigService) {
    this.client = new Anthropic({
      apiKey: this.configService.get<string>('ANTHROPIC_API_KEY'),
    });
  }

  async generateContent(prompt: string, options?: LLMGenerateOptions): Promise<LLMResponse> {
    const response = await this.client.messages.create({
      model: options?.model || this.defaultModel,
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
        heroImagePrompt: parsed.heroImagePrompt || `Professional ${businessData.category || 'business'} services, modern and clean design`,
        seoTitle: parsed.seoTitle || businessData.businessName,
        seoDescription: parsed.seoDescription || businessData.description || '',
      };
    } catch {
      return this.generateDefaultStructure(businessData);
    }
  }

  private buildHugoPrompt(data: BusinessData): string {
    return `Generate a complete Hugo static website structure for a B2B business. Return ONLY a JSON object with these keys:

{
  "hugoToml": "TOML config string",
  "indexMd": "Markdown content for homepage",
  "aboutMd": "Markdown content for about page",
  "servicesMd": "Markdown content for services page",
  "contactMd": "Markdown content for contact page",
  "heroImagePrompt": "DALL-E 3 prompt for hero background image",
  "seoTitle": "SEO optimized title",
  "seoDescription": "Meta description (max 160 chars)"
}

Business details:
- Name: ${data.businessName}
- Category: ${data.category || 'General business'}
- Description: ${data.description || 'Professional services'}
- Address: ${data.address || 'Ukraine'}
- Phone: ${data.phone || 'Contact us'}
- Email: ${data.email || 'Contact form'}

Requirements:
1. Write SEO-optimized Ukrainian text (if business is in Ukraine) or English
2. Include structured data (JSON-LD) in the index page
3. Make the hero image prompt specific and professional
4. Include meta tags for social sharing (Open Graph)
5. The Hugo config should use the '${data.theme || 'hugo-theme-zen'}' theme
6. Base URL should be https://{slug}.sitenow.pp.ua`;
  }

  private getDefaultHugoToml(data: BusinessData): string {
    return `baseURL = "https://${data.businessName.toLowerCase().replace(/\s+/g, '-')}.sitenow.pp.ua"
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

  private generateDefaultStructure(data: BusinessData): HugoGeneratedContent {
    const slug = data.businessName.toLowerCase().replace(/\s+/g, '-');
    return {
      hugoToml: this.getDefaultHugoToml(data),
      indexMd: `---
title: "${data.businessName}"
description: "${data.description || data.businessName}"
---

# ${data.businessName}

${data.description || 'Professional services you can trust.'}

## Why Choose Us?

- Professional team
- Quality service
- Customer satisfaction

[Contact Us](/contact/)`,
      aboutMd: `---
title: "About Us"
---

# About ${data.businessName}

We are a professional ${data.category || 'service'} provider dedicated to delivering exceptional results.`,
      servicesMd: `---
title: "Our Services"
---

# Our Services

Professional ${data.category || 'services'} tailored to your needs.`,
      contactMd: `---
title: "Contact"
---

# Contact Us

**Phone:** ${data.phone || 'Contact us'}
**Email:** ${data.email || 'Contact form'}
**Address:** ${data.address || 'Ukraine'}`,
      heroImagePrompt: `Professional ${data.category || 'business'} services, modern clean design, ${data.businessName}`,
      seoTitle: `${data.businessName} | ${data.category || 'Professional Services'}`,
      seoDescription: data.description || `${data.businessName} - professional ${data.category || 'services'}`,
    };
  }
}
