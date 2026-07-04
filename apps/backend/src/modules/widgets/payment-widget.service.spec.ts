import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PaymentWidgetService } from './payment-widget.service';
import { ConfigService } from '@nestjs/config';

describe('PaymentWidgetService', () => {
  let service: PaymentWidgetService;
  let configService: { get: ReturnType<typeof vi.fn> };
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    configService = { get: vi.fn() };
    configService.get.mockImplementation((key: string, fallback: string) => {
      if (key === 'WAYFORPAY_SECRET') return 'wfp-secret';
      if (key === 'BASE_DOMAIN') return 'sitenow.pp.ua';
      return fallback;
    });

    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    service = new PaymentWidgetService(configService as unknown as ConfigService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('createInvoice', () => {
    const paymentConfig = {
      provider: 'wayforpay' as const,
      merchantId: 'test-merchant',
      apiKey: 'test-key',
    };

    const invoiceRequest = {
      amount: 500,
      currency: 'UAH',
      description: 'Test payment',
      orderId: 'order-1',
    };

    it('should create WayForPay invoice via API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            invoiceUrl: 'https://secure.wayforpay.com/invoice/123',
            orderReference: 'order-1',
          }),
      });

      const result = await service.createInvoice(paymentConfig, invoiceRequest);
      expect(result.success).toBe(true);
      expect(result.invoiceUrl).toContain('wayforpay');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('wayforpay'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should create Monobank invoice via API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            invoiceId: 'mono-abc',
            pageUrl: 'https://pay.monobank.com.ua/mono-abc',
          }),
      });

      const result = await service.createInvoice(
        { provider: 'monobank', merchantId: '', apiKey: 'mono-key' },
        invoiceRequest,
      );
      expect(result.success).toBe(true);
      expect(result.invoiceUrl).toContain('monobank');
    });

    it('should return error when WayForPay credentials missing', async () => {
      const result = await service.createInvoice(
        { provider: 'wayforpay', merchantId: '', apiKey: '' },
        invoiceRequest,
      );
      expect(result.success).toBe(false);
    });

    it('should return error when Monobank API key missing', async () => {
      const result = await service.createInvoice(
        { provider: 'monobank', merchantId: '', apiKey: '' },
        invoiceRequest,
      );
      expect(result.success).toBe(false);
    });

    it('should handle API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ reason: 'Invalid request', errCode: 'error' }),
      });

      const result = await service.createInvoice(paymentConfig, invoiceRequest);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('verifyCallback', () => {
    it('should return false for unknown provider', async () => {
      const result = await service.verifyCallback('unknown', {}, '');
      expect(result).toBe(false);
    });

    it('should verify WayForPay callback', async () => {
      const payload = {
        merchantAccount: 'test-merchant',
        orderReference: 'order-1',
        amount: '500.00',
        currency: 'UAH',
        authCode: '123456',
        cardPan: '1234',
        transactionStatus: 'Approved',
      };
      const result = await service.verifyCallback('wayforpay', payload, 'fake-sig');
      expect(result).toBe(false); // will fail due to signature mismatch
    });

    it('should verify Monobank callback', async () => {
      const result = await service.verifyCallback('monobank', { invoiceId: 'x1' }, 'fake-sig');
      expect(result).toBe(false); // will fail due to missing public key
    });
  });
});
