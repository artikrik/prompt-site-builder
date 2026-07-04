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
  scrapedData: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
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
  scrapedData?: Record<string, unknown>;
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
  tags?: string[];
}

export interface LeadFilter {
  search?: string;
  status?: LeadStatus;
  source?: string;
  city?: string;
  category?: string;
  tags?: string[];
}
