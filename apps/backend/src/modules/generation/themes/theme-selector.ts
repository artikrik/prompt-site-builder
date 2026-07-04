import { Injectable, Logger } from '@nestjs/common';
import { LLMStrategyFactory } from '../strategies/llm-strategy.factory';
import { HUGO_THEMES, getThemeByName, HugoTheme } from './theme-registry';

@Injectable()
export class ThemeSelector {
  private readonly logger = new Logger(ThemeSelector.name);

  constructor(private readonly llmFactory: LLMStrategyFactory) {}

  async selectThemeForBusiness(businessData: {
    businessName: string;
    category: string | null;
    description: string | null;
  }): Promise<HugoTheme> {
    try {
      const llm = this.llmFactory.create();
      const prompt = this.buildThemeSelectionPrompt(businessData);
      const response = await llm.generateContent(prompt, { maxTokens: 256, temperature: 0.3 });

      const selectedName = response.content.trim().toLowerCase();
      const theme = HUGO_THEMES.find((t) => t.name.toLowerCase() === selectedName);

      if (theme) {
        this.logger.log(`AI selected theme "${theme.name}" for "${businessData.businessName}"`);
        return theme;
      }

      this.logger.warn(`AI returned unknown theme "${selectedName}", using default`);
      return this.getFallbackTheme(businessData.category);
    } catch (error) {
      this.logger.warn(`AI theme selection failed: ${error}, using fallback`);
      return this.getFallbackTheme(businessData.category);
    }
  }

  private buildThemeSelectionPrompt(data: {
    businessName: string;
    category: string | null;
    description: string | null;
  }): string {
    const themeList = HUGO_THEMES.map((t) => `- ${t.name}: ${t.description} [${t.category}]`).join('\n');

    return `You are a web design expert. Given a business, select the BEST Hugo theme from the list below.

Business: ${data.businessName}
Category: ${data.category || 'General business'}
Description: ${data.description || 'Professional services'}

Available themes:
${themeList}

Reply with ONLY the theme name (e.g. "ananke"). No explanation.`;
  }

  private getFallbackTheme(category: string | null): HugoTheme {
    if (!category) return getThemeByName('hugo-theme-zen')!;

    const cat = category.toLowerCase();
    if (cat.includes('salon') || cat.includes('beauty') || cat.includes('spa')) {
      return getThemeByName('corporio') || getThemeByName('ananke')!;
    }
    if (cat.includes('restaurant') || cat.includes('cafe') || cat.includes('food')) {
      return getThemeByName('hugo-universal-theme') || getThemeByName('ananke')!;
    }
    if (cat.includes('tech') || cat.includes('it') || cat.includes('software')) {
      return getThemeByName('hugoplate') || getThemeByName('blowfish')!;
    }
    if (cat.includes('law') || cat.includes('legal') || cat.includes('finance')) {
      return getThemeByName('hugo-up-business') || getThemeByName('corporio')!;
    }
    return getThemeByName('ananke')!;
  }
}
