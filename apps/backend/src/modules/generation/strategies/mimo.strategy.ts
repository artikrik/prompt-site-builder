import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ILLMStrategy, LLMGenerateOptions, LLMResponse, BusinessData, HugoGeneratedContent } from './llm-strategy.interface';

@Injectable()
export class MimoStrategy implements ILLMStrategy {
  private client: OpenAI;

  constructor(private readonly configService: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.configService.get<string>('MIMO_API_KEY'),
      baseURL: this.configService.get<string>('MIMO_BASE_URL', 'https://api.mimo.ai/v1'),
    });
  }

  async generateContent(prompt: string, options?: LLMGenerateOptions): Promise<LLMResponse> {
    const response = await this.client.chat.completions.create({
      model: options?.model || this.configService.get<string>('MIMO_MODEL', 'mimo-auto'),
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
    const prompt = this.buildHugoPrompt(businessData);
    const response = await this.generateContent(prompt, { maxTokens: 8192 });

    try {
      const parsed = JSON.parse(response.content);
      return {
        hugoToml: parsed.hugoToml || '',
        indexMd: parsed.indexMd || '',
        aboutMd: parsed.aboutMd || '',
        servicesMd: parsed.servicesMd || '',
        contactMd: parsed.contactMd || '',
        heroImagePrompt: parsed.heroImagePrompt || '',
        seoTitle: parsed.seoTitle || businessData.businessName,
        seoDescription: parsed.seoDescription || '',
      };
    } catch {
      return this.generateDefaultStructure(businessData);
    }
  }

  private buildHugoPrompt(data: BusinessData): string {
    return `Generate a complete Hugo static website structure for a B2B business. Return ONLY a JSON object:

{
  "hugoToml": "TOML config",
  "indexMd": "Homepage markdown with YAML frontmatter",
  "aboutMd": "About page markdown with YAML frontmatter",
  "servicesMd": "Services page markdown with YAML frontmatter",
  "contactMd": "Contact page markdown with YAML frontmatter",
  "heroImagePrompt": "DALL-E 3 image prompt for hero background",
  "seoTitle": "SEO title",
  "seoDescription": "Meta description (max 160 chars)"
}

Business: ${data.businessName}
Category: ${data.category || 'General'}
Description: ${data.description || 'Professional services'}
Address: ${data.address || 'Ukraine'}
Phone: ${data.phone || 'N/A'}
Email: ${data.email || 'N/A'}

Requirements:
1. Write Ukrainian text (use cyrillic)
2. JSON-LD structured data on homepage
3. Open Graph meta tags via Hugo config
4. Theme: ${data.theme || 'hugo-theme-zen'}
5. Make it professional and SEO-optimized`;
  }

  private generateDefaultStructure(data: BusinessData): HugoGeneratedContent {
    const name = data.businessName;
    const cat = data.category || 'Business';
    return {
      hugoToml: `baseURL = "/"
languageCode = "uk"
title = "${name}"
theme = "${data.theme || 'hugo-theme-zen'}"

[params]
  description = "${data.description || name}"
  businessName = "${name}"
  phone = "${data.phone || ''}"
  email = "${data.email || ''}"
  address = "${data.address || ''}"
  category = "${cat}"`,
      indexMd: `---
title: "${name}"
description: "${data.description || name}"
---

# ${name}

${data.description || 'Professional services you can trust.'}`,
      aboutMd: `---
title: "Про нас"
---

# Про ${name}

Команда професіоналів у сфері ${cat.toLowerCase()}.`,
      servicesMd: `---
title: "Послуги"
---

# Наші послуги

Професійні ${cat.toLowerCase()} послуги.`,
      contactMd: `---
title: "Контакти"
---

# Контакти

**Телефон:** ${data.phone || 'N/A'}
**Email:** ${data.email || 'N/A'}
**Адреса:** ${data.address || 'N/A'}`,
      heroImagePrompt: `Professional ${cat} services, modern design`,
      seoTitle: `${name} | ${cat}`,
      seoDescription: data.description || `${name} - professional services`,
    };
  }
}
