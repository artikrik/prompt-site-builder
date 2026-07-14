import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { GenerationService } from '../generation/generation.service';

export interface EditableSection {
  id: string;
  name: string;
  type: 'text' | 'richtext' | 'image' | 'list' | 'contact';
  content: unknown;
}

export interface SiteSectionData {
  hero?: {
    title: string;
    subtitle: string;
    ctaText: string;
    ctaUrl: string;
    imageUrl?: string;
  };
  about?: {
    content: string;
  };
  services?: {
    items: Array<{
      name: string;
      description: string;
      price?: string;
    }>;
  };
  contact?: {
    phone: string;
    email: string;
    address: string;
    workingHours?: string;
  };
  social?: {
    instagram?: string;
    facebook?: string;
    telegram?: string;
  };
}

@Injectable()
export class SiteEditorService {
  private readonly logger = new Logger(SiteEditorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly generationService: GenerationService,
  ) {}

  async getEditableSections(projectId: string): Promise<EditableSection[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { activeVariant: true },
    });

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    const variant = project.activeVariant;
    if (!variant) {
      return [];
    }

    const content = variant.content as Record<string, unknown>;
    const sections: EditableSection[] = [];

    // Parse index.md to extract sections
    const indexMd = content.indexMd as string || '';
    const sectionsData = this.parseContentToSections(indexMd, project);

    if (sectionsData.hero) {
      sections.push({
        id: 'hero',
        name: 'Hero Section',
        type: 'text',
        content: sectionsData.hero,
      });
    }

    if (sectionsData.about) {
      sections.push({
        id: 'about',
        name: 'About Section',
        type: 'richtext',
        content: sectionsData.about,
      });
    }

    if (sectionsData.services) {
      sections.push({
        id: 'services',
        name: 'Services',
        type: 'list',
        content: sectionsData.services,
      });
    }

    if (sectionsData.contact) {
      sections.push({
        id: 'contact',
        name: 'Contact Info',
        type: 'contact',
        content: sectionsData.contact,
      });
    }

    return sections;
  }

  async updateSection(
    projectId: string,
    sectionId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { activeVariant: true },
    });

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    const variant = project.activeVariant;
    if (!variant) {
      throw new NotFoundException(`No active variant for project ${projectId}`);
    }

    const content = variant.content as Record<string, string>;
    let indexMd = content.indexMd || '';

    // Update the specific section in index.md
    indexMd = this.updateSectionInContent(indexMd, sectionId, data);

    // Save updated content
    await this.prisma.siteVariant.update({
      where: { id: variant.id },
      data: {
        content: {
          ...content,
          indexMd,
        },
      },
    });

    this.logger.log(`Section ${sectionId} updated for project ${projectId}`);
  }

  async regenerateSite(projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { lead: true, activeVariant: true },
    });

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    if (!project.activeVariant) {
      throw new NotFoundException(`No active variant for project ${projectId}`);
    }

    const variant = project.activeVariant;

    // Rebuild the site with updated content
    await this.generationService.generateSite({
      projectId: project.id,
      leadId: project.leadId,
      businessName: project.lead.businessName,
      slug: project.slug,
      category: project.lead.category,
      description: project.lead.description,
      address: project.lead.address,
      phone: project.lead.phone,
      email: project.lead.email,
      socialUrl: project.lead.socialUrls?.[0],
      theme: variant.themeName || undefined,
      variantId: variant.id,
    });

    this.logger.log(`Site regenerated for project ${projectId}`);
  }

  private parseContentToSections(indexMd: string, project: Record<string, unknown>): SiteSectionData {
    const sections: SiteSectionData = {};

    // Extract hero section (first H1 and subtitle)
    const heroMatch = indexMd.match(/^#\s+(.+?)$/m);
    if (heroMatch) {
      sections.hero = {
        title: heroMatch[1],
        subtitle: this.extractSubtitle(indexMd),
        ctaText: 'Записатися',
        ctaUrl: '#contact',
      };
    }

    // Extract about section
    const aboutMatch = indexMd.match(/##\s+Про\s+нас\s*\n([\s\S]*?)(?=\n##\s|$)/i);
    if (aboutMatch) {
      sections.about = {
        content: aboutMatch[1].trim(),
      };
    }

    // Extract services section
    const servicesMatch = indexMd.match(/##\s+Наші\s+послуги\s*\n([\s\S]*?)(?=\n##\s|$)/i);
    if (servicesMatch) {
      const items = this.parseListItems(servicesMatch[1]);
      sections.services = { items };
    }

    // Extract contact section
    const phone = project.phone as string;
    const email = project.email as string;
    const address = project.address as string;
    
    if (phone || email || address) {
      sections.contact = {
        phone: phone || '',
        email: email || '',
        address: address || '',
      };
    }

    return sections;
  }

  private extractSubtitle(content: string): string {
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---') && trimmed.length > 10) {
        return trimmed;
      }
    }
    return '';
  }

  private parseListItems(content: string): Array<{ name: string; description: string; price?: string }> {
    const items: Array<{ name: string; description: string; price?: string }> = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const itemText = trimmed.slice(2);
        const parts = itemText.split(':');
        if (parts.length >= 2) {
          items.push({
            name: parts[0].trim(),
            description: parts.slice(1).join(':').trim(),
          });
        } else {
          items.push({
            name: itemText,
            description: '',
          });
        }
      }
    }

    return items;
  }

  private updateSectionInContent(content: string, sectionId: string, data: Record<string, unknown>): string {
    const lines = content.split('\n');
    const result: string[] = [];
    let inSection = false;
    let sectionFound = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check if we're entering a section
      if (trimmed.startsWith('## ')) {
        if (inSection && !sectionFound) {
          // We were in the section but didn't find it, add data here
          result.push(...this.formatSectionData(sectionId, data));
          sectionFound = true;
        }
        inSection = false;
      }

      // Check if this is our target section
      if (this.isTargetSection(trimmed, sectionId)) {
        inSection = true;
        result.push(line);
        result.push(...this.formatSectionData(sectionId, data));
        sectionFound = true;
        continue;
      }

      // If we're in the target section, skip existing content
      if (inSection) {
        continue;
      }

      result.push(line);
    }

    // If section wasn't found, append it
    if (!sectionFound) {
      result.push('');
      result.push(`## ${this.getSectionTitle(sectionId)}`);
      result.push(...this.formatSectionData(sectionId, data));
    }

    return result.join('\n');
  }

  private isTargetSection(line: string, sectionId: string): boolean {
    const sectionTitles: Record<string, string[]> = {
      hero: ['# '],
      about: ['## Про нас', '## About'],
      services: ['## Наші послуги', '## Services', '## Послуги'],
      contact: ['## Контакти', '## Contact'],
    };

    const titles = sectionTitles[sectionId] || [];
    return titles.some((title) => line.toLowerCase().startsWith(title.toLowerCase()));
  }

  private getSectionTitle(sectionId: string): string {
    const titles: Record<string, string> = {
      hero: '',
      about: 'Про нас',
      services: 'Наші послуги',
      contact: 'Контакти',
    };
    return titles[sectionId] || sectionId;
  }

  private formatSectionData(sectionId: string, data: Record<string, unknown>): string[] {
    switch (sectionId) {
      case 'hero':
        return [
          (data.title as string) || '',
          '',
          (data.subtitle as string) || '',
        ];
      case 'about':
        return [(data.content as string) || ''];
      case 'services': {
        const items = data.items as Array<{ name: string; description: string; price?: string }> || [];
        return items.map((item) => `- ${item.name}: ${item.description}${item.price ? ` (${item.price})` : ''}`);
      }
      case 'contact':
        return [
          `**Телефон:** ${data.phone || ''}`,
          `**Email:** ${data.email || ''}`,
          `**Адреса:** ${data.address || ''}`,
        ];
      default:
        return [];
    }
  }
}
