import { LeadStatus } from '../enums';

export interface Lead {
  id: string;
  businessName: string;
  slug: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  category: string | null;
  description: string | null;
  website: string | null;
  socialUrl: string | null;
  source: string;
  status: LeadStatus;
  tags: string[];
  scrapedData: any;
  createdAt: Date;
  updatedAt: Date;
  easyweekEnabled: boolean;
  easyweekApiKey: string | null;
  wayforpayEnabled: boolean;
  wayforpayMerchant: string | null;
  wayforpaySecret: string | null;
  monobankEnabled: boolean;
  monobankApiKey: string | null;
}

export interface CreateLeadDto {
  businessName: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  category?: string;
  description?: string;
  website?: string;
  socialUrl?: string;
  source: string;
  tags?: string[];
  scrapedData?: any;
}

export interface UpdateLeadDto {
  businessName?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  category?: string;
  description?: string;
  website?: string;
  socialUrl?: string;
  status?: LeadStatus;
  scrapedData?: any;
  tags?: string[];
  easyweekEnabled?: boolean;
  easyweekApiKey?: string | null;
  wayforpayEnabled?: boolean;
  wayforpayMerchant?: string | null;
  wayforpaySecret?: string | null;
  monobankEnabled?: boolean;
  monobankApiKey?: string | null;
}

export interface LeadFilter {
  search?: string;
  status?: LeadStatus;
  source?: string;
  city?: string;
  category?: string;
  tags?: string[];
}
