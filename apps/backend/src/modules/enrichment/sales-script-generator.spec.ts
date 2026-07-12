import { describe, it, expect, vi } from 'vitest';
import { SalesScriptGenerator } from './sales-script-generator';
import type { LLMResponse } from '../generation/strategies/llm-strategy.interface';

function makeMockLLM(responseContent: string): any {
  return {
    generateContent: vi.fn().mockResolvedValue({
      content: responseContent,
      model: 'test-model',
      tokensUsed: 500,
    } as LLMResponse),
  };
}

function makeRawData(overrides: Record<string, string> = {}): any[] {
  return [{ source: 'google', data: { businessName: 'TestBiz', category: 'dentist', city: 'Lviv', ...overrides } }];
}

function competitorWithAnalysis(name: string, rating: number, hasBooking: boolean): any {
  return {
    name,
    rating,
    reviewCount: 50,
    services: [{ name: 'Teeth cleaning' }],
    websiteAnalysis: {
      pages: ['/'],
      hasOnlineBooking: hasBooking,
      hasPriceList: true,
      hasPortfolio: false,
      hasReviews: true,
      strengths: ['Good SEO'],
    },
  };
}

const fullScriptJson = JSON.stringify({
  opening: { greeting: 'Добрий день', icebreaker: 'Test icebreaker', hook: 'Test hook' },
  discovery: {
    qualificationQuestions: [{ question: 'Q1?', purpose: 'Understand needs' }],
    painPointProbes: [{ question: 'P1?', target: 'No online booking' }],
    budgetSignals: ['Have budget', 'No budget'],
  },
  valueProposition: {
    corePromise: 'We help you grow',
    tailoredToBusiness: 'Specifically for you',
    roiExamples: [{ scenario: 'More clients', result: '+50000 UAH/month' }],
  },
  objections: [{
    objection: 'It is expensive',
    rootCause: 'Fear of investment',
    response: 'ROI covers this',
    followUp: 'What if it pays for itself?',
    evidence: 'Typical ROI 300%',
  }],
  closing: {
    trialCloses: ['Would you like to try?'],
    assumptiveClose: "Let's start next week",
    urgencyBuilder: 'Limited time offer',
    alternativeClose: 'We can start small',
  },
  followUp: {
    sameDaySms: 'Thanks for your time',
    nextDayEmail: 'Subject | Body',
    threeDayCallback: 'Callback script',
    referralAsk: 'Know anyone who needs this?',
  },
  strategy: {
    targetDecisionMaker: 'Owner, 30-50',
    bestTimeToCall: 'Tue-Thu 10-12',
    dealBreakers: ['No budget'],
    quickWins: ['Free audit'],
    competitiveAdvantages: ['We have online booking'],
  },
  salesOpportunities: [{
    gap: 'No online booking',
    currentState: 'Phone calls only',
    recommendation: 'Add booking widget',
    pitchAngle: 'Clients can book 24/7',
    revenueImpact: '+30000 UAH/month',
    scriptExcerpt: 'Imagine your clients...',
  }],
});

describe('SalesScriptGenerator', () => {
  it('should generate combined sales script with all sections', async () => {
    const generator = new SalesScriptGenerator();
    const llm = makeMockLLM(fullScriptJson);
    const rawData = makeRawData();
    const existing = { competitors: [competitorWithAnalysis('Comp1', 4.5, false)] };

    const result = await generator.generate(llm, rawData, existing);

    expect(result.salesScript).toBeDefined();
    expect(result.salesScript!.opening).toBeDefined();
    expect(result.salesScript!.discovery).toBeDefined();
    expect(result.salesScript!.valueProposition).toBeDefined();
    expect(result.salesScript!.objections).toBeDefined();
    expect(result.salesScript!.closing).toBeDefined();
    expect(result.salesScript!.followUp).toBeDefined();
    expect(result.salesScript!.strategy).toBeDefined();
    expect(result.salesOpportunities).toHaveLength(1);
    expect(llm.generateContent).toHaveBeenCalledTimes(1);
  });

  it('should pass competitor analysis data to LLM prompt', async () => {
    const generator = new SalesScriptGenerator();
    const llm = makeMockLLM(fullScriptJson);
    const rawData = makeRawData();
    const comp = competitorWithAnalysis('DentPro', 4.8, true);
    const existing = { competitors: [comp] };

    await generator.generate(llm, rawData, existing);

    const promptArg: string = llm.generateContent.mock.calls[0][0];
    expect(promptArg).toContain('DentPro');
    expect(promptArg).toContain('Good SEO');
    expect(promptArg).toContain('Teeth cleaning');
    expect(promptArg).toContain('booking=true');
  });

  it('should handle empty competitors gracefully', async () => {
    const generator = new SalesScriptGenerator();
    const llm = makeMockLLM(fullScriptJson);
    const rawData = makeRawData();

    await generator.generate(llm, rawData, {});

    const promptArg: string = llm.generateContent.mock.calls[0][0];
    expect(promptArg).toContain('No competitor data available');
  });

  it('should return empty object on LLM parse failure', async () => {
    const generator = new SalesScriptGenerator();
    const llm = makeMockLLM('not valid json at all {{{');

    const result = await generator.generate(llm, makeRawData(), {});

    expect(result.salesScript).toEqual({});
    expect(result.salesOpportunities).toEqual([]);
  });

  it('should handle partial JSON response gracefully', async () => {
    const generator = new SalesScriptGenerator();
    const llm = makeMockLLM(JSON.stringify({ opening: { greeting: 'Hi' } }));

    const result = await generator.generate(llm, makeRawData(), {});

    // Partial — opening present, rest undefined
    expect(result.salesScript!.opening).toBeDefined();
    expect((result.salesScript!.opening as any).greeting).toBe('Hi');
    expect(result.salesScript!.discovery).toBeUndefined();
  });

  it('should return empty object when LLM throws', async () => {
    const generator = new SalesScriptGenerator();
    const llm = {
      generateContent: vi.fn().mockRejectedValue(new Error('API timeout')),
      generateHugoStructure: vi.fn(),
    };

    const result = await generator.generate(llm, makeRawData(), {});

    expect(result.salesScript).toEqual({});
    expect(result.salesOpportunities).toEqual([]);
  });

  it('should handle generated content wrapped in markdown code fences', async () => {
    const generator = new SalesScriptGenerator();
    const llm = makeMockLLM('```json\n' + fullScriptJson + '\n```');

    const result = await generator.generate(llm, makeRawData(), {});

    expect(result.salesScript!.opening).toBeDefined();
    expect(result.salesScript!.closing).toBeDefined();
  });
});
