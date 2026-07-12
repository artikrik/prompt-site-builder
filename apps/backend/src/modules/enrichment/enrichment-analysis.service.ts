import { Injectable, Logger } from '@nestjs/common';
import { LLMStrategyFactory } from '../generation/strategies/llm-strategy.factory';
import type { EnrichmentData, CompetitorInfo, SalesOpportunity } from '@prompt-site-builder/shared';

interface ProviderRawData {
  source: string;
  data: Record<string, unknown>;
}

interface SalesScript {
  opening: { greeting: string; icebreaker: string; hook: string };
  discovery: {
    qualificationQuestions: { question: string; purpose: string }[];
    painPointProbes: { question: string; target: string }[];
    budgetSignals: string[];
  };
  valueProposition: { corePromise: string; tailoredToBusiness: string; roiExamples: { scenario: string; result: string }[] };
  objections: { objection: string; rootCause: string; response: string; followUp: string; evidence?: string }[];
  closing: { trialCloses: string[]; assumptiveClose: string; urgencyBuilder: string; alternativeClose: string };
  followUp: { sameDaySms: string; nextDayEmail: string; threeDayCallback: string; referralAsk: string };
  strategy: { targetDecisionMaker: string; bestTimeToCall: string; dealBreakers: string[]; quickWins: string[]; competitiveAdvantages: string[] };
}

@Injectable()
export class EnrichmentAnalysisService {
  private readonly logger = new Logger(EnrichmentAnalysisService.name);

  constructor(private readonly llmFactory: LLMStrategyFactory) {}

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
    const generator = new SalesScriptGenerator();
    return generator.generate(llm, rawData, existing);
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

// ── Sales Script Generator (inline — single file, no DI needed) ──

class SalesScriptGenerator {
  async generate(
    llm: ReturnType<LLMStrategyFactory['create']>,
    rawData: ProviderRawData[],
    existing: Partial<EnrichmentData>,
  ): Promise<Partial<EnrichmentData>> {
    const businessName = this.extract(rawData, 'businessName') || this.extract(rawData, 'name') || 'the business';
    const niche = this.extract(rawData, 'category') || this.extract(rawData, 'niche') || 'local business';
    const city = this.extract(rawData, 'city') || 'Ukraine';
    const weaknesses = this.collectWeaknesses(existing);
    const competitors = (existing.competitors || []) as CompetitorInfo[];

    const [opening, discovery, value, objections, closing, followUp, strategy, opportunities] = await Promise.all([
      this.generateSection(llm, 'opening', this.openingPrompt(businessName, niche, city)),
      this.generateSection(llm, 'discovery', this.discoveryPrompt(businessName, niche, weaknesses)),
      this.generateSection(llm, 'value', this.valuePrompt(businessName, niche, weaknesses)),
      this.generateSection(llm, 'objections', this.objectionsPrompt(businessName, niche, weaknesses, competitors)),
      this.generateSection(llm, 'closing', this.closingPrompt(businessName, niche)),
      this.generateSection(llm, 'followUp', this.followUpPrompt(businessName, niche)),
      this.generateSection(llm, 'strategy', this.strategyPrompt(businessName, niche, competitors)),
      this.generateOpportunities(llm, businessName, niche, weaknesses, competitors),
    ]);

    return {
      salesScript: { opening, discovery, valueProposition: value, objections, closing, followUp, strategy } as unknown as Record<string, unknown>,
      salesOpportunities: opportunities,
    };
  }

  private async generateSection(
    llm: ReturnType<LLMStrategyFactory['create']>,
    section: string,
    prompt: string,
  ): Promise<Record<string, unknown>> {
    try {
      const response = await llm.generateContent(prompt, { temperature: 0.4, maxTokens: 2000 });
      return this.parseJson(response.content);
    } catch (err) {
      return {};
    }
  }

  // ── Prompt templates ────────────────────────────────────

  private openingPrompt(businessName: string, niche: string, city: string): string {
    return `You are a sales trainer in Ukraine. Write a phone call opening for pitching a website to "${businessName}" (${niche}, ${city}).

Return ONLY JSON:
{
  "greeting": "exact greeting in Ukrainian/Russian (match business language)",
  "icebreaker": "1-2 sentences personalized to the business",
  "hook": "1 sentence value hook that gets attention"
}`;
  }

  private discoveryPrompt(businessName: string, niche: string, weaknesses: string[]): string {
    return `You are a sales trainer. Create discovery questions for "${businessName}" (${niche}).
Known weaknesses: ${weaknesses.join(', ') || 'unknown'}

Return ONLY JSON:
{
  "qualificationQuestions": [{"question": "exact question in Ukrainian", "purpose": "what this reveals"}],
  "painPointProbes": [{"question": "probe question", "target": "which weakness this targets"}],
  "budgetSignals": ["phrase indicating budget", "phrase indicating no budget"]
}`;
  }

