import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac } from 'crypto';

export interface PaymentConfig {
  provider: 'wayforpay' | 'monobank';
  merchantId: string;
  apiKey: string;
  callbackUrl?: string;
}

export interface InvoiceRequest {
  amount: number;
  currency: string;
  description: string;
  orderId: string;
}

export interface InvoiceResponse {
  success: boolean;
  invoiceUrl?: string;
  invoiceId?: string;
  error?: string;
}

@Injectable()
export class PaymentWidgetService {
  private readonly logger = new Logger(PaymentWidgetService.name);
  private readonly wayforpayUrl: string;
  private readonly monobankUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.wayforpayUrl = this.configService.get<string>('WAYFORPAY_API_URL', 'https://api.wayforpay.com/api');
    this.monobankUrl = this.configService.get<string>('MONOBANK_API_URL', 'https://api.monobank.ua/api/merchant');
  }

  async createInvoice(config: PaymentConfig, request: InvoiceRequest): Promise<InvoiceResponse> {
    if (config.provider === 'wayforpay') {
      return this.createWayForPayInvoice(config, request);
    }
    return this.createMonobankInvoice(config, request);
  }

  private async createWayForPayInvoice(
    config: PaymentConfig,
    request: InvoiceRequest,
  ): Promise<InvoiceResponse> {
    const merchantKey = config.apiKey;

    if (!merchantKey || !config.merchantId) {
      this.logger.warn('WayForPay merchant credentials not configured');
      return { success: false, error: 'Payment provider not configured' };
    }

    const formattedAmount = request.amount.toFixed(2);
    const domainName = this.configService.get<string>('BASE_DOMAIN', 'sitenow.pp.ua');

    // Build signature: merchantAccount;merchantDomainName;orderReference;orderDate;amount;currency;productNames;productCount;productPrice
    const signatureRaw = [
      config.merchantId,
      domainName,
      request.orderId,
      new Date().toISOString().split('T')[0],
      formattedAmount,
      request.currency,
      request.description.replace(/;/g, ''),
      '1',
      formattedAmount,
    ].join(';');

    const signature = createHmac('sha256', merchantKey).update(signatureRaw).digest('hex');

    const payload = {
      transactionType: 'CREATE_INVOICE',
      merchantAccount: config.merchantId,
      merchantDomainName: domainName,
      merchantSignature: signature,
      apiVersion: 1,
      orderReference: request.orderId,
      orderDate: Math.floor(Date.now() / 1000),
      amount: formattedAmount,
      currency: request.currency,
      productName: [request.description.replace(/;/g, '')],
      productCount: [1],
      productPrice: [formattedAmount],
      serviceUrl: config.callbackUrl ?? `https://${domainName}/api/payment/callback`,
    };

    try {
      const response = await fetch(this.wayforpayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json() as Record<string, unknown>;

      if ((data.reasonCode ?? data.reason) && !data.invoiceUrl) {
        this.logger.error(`WayForPay invoice creation failed: ${JSON.stringify(data)}`);
        return { success: false, error: String(data.reason ?? data.reasonCode ?? 'Unknown error') };
      }

      this.logger.log(`WayForPay invoice created: ${String(data.invoiceUrl ?? data.orderReference)}`);

      return {
        success: true,
        invoiceId: String(data.orderReference ?? request.orderId),
        invoiceUrl: String(data.invoiceUrl ?? `https://secure.wayforpay.com/pay/${request.orderId}`),
      };
    } catch (error) {
      this.logger.error(`WayForPay API error: ${error}`);
      return { success: false, error: String(error) };
    }
  }

  private async createMonobankInvoice(
    config: PaymentConfig,
    request: InvoiceRequest,
  ): Promise<InvoiceResponse> {
    if (!config.apiKey) {
      this.logger.warn('Monobank API key not configured');
      return { success: false, error: 'Payment provider not configured' };
    }

    const payload = {
      amount: Math.round(request.amount * 100), // Monobank expects amount in kopiykas
      ccy: request.currency === 'UAH' ? 980 : 840, // ISO 4217 numeric: UAH=980, USD=840
      merchantPaymInfo: {
        reference: request.orderId,
        destination: request.description,
      },
      redirectUrl: config.callbackUrl ?? `https://${this.configService.get<string>('BASE_DOMAIN', 'sitenow.pp.ua')}/payment/callback`,
      webHookUrl: config.callbackUrl ?? `https://${this.configService.get<string>('BASE_DOMAIN', 'sitenow.pp.ua')}/api/payment/callback`,
    };

    try {
      const response = await fetch(`${this.monobankUrl}/invoice/create`, {
        method: 'POST',
        headers: {
          'X-Token': config.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json() as Record<string, unknown>;

      if (!response.ok || data.errCode) {
        this.logger.error(`Monobank invoice creation failed: ${JSON.stringify(data)}`);
        return {
          success: false,
          error: String(data.errText ?? `API error: ${response.status}`),
        };
      }

      this.logger.log(`Monobank invoice created: ${String(data.invoiceId)}`);

      return {
        success: true,
        invoiceId: String(data.invoiceId),
        invoiceUrl: String(data.pageUrl ?? `https://pay.monobank.com.ua/${data.invoiceId}`),
      };
    } catch (error) {
      this.logger.error(`Monobank API error: ${error}`);
      return { success: false, error: String(error) };
    }
  }

  async verifyCallback(provider: string, payload: Record<string, unknown>, signature: string): Promise<boolean> {
    this.logger.log(`Verifying ${provider} payment callback`);

    if (provider === 'wayforpay') {
      return this.verifyWayForPayCallback(payload, signature);
    }
    if (provider === 'monobank') {
      return this.verifyMonobankCallback(payload, signature);
    }

    this.logger.warn(`Unknown payment provider: ${provider}`);
    return false;
  }

  private verifyWayForPayCallback(payload: Record<string, unknown>, signature: string): boolean {
    const merchantKey = this.configService.get<string>('WAYFORPAY_SECRET', '');
    if (!merchantKey) {
      this.logger.warn('WayForPay merchant secret not configured for callback verification');
      return false;
    }

    // Build expected signature string
    const fields = [
      payload.merchantAccount,
      payload.orderReference,
      payload.amount,
      payload.currency,
      payload.authCode,
      payload.cardPan,
      payload.transactionStatus,
    ].map(String);

    const expectedSig = createHmac('sha256', merchantKey).update(fields.join(';')).digest('hex');

    const valid = expectedSig === signature;
    if (!valid) {
      this.logger.warn(`WayForPay callback signature mismatch: expected ${expectedSig}, got ${signature}`);
    }
    return valid;
  }

  private verifyMonobankCallback(payload: Record<string, unknown>, signature: string): boolean {
    // Monobank uses X-Sign header with public key verification
    // The signature is a base64-encoded ECDSA signature of the request body
    const publicKey = this.configService.get<string>('MONOBANK_PUBLIC_KEY', '');
    if (!publicKey) {
      this.logger.warn('Monobank public key not configured for callback verification');
      return false;
    }

    try {
      const verify = createHmac('sha256', publicKey)
        .update(JSON.stringify(payload))
        .digest('hex');
      return verify === signature;
    } catch (error) {
      this.logger.error(`Monobank callback verification error: ${error}`);
      return false;
    }
  }
}
