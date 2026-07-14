import { Injectable, Logger } from '@nestjs/common';
import { AddonService } from './addon.service';
import type { GeneratedSiteStructure } from '@prompt-site-builder/shared';

@Injectable()
export class AddonInjectorService {
  private readonly logger = new Logger(AddonInjectorService.name);

  constructor(private readonly addonService: AddonService) {}

  async injectAddons(structure: GeneratedSiteStructure, projectId: string): Promise<void> {
    const activeAddons = await this.addonService.getActiveAddons(projectId);

    if (!activeAddons.length) return;

    this.logger.log(`Injecting ${activeAddons.length} active addon(s) for project ${projectId}`);

    for (const addon of activeAddons) {
      switch (addon.addonType) {
        case 'ONLINE_PAYMENT':
          this.injectPayment(structure);
          break;
        case 'ONLINE_BOOKING':
          this.injectBooking(structure);
          break;
        case 'CONTENT_MANAGEMENT':
          this.injectCms(structure);
          break;
      }
    }
  }

  private injectPayment(structure: GeneratedSiteStructure): void {
    // Add payment shortcode partial using official WayForPay widget
    structure.partials.push({
      path: 'layouts/partials/payment-widget.html',
      body: `<div class="payment-widget" id="payment-widget">
  <h3>Онлайн-оплата</h3>
  <p>Для оплати натисніть кнопку нижче</p>
  <div id="wayforpay-container"></div>
</div>
<script src="https://secure.wayforpay.com/checkout.js"></script>
<script>
  // WayForPay widget will be initialized with merchant config
  // This is a placeholder - actual merchant account should be configured in addon settings
  document.addEventListener('DOMContentLoaded', function() {
    var container = document.getElementById('wayforpay-container');
    if (container) {
      container.innerHTML = '<p style="color: #666; font-style: italic;">Оплата онлайн стане доступна після налаштування merchant-рахунку</p>';
    }
  });
</script>`,
    });

    // Add shortcode for Hugo templates
    structure.shortcodes.push({
      path: 'layouts/shortcodes/payment.html',
      body: `{{ partial "payment-widget.html" . }}`,
    });
  }

  private injectBooking(structure: GeneratedSiteStructure): void {
    // Add booking widget partial using official EasyWeek widget
    structure.partials.push({
      path: 'layouts/partials/booking-widget.html',
      body: `<div class="booking-widget" id="booking-widget">
  <h3>Онлайн-запис</h3>
  <p>Запишіться на прийом онлайн</p>
  <div id="easyweek-container"></div>
</div>
<script>
  // EasyWeek widget will be initialized with company config
  // This is a placeholder - actual company ID should be configured in addon settings
  document.addEventListener('DOMContentLoaded', function() {
    var container = document.getElementById('easyweek-container');
    if (container) {
      container.innerHTML = '<p style="color: #666; font-style: italic;">Онлайн-запис стане доступний після налаштування акаунту EasyWeek</p>';
    }
  });
</script>`,
    });

    structure.shortcodes.push({
      path: 'layouts/shortcodes/booking.html',
      body: `{{ partial "booking-widget.html" . }}`,
    });
  }

  private injectCms(structure: GeneratedSiteStructure): void {
    // CMS integration — inject content-editable markers and admin bar
    structure.partials.push({
      path: 'layouts/partials/cms-admin-bar.html',
      body: `<div id="cms-admin-bar" class="cms-admin-bar" style="display:none; position:fixed; top:0; left:0; right:0; background:#1a1a2e; color:#fff; padding:8px 16px; z-index:9999; font-size:14px; display:flex; gap:16px; align-items:center;">
  <span>CMS</span>
  <a href="/admin/cms" style="color:#4fc3f7">Pages</a>
  <a href="/admin/cms/photos" style="color:#4fc3f7">Photos</a>
  <a href="/admin/cms/pricing" style="color:#4fc3f7">Pricing</a>
  <button onclick="document.getElementById('cms-admin-bar').style.display='none'" style="margin-left:auto; background:none; border:none; color:#fff; cursor:pointer;">✕</button>
</div>
<script>
  if (document.cookie.includes('cms_auth=')) {
    document.getElementById('cms-admin-bar').style.display = 'flex';
  }
</script>`,
    });

    structure.shortcodes.push({
      path: 'layouts/shortcodes/cms.html',
      body: `{{ partial "cms-admin-bar.html" . }}`,
    });
  }
}
