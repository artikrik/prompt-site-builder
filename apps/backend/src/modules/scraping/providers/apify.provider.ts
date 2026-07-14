import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../../settings/settings.service';

export interface ApifyScrapeParams {
  city: string;
  category: string;
  limit?: number;
}

export interface ApifyScrapedBusiness {
  businessName: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  category: string | null;
  city: string | null;
  placeId: string | null;
  rating: number | null;
  reviewCount: number | null;
}

@Injectable()
export class ApifyProvider {
  private readonly logger = new Logger(ApifyProvider.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService,
  ) {}

  private async getApiToken(): Promise<string> {
    const { value } = await this.settingsService.get('apify_api_key');
    if (value) return value;
    return this.configService.get<string>('APIFY_TOKEN', '');
  }

  async scrapeGoogleMaps(params: ApifyScrapeParams): Promise<ApifyScrapedBusiness[]> {
    const { city, category, limit = 20 } = params;
    this.logger.log(`Scraping Google Maps for "${category}" in "${city}" (limit: ${limit})`);

    const apiToken = await this.getApiToken();
    if (!apiToken) {
      this.logger.warn('No Apify API token configured — using mock results');
      return this.getMockResults(city, category, limit);
    }

    try {
      const searchQuery = `${category} ${city}`;
      const response = await fetch(
        `https://api.apify.com/v2/acts/apify~google-maps-scraper/run-sync-get-dataset-items?token=${apiToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            searchStringsArray: [searchQuery],
            maxCrawledPlacesPerSearch: limit,
            language: 'uk',
            includeWebsite: true,
            includePhone: true,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Apify API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any[];
      return this.mapApifyResults(data);
    } catch (error) {
      this.logger.error(`Apify scraping failed: ${error}`);
      return this.getMockResults(city, category, limit);
    }
  }

  private mapApifyResults(data: any[]): ApifyScrapedBusiness[] {
    return data.map((item) => ({
      businessName: item.title || item.name || 'Unknown',
      address: item.address || null,
      phone: item.phone || null,
      website: item.url || item.website || null,
      category: item.categoryName || null,
      city: item.city || null,
      placeId: item.placeId || null,
      rating: item.totalScore || null,
      reviewCount: item.reviewsCount || null,
    }));
  }

  private getMockResults(city: string, category: string, limit: number): ApifyScrapedBusiness[] {
    this.logger.warn('Using mock scraping results');
    const businesses: ApifyScrapedBusiness[] = [];
    for (let i = 1; i <= Math.min(limit, 5); i++) {
      businesses.push({
        businessName: `${category} ${city} #${i}`,
        address: `вул. Хрещатик ${i}, ${city}`,
        phone: `+380${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
        website: null,
        category,
        city,
        placeId: `mock-place-${i}`,
        rating: 4 + Math.random(),
        reviewCount: Math.floor(Math.random() * 50),
      });
    }
    return businesses;
  }
}
