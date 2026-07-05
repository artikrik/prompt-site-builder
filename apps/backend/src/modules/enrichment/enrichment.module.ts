import { Module } from '@nestjs/common';
import { EnrichmentController } from './enrichment.controller';
import { EnrichmentService } from './enrichment.service';
import { EnrichmentFactory } from './providers/enrichment-factory';
import { FacebookProvider } from './providers/facebook.provider';
import { GoogleMapsProvider } from './providers/google-maps.provider';
import { EnrichmentProcessor } from './processors/enrichment.processor';
import { InstagramProvider } from '../scraping/providers/instagram.provider';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [PrismaModule, QueueModule],
  controllers: [EnrichmentController],
  providers: [
    EnrichmentService,
    EnrichmentFactory,
    FacebookProvider,
    GoogleMapsProvider,
    InstagramProvider,
    EnrichmentProcessor,
  ],
  exports: [EnrichmentService],
})
export class EnrichmentModule {}
