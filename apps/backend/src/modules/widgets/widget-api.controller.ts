import { Controller, Get, Post, Param, Query, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BookingWidgetService, BookingSlot } from './booking-widget.service';
import { PaymentWidgetService, InvoiceResponse } from './payment-widget.service';

@ApiTags('Widget API (Public)')
@Controller('widget-api')
export class WidgetApiController {
  constructor(
    private readonly bookingService: BookingWidgetService,
    private readonly paymentService: PaymentWidgetService,
  ) {}

  @Get('booking/slots/:accountId')
  @ApiOperation({ summary: 'Get available booking slots (public, called by widget JS)' })
  @ApiResponse({ status: 200, description: 'Available slots' })
  async getSlots(
    @Param('accountId') accountId: string,
    @Query('date') date: string,
    @Query('service') service?: string,
  ): Promise<BookingSlot[]> {
    return this.bookingService.getAvailableSlots(accountId, date, service);
  }

  @Post('booking/create')
  @ApiOperation({ summary: 'Create a booking (public, called by widget JS)' })
  @ApiResponse({ status: 201, description: 'Booking created' })
  async createBooking(
    @Body()
    body: {
      accountId: string;
      customerName: string;
      customerPhone: string;
      serviceId: string;
      slotTime: string;
      date?: string;
    },
  ) {
    return this.bookingService.createBooking(
      body.accountId,
      body.customerName,
      body.customerPhone,
      body.serviceId,
      body.slotTime,
      body.date,
    );
  }

  @Post('payment/invoice')
  @ApiOperation({ summary: 'Create a payment invoice (public, called by widget JS)' })
  @ApiResponse({ status: 201, description: 'Invoice created' })
  async createInvoice(
    @Body()
    body: {
      provider: 'wayforpay' | 'monobank';
      merchantId: string;
      apiKey: string;
      callbackUrl?: string;
      amount: number;
      currency: string;
      description: string;
      orderId: string;
    },
  ): Promise<InvoiceResponse> {
    return this.paymentService.createInvoice(
      {
        provider: body.provider,
        merchantId: body.merchantId,
        apiKey: body.apiKey,
        callbackUrl: body.callbackUrl,
      },
      {
        amount: body.amount,
        currency: body.currency,
        description: body.description,
        orderId: body.orderId,
      },
    );
  }

  @Post('payment/callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Payment provider callback (WayForPay / Monobank)' })
  async paymentCallback(
    @Body() body: Record<string, unknown>,
    @Query('signature') signature?: string,
  ) {
    void (body.merchantAccount ?? body.invoiceId ?? '');
    const sig = signature ?? String(body.merchantSignature ?? body.sign ?? '');

    const valid = await this.paymentService.verifyCallback(
      body.merchantAccount ? 'wayforpay' : 'monobank',
      body,
      sig,
    );

    if (!valid) {
      return { success: false, error: 'Invalid signature' };
    }

    // TODO: Update project/order status based on payment confirmation
    return { success: true, message: 'Callback processed' };
  }
}
