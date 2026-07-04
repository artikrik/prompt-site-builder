import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateWidgetDto, ClientWidget, WidgetType } from '@prompt-site-builder/shared';

@Injectable()
export class WidgetsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateWidgetDto): Promise<ClientWidget> {
    return this.prisma.clientWidget.create({
      data: {
        projectId: dto.projectId,
        type: dto.type,
        config: dto.config,
      },
    });
  }

  async findByProject(projectId: string): Promise<ClientWidget[]> {
    return this.prisma.clientWidget.findMany({
      where: { projectId },
    });
  }

  async findOne(id: string): Promise<ClientWidget> {
    const widget = await this.prisma.clientWidget.findUnique({
      where: { id },
    });

    if (!widget) {
      throw new NotFoundException(`Widget with ID ${id} not found`);
    }

    return widget;
  }

  async toggleEnabled(id: string, enabled: boolean): Promise<ClientWidget> {
    await this.findOne(id);

    return this.prisma.clientWidget.update({
      where: { id },
      data: { enabled },
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);

    await this.prisma.clientWidget.delete({
      where: { id },
    });
  }

  async getWidgetHtml(projectId: string): Promise<string> {
    const widgets = await this.findByProject(projectId);
    const enabledWidgets = widgets.filter((w) => w.enabled);

    let html = '';

    for (const widget of enabledWidgets) {
      if (widget.type === WidgetType.BOOKING) {
        const config = widget.config as any;
        html += this.generateBookingWidgetHtml(config);
      } else if (widget.type === WidgetType.PAYMENT) {
        const config = widget.config as any;
        html += this.generatePaymentWidgetHtml(config);
      }
    }

    return html;
  }

  private generateBookingWidgetHtml(config: any): string {
    return `
<!-- EasyWeek Booking Widget -->
<div id="easyweek-widget" 
     data-account="${config.accountId || ''}"
     data-services="${(config.services || []).join(',')}">
</div>
<script src="https://easyweek.io/js/widget.js" async></script>
`;
  }

  private generatePaymentWidgetHtml(config: any): string {
    if (config.provider === 'wayforpay') {
      return `
<!-- WayForPay Widget -->
<div id="wayforpay-widget"
     data-merchant="${config.merchantId || ''}">
</div>
<script src="https://secure.wayforpay.com/js/widget.js" async></script>
`;
    }
    return `
<!-- Monobank Payment Widget -->
<div id="monobank-widget" class="payment-widget">
  <div class="payment-form">
    <label for="monobank-amount">Сума (грн):</label>
    <input type="number" id="monobank-amount" min="1" step="0.01" placeholder="0.00" />
    <label for="monobank-desc">Призначення платежу:</label>
    <input type="text" id="monobank-desc" placeholder="Оплата послуг" />
    <button id="monobank-pay-btn" class="payment-btn">Сплатити через Monobank</button>
    <p id="monobank-status" class="payment-status"></p>
  </div>
</div>
<script>
(function() {
  var btn = document.getElementById('monobank-pay-btn');
  var status = document.getElementById('monobank-status');
  if (!btn) return;
  btn.addEventListener('click', function() {
    var amount = document.getElementById('monobank-amount').value;
    var desc = document.getElementById('monobank-desc').value || 'Оплата послуг';
    if (!amount || parseFloat(amount) <= 0) {
      status.textContent = 'Будь ласка, вкажіть суму';
      return;
    }
    status.textContent = 'Створення платежу...';
    btn.disabled = true;
    fetch('/api/payment/invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'monobank',
        amount: parseFloat(amount),
        currency: 'UAH',
        description: desc,
        orderId: 'order_' + Date.now()
      })
    }).then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.invoiceUrl) {
          window.location.href = data.invoiceUrl;
        } else {
          status.textContent = 'Помилка: ' + (data.error || 'не вдалося створити платіж');
          btn.disabled = false;
        }
      })
      .catch(function(err) {
        status.textContent = 'Помилка з'єднання';
        btn.disabled = false;
      });
  });
})();
</script>
`;
  }
}
