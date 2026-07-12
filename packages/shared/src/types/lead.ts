import { LeadStatus } from '../enums';
import { EnrichmentData } from './enrichment';

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
  socialUrls: string[];
  country: string | null;
  region: string | null;
  source: string;
  status: LeadStatus;
  tags: string[];
  scrapedData: any;
  scrapingEnabled: boolean;
  scrapedPhotos: string[];
  scrapedReviews: Array<Record<string, unknown>>;
  scrapedContacts: Record<string, unknown>;
  scrapedHours: Record<string, unknown>;
  enrichmentData: EnrichmentData | null;
  enrichedAt: Date | null;
  enrichmentSources: string[];
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
  region?: string;
  country?: string;
  category?: string;
  description?: string;
  website?: string;
  socialUrls?: string[];
  source: string;
  tags?: string[];
  scrapedData?: any;
  enrichmentSources?: Array<'instagram' | 'facebook' | 'googleMaps'>;
}

export interface UpdateLeadDto {
  businessName?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  category?: string;
  description?: string;
  website?: string;
  socialUrls?: string[];
  status?: LeadStatus;
  scrapedData?: any;
  tags?: string[];
  enrichmentSources?: Array<'instagram' | 'facebook' | 'googleMaps'>;
  scrapingEnabled?: boolean;
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
