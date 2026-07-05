import { Module } from '@nestjs/common';
import { GenerationService } from './generation.service';
import { GenerationController } from './generation.controller';
import { GenerationProcessor } from './processors/generation.processor';
import { LLMStrategyFactory } from './strategies/llm-strategy.factory';
import { AnthropicStrategy } from './strategies/anthropic.strategy';
import { OpenAIStrategy } from './strategies/openai.strategy';
import { DeepseekStrategy } from './strategies/deepseek.strategy';
import { MimoStrategy } from './strategies/mimo.strategy';
import { GeminiStrategy } from './strategies/gemini.strategy';
import { DallE3Strategy } from './strategies/dalle3.strategy';
import { ImagenStrategy } from './strategies/imagen.strategy';
import { FluxStrategy } from './strategies/flux.strategy';
import { ImageStrategyFactory } from './strategies/image-strategy.factory';
import { HugoCompilerService } from './hugo/hugo-compiler.service';
import { HugoValidatorService } from './hugo/hugo-validator.service';
import { ThemeService } from './themes/theme.service';
import { ThemeSelector } from './themes/theme-selector';
import { PublishingModule } from '../publishing/publishing.module';
import { ProjectsModule } from '../projects/projects.module';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { SettingsModule } from '../settings/settings.module';
import { LeadsModule } from '../leads/leads.module';

@Module({
  imports: [PublishingModule, ProjectsModule, PrismaModule, QueueModule, SettingsModule, LeadsModule],
  controllers: [GenerationController],
  providers: [
    GenerationService,
    GenerationProcessor,
    LLMStrategyFactory,
    AnthropicStrategy,
    OpenAIStrategy,
    DeepseekStrategy,
    MimoStrategy,
    GeminiStrategy,
    DallE3Strategy,
    ImagenStrategy,
    FluxStrategy,
    ImageStrategyFactory,
    HugoCompilerService,
    HugoValidatorService,
    ThemeService,
    ThemeSelector,
  ],
  exports: [GenerationService, HugoCompilerService, ThemeService, ThemeSelector],
})
export class GenerationModule {}
