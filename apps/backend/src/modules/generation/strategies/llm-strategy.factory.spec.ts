import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LLMStrategyFactory } from './llm-strategy.factory';
import { ConfigService } from '@nestjs/config';
import { AnthropicStrategy } from './anthropic.strategy';
import { OpenAIStrategy } from './openai.strategy';

describe('LLMStrategyFactory', () => {
  let factory: LLMStrategyFactory;
  let configService: { get: ReturnType<typeof vi.fn> };
  let anthropicStrategy: AnthropicStrategy;
  let openaiStrategy: OpenAIStrategy;

  beforeEach(() => {
    configService = { get: vi.fn() };
    anthropicStrategy = {} as AnthropicStrategy;
    openaiStrategy = {} as OpenAIStrategy;

    factory = new LLMStrategyFactory(
      configService as unknown as ConfigService,
      anthropicStrategy,
      openaiStrategy,
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

  it('should return AnthropicStrategy for unknown provider', () => {
    configService.get.mockReturnValue('unknown');
    const result = factory.create();
    expect(result).toBe(anthropicStrategy);
  });
});
