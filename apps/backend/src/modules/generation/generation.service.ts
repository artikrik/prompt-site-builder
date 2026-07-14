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
import { DefaultContentBuilder } from './default-content.builder';

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
    return DefaultContentBuilder.build(
      {
        businessName: request.businessName,
        category: request.category,
        description: request.description,
        address: request.address,
        phone: request.phone,
        email: request.email,
        socialUrl: request.socialUrl,
        theme: request.theme,
      },
      this.configService.get<string>('BASE_DOMAIN', 'sitenow.pp.ua'),
    );
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

  private escapeHtml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  private generatePlaceholderSvg(businessName: string, category: string | null): string {
    const cat = category || 'Business';
    const safeName = this.escapeHtml(businessName);
    const safeCat = this.escapeHtml(cat);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600" viewBox="0 0 1200 600">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e293b"/>
      <stop offset="100%" style="stop-color:#334155"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="600" fill="url(#bg)"/>
  <text x="600" y="280" font-family="Inter, system-ui, sans-serif" font-size="48" font-weight="bold" fill="white" text-anchor="middle">${safeName}</text>
  <text x="600" y="340" font-family="Inter, system-ui, sans-serif" font-size="24" fill="#94a3b8" text-anchor="middle">${safeCat}</text>
</svg>`;
  }

  private async generateStaticSite(slug: string, structure: GeneratedSiteStructure, request: SiteGenerationRequest): Promise<void> {
    const pages = [
      { file: 'index.html', content: structure.content.find((c) => c.path.includes('index'))?.body || '', label: 'Головна' },
      { file: 'about.html', content: structure.content.find((c) => c.path.includes('about'))?.body || '', label: 'Про нас' },
      { file: 'services.html', content: structure.content.find((c) => c.path.includes('services'))?.body || '', label: 'Послуги' },
      { file: 'contact.html', content: structure.content.find((c) => c.path.includes('contact'))?.body || '', label: 'Контакти' },
    ];

    const heroStatic = structure.static.find((s) => s.path.includes('hero'));
    const heroAsset = structure.assets.find((a) => a.path.includes('hero'));
    const safeName = this.escapeHtml(request.businessName);
    const safeCat = this.escapeHtml(request.category || 'Професійні послуги');
    const safeAddr = this.escapeHtml(request.address || '');
    const safePhone = this.escapeHtml(request.phone || '');
    const safeEmail = this.escapeHtml(request.email || '');

    const navHtml = `
      <nav class="nav">
        <div class="nav-inner">
          <a href="/${slug}/" class="nav-brand">${safeName}</a>
          <button class="nav-toggle" onclick="document.querySelector('.nav-links').classList.toggle('open')" aria-label="Меню">&#9776;</button>
          <div class="nav-links">
            ${pages.map((p) => `<a href="/${slug}/${p.file}">${p.label}</a>`).join('\n            ')}
          </div>
        </div>
      </nav>`;

    const heroHtml = `
      <section class="hero">
        <div class="hero-inner">
          <h1>${safeName}</h1>
          <p class="hero-sub">${safeCat} — професійний підхід до кожного клієнта</p>
          <div class="hero-actions">
            ${safePhone ? `<a href="tel:${safePhone.replace(/\s/g, '')}" class="btn btn-primary">Зателефонувати</a>` : ''}
            <a href="/${slug}/contact.html" class="btn btn-outline">Безкоштовна консультація</a>
          </div>
        </div>
      </section>`;

    const footerHtml = `
      <footer class="footer">
        <div class="footer-inner">
          <div class="footer-brand">
            <strong>${safeName}</strong>
            <p>${safeCat}</p>
          </div>
          <div class="footer-links">
            <strong>Навігація</strong>
            ${pages.map((p) => `<a href="/${slug}/${p.file}">${p.label}</a>`).join('\n            ')}
          </div>
          <div class="footer-contact">
            <strong>Контакти</strong>
            ${safePhone ? `<p><a href="tel:${safePhone.replace(/\s/g, '')}">${safePhone}</a></p>` : ''}
            ${safeEmail ? `<p><a href="mailto:${safeEmail}">${safeEmail}</a></p>` : ''}
            ${safeAddr ? `<p>${safeAddr}</p>` : ''}
          </div>
        </div>
        <div class="footer-bottom">
          <p>&copy; ${new Date().getFullYear()} ${safeName}. Усі права захищено.</p>
        </div>
      </footer>`;

    for (const page of pages) {
      const isHome = page.file === 'index.html';
      const html = this.wrapHtml(request.businessName, request.slug, `
        ${navHtml}
        ${isHome ? heroHtml : ''}
        <main class="container">
          <article class="content">
            ${this.mdToSimpleHtml(page.content)}
          </article>
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

    // Write CSS — professional responsive stylesheet
    await this.publisher.writeFile(request.slug, 'style.css', this.getStaticFallbackCss());
  }

  private getStaticFallbackCss(): string {
    return `/* Reset & Base */
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { font-family: 'Inter', system-ui, -apple-system, sans-serif; line-height: 1.7; color: #1e293b; background: #fff; }
img { max-width: 100%; height: auto; }
a { color: #2563eb; text-decoration: none; transition: color .2s; }
a:hover { color: #1d4ed8; }

/* Typography */
h1 { font-size: clamp(2rem, 5vw, 3.2rem); font-weight: 800; line-height: 1.15; letter-spacing: -0.02em; color: #0f172a; margin-bottom: 1rem; }
h2 { font-size: clamp(1.5rem, 3vw, 2rem); font-weight: 700; color: #0f172a; margin: 2.5rem 0 1rem; padding-bottom: .5rem; border-bottom: 2px solid #e2e8f0; }
h3 { font-size: 1.2rem; font-weight: 600; color: #1e293b; margin: 1.5rem 0 .75rem; }
p { margin-bottom: 1rem; color: #475569; }
ul, ol { margin: 0 0 1rem 1.5rem; color: #475569; }
li { margin-bottom: .4rem; }
blockquote { border-left: 4px solid #2563eb; padding: 1rem 1.5rem; margin: 1.5rem 0; background: #f8fafc; border-radius: 0 8px 8px 0; font-style: italic; color: #334155; }
hr { border: none; height: 1px; background: #e2e8f0; margin: 2rem 0; }
strong { color: #0f172a; }

/* Layout */
.container { max-width: 960px; margin: 0 auto; padding: 2rem 1.5rem; }
.content { background: #fff; }

/* Navigation */
.nav { background: #0f172a; color: #fff; position: sticky; top: 0; z-index: 100; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
.nav-inner { max-width: 1100px; margin: 0 auto; padding: 0 1.5rem; display: flex; align-items: center; justify-content: space-between; height: 64px; }
.nav-brand { color: #fff; font-size: 1.2rem; font-weight: 700; text-decoration: none; }
.nav-brand:hover { color: #93c5fd; }
.nav-links { display: flex; gap: 2rem; align-items: center; }
.nav-links a { color: #cbd5e1; font-size: .95rem; font-weight: 500; transition: color .2s; }
.nav-links a:hover { color: #fff; }
.nav-toggle { display: none; background: none; border: none; color: #fff; font-size: 1.5rem; cursor: pointer; padding: .5rem; }

/* Hero */
.hero { background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%); color: #fff; padding: 5rem 1.5rem; text-align: center; position: relative; overflow: hidden; }
.hero::before { content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle at 30% 50%, rgba(37,99,235,.15) 0%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(59,130,246,.1) 0%, transparent 50%); pointer-events: none; }
.hero-inner { max-width: 800px; margin: 0 auto; position: relative; z-index: 1; }
.hero h1 { color: #fff; font-size: clamp(2.2rem, 6vw, 3.5rem); margin-bottom: 1rem; }
.hero-sub { color: #94a3b8; font-size: clamp(1rem, 2.5vw, 1.3rem); margin-bottom: 2rem; max-width: 600px; margin-left: auto; margin-right: auto; }
.hero-actions { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }

/* Buttons */
.btn { display: inline-flex; align-items: center; padding: .85rem 2rem; border-radius: 8px; font-size: 1rem; font-weight: 600; text-decoration: none; transition: all .2s; cursor: pointer; border: 2px solid transparent; }
.btn-primary { background: #2563eb; color: #fff; border-color: #2563eb; }
.btn-primary:hover { background: #1d4ed8; border-color: #1d4ed8; color: #fff; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(37,99,235,.3); }
.btn-outline { background: transparent; color: #fff; border-color: rgba(255,255,255,.3); }
.btn-outline:hover { background: rgba(255,255,255,.1); border-color: #fff; color: #fff; }

/* Cards (for services, features) */
.content h3 { background: #f8fafc; padding: .75rem 1rem; border-radius: 6px; border-left: 4px solid #2563eb; }
.content ul { list-style: none; margin-left: 0; }
.content ul li { padding-left: 1.5rem; position: relative; }
.content ul li::before { content: '✓'; position: absolute; left: 0; color: #2563eb; font-weight: 700; }

/* Footer */
.footer { background: #0f172a; color: #94a3b8; padding-top: 3rem; }
.footer-inner { max-width: 1100px; margin: 0 auto; padding: 0 1.5rem 2rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 2rem; }
.footer-brand strong { color: #fff; font-size: 1.1rem; }
.footer-brand p { color: #94a3b8; margin-top: .5rem; font-size: .9rem; }
.footer-links strong, .footer-contact strong { color: #e2e8f0; display: block; margin-bottom: .75rem; font-size: .95rem; }
.footer-links a { display: block; color: #94a3b8; padding: .25rem 0; font-size: .9rem; }
.footer-links a:hover { color: #fff; }
.footer-contact p { font-size: .9rem; margin-bottom: .4rem; }
.footer-contact a { color: #93c5fd; }
.footer-contact a:hover { color: #bfdbfe; }
.footer-bottom { border-top: 1px solid #1e293b; text-align: center; padding: 1.5rem; font-size: .85rem; }

/* Responsive */
@media (max-width: 768px) {
  .nav-toggle { display: block; }
  .nav-links { display: none; position: absolute; top: 64px; left: 0; right: 0; background: #0f172a; flex-direction: column; padding: 1rem 1.5rem; gap: 0; box-shadow: 0 4px 12px rgba(0,0,0,.2); }
  .nav-links.open { display: flex; }
  .nav-links a { padding: .75rem 0; border-bottom: 1px solid #1e293b; }
  .hero { padding: 3rem 1rem; }
  .container { padding: 1.5rem 1rem; }
  .footer-inner { grid-template-columns: 1fr; }
}`;
  }

  private wrapHtml(title: string, slug: string, body: string): string {
    return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title)}</title>
  <meta name="description" content="${this.escapeHtml(title)} — професійні послуги">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
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
    // Horizontal rules
    html = html.replace(/^---+$/gm, '<hr>');
    // Blockquotes
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Lists
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);
    // Paragraphs
    html = html.replace(/\n\n+/g, '</p><p>');
    html = `<p>${html}</p>`;
    html = html.replace(/<p>\s*<(h[1-3]|ul|li|hr|blockquote)/g, '<$1');
    html = html.replace(/<\/(h[1-3]|ul|li|blockquote)>\s*<\/p>/g, '</$1>');
    html = html.replace(/<p>\s*<hr>\s*<\/p>/g, '<hr>');
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
