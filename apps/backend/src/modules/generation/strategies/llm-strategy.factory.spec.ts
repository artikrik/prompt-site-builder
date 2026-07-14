import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LLMStrategyFactory } from './llm-strategy.factory';
import { ConfigService } from '@nestjs/config';
import { AnthropicStrategy } from './anthropic.strategy';
import { OpenAIStrategy } from './openai.strategy';
import { DeepseekStrategy } from './deepseek.strategy';
import { MimoStrategy } from './mimo.strategy';
import { GeminiStrategy } from './gemini.strategy';
import { OpenRouterStrategy } from './openrouter.strategy';

describe('LLMStrategyFactory', () => {
  let factory: LLMStrategyFactory;
  let configService: { get: ReturnType<typeof vi.fn> };
  let anthropicStrategy: AnthropicStrategy;
  let openaiStrategy: OpenAIStrategy;
  let geminiStrategy: GeminiStrategy;

  beforeEach(() => {
    configService = { get: vi.fn() };
    anthropicStrategy = {} as AnthropicStrategy;
    openaiStrategy = {} as OpenAIStrategy;
    geminiStrategy = {} as GeminiStrategy;

    factory = new LLMStrategyFactory(
      configService as unknown as ConfigService,
      anthropicStrategy,
      openaiStrategy,
      {} as DeepseekStrategy,
      {} as MimoStrategy,
      geminiStrategy,
      {} as OpenRouterStrategy,
    );
  });

  it('should return AnthropicStrategy by default', () => {
    configService.get.mockReturnValue('anthropic');
    const result = factory.create();
    expect(result).toBe(anthropicStrategy);
  });

  it('should return OpenAIStrategy when configured', () => {
    configService.get.mockReturnValue('openai');
    const result = factory.create();
    expect(result).toBe(openaiStrategy);
  });

  it('should return GeminiStrategy for google provider', () => {
    configService.get.mockReturnValue('google');
    const result = factory.create();
    expect(result).toBe(geminiStrategy);
  });

  it('should return OpenAIStrategy for unknown provider (fallback)', () => {
    configService.get.mockReturnValue('unknown');
    const result = factory.create();
    expect(result).toBe(openaiStrategy);
  });
});
