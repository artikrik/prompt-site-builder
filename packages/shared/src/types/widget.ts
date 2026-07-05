import { WidgetType } from '../enums';

export interface ClientWidget {
  id: string;
  projectId: string;
  type: WidgetType;
  config: WidgetConfig;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type WidgetConfig = BookingWidgetConfig | PaymentWidgetConfig;

export interface BookingWidgetConfig {
  provider: 'easyweek';
  accountId: string;
  services?: string[];
}

export interface PaymentWidgetConfig {
  provider: 'wayforpay' | 'monobank';
  merchantId: string;
  apiKey: string;
  callbackUrl?: string;
}

export interface WidgetApiResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface CreateWidgetDto {
  projectId: string;
  type: WidgetType;
  config: unknown;
}
