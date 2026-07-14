import { Module } from '@nestjs/common';
import { ScrapingService } from './scraping.service';
import { ScrapingController } from './scraping.controller';
import { ScrapingProcessor } from './processors/scraping.processor';
import { ApifyProvider } from './providers/apify.provider';
import { InstagramProvider } from './providers/instagram.provider';
import { GoogleMapsScraperProvider } from './providers/google-maps-scraper.provider';
import { LeadsModule } from '../leads/leads.module';
import { QueueModule } from '../queue/queue.module';
import { LogsModule } from '../logs/logs.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [LeadsModule, QueueModule, LogsModule, SettingsModule],
  controllers: [ScrapingController],
  providers: [ScrapingService, ScrapingProcessor, ApifyProvider, InstagramProvider, GoogleMapsScraperProvider],
  exports: [ScrapingService],
})
export class ScrapingModule {}
