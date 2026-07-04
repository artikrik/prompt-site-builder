import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BookingWidgetService } from './booking-widget.service';
import { ConfigService } from '@nestjs/config';

describe('BookingWidgetService', () => {
  let service: BookingWidgetService;
  let configService: { get: ReturnType<typeof vi.fn> };
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    configService = { get: vi.fn() };
    configService.get.mockImplementation((key: string, fallback: string) => {
      if (key === 'EASYWEEK_API_KEY') return 'test-api-key';
      if (key === 'EASYWEEK_API_URL') return 'https://api.easyweek.io/api/v1';
      return fallback;
    });

    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    service = new BookingWidgetService(configService as unknown as ConfigService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getAvailableSlots', () => {
    it('should return empty array when API key is missing', async () => {
      const svc = new BookingWidgetService({
        get: vi.fn().mockReturnValue(''),
      } as unknown as ConfigService);
      const result = await svc.getAvailableSlots('123', '2026-01-01');
      expect(result).toEqual([]);
    });

    it('should fetch and parse slots from API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            slots: [
              { time: '09:00', available: true },
              { time: '10:00', available: false },
            ],
          }),
      });

      const result = await service.getAvailableSlots('123', '2026-01-01');
      expect(result).toEqual([
        { time: '09:00', available: true },
        { time: '10:00', available: false },
      ]);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('account=123'),
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-api-key' }) }),
      );
    });

    it('should return empty on API error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      const result = await service.getAvailableSlots('123', '2026-01-01');
      expect(result).toEqual([]);
    });

    it('should return empty on non-ok response', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' });
      const result = await service.getAvailableSlots('123', '2026-01-01');
      expect(result).toEqual([]);
    });
  });

  describe('createBooking', () => {
    it('should return error when API key is missing', async () => {
      const svc = new BookingWidgetService({
        get: vi.fn().mockReturnValue(''),
      } as unknown as ConfigService);
      const result = await svc.createBooking('123', 'John', '+380501234567', 's1', '09:00');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Booking provider not configured');
    });

    it('should create booking via API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'booking-1' }),
      });

      const result = await service.createBooking('123', 'John', '+380501234567', 's1', '09:00');
      expect(result.success).toBe(true);
      expect(result.bookingId).toBe('booking-1');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/bookings'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});
