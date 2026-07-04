import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface BookingConfig {
  accountId: string;
  services?: string[];
}

export interface BookingSlot {
  time: string;
  available: boolean;
}

export interface BookingResult {
  success: boolean;
  bookingId?: string;
  error?: string;
}

@Injectable()
export class BookingWidgetService {
  private readonly logger = new Logger(BookingWidgetService.name);
  private readonly apiKey: string;
  private readonly apiUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('EASYWEEK_API_KEY', '');
    this.apiUrl = this.configService.get<string>('EASYWEEK_API_URL', 'https://api.easyweek.io/api/v1');
  }

  async getAvailableSlots(
    accountId: string,
    date: string,
    serviceId?: string,
  ): Promise<BookingSlot[]> {
    if (!this.apiKey) {
      this.logger.warn('EasyWeek API key not configured');
      return [];
    }

    try {
      const params = new URLSearchParams({ account: accountId, date });
      if (serviceId) params.set('service', serviceId);

      const response = await fetch(`${this.apiUrl}/slots?${params}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });

      if (!response.ok) {
        this.logger.error(`EasyWeek slots fetch failed: ${response.status} ${response.statusText}`);
        return [];
      }

      const data = await response.json() as Record<string, unknown>;
      const slots = (data.slots ?? data) as Array<{ time: string; available: boolean }>;
      return slots.map((s) => ({ time: s.time, available: s.available }));
    } catch (error) {
      this.logger.error(`EasyWeek slots fetch error: ${error}`);
      return [];
    }
  }

  async createBooking(
    accountId: string,
    customerName: string,
    customerPhone: string,
    serviceId: string,
    slotTime: string,
    date?: string,
  ): Promise<BookingResult> {
    if (!this.apiKey) {
      this.logger.warn('EasyWeek API key not configured');
      return { success: false, error: 'Booking provider not configured' };
    }

    try {
      const body = {
        account: accountId,
        customerName,
        customerPhone,
        service: serviceId,
        time: slotTime,
        date: date ?? new Date().toISOString().split('T')[0],
      };

      const response = await fetch(`${this.apiUrl}/bookings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`EasyWeek booking failed: ${response.status} ${errorText}`);
        return { success: false, error: `API error: ${response.status}` };
      }

      const data = await response.json() as Record<string, unknown>;
      this.logger.log(`Booking created for ${customerName}: ${String(data.id ?? data.bookingId ?? 'unknown')}`);

      return {
        success: true,
        bookingId: String(data.id ?? data.bookingId ?? ''),
      };
    } catch (error) {
      this.logger.error(`EasyWeek booking error: ${error}`);
      return { success: false, error: String(error) };
    }
  }
}
