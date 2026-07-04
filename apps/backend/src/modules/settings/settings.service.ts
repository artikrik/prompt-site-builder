import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AppSettings {
  llmProvider: string;
  defaultTheme: string;
  baseDomain: string;
  hugoSitesPath: string;
  widgets: {
    easyweekEnabled: boolean;
    wayforpayEnabled: boolean;
    monobankEnabled: boolean;
  };
}

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly configService: ConfigService) {}

  getSettings(): AppSettings {
    return {
      llmProvider: this.configService.get<string>('LLM_PROVIDER', 'openai'),
      defaultTheme: 'hugo-theme-zen',
      baseDomain: this.configService.get<string>('BASE_DOMAIN', 'sitenow.pp.ua'),
      hugoSitesPath: this.configService.get<string>('HUGO_SITES_PATH', '/var/www/client-sites'),
      widgets: {
        easyweekEnabled: !!this.configService.get<string>('EASYWEEK_API_KEY'),
        wayforpayEnabled: !!this.configService.get<string>('WAYFORPAY_MERCHANT'),
        monobankEnabled: !!this.configService.get<string>('MONOBANK_API_KEY'),
      },
    };
  }

  updateSettings(updates: Partial<AppSettings>): AppSettings {
    this.logger.log('Settings update requested (env-based config, changes require restart)');
    return this.getSettings();
  }
}
