import { Module } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { SettingsModule } from '../settings/settings.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [SettingsModule, QueueModule],
  controllers: [LeadsController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}
