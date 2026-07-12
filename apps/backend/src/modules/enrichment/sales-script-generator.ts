import { Injectable } from '@nestjs/common';
import { LLMStrategyFactory } from '../generation/strategies/llm-strategy.factory';
import type { EnrichmentData, CompetitorInfo, SalesOpportunity } from '@prompt-site-builder/shared';

interface ProviderRawData {
  source: string;
  data: Record<string, unknown>;
}

@Injectable()
export class SalesScriptGenerator {
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

  // ── Section Generators ────────────────────────────────────

  private async generateSection(
    llm: ReturnType<LLMStrategyFactory['create']>,
    _section: string,
    prompt: string,
  ): Promise<Record<string, unknown>> {
    try {
      const response = await llm.generateContent(prompt, { temperature: 0.4, maxTokens: 2000 });
      return this.parseJson(response.content) as Record<string, unknown>;
    } catch {
      return {};
    }
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
      const parsed = this.parseJson(response.content);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  // ── Prompts ───────────────────────────────────────────────

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
      const analysis = (comp as unknown as Record<string, unknown>).websiteAnalysis as Record<string, unknown> | undefined;
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

  private parseJson(response: string): unknown {
    try {
      const cleaned = response.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      return {};
    }
  }
}
