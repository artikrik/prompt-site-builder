import { Module } from '@nestjs/common';
import { ScrapingService } from './scraping.service';
import { ScrapingController } from './scraping.controller';
import { ScrapingProcessor } from './processors/scraping.processor';
import { ApifyProvider } from './providers/apify.provider';
import { InstagramProvider } from './providers/instagram.provider';
import { LeadsModule } from '../leads/leads.module';
import { QueueModule } from '../queue/queue.module';
import { EnrichmentModule } from '../enrichment/enrichment.module';
import { LogsModule } from '../logs/logs.module';

@Module({
  imports: [LeadsModule, QueueModule, EnrichmentModule, LogsModule],
  controllers: [ScrapingController],
  providers: [ScrapingService, ScrapingProcessor, ApifyProvider, InstagramProvider],
  exports: [ScrapingService],
})
export class ScrapingModule {}
