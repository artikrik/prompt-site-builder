import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ILLMStrategy, LLMGenerateOptions, LLMResponse, BusinessData, HugoGeneratedContent } from './llm-strategy.interface';

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
    return `Generate a complete Hugo static website structure for a business. Return ONLY a JSON object:

{
  "hugoToml": "TOML config with baseURL, languageCode=uk, theme, params",
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
      hugoToml: `baseURL = "/"\nlanguageCode = "uk"\ntitle = "${name}"\ntheme = "${data.theme || 'hugo-theme-zen'}"`,
      indexMd: `---\ntitle: "${name}"\n---\n\n# ${name}\n\n${data.description || 'Professional services.'}`,
      aboutMd: `---\ntitle: "Про нас"\n---\n\n# Про ${name}\n\nКоманда професіоналів.`,
      servicesMd: `---\ntitle: "Послуги"\n---\n\n# Наші послуги\n\nПрофесійні послуги.`,
      contactMd: `---\ntitle: "Контакти"\n---\n\n# Контакти\n\n**Телефон:** ${data.phone || 'N/A'}`,
      heroImagePrompt: `Professional ${cat} services, modern design`,
      seoTitle: `${name} | ${cat}`,
      seoDescription: data.description || `${name} - professional services`,
    };
  }
}
