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

    const result = await this.generateCombined(
      llm,
      businessName,
      niche,
      city,
      weaknesses,
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

  private buildCompetitorAnalysis(competitors: CompetitorInfo[]): string {
    if (!competitors.length) return 'No competitor data available.';

    return competitors.map((c) => {
      const parts: string[] = [`${c.name} (rating: ${c.rating}, reviews: ${c.reviewCount})`];
      if (c.services?.length) parts.push(`  Services: ${c.services.map((s) => s.name).join(', ')}`);
      if (c.websiteAnalysis) {
        const a = c.websiteAnalysis;
        parts.push(`  Online presence: booking=${a.hasOnlineBooking}, prices=${a.hasPriceList}, portfolio=${a.hasPortfolio}, reviews=${a.hasReviews}`);
        if (a.strengths?.length) parts.push(`  Strengths: ${a.strengths.join(', ')}`);
      }
      return parts.join('\n');
    }).join('\n\n');
  }

  private async generateCombined(
    llm: ReturnType<LLMStrategyFactory['create']>,
    businessName: string,
    niche: string,
    city: string,
    weaknesses: string[],
    competitors: CompetitorInfo[],
  ): Promise<Record<string, unknown>> {
    const competitorNames = competitors.map((c) => c.name).join(', ') || 'unknown';
    const competitorAnalysis = this.buildCompetitorAnalysis(competitors);

    const prompt = `You are a senior sales trainer and business analyst in Ukraine. Generate a COMPLETE sales script and strategy for "${businessName}" (${niche}, ${city}).

Known weaknesses: ${weaknesses.join(', ') || 'none detected'}
Competitors nearby: ${competitorNames}

Competitive analysis (use this to craft targeted objection-handling and competitive advantages):
${competitorAnalysis}

Return ONLY a single JSON object with ALL sections below. Use Ukrainian or Russian language matching the business. Be specific — reference real data points, not generic placeholders.

{
  "opening": {
    "greeting": "exact greeting in Ukrainian/Russian",
    "icebreaker": "1-2 sentences personalized to this business",
    "hook": "1 sentence value hook that gets attention"
  },

  "discovery": {
    "qualificationQuestions": [{"question": "exact question", "purpose": "what this reveals"}],
    "painPointProbes": [{"question": "probe question", "target": "which weakness this targets"}],
    "budgetSignals": ["phrase indicating budget", "phrase indicating no budget"]
  },

  "valueProposition": {
    "corePromise": "1 sentence",
    "tailoredToBusiness": "2-3 sentences specific to this business",
    "roiExamples": [{"scenario": "specific", "result": "concrete result with numbers"}]
  },

  "objections": [{
    "objection": "exact words client will say (Ukrainian/Russian)",
    "rootCause": "psychological reason behind this objection",
    "response": "exact 2-3 sentence response",
    "followUp": "what to say if they push back again",
    "evidence": "data point or example to counter this objection"
  }],

  "closing": {
    "trialCloses": ["trial close phrase 1", "trial close phrase 2"],
    "assumptiveClose": "exact assumptive close script",
    "urgencyBuilder": "urgency statement with reason",
    "alternativeClose": "alternative approach if assumptive fails"
  },

  "followUp": {
    "sameDaySms": "SMS text to send same day",
    "nextDayEmail": "Email subject and body for next day",
    "threeDayCallback": "call script for 3-day follow-up",
    "referralAsk": "how to ask for referrals even if prospect says no"
  },

  "strategy": {
    "targetDecisionMaker": "who to talk to, age range, gender",
    "bestTimeToCall": "optimal day and time for calling",
    "dealBreakers": ["situation that kills the deal"],
    "quickWins": ["easy concession to keep deal alive"],
    "competitiveAdvantages": ["our strength vs each specific competitor"]
  },

  "salesOpportunities": [{
    "gap": "what they are missing compared to competitors",
    "currentState": "how they operate now",
    "recommendation": "what we propose to close this gap",
    "pitchAngle": "how to pitch this specific gap",
    "revenueImpact": "estimated revenue impact in UAH/month",
    "scriptExcerpt": "relevant sales script excerpt for this opportunity"
  }]
}`;

    try {
      const response = await llm.generateContent(prompt, { temperature: 0.4, maxTokens: 8000 });
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
