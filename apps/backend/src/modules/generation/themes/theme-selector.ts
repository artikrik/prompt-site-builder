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

Theme selection rules (MUST follow):
- Medical/clinic/vet/health → hugo-fresh (clean, medical-focused)
- Salon/beauty/spa/gym/fitness → hugo-hero-theme (bold hero, visual)
- Restaurant/cafe/food → hugo-universal-theme (visual, carousel)
- Construction/real estate/auto → hugo-universal-theme (corporate, trust)
- Law/legal/finance → ananke (authoritative, professional)
- Cleaning/logistics/plumber/trades → hugo-scroll (single-page, trades)
- Tech/SaaS/startup → hugoplate (modern, landing page)
- Default/other → ananke (modern, responsive, business)

Available themes:
${themeList}

Reply with ONLY the theme name (e.g. "ananke"). No explanation.`;
  }

  private getFallbackTheme(category: string | null): HugoTheme {
    if (!category) return getThemeByName('ananke')!;

    const cat = category.toLowerCase();

    // Ukrainian + English keyword matching
    const ukToEn: Record<string, string> = {
      'салон': 'salon', 'краси': 'salon', 'перукарн': 'salon', 'нігт': 'salon', 'маникюр': 'salon',
      'медицина': 'medical', 'клінік': 'medical', 'стоматолог': 'medical', 'лікар': 'medical', 'медичн': 'medical', 'аптек': 'medical',
      'будівництво': 'construction', 'ремонт': 'construction', 'будівельн': 'construction',
      'ресторан': 'restaurant', 'кафе': 'restaurant', 'їдальн': 'restaurant', 'бар': 'restaurant',
      'юрист': 'law', 'адвокат': 'law', 'правов': 'law', 'юридичн': 'law', 'нотаріус': 'law',
      'авто': 'auto', 'автосервіс': 'auto', 'сто': 'auto', 'майстерн': 'auto', 'шиномонтаж': 'auto',
      'клінінг': 'cleaning', 'прибир': 'cleaning', 'уборк': 'cleaning',
      'спортзал': 'gym', 'фітнес': 'gym', 'тренажерн': 'gym',
      'логістика': 'logistics', 'транспорт': 'logistics', 'доставк': 'logistics', 'вантаж': 'logistics',
      'ветеринар': 'vet', 'ветклінік': 'vet', 'зооклінік': 'vet',
      'сало': 'salon', 'beauty': 'salon', 'spa': 'salon', 'nail': 'salon',
      'medical': 'medical', 'clinic': 'medical', 'dentist': 'medical', 'doctor': 'medical', 'health': 'medical',
      'construct': 'construction', 'renovat': 'construction',
      'restaurant': 'restaurant', 'cafe': 'restaurant', 'food': 'restaurant',
      'law': 'law', 'legal': 'law', 'attorney': 'law',
      'auto': 'auto', 'car': 'auto', 'repair': 'auto', 'garage': 'auto',
      'clean': 'cleaning', 'janitor': 'cleaning',
      'gym': 'gym', 'fitness': 'gym', 'sport': 'gym',
      'logistic': 'logistics', 'transport': 'logistics', 'delivery': 'logistics',
      'vet': 'vet', 'animal': 'vet', 'pet': 'vet',
    };

    let normalizedCat = cat;
    for (const [key, enKey] of Object.entries(ukToEn)) {
      if (cat.includes(key)) { normalizedCat = enKey; break; }
    }

    // Category → best available theme mapping (matches CLAUDE.md spec)
    if (normalizedCat === 'medical' || normalizedCat === 'vet') {
      return getThemeByName('hugo-fresh') || getThemeByName('ananke')!;
    }
    if (normalizedCat === 'salon' || normalizedCat === 'gym') {
      return getThemeByName('hugo-hero-theme') || getThemeByName('corporio') || getThemeByName('ananke')!;
    }
    if (normalizedCat === 'restaurant') {
      return getThemeByName('hugo-universal-theme') || getThemeByName('ananke')!;
    }
    if (normalizedCat === 'construction' || normalizedCat === 'auto' || normalizedCat === 'real estate') {
      return getThemeByName('hugo-universal-theme') || getThemeByName('ananke')!;
    }
    if (normalizedCat === 'law') {
      return getThemeByName('ananke') || getThemeByName('hugo-up-business')!;
    }
    if (normalizedCat === 'cleaning') {
      return getThemeByName('hugo-fresh') || getThemeByName('ananke')!;
    }
    if (normalizedCat === 'logistics' || normalizedCat === 'plumbing') {
      return getThemeByName('hugo-scroll') || getThemeByName('ananke')!;
    }
    if (normalizedCat === 'tech') {
      return getThemeByName('hugoplate') || getThemeByName('blowfish')!;
    }
    return getThemeByName('ananke')!;
  }
}
