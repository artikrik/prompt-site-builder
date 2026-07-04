import { Module } from '@nestjs/common';
import { SitePublisherService } from './site-publisher.service';

@Module({
  providers: [SitePublisherService],
  exports: [SitePublisherService],
})
export class PublishingModule {}
