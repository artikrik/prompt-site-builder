import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ILLMStrategy } from './llm-strategy.interface';
import { AnthropicStrategy } from './anthropic.strategy';
import { OpenAIStrategy } from './openai.strategy';
import { DeepseekStrategy } from './deepseek.strategy';
import { MimoStrategy } from './mimo.strategy';
import { GeminiStrategy } from './gemini.strategy';

@Injectable()
export class LLMStrategyFactory {
  private readonly logger = new Logger(LLMStrategyFactory.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly anthropicStrategy: AnthropicStrategy,
    private readonly openaiStrategy: OpenAIStrategy,
    private readonly deepseekStrategy: DeepseekStrategy,
    private readonly mimoStrategy: MimoStrategy,
    private readonly geminiStrategy: GeminiStrategy,
  ) {}

  create(): ILLMStrategy {
    const provider = this.configService.get<string>('LLM_PROVIDER', 'anthropic');
    this.logger.log(`Creating LLM strategy for provider: ${provider}`);

    switch (provider) {
      case 'anthropic':
        return this.anthropicStrategy;
      case 'openai':
        return this.openaiStrategy;
      case 'deepseek':
        return this.deepseekStrategy;
      case 'mimo':
        return this.mimoStrategy;
      case 'google':
        return this.geminiStrategy;
      default:
        this.logger.warn(`Unknown provider "${provider}", falling back to anthropic`);
        return this.anthropicStrategy;
    }
  }
}