  private valuePrompt(businessName: string, niche: string, weaknesses: string[]): string {
    return `You are a sales consultant. Create value proposition for "${businessName}" (${niche}).
Weaknesses: ${weaknesses.join(', ') || 'unknown'}

Return ONLY JSON:
{
  "corePromise": "1 sentence",
  "tailoredToBusiness": "2-3 sentences specific to this business",
  "roiExamples": [{"scenario": "specific", "result": "concrete result with numbers"}]
}`;
  }

  private objectionsPrompt(businessName: string, niche: string, weaknesses: string[], competitors: CompetitorInfo[]): string {
    return `You are a senior sales trainer in Ukraine. Generate 5-7 objections "${businessName}" (${niche}) will raise when pitched a new website.

Weaknesses: ${weaknesses.join(', ') || 'unknown'}
Competitors: ${competitors.map((c) => c.name).join(', ') || 'unknown'}

Return ONLY JSON array of:
{
  "objection": "exact words they'll say (Ukrainian/Russian)",
  "rootCause": "psychological reason",
  "response": "exact 2-3 sentence response",
  "followUp": "what to say if they push back again",
  "evidence": "data point or example"
}`;
  }

  private closingPrompt(businessName: string, niche: string): string {
    return `You are a sales closer. Write closing techniques for "${businessName}" (${niche}).

Return ONLY JSON:
{
  "trialCloses": ["trial close 1", "trial close 2"],
  "assumptiveClose": "exact assumptive close script",
  "urgencyBuilder": "urgency statement",
  "alternativeClose": "alternative if assumptive fails"
}`;
  }

  private followUpPrompt(businessName: string, niche: string): string {
    return `You are a sales follow-up expert. Write follow-up templates for "${businessName}" (${niche}).

Return ONLY JSON:
{
  "sameDaySms": "SMS text (Ukrainian/Russian)",
  "nextDayEmail": "Email subject + body",
  "threeDayCallback": "call script for 3-day follow-up",
  "referralAsk": "how to ask for referrals even if they say no"
}`;
  }

  private strategyPrompt(businessName: string, niche: string, competitors: CompetitorInfo[]): string {
    return `You are a sales strategist. Plan sales approach for "${businessName}" (${niche}).
Competitors: ${competitors.map((c) => c.name).join(', ') || 'unknown'}

Return ONLY JSON:
{
  "targetDecisionMaker": "who to talk to, age range, gender",
  "bestTimeToCall": "optimal day/time",
  "dealBreakers": ["thing that kills deal"],
  "quickWins": ["easy concession to keep deal alive"],
  "competitiveAdvantages": ["our strength vs their current setup"]
}`;
  }

  private async generateOpportunities(
    llm: ReturnType<LLMStrategyFactory['create']>,
    businessName: string, niche: string, weaknesses: string[], competitors: CompetitorInfo[],
  ): Promise<SalesOpportunity[]> {
    const prompt = `You are a business analyst. Generate 3-5 sales opportunities for "${businessName}" (${niche}).

Weaknesses: ${weaknesses.join(', ') || 'unknown'}
Competitors: ${competitors.map((c) => c.name).join(', ') || 'unknown'}

Return ONLY JSON array:
[{
  "gap": "what they're missing",
  "currentState": "how they operate now",
  "recommendation": "what we propose",
  "pitchAngle": "how to pitch this specific gap",
  "revenueImpact": "estimated revenue impact in UAH/month",
  "scriptExcerpt": "relevant sales script excerpt for this gap"
}]`;

    try {
      const response = await llm.generateContent(prompt, { temperature: 0.5, maxTokens: 2000 });
      return this.parseJson(response.content);
    } catch {
      return [];
    }
  }

  // ── Helpers ─────────────────────────────────────────────

  private extract(rawData: ProviderRawData[], field: string): string {
    for (const d of rawData) {
      if (typeof d.data[field] === 'string') return d.data[field] as string;
    }
    return '';
  }

  private collectWeaknesses(existing: Partial<EnrichmentData>): string[] {
    const w: string[] = [];
    const competitors = (existing.competitors || []) as CompetitorInfo[];
    for (const comp of competitors) {
      const analysis = (comp as any).websiteAnalysis;
      if (analysis) {
        if (!analysis.hasOnlineBooking) w.push('No online booking');
        if (!analysis.hasPriceList) w.push('No online price list');
        if (!analysis.hasPortfolio) w.push('No portfolio');
        if (!analysis.hasReviews) w.push('No reviews');
      }
    }
    if (!existing.logoUrl) w.push('No professional logo');
    if (!existing.services || !existing.services.length) w.push('Services not clearly listed');
    return w;
  }

  private parseJson(response: string): any {
    try {
      const cleaned = response.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      return Array.isArray(response) ? [] : {};
    }
  }
}
