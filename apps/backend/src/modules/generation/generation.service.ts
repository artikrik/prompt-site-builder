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
import { marked } from 'marked';

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
      <nav class="nav" role="navigation" aria-label="Головна навігація">
        <div class="nav-inner">
          <a href="/" class="nav-brand">${safeName}</a>
          <button class="nav-toggle" onclick="document.querySelector('.nav-links').classList.toggle('open')" aria-label="Відкрити меню" aria-expanded="false" aria-controls="nav-menu">&#9776;</button>
          <div class="nav-links" id="nav-menu" role="menubar">
            ${pages.map((p) => `<a href="/${p.file}" role="menuitem">${p.label}</a>`).join('\n            ')}
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
            <a href="/contact.html" class="btn btn-outline">Безкоштовна консультація</a>
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
            ${pages.map((p) => `<a href="/${p.file}">${p.label}</a>`).join('\n            ')}
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
  }

  private getStaticFallbackCss(): string {
    return `/* Reset & Base */
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; -webkit-font-smoothing: antialiased; }
body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; line-height: 1.7; color: #1e293b; background: #fff; }
img { max-width: 100%; height: auto; display: block; }
a { color: #6d28d9; text-decoration: none; transition: color .15s ease; }
a:hover { color: #5b21b6; }

/* Typography */
h1 { font-size: clamp(2rem, 5vw, 3.2rem); font-weight: 800; line-height: 1.12; letter-spacing: -0.03em; color: #0f172a; margin-bottom: 1rem; text-wrap: balance; }
h2 { font-size: clamp(1.35rem, 3vw, 1.75rem); font-weight: 700; color: #0f172a; margin: 0 0 1rem; line-height: 1.3; text-wrap: balance; }
h3 { font-size: 1.1rem; font-weight: 600; color: #1e293b; margin: 0 0 .5rem; }
p { margin-bottom: 1rem; color: #334155; max-width: 65ch; }
ul, ol { margin: 0 0 1rem 1.25rem; color: #334155; }
li { margin-bottom: .4rem; line-height: 1.65; }
blockquote { padding: 1.25rem 1.5rem; margin: 0; background: transparent; border-radius: 0; font-style: normal; color: #334155; border: none; }
blockquote p { color: #334155; margin-bottom: .35rem; }
hr { border: none; height: 1px; background: #e2e8f0; margin: 3rem 0; }
strong { color: #0f172a; font-weight: 600; }
em { font-style: italic; color: #475569; }

/* Layout */
.container { max-width: 800px; margin: 0 auto; padding: 4rem 1.5rem; }
.content { background: transparent; }
.section-spacing { padding: 4rem 0; }

/* Navigation */
.nav { background: #0f172a; color: #fff; position: sticky; top: 0; z-index: 100; }
.nav-inner { max-width: 1100px; margin: 0 auto; padding: 0 1.5rem; display: flex; align-items: center; justify-content: space-between; height: 56px; }
.nav-brand { color: #fff; font-size: 1rem; font-weight: 700; text-decoration: none; letter-spacing: -0.01em; }
.nav-brand:hover { color: #c4b5fd; }
.nav-links { display: flex; gap: 1.75rem; align-items: center; }
.nav-links a { color: #94a3b8; font-size: .85rem; font-weight: 500; transition: color .15s ease; }
.nav-links a:hover { color: #fff; }
.nav-toggle { display: none; background: none; border: none; color: #fff; font-size: 1.4rem; cursor: pointer; padding: .5rem; }

/* Hero */
.hero { background: #0f172a; color: #fff; padding: 5rem 1.5rem 4.5rem; text-align: center; position: relative; overflow: hidden; }
.hero::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 60% 50% at 50% 0%, rgba(109,40,217,.15) 0%, transparent 70%); pointer-events: none; }
.hero::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(255,255,255,.08), transparent); }
.hero-inner { max-width: 640px; margin: 0 auto; position: relative; z-index: 1; }
.hero h1 { color: #fff; font-size: clamp(2.2rem, 5.5vw, 3.4rem); margin-bottom: 1rem; letter-spacing: -0.035em; }
.hero-sub { color: #94a3b8; font-size: clamp(.95rem, 2vw, 1.1rem); margin-bottom: 2rem; max-width: 460px; margin-left: auto; margin-right: auto; line-height: 1.6; }
.hero-actions { display: flex; gap: .75rem; justify-content: center; flex-wrap: wrap; }

/* Buttons */
.btn { display: inline-flex; align-items: center; padding: .7rem 1.5rem; border-radius: 6px; font-size: .9rem; font-weight: 600; text-decoration: none; transition: all .2s ease; cursor: pointer; border: 1.5px solid transparent; min-height: 44px; }
.btn-primary { background: #6d28d9; color: #fff; border-color: #6d28d9; }
.btn-primary:hover { background: #5b21b6; border-color: #5b21b6; color: #fff; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(109,40,217,.3); }
.btn-outline { background: transparent; color: rgba(255,255,255,.9); border-color: rgba(255,255,255,.2); }
.btn-outline:hover { background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.35); color: #fff; }
.btn-sm { padding: .5rem 1.1rem; font-size: .82rem; border-radius: 5px; }

/* Cards (replacing side-stripe h3) */
.card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.25rem; margin: 1.5rem 0; }
.card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1.5rem; }
.card h3 { margin-bottom: .5rem; }
.card p { font-size: .9rem; color: #475569; margin-bottom: 0; }

/* Feature list (replacing checkmark list) */
.feature-list { list-style: none; margin: 1rem 0 0; padding: 0; }
.feature-list li { padding: .6rem 0 .6rem 1.75rem; position: relative; color: #334155; font-size: .92rem; border-bottom: 1px solid #f1f5f9; }
.feature-list li:last-child { border-bottom: none; }
.feature-list li::before { content: ''; position: absolute; left: 0; top: .85rem; width: 8px; height: 8px; background: #6d28d9; border-radius: 50%; }

/* Steps (replacing numbered h3) */
.steps { counter-reset: step; margin: 1.5rem 0; }
.step { display: flex; gap: 1rem; margin-bottom: 1.5rem; align-items: flex-start; }
.step-num { flex-shrink: 0; width: 32px; height: 32px; background: #6d28d9; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: .8rem; font-weight: 700; margin-top: .1rem; }
.step-content h3 { margin-bottom: .35rem; }
.step-content p { font-size: .9rem; color: #475569; margin-bottom: 0; }

/* Testimonials */
.testimonials { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.25rem; margin: 1.5rem 0; }
.testimonial { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1.5rem; }
.testimonial-quote { font-size: .92rem; color: #334155; font-style: italic; line-height: 1.6; margin-bottom: .75rem; }
.testimonial-quote::before { content: '\\201C'; font-size: 1.5rem; color: #6d28d9; line-height: 0; vertical-align: -.3em; margin-right: .15rem; }
.testimonial-author { font-size: .82rem; color: #64748b; font-weight: 500; }

/* FAQ */
.faq-item { border-bottom: 1px solid #e2e8f0; }
.faq-item:last-child { border-bottom: none; }
.faq-q { display: flex; justify-content: space-between; align-items: center; padding: 1.1rem 0; cursor: pointer; font-weight: 600; color: #0f172a; font-size: .95rem; background: none; border: none; width: 100%; text-align: left; font-family: inherit; min-height: 44px; }
.faq-q:hover { color: #6d28d9; }
.faq-q::after { content: '+'; font-size: 1.2rem; color: #94a3b8; transition: transform .2s ease; flex-shrink: 0; margin-left: 1rem; }
.faq-item.open .faq-q::after { content: '\\2212'; }
.faq-a { max-height: 0; overflow: hidden; transition: max-height .3s ease, padding .3s ease; }
.faq-item.open .faq-a { max-height: 200px; padding-bottom: 1.1rem; }
.faq-a p { font-size: .9rem; color: #475569; margin-bottom: 0; }

/* CTA Section */
.cta-section { background: #f1f0fb; border-radius: 12px; padding: 2.5rem; text-align: center; margin: 2rem 0; }
.cta-section h2 { margin-bottom: .75rem; }
.cta-section p { margin: 0 auto 1.5rem; color: #475569; }
.cta-actions { display: flex; gap: .75rem; justify-content: center; flex-wrap: wrap; }

/* Footer */
.footer { background: #0f172a; color: #94a3b8; padding-top: 3rem; }
.footer-inner { max-width: 1100px; margin: 0 auto; padding: 0 1.5rem 2rem; display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 2rem; }
.footer-brand strong { color: #e2e8f0; font-size: .95rem; font-weight: 600; }
.footer-brand p { color: #64748b; margin-top: .4rem; font-size: .82rem; line-height: 1.5; }
.footer-links strong, .footer-contact strong { color: #e2e8f0; display: block; margin-bottom: .75rem; font-size: .75rem; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: #64748b; }
.footer-links a { display: block; color: #94a3b8; padding: .25rem 0; font-size: .85rem; transition: color .15s; min-height: 32px; display: flex; align-items: center; }
.footer-links a:hover { color: #fff; }
.footer-contact p { font-size: .85rem; margin-bottom: .35rem; }
.footer-contact a { color: #c4b5fd; }
.footer-contact a:hover { color: #ddd6fe; }
.footer-bottom { border-top: 1px solid rgba(255,255,255,.06); text-align: center; padding: 1.25rem; font-size: .78rem; color: #475569; }

/* Responsive */
@media (max-width: 768px) {
  .nav-toggle { display: block; }
  .nav-links { display: none; position: absolute; top: 56px; left: 0; right: 0; background: #0f172a; flex-direction: column; padding: .75rem 1.5rem; gap: 0; box-shadow: 0 4px 20px rgba(0,0,0,.3); border-top: 1px solid rgba(255,255,255,.05); }
  .nav-links.open { display: flex; }
  .nav-links a { padding: .65rem 0; border-bottom: 1px solid rgba(255,255,255,.05); font-size: .88rem; min-height: 44px; display: flex; align-items: center; }
  .hero { padding: 3.5rem 1.25rem 3rem; }
  .container { padding: 2.5rem 1.25rem; }
  .footer-inner { grid-template-columns: 1fr; gap: 1.5rem; }
  .card-grid { grid-template-columns: 1fr; }
  .testimonials { grid-template-columns: 1fr; }
  .cta-section { padding: 2rem 1.25rem; }
  a, button { min-height: 44px; display: inline-flex; align-items: center; }
  .btn { min-height: 44px; padding: .65rem 1.25rem; }
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  html { scroll-behavior: auto; }
}
:focus-visible { outline: 2px solid #6d28d9; outline-offset: 2px; }`;
  }

  private wrapHtml(title: string, slug: string, body: string): string {
    return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title)}</title>
  <meta name="description" content="${this.escapeHtml(title)} — професійні послуги">
  <style>${this.getStaticFallbackCss()}</style>
