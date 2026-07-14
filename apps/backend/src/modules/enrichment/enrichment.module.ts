import { Module } from '@nestjs/common';
import { EnrichmentController } from './enrichment.controller';
import { EnrichmentService } from './enrichment.service';
import { EnrichmentAnalysisService } from './enrichment-analysis.service';
import { SalesScriptGenerator } from './sales-script-generator';
import { EnrichmentFactory } from './providers/enrichment-factory';
import { FacebookProvider } from './providers/facebook.provider';
import { GoogleMapsProvider } from './providers/google-maps.provider';
import { EnrichmentProcessor } from './processors/enrichment.processor';
import { InstagramProvider } from '../scraping/providers/instagram.provider';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { GenerationModule } from '../generation/generation.module';
import { LogsModule } from '../logs/logs.module';

@Module({
  imports: [PrismaModule, QueueModule, GenerationModule, LogsModule],
  controllers: [EnrichmentController],
  providers: [
    EnrichmentService,
    EnrichmentAnalysisService,
    SalesScriptGenerator,
    EnrichmentFactory,
    FacebookProvider,
    GoogleMapsProvider,
    InstagramProvider,
    EnrichmentProcessor,
  ],
  exports: [EnrichmentService],
})
export class EnrichmentModule {}
