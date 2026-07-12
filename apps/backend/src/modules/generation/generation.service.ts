import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { LLMStrategyFactory } from './strategies/llm-strategy.factory';
import { DallE3Strategy } from './strategies/dalle3.strategy';
import { HugoCompilerService } from './hugo/hugo-compiler.service';
import { HugoValidatorService } from './hugo/hugo-validator.service';
import { SitePublisherService } from '../publishing/site-publisher.service';
import { SettingsService } from '../settings/settings.service';
import { LeadsService } from '../leads/leads.service';
import { VariantsService } from '../projects/variants/variants.service';
import { AddonInjectorService } from '../addons/addon-injector.service';
import { SiteGenerationRequest, GeneratedSiteStructure, ProjectStatus, JobStatus } from '@prompt-site-builder/shared';

@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly llmFactory: LLMStrategyFactory,
    private readonly imageStrategy: DallE3Strategy,
    private readonly hugoCompiler: HugoCompilerService,
    private readonly hugoValidator: HugoValidatorService,
    private readonly publisher: SitePublisherService,
    private readonly settingsService: SettingsService,
    private readonly leadsService: LeadsService,
    private readonly variantsService: VariantsService,
    private readonly addonInjector: AddonInjectorService,
  ) {}

  async generateSite(request: SiteGenerationRequest): Promise<void> {
    const { projectId } = request;
    this.logger.log(`Starting site generation for project ${projectId}`);

    // Resolve LLM provider and model from settings (with optional request override)
    const llmProvider = (await this.settingsService.get('llm_provider')).value || 'openai';
    const llmModel = request.model || (await this.settingsService.getEffectiveModel(llmProvider, 'content'));
    this.logger.log(`LLM: provider=${llmProvider}, model=${llmModel}`);

    // Resolve image provider and model from settings (with optional request override)
    const imageProvider = (await this.settingsService.get('image_provider')).value || 'openai';
    const imageModel = request.imageModel || (await this.settingsService.getEffectiveModel(imageProvider, 'image'));
    this.logger.log(`Image: provider=${imageProvider}, model=${imageModel}`);

    // Fetch lead for payment service config
    const lead = await this.leadsService.findOne(request.leadId);
    const paymentConfig = {
      easyweekEnabled: lead.easyweekEnabled,
      wayforpayEnabled: lead.wayforpayEnabled,
      monobankEnabled: lead.monobankEnabled,
    };

    // Create or use variant for this generation
    let variantId: string | undefined = (request as any).variantId;
    if (!variantId) {
      const variant = await this.variantsService.create(projectId, {
        model: llmModel,
        imageModel,
        theme: request.theme,
      });
      variantId = variant.id;
      this.logger.log(`Created variant ${variantId} for project ${projectId}`);
    }

    // Update variant status to generating
    await this.prisma.siteVariant.update({
      where: { id: variantId },
      data: { status: 'GENERATING' },
    });

    const job = await this.prisma.generationJob.create({
      data: {
        projectId,
        variantId,
        type: 'GENERATE_SITE',
        status: JobStatus.PROCESSING,
        attempts: 1,
      },
    });

    try {
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: ProjectStatus.GENERATING },
      });

      // 1. Generate Hugo structure via LLM (with fallback)
      this.logger.log(`Generating Hugo structure for ${request.businessName} with theme ${request.theme || 'default'}`);
      let hugoContent;
      try {
        const llm = this.llmFactory.create();
        hugoContent = await llm.generateHugoStructure({
          businessName: request.businessName,
          category: request.category,
          description: request.description,
          address: request.address,
          phone: request.phone,
          email: request.email,
          socialUrl: request.socialUrl,
          theme: request.theme,
        });
        this.logger.log('LLM content generated successfully');
      } catch (llmError) {
        this.logger.warn(`LLM failed, using default template: ${llmError}`);
        hugoContent = this.getDefaultHugoContent(request);
      }

      // Inject lead payment config into Hugo params
      hugoContent.hugoToml = this.injectPaymentParams(hugoContent.hugoToml, paymentConfig);

      // 2. Build site structure
      const structure = this.buildSiteStructure(request, hugoContent);

      // 2.5 Inject active add-ons (payment, booking, CMS shortcodes)
      try {
        await this.addonInjector.injectAddons(structure, projectId);
      } catch (addonErr) {
        this.logger.warn(`Addon injection skipped: ${addonErr}`);
      }

      // 3. Generate hero image (optional — skip if API fails)
      try {
        this.logger.log(`Generating hero image for ${request.businessName}`);
        const heroImage = await this.imageStrategy.generateHeroImage(
          request.businessName,
          request.category,
        );
        const heroImageBuffer = await this.downloadImage(heroImage.url);
        structure.assets.push({
          path: 'static/images/hero.jpg',
          data: heroImageBuffer,
        });
        this.logger.log('Hero image generated');

        await this.prisma.siteAsset.create({
          data: {
            projectId,
            filePath: '/static/images/hero.jpg',
            assetType: 'HERO',
            sourceUrl: heroImage.url,
          },
        });
      } catch (imgError) {
        this.logger.warn(`Image generation skipped: ${imgError}`);
        // Generate a placeholder SVG as hero
        const placeholderSvg = this.generatePlaceholderSvg(request.businessName, request.category);
        structure.static.push({
          path: 'static/images/hero.svg',
          body: placeholderSvg,
        });
      }

      // 4. Build Hugo site (or static fallback)
      this.logger.log(`Building site for ${request.slug} with theme ${request.theme || 'default'}`);
      let buildSuccess = false;
      try {
        const buildResult = await this.hugoCompiler.build(request.slug, structure, request.theme, variantId);
        buildSuccess = buildResult.success;
        if (!buildSuccess) {
          this.logger.warn(`Hugo build failed, using static fallback: ${buildResult.errors.join(', ')}`);
        }
      } catch (buildError) {
        this.logger.warn(`Hugo compiler error, using static fallback: ${buildError}`);
      }

      if (!buildSuccess) {
        // Generate static HTML site directly
        await this.generateStaticSite(request.slug, structure, request);
      }

      // 7. Publish
      this.logger.log(`Publishing site for ${request.slug}`);
      await this.publisher.publish(request.slug);

      // 8. Update project — include hugoConfig sync + generatedAt timestamp
      const publishedUrl = `https://${request.slug}.${this.configService.get('BASE_DOMAIN')}`;
      await this.prisma.project.update({
        where: { id: projectId },
        data: {
          status: ProjectStatus.PUBLISHED,
          generatedAt: new Date(),
          publishedAt: new Date(),
          publishedUrl,
          activeVariantId: variantId,
          hugoConfig: {
            theme: request.theme || 'hugo-theme-zen',
            title: request.businessName,
            params: {
              businessName: request.businessName,
              category: request.category,
              phone: request.phone,
              email: request.email,
              address: request.address,
            },
            baseUrl: publishedUrl,
            description: request.description || `Professional ${request.category?.toLowerCase() || ''} services`,
            languageCode: 'uk',
          },
        },
      });

      // 9. Store generated content on variant
      await this.prisma.siteVariant.update({
        where: { id: variantId! },
        data: {
          status: 'GENERATED',
          hugoConfig: { theme: request.theme, config: hugoContent.hugoToml },
          content: {
            indexMd: hugoContent.indexMd,
            aboutMd: hugoContent.aboutMd,
            servicesMd: hugoContent.servicesMd,
            contactMd: hugoContent.contactMd,
          },
          modelUsed: llmModel,
          imageModel,
          themeName: request.theme,
          previewUrl: publishedUrl,
        },
      });

      // 10. Mark job done
      await this.prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: JobStatus.COMPLETED,
          result: {
            seoTitle: hugoContent.seoTitle,
            publishedUrl,
            method: buildSuccess ? 'hugo' : 'static',
            variantId: variantId!,
          },
        },
      });

      this.logger.log(`Site generation complete for ${request.slug}`);
    } catch (error) {
      this.logger.error(`Site generation failed: ${error}`);
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: ProjectStatus.FAILED },
      });
      if (variantId) {
        await this.prisma.siteVariant.update({
          where: { id: variantId },
          data: { status: 'DRAFT' },
        });
      }
      await this.prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: JobStatus.FAILED,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  private buildSiteStructure(request: SiteGenerationRequest, hugoContent: any): GeneratedSiteStructure {
    return {
      config: hugoContent.hugoToml,
      content: [
        { path: 'content/index.md', body: hugoContent.indexMd },
        { path: 'content/about.md', body: hugoContent.aboutMd },
        { path: 'content/services.md', body: hugoContent.servicesMd },
        { path: 'content/contact.md', body: hugoContent.contactMd },
      ],
      layouts: [],
      partials: [],
      shortcodes: [],
      static: [],
      assets: [],
    };
  }

  private getDefaultHugoContent(request: SiteGenerationRequest): any {
    const name = request.businessName;
    const cat = request.category || 'Business';
    const desc = request.description || `Professional ${cat.toLowerCase()} services`;
    const addr = request.address || '';
    const phone = request.phone || '';
    const email = request.email || '';
    const theme = request.theme || 'hugo-theme-zen';

    return {
      hugoToml: `baseURL = "/"
languageCode = "uk"
title = "${name}"
theme = "${theme}"

[params]
  description = "${desc}"
  businessName = "${name}"
  phone = "${phone}"
  email = "${email}"
  address = "${addr}"
  category = "${cat}"

[markup]
  [markup.goldmark]
    [markup.goldmark.renderer]
      unsafe = true`,
      indexMd: `---
title: "${name}"
description: "${desc}"
---

# ${name}

${desc}

## Чому обирають нас?

- Професійна команда фахівців
- Індивідуальний підхід до кожного клієнта
- Гарантія якості на всі послуги

## Наші послуги

Ми пропонуємо широкий спектр послуг для вашого бізнесу.

## Контакти

Зателефонуйте або надішліть повідомлення для безкоштовної консультації.`,
      aboutMd: `---
title: "Про нас"
---

# Про ${name}

${name} — це команда професіоналів у сфері ${cat.toLowerCase()}.

Наша місія — надавати якісні послуги та забезпечувати задоволення кожного клієнта.`,
      servicesMd: `---
title: "Послуги"
---

# Наші послуги

## Основні послуги

- Консультація
- Виконання робіт
- Гарантійне обслуговування`,
      contactMd: `---
title: "Контакти"
---

# Контакти

## ${name}

**Телефон:** ${phone || 'Не вказано'}
**Email:** ${email || 'Не вказано'}
**Адреса:** ${addr || 'Не вказано'}`,
      heroImagePrompt: `Professional ${cat} services, modern design`,
      seoTitle: `${name} | ${cat}`,
      seoDescription: desc,
    };
  }

  private injectPaymentParams(
    hugoToml: string,
    paymentConfig: { easyweekEnabled: boolean; wayforpayEnabled: boolean; monobankEnabled: boolean },
  ): string {
    const paramsBlock = [
      '  easyweekEnabled = true',
      '  wayforpayEnabled = true',
      '  monobankEnabled = true',
    ].filter((_, i) => [paymentConfig.easyweekEnabled, paymentConfig.wayforpayEnabled, paymentConfig.monobankEnabled][i]);
    if (paramsBlock.length === 0) return hugoToml;
    const insert = `\n[params.payment]\n${paramsBlock.join('\n')}`;
    // Append before [markup] block or at end of [params] section
    if (hugoToml.includes('[markup]')) {
      return hugoToml.replace('[markup]', `${insert}\n\n[markup]`);
    }
    return hugoToml + insert;
  }

  private generatePlaceholderSvg(businessName: string, category: string | null): string {
    const cat = category || 'Business';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600" viewBox="0 0 1200 600">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e293b"/>
      <stop offset="100%" style="stop-color:#334155"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="600" fill="url(#bg)"/>
  <text x="600" y="280" font-family="Inter, system-ui, sans-serif" font-size="48" font-weight="bold" fill="white" text-anchor="middle">${businessName}</text>
  <text x="600" y="340" font-family="Inter, system-ui, sans-serif" font-size="24" fill="#94a3b8" text-anchor="middle">${cat}</text>
</svg>`;
  }

  private async generateStaticSite(slug: string, structure: GeneratedSiteStructure, request: SiteGenerationRequest): Promise<void> {
    const pages = [
      { file: 'index.html', content: structure.content.find((c) => c.path.includes('index'))?.body || '' },
      { file: 'about.html', content: structure.content.find((c) => c.path.includes('about'))?.body || '' },
      { file: 'services.html', content: structure.content.find((c) => c.path.includes('services'))?.body || '' },
      { file: 'contact.html', content: structure.content.find((c) => c.path.includes('contact'))?.body || '' },
    ];

    const heroStatic = structure.static.find((s) => s.path.includes('hero'));
    const heroAsset = structure.assets.find((a) => a.path.includes('hero'));

    const navHtml = `
      <nav style="background:#1e293b;color:white;padding:1rem 2rem;display:flex;align-items:center;justify-content:space-between">
        <a href="/" style="color:white;text-decoration:none;font-size:1.25rem;font-weight:700">${request.businessName}</a>
        <div style="display:flex;gap:1.5rem">
          <a href="/${slug}/" style="color:#e2e8f0;text-decoration:none">Home</a>
          <a href="/${slug}/about.html" style="color:#e2e8f0;text-decoration:none">About</a>
          <a href="/${slug}/services.html" style="color:#e2e8f0;text-decoration:none">Services</a>
          <a href="/${slug}/contact.html" style="color:#e2e8f0;text-decoration:none">Contact</a>
        </div>
      </nav>`;

    const footerHtml = `
      <footer style="background:#0f172a;color:#94a3b8;padding:2rem;text-align:center;margin-top:4rem">
        <p>&copy; ${new Date().getFullYear()} ${request.businessName}. All rights reserved.</p>
        ${request.phone ? `<p>Phone: ${request.phone}</p>` : ''}
        ${request.email ? `<p>Email: ${request.email}</p>` : ''}
      </footer>`;

    for (const page of pages) {
      const html = this.wrapHtml(request.businessName, request.slug, `
        ${navHtml}
        <main style="max-width:900px;margin:0 auto;padding:2rem">
          ${this.mdToSimpleHtml(page.content)}
        </main>
        ${footerHtml}
      `);

      await this.publisher.writeFile(request.slug, page.file, html);
    }

    // Save hero image
    if (heroStatic) {
      await this.publisher.writeFile(request.slug, 'images/hero.svg', heroStatic.body);
    }
    if (heroAsset) {
      await this.publisher.writeFileBinary(request.slug, 'images/hero.jpg', heroAsset.data);
    }

    // Write CSS
    await this.publisher.writeFile(request.slug, 'style.css', `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Inter, system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
      h1 { font-size: 2.5rem; margin-bottom: 1rem; }
      h2 { font-size: 1.75rem; margin: 2rem 0 1rem; }
      p { margin-bottom: 1rem; }
      ul { margin-left: 1.5rem; margin-bottom: 1rem; }
      li { margin-bottom: 0.5rem; }
      a { color: #2563eb; }
    `);
  }

  private wrapHtml(title: string, slug: string, body: string): string {
    return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="/${slug}/style.css">
</head>
<body>
${body}
</body>
</html>`;
  }

  private mdToSimpleHtml(md: string): string {
    let html = md;
    // Remove frontmatter
    html = html.replace(/^---[\s\S]*?---\n*/m, '');
    // Headers
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Lists
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);
    // Paragraphs
    html = html.replace(/\n\n+/g, '</p><p>');
    html = `<p>${html}</p>`;
    html = html.replace(/<p>\s*<(h[1-3]|ul|li)/g, '<$1');
    html = html.replace(/<\/(h[1-3]|ul|li)>\s*<\/p>/g, '</$1>');
    html = html.replace(/<p>\s*<\/p>/g, '');
    return html;
  }

  private async downloadImage(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download image: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
