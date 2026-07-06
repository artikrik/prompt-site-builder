import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { SettingsRepository } from './settings.repository';
import { EncryptionService } from './encryption.service';

@Module({
  controllers: [SettingsController],
  providers: [
    SettingsRepository,
    {
      provide: EncryptionService,
      useFactory: (configService: ConfigService) => {
        return new EncryptionService(configService.get<string>('ENCRYPTION_KEY') ?? '');
      },
      inject: [ConfigService],
    },
    SettingsService,
  ],
  exports: [SettingsService, EncryptionService],
})
export class SettingsModule {}
