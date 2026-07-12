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
    const competitorNames = competitors.map((c) => c.name).join(', ') || 'unknown';

    const result = await this.generateCombined(
      llm,
      businessName,
      niche,
      city,
      weaknesses,
      competitorNames,
      competitors,
    );

    return {
      salesScript: {
        opening: result.opening,
        discovery: result.discovery,
        valueProposition: result.valueProposition,
        objections: result.objections,
        closing: result.closing,
        followUp: result.followUp,
        strategy: result.strategy,
      } as unknown as Record<string, unknown>,
      salesOpportunities: (result.salesOpportunities as SalesOpportunity[] | undefined) || [],
    };
  }

  // ── Combined Generation (1 LLM call instead of 8) ──────

  private async generateCombined(
    llm: ReturnType<LLMStrategyFactory['create']>,
    businessName: string,
    niche: string,
    city: string,
    weaknesses: string[],
    competitorNames: string,
    _competitors: CompetitorInfo[],
  ): Promise<Record<string, unknown>> {
    const prompt = `You are a senior sales trainer and business analyst in Ukraine. Generate a COMPLETE sales script and strategy for "${businessName}" (${niche}, ${city}).

Known weaknesses: ${weaknesses.join(', ') || 'none detected'}
Competitors nearby: ${competitorNames || 'unknown'}

Return ONLY a single JSON object with ALL sections below. Use Ukrainian or Russian language matching the business. Be specific — reference real data points, not generic placeholders.

{
  // 1. OPENING — phone call opening
  "opening": {
    "greeting": "exact greeting in Ukrainian/Russian",
    "icebreaker": "1-2 sentences personalized to this business",
    "hook": "1 sentence value hook that gets attention"
  },

  // 2. DISCOVERY — qualification questions
  "discovery": {
    "qualificationQuestions": [{"question": "exact question", "purpose": "what this reveals"}],
    "painPointProbes": [{"question": "probe question", "target": "which weakness this targets"}],
    "budgetSignals": ["phrase indicating budget", "phrase indicating no budget"]
  },

  // 3. VALUE PROPOSITION
  "valueProposition": {
    "corePromise": "1 sentence",
    "tailoredToBusiness": "2-3 sentences specific to this business",
    "roiExamples": [{"scenario": "specific", "result": "concrete result with numbers"}]
  },

  // 4. OBJECTIONS — 5-7 anticipated objections
  "objections": [{
    "objection": "exact words they'll say (Ukrainian/Russian)",
    "rootCause": "psychological reason",
    "response": "exact 2-3 sentence response",
    "followUp": "what to say if they push back again",
    "evidence": "data point or example"
  }],

  // 5. CLOSING techniques
  "closing": {
    "trialCloses": ["trial close 1", "trial close 2"],
    "assumptiveClose": "exact assumptive close script",
    "urgencyBuilder": "urgency statement",
    "alternativeClose": "alternative if assumptive fails"
  },

  // 6. FOLLOW-UP
  "followUp": {
    "sameDaySms": "SMS text",
    "nextDayEmail": "Email subject + body",
    "threeDayCallback": "call script for 3-day follow-up",
    "referralAsk": "how to ask for referrals even if they say no"
  },

  // 7. STRATEGY
  "strategy": {
    "targetDecisionMaker": "who to talk to, age range, gender",
    "bestTimeToCall": "optimal day/time",
    "dealBreakers": ["thing that kills deal"],
    "quickWins": ["easy concession to keep deal alive"],
    "competitiveAdvantages": ["our strength vs their current setup"]
  },

  // 8. SALES OPPORTUNITIES — 3-5 concrete gaps
  "salesOpportunities": [{
    "gap": "what they're missing",
    "currentState": "how they operate now",
    "recommendation": "what we propose",
    "pitchAngle": "how to pitch this specific gap",
    "revenueImpact": "estimated revenue impact in UAH/month",
    "scriptExcerpt": "relevant sales script excerpt for this gap"
  }]
}`;

    try {
      const response = await llm.generateContent(prompt, { temperature: 0.4, maxTokens: 4000 });
      return this.parseJson(response.content) as Record<string, unknown>;
    } catch {
      return {};
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
