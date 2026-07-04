import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { access, rm, readdir, stat } from 'fs/promises';
import { join, dirname } from 'path';

@Injectable()
export class SitePublisherService {
  private readonly logger = new Logger(SitePublisherService.name);
  private readonly sitesPath: string;

  constructor(private readonly configService: ConfigService) {
    this.sitesPath = this.configService.get<string>('HUGO_SITES_PATH', '/var/www/client-sites');
  }

  async publish(slug: string): Promise<void> {
    const siteDir = join(this.sitesPath, slug);

    this.logger.log(`Publishing site: ${slug}`);

    // Verify site directory exists (HugoCompilerService already copies output here)
    try {
      await access(siteDir);
    } catch {
      throw new Error(`Site directory not found: ${siteDir}`);
    }

    // Verify the site has content (at least an index.html)
    const hasIndex = await this.fileExists(join(siteDir, 'index.html'));
    if (!hasIndex) {
      this.logger.warn(`Site ${slug} has no index.html, checking for index.htm`);
      const hasHtm = await this.fileExists(join(siteDir, 'index.htm'));
      if (!hasHtm) {
        throw new Error(`Site ${slug} has no index file`);
      }
    }

    // Get site size for logging
    const siteSize = await this.getDirectorySize(siteDir);
    this.logger.log(`Site ${slug} published successfully (${siteSize} bytes)`);
  }

  async unpublish(slug: string): Promise<void> {
    const targetDir = join(this.sitesPath, slug);

    this.logger.log(`Unpublishing site: ${slug}`);

    try {
      await rm(targetDir, { recursive: true, force: true });
      this.logger.log(`Site ${slug} unpublished`);
    } catch (error) {
      this.logger.error(`Failed to unpublish site ${slug}: ${error}`);
      throw error;
    }
  }

  async listPublished(): Promise<string[]> {
    try {
      const entries = await readdir(this.sitesPath, { withFileTypes: true });
      return entries
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
        .map((e) => e.name);
    } catch {
      return [];
    }
  }

  async isPublished(slug: string): Promise<boolean> {
    const targetDir = join(this.sitesPath, slug);
    try {
      await access(targetDir);
      return true;
    } catch {
      return false;
    }
  }

  async writeFile(slug: string, filePath: string, content: string): Promise<void> {
    const { writeFile: writeFileAsync, mkdir } = await import('fs/promises');
    const fullPath = join(this.sitesPath, slug, filePath);
    const dir = dirname(fullPath);
    await mkdir(dir, { recursive: true });
    await writeFileAsync(fullPath, content);
  }

  async writeFileBinary(slug: string, filePath: string, data: Buffer): Promise<void> {
    const { writeFile: writeFileAsync, mkdir } = await import('fs/promises');
    const fullPath = join(this.sitesPath, slug, filePath);
    const dir = dirname(fullPath);
    await mkdir(dir, { recursive: true });
    await writeFileAsync(fullPath, data);
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  private async getDirectorySize(dirPath: string): Promise<number> {
    let size = 0;
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);
        if (entry.isDirectory()) {
          size += await this.getDirectorySize(fullPath);
        } else {
          const fileStat = await stat(fullPath);
          size += fileStat.size;
        }
      }
    } catch {
      // ignore errors
    }
    return size;
  }
}
