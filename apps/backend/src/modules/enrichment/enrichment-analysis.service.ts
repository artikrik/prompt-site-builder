import { Injectable, Logger } from '@nestjs/common';
import { LLMStrategyFactory } from '../generation/strategies/llm-strategy.factory';
import { SalesScriptGenerator } from './sales-script-generator';
import type { EnrichmentData, CompetitorInfo } from '@prompt-site-builder/shared';

interface ProviderRawData {
  source: string;
  data: Record<string, unknown>;
}

@Injectable()
export class EnrichmentAnalysisService {
  private readonly logger = new Logger(EnrichmentAnalysisService.name);

  constructor(
    private readonly llmFactory: LLMStrategyFactory,
    private readonly salesScriptGenerator: SalesScriptGenerator,
  ) {}

  async analyze(rawData: ProviderRawData[], existingData: Partial<EnrichmentData>): Promise<Partial<EnrichmentData>> {
    const llm = this.llmFactory.create();

    const [brand, competitors, sales] = await Promise.all([
      this.brandAnalysis(llm, rawData, existingData),
      this.competitorAnalysis(llm, rawData, existingData),
      this.salesAnalysis(llm, rawData, existingData),
    ]);

    return this.deepMerge(existingData, brand, competitors, sales);
  }

  // ── Brand Analysis ──────────────────────────────────────

  private async brandAnalysis(
    llm: ReturnType<LLMStrategyFactory['create']>,
    rawData: ProviderRawData[],
    _existing: Partial<EnrichmentData>,
  ): Promise<Partial<EnrichmentData>> {
    const bio = this.extract(rawData, 'bio') || '';
    const posts = this.extractArray(rawData, 'posts').slice(0, 5);

    const prompt = `You are a brand analyst. Extract brand information from this business data.

BUSINESS DATA:
- Bio/About: ${bio}
- Recent posts: ${posts.join('\n')}

Return ONLY valid JSON (no markdown, no explanation):
{
  "brandColors": { "primary": "#hex", "secondary": "#hex", "accent": "#hex", "extractedFrom": "logo|website|posts" },
  "fonts": { "preferred": ["font name"], "note": "where observed" },
  "toneOfVoice": {
    "style": "professional|friendly|luxury|casual|technical|warm|bold",
    "formality": "formal|semi-formal|casual",
    "keyPhrases": ["phrase1"],
    "languageMix": "uk|ru|en|mix",
    "emojiUsage": "heavy|moderate|rare|none",
    "sampleBio": "rewritten best version of their bio"
  }
}
If a field cannot be determined, omit it.`;

    try {
      const response = await llm.generateContent(prompt, { temperature: 0.3, maxTokens: 2000 });
      return this.parseJson(response.content);
    } catch (err) {
      this.logger.warn(`Brand analysis failed: ${err}`);
      return {};
    }
  }

  // ── Competitor Analysis ─────────────────────────────────

  private async competitorAnalysis(
    llm: ReturnType<LLMStrategyFactory['create']>,
    rawData: ProviderRawData[],
    existing: Partial<EnrichmentData>,
  ): Promise<Partial<EnrichmentData>> {
    const competitors = (existing.competitors || []) as CompetitorInfo[];
    if (!competitors.length) return {};

    const ourBusiness = this.extractBusinessSummary(rawData);

    // Analyze each competitor's website
    const analyzed = await Promise.all(
      competitors.map(async (comp) => {
        if (!comp.website) return comp;

        try {
          const websiteContent = await this.fetchWebsite(comp.website);
          if (!websiteContent) return comp;

          const prompt = `Analyze this competitor website for "${ourBusiness}".

WEBSITE: ${comp.website}
CONTENT: ${websiteContent.slice(0, 3000)}

Return ONLY JSON:
{
  "websiteAnalysis": {
    "pages": ["page1", "page2"],
    "hasOnlineBooking": true,
    "hasPriceList": false,
    "hasPortfolio": true,
    "hasReviews": false,
    "strengths": ["what they do well"],
    "weaknesses": ["what they lack"]
  },
  "positioning": "1 sentence positioning",
  "uniqueSellingPoints": ["usp1"],
  "services": [{ "name": "service name", "price": "price if visible" }]
}`;

          const response = await llm.generateContent(prompt, { temperature: 0.3, maxTokens: 2000 });
          return { ...comp, ...this.parseJson(response.content) };
        } catch {
          return comp;
        }
      }),
    );

    // Market gap synthesis
    const gapPrompt = `Given our business "${ourBusiness}" and competitors:
${JSON.stringify(analyzed.map((c) => ({ name: c.name, positioning: c.positioning, websiteAnalysis: (c as any).websiteAnalysis })), null, 2)}

Identify market opportunities. Return ONLY JSON:
{
  "marketGap": {
    "opportunities": ["specific opportunity 1", "specific opportunity 2", "specific opportunity 3"],
    "recommendedPages": ["page to build 1", "page to build 2"],
    "differentiationAngle": "1 sentence — why choose us over them"
  }
}`;

    try {
      const gapResponse = await llm.generateContent(gapPrompt, { temperature: 0.5, maxTokens: 1500 });
      const marketGap = this.parseJson(gapResponse.content);
      return { competitors: analyzed, ...marketGap };
    } catch (err) {
      this.logger.warn(`Market gap analysis failed: ${err}`);
      return { competitors: analyzed };
    }
  }

  // ── Sales Analysis (delegates to SalesScriptGenerator) ──

  private async salesAnalysis(
    llm: ReturnType<LLMStrategyFactory['create']>,
    rawData: ProviderRawData[],
    existing: Partial<EnrichmentData>,
  ): Promise<Partial<EnrichmentData>> {
    return this.salesScriptGenerator.generate(llm, rawData, existing);
  }

  // ── Helpers ─────────────────────────────────────────────

  private extract(rawData: ProviderRawData[], field: string): string {
    for (const d of rawData) {
      if (typeof d.data[field] === 'string') return d.data[field] as string;
    }
    return '';
  }

  private extractArray(rawData: ProviderRawData[], field: string): string[] {
    for (const d of rawData) {
      if (Array.isArray(d.data[field])) return d.data[field] as string[];
    }
    return [];
  }

  private extractBusinessSummary(rawData: ProviderRawData[]): string {
    const name = this.extract(rawData, 'businessName') || this.extract(rawData, 'name') || 'Unknown';
    const bio = this.extract(rawData, 'bio');
    const services = this.extractArray(rawData, 'services');
    return [`Name: ${name}`, bio && `Bio: ${bio}`, services.length && `Services: ${services.join(', ')}`].filter(Boolean).join(' | ');
  }

  private async fetchWebsite(url: string): Promise<string> {
    try {
      const fullUrl = url.startsWith('http') ? url : `https://${url}`;
      const response = await fetch(fullUrl, { signal: AbortSignal.timeout(10000) });
      return response.text();
    } catch {
      return '';
    }
  }

  private parseJson(response: string): Record<string, unknown> {
    try {
      const cleaned = response.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      return {};
    }
  }

  private deepMerge(...objects: Partial<EnrichmentData>[]): Partial<EnrichmentData> {
    const result: Record<string, unknown> = {};
    for (const obj of objects) {
      if (!obj) continue;
      for (const [key, value] of Object.entries(obj)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
          result[key] = [...(result[key] as unknown[] || []), ...value];
        } else if (typeof value === 'object') {
          result[key] = { ...(result[key] as Record<string, unknown> || {}), ...value as Record<string, unknown> };
        } else {
          result[key] = value;
        }
      }
    }
    return result as Partial<EnrichmentData>;
  }
}