</head>
<body>
${body}
<script>
document.querySelectorAll('.faq-q').forEach(function(q){
  q.addEventListener('click',function(){
    var item=this.closest('.faq-item');
    var wasOpen=item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach(function(i){i.classList.remove('open')});
    if(!wasOpen)item.classList.add('open');
  });
});
var toggle=document.querySelector('.nav-toggle');
if(toggle){toggle.addEventListener('click',function(){var expanded=this.getAttribute('aria-expanded')==='true';this.setAttribute('aria-expanded',String(!expanded))});}
</script>
</body>
</html>`;
  }

  private mdToSimpleHtml(md: string): string {
    // Remove frontmatter
    const withoutFrontmatter = md.replace(/^---[\s\S]*?---\n*/m, '');

    // Use marked for proper markdown conversion
    try {
      marked.setOptions({
        breaks: true,
        gfm: true,
      });
      return marked.parse(withoutFrontmatter) as string;
    } catch {
      // Fallback to simple conversion if marked is not available
      return this.simpleMdToHtml(withoutFrontmatter);
    }
  }

  private simpleMdToHtml(md: string): string {
    let html = md;
    // Headers
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    // Horizontal rules
    html = html.replace(/^---+$/gm, '<hr>');
    // Blockquotes
    html = html.replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>');
    html = html.replace(/<\/blockquote>\s*<blockquote>/g, '\n');
    // Lists
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);
    // Inline elements
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Paragraphs
    const lines = html.split('\n');
    const result: string[] = [];
    let inParagraph = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (inParagraph) { result.push('</p>'); inParagraph = false; }
        continue;
      }
      const isBlock = /^<(h[1-6]|hr|ul|ol|li|blockquote|div|table|pre|nav|section|footer)/.test(trimmed);
      if (isBlock) {
        if (inParagraph) { result.push('</p>'); inParagraph = false; }
        result.push(trimmed);
      } else {
        if (!inParagraph) { result.push('<p>'); inParagraph = true; }
        result.push(trimmed);
      }
    }
    if (inParagraph) result.push('</p>');
    return result.join('\n');
  }

  private async downloadImage(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download image: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
