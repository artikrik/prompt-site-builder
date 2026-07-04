import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import { HugoTheme, HUGO_THEMES, getThemeByName, getThemesByCategory } from './theme-registry';

const execAsync = promisify(exec);

@Injectable()
export class ThemeService {
  private readonly logger = new Logger(ThemeService.name);
  private readonly hugoSitesPath: string;

  constructor(private readonly configService: ConfigService) {
    this.hugoSitesPath = this.configService.get<string>('HUGO_SITES_PATH', '/var/www/client-sites');
  }

  listAvailableThemes(): HugoTheme[] {
    return HUGO_THEMES;
  }

  getThemeByName(name: string): HugoTheme | undefined {
    return getThemeByName(name);
  }

  getThemesByCategory(category: HugoTheme['category']): HugoTheme[] {
    return getThemesByCategory(category);
  }

  async installTheme(themeName: string, projectDir: string): Promise<boolean> {
    const theme = getThemeByName(themeName);
    if (!theme) {
      this.logger.warn(`Theme "${themeName}" not found in registry`);
      return false;
    }

    const themesDir = `${projectDir}/themes`;
    const themeDir = `${themesDir}/${theme.name}`;

    try {
      await execAsync(`mkdir -p "${themesDir}"`);
      await execAsync(`git clone --depth 1 "${theme.repoUrl}" "${themeDir}"`);
      this.logger.log(`Theme "${themeName}" installed to ${themeDir}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to install theme "${themeName}": ${error}`);
      return false;
    }
  }

  getDefaultTheme(): string {
    return 'hugo-theme-zen';
  }
}
