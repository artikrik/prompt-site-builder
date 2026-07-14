import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApifyScrapedBusiness } from './apify.provider';

interface GoogleTextSearchResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  formatted_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  geometry?: {
    location: { lat: number; lng: number };
  };
}

interface GoogleTextSearchResponse {
  results: GoogleTextSearchResult[];
  status: string;
  next_page_token?: string;
}

@Injectable()
export class GoogleMapsScraperProvider {
  private readonly logger = new Logger(GoogleMapsScraperProvider.name);
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GOOGLE_MAPS_API_KEY', '');
  }

  async scrapeBusinesses(params: {
    city: string;
    category: string;
    limit?: number;
  }): Promise<ApifyScrapedBusiness[]> {
    const { city, category, limit = 20 } = params;
    this.logger.log(`Scraping Google Maps for "${category}" in "${city}" (limit: ${limit})`);

    if (!this.apiKey) {
      this.logger.warn('GOOGLE_MAPS_API_KEY not configured');
      return [];
    }

    try {
      const query = `${category} ${city} Ukraine`;
      const results = await this.textSearch(query, Math.min(limit, 20));
      
      return results.map((r) => ({
        businessName: r.name,
        address: r.formatted_address || null,
        phone: r.formatted_phone_number || null,
        website: r.website || null,
        category: r.types?.[0] || category,
        city: city,
        placeId: r.place_id,
        rating: r.rating ?? null,
        reviewCount: r.user_ratings_total ?? null,
      }));
    } catch (error) {
      this.logger.error(`Google Maps scraping failed: ${error}`);
      return [];
    }
  }

  private async textSearch(query: string, limit: number): Promise<GoogleTextSearchResult[]> {
    const allResults: GoogleTextSearchResult[] = [];
    let pageToken: string | undefined;
    let pagesFetched = 0;
    const maxPages = Math.ceil(limit / 20);

    do {
      const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
      url.searchParams.set('query', query);
      url.searchParams.set('key', this.apiKey);
      url.searchParams.set('language', 'uk');
      if (pageToken) {
        url.searchParams.set('pagetoken', pageToken);
        // Google requires a delay before using next_page_token
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Google Maps API error: ${response.status}`);
      }

      const data = (await response.json()) as GoogleTextSearchResponse;
      if (data.status !== 'OK') {
        this.logger.warn(`Google Maps text search status: ${data.status}`);
        break;
      }

      allResults.push(...data.results);
      pageToken = data.next_page_token;
      pagesFetched++;
    } while (pageToken && pagesFetched < maxPages);

    return allResults.slice(0, limit);
  }
}
