export interface EnrichmentService {
  name: string;
  price?: string;
  description?: string;
}

export interface EnrichmentReview {
  author: string;
  text: string;
  rating?: number;
}

export interface EnrichmentWorkingHours {
  day: string;
  open: string;
  close: string;
}

export interface EnrichmentFAQ {
  question: string;
  answer: string;
}

export interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
  extractedFrom: string;
}

export interface ToneOfVoice {
  style: string;
  formality: string;
  keyPhrases: string[];
  languageMix: string;
  emojiUsage: string;
  sampleBio: string;
}

export interface AudienceInsights {
  followers: number;
  engagementRate: string;
  topLocations: string[];
  ageGroup: string;
}

export interface CustomerJourney {
  bookingChannels: string[];
  paymentMethods: string[];
  messagingApps: string[];
}

export interface CompetitorInfo {
  name: string;
  googleMapsUrl?: string;
  website?: string;
  instagram?: string;
  rating: number;
  reviewCount: number;
  distance?: string;
  services: EnrichmentService[];
  websiteAnalysis?: {
    pages: string[];
    hasOnlineBooking: boolean;
    hasPriceList: boolean;
    hasPortfolio: boolean;
    hasReviews: boolean;
    strengths: string[];
    weaknesses: string[];
  };
  positioning: string;
  uniqueSellingPoints: string[];
}

export interface MarketGap {
  opportunities: string[];
  recommendedPages: string[];
  differentiationAngle: string;
}

export interface SalesOpportunity {
  gap: string;
  currentState: string;
  recommendation: string;
  pitchAngle: string;
  revenueImpact: string;
}

export interface EnrichmentSourceUrls {
  instagram?: string;
  facebook?: string;
  googleMaps?: string;
}

export interface EnrichmentStats {
  instagramPosts?: number;
  instagramFollowers?: number;
  facebookReviews?: number;
  googleRating?: number;
  googleReviewCount?: number;
}

export interface EnrichmentData {
  services: EnrichmentService[];
  reviews: EnrichmentReview[];
  workingHours: EnrichmentWorkingHours[];
  faq: EnrichmentFAQ[];
  photos: string[];
  videos: string[];
  logoUrl?: string;
  coverPhotoUrl?: string;
  brandColors?: BrandColors;
  fonts?: { preferred: string[]; note: string };
  toneOfVoice?: ToneOfVoice;
  audienceInsights?: AudienceInsights;
  customerJourney?: CustomerJourney;
  competitors: CompetitorInfo[];
  marketGap?: MarketGap;
  salesOpportunities: SalesOpportunity[];
  salesScript?: Record<string, unknown>;
  sourceUrls: EnrichmentSourceUrls;
  stats: EnrichmentStats;
}

export interface UpdateEnrichmentSourcesDto {
  sources: Array<'instagram' | 'facebook' | 'googleMaps'>;
}
