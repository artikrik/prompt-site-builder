import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { GeneratedSiteStructure } from '@prompt-site-builder/shared';

export interface SiteTemplate {
  name: string;
  category: string;
  description: string;
  previewImage?: string;
}

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);
  private readonly templatesPath: string;

  constructor(private readonly configService: ConfigService) {
    this.templatesPath = join(__dirname, '..');
  }

  async listTemplates(category?: string): Promise<SiteTemplate[]> {
    const templates: SiteTemplate[] = [];
    const categories = await readdir(this.templatesPath, { withFileTypes: true });

    for (const cat of categories) {
      if (!cat.isDirectory() || cat.name.startsWith('.')) continue;

      if (category && cat.name !== category) continue;

      const templatesInCategory = await readdir(
        join(this.templatesPath, cat.name),
        { withFileTypes: true },
      );

      for (const tmpl of templatesInCategory) {
        if (!tmpl.isDirectory()) continue;

        const description = await this.readTemplateDescription(cat.name, tmpl.name);
        templates.push({
          name: tmpl.name,
          category: cat.name,
          description,
        });
      }
    }

    return templates;
  }

  async getTemplate(name: string, category?: string): Promise<SiteTemplate | null> {
    const categories = category ? [category] : await this.getCategoryDirs();

    for (const cat of categories) {
      const templateDir = join(this.templatesPath, cat, name);
      try {
        await readFile(join(templateDir, 'content', 'index.md'));
        const description = await this.readTemplateDescription(cat, name);
        return {
          name,
          category: cat,
          description,
        };
      } catch {
        // Template not found in this category, continue
      }
    }

    return null;
  }

  async generateFromTemplate(
    templateName: string,
    leadData: {
      businessName: string;
      category?: string;
      description?: string;
      address?: string;
      phone?: string;
      email?: string;
      socialUrl?: string;
      baseUrl: string;
    },
  ): Promise<GeneratedSiteStructure | null> {
    const template = await this.getTemplate(templateName, leadData.category);
    if (!template) {
      this.logger.warn(`Template "${templateName}" not found`);
      return null;
    }

    const templateDir = join(this.templatesPath, template.category, templateName);

    try {
      // Read hugo.toml
      const configContent = await this.readFileOrNull(join(templateDir, 'hugo.toml'));
      
      // Read content files
      const contentFiles = await this.readContentFiles(join(templateDir, 'content'));

      // Replace placeholders in all files
      const replacements = {
        '{{businessName}}': leadData.businessName,
        '{{description}}': leadData.description || '',
        '{{address}}': leadData.address || '',
        '{{phone}}': leadData.phone || '',
        '{{email}}': leadData.email || '',
        '{{socialUrl}}': leadData.socialUrl || '',
        '{{baseUrl}}': leadData.baseUrl,
      };

      const config = configContent ? this.replacePlaceholders(configContent, replacements) : '';
      const content = contentFiles.map((file) => ({
        path: `content/${file.name}`,
        body: this.replacePlaceholders(file.content, replacements),
      }));

      return {
        config,
        content,
        layouts: [],
        partials: [],
        shortcodes: [],
        static: [],
        assets: [],
      };
    } catch (error) {
      this.logger.error(`Failed to generate from template "${templateName}": ${error}`);
      return null;
    }
  }

  private async readTemplateDescription(category: string, name: string): Promise<string> {
    try {
      const readmePath = join(this.templatesPath, category, name, 'README.md');
      const content = await readFile(readmePath, 'utf-8');
      // Extract first paragraph as description
      const match = content.match(/^#\s+.+\n\n(.+)/m);
      return match?.[1] || `${name} template for ${category}`;
    } catch {
      return `${name} template for ${category}`;
    }
  }

  private async getCategoryDirs(): Promise<string[]> {
    const entries = await readdir(this.templatesPath, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name);
  }

  private async readContentFiles(contentDir: string): Promise<Array<{ name: string; content: string }>> {
    const files: Array<{ name: string; content: string }> = [];
    
    try {
      const entries = await readdir(contentDir);
      for (const entry of entries) {
        if (entry.endsWith('.md') || entry.endsWith('.toml')) {
          const content = await readFile(join(contentDir, entry), 'utf-8');
          files.push({ name: entry, content });
        }
      }
    } catch {
      // Content directory might not exist
    }

    return files;
  }

  private async readFileOrNull(path: string): Promise<string | null> {
    try {
      return await readFile(path, 'utf-8');
    } catch {
      return null;
    }
  }

  private replacePlaceholders(text: string, replacements: Record<string, string>): string {
    let result = text;
    for (const [placeholder, value] of Object.entries(replacements)) {
      result = result.split(placeholder).join(value);
    }
    return result;
  }
}
