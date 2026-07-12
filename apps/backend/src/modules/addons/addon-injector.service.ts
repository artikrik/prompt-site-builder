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
    // Add payment shortcode partial
    structure.partials.push({
      path: 'layouts/partials/payment-widget.html',
      body: `<div class="payment-widget" id="payment-form">
  <h3>Online Payment</h3>
  <form id="wayforpay-form" class="payment-form">
    <label>Amount (UAH) <input type="number" name="amount" min="1" required /></label>
    <label>Description <input type="text" name="description" /></label>
    <button type="submit" class="btn btn-primary">Pay Now</button>
  </form>
  <div id="payment-status" class="mt-2"></div>
</div>
<script>
  document.getElementById('wayforpay-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = new FormData(form);
    document.getElementById('payment-status')!.textContent = 'Processing...';
    try {
      const res = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(data)),
      });
      if (res.ok) {
        const invoice = await res.json();
        window.location.href = invoice.checkoutUrl;
      } else {
        document.getElementById('payment-status')!.textContent = 'Payment failed. Please try again.';
      }
    } catch {
      document.getElementById('payment-status')!.textContent = 'Network error. Please try again.';
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
    // Add booking widget partial
    structure.partials.push({
      path: 'layouts/partials/booking-widget.html',
      body: `<div class="booking-widget" id="booking-form">
  <h3>Book an Appointment</h3>
  <form id="easyweek-form" class="booking-form">
    <label>Service <select name="service" id="booking-service">
      <option value="">Loading services...</option>
    </select></label>
    <label>Date <input type="date" name="date" id="booking-date" required /></label>
    <label>Time <select name="time" id="booking-time">
      <option value="">Select time</option>
    </select></label>
    <label>Name <input type="text" name="name" required /></label>
    <label>Phone <input type="tel" name="phone" required /></label>
    <button type="submit" class="btn btn-primary">Book Now</button>
  </form>
  <div id="booking-status" class="mt-2"></div>
</div>
<script>
  (async () => {
    try {
      const res = await fetch('/api/booking/services');
      const services = await res.json();
      const sel = document.getElementById('booking-service');
      if (sel) services.forEach((s) => { sel.innerHTML += '<option value="' + s.id + '">' + s.name + '</option>'; });
    } catch {}
  })();
  document.getElementById('easyweek-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = new FormData(form);
    document.getElementById('booking-status')!.textContent = 'Booking...';
    try {
      const res = await fetch('/api/booking/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(data)),
      });
      if (res.ok) {
        document.getElementById('booking-status')!.textContent = 'Booking confirmed! We will contact you shortly.';
      } else {
        document.getElementById('booking-status')!.textContent = 'Booking failed. Please try again.';
      }
    } catch {
      document.getElementById('booking-status')!.textContent = 'Network error. Please try again.';
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
