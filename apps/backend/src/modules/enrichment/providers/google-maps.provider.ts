import { Injectable, Logger } from '@nestjs/common';
import { IEnrichmentProvider } from './types';
import type {
  EnrichmentData,
  EnrichmentReview,
  EnrichmentWorkingHours,
  CompetitorInfo,
} from '@prompt-site-builder/shared';

interface GooglePlaceCandidate {
  place_id: string;
}

interface GoogleFindPlaceResponse {
  candidates: GooglePlaceCandidate[];
  status: string;
}

interface GooglePhoto {
  photo_reference: string;
}

interface GoogleReview {
  author_name: string;
  text?: string;
  rating: number;
}

interface GoogleOpeningHours {
  weekday_text?: string[];
}

interface GooglePlaceDetailsResult {
  photos?: GooglePhoto[];
  reviews?: GoogleReview[];
  rating?: number;
  user_ratings_total?: number;
  opening_hours?: GoogleOpeningHours;
  website?: string;
  formatted_phone_number?: string;
  formatted_address?: string;
  types?: string[];
  geometry?: {
    location: { lat: number; lng: number };
  };
}

interface GooglePlaceDetailsResponse {
  result: GooglePlaceDetailsResult;
  status: string;
}

interface GoogleNearbyResult {
  name: string;
  place_id: string;
  rating?: number;
  user_ratings_total?: number;
  vicinity?: string;
  types?: string[];
}

interface GoogleNearbyResponse {
  results: GoogleNearbyResult[];
  status: string;
}

@Injectable()
export class GoogleMapsProvider implements IEnrichmentProvider {
  readonly source = 'googleMaps' as const;
  private readonly logger = new Logger(GoogleMapsProvider.name);
  private readonly apiKey: string;

  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
  }

  async enrich(
    businessName: string,
    city?: string,
    _url?: string,
  ): Promise<Partial<EnrichmentData>> {
    if (!this.apiKey) {
      this.logger.warn('GOOGLE_MAPS_API_KEY not set, skipping Google Maps enrichment');
      return {};
    }

    try {
      const placeId = await this.findPlace(businessName, city);
      if (!placeId) {
        this.logger.warn(`No Google Maps place found for "${businessName}"`);
        return {};
      }

      const details = await this.getPlaceDetails(placeId);
      if (!details) {
        this.logger.warn(`Failed to get place details for "${businessName}" (${placeId})`);
        return {};
      }

      const photos = this.buildPhotoUrls(details.photos);
      const reviews = this.mapReviews(details.reviews);
      const workingHours = this.mapHours(details.opening_hours);

      const competitors = details.geometry
        ? await this.findCompetitors(
            details.geometry.location.lat,
            details.geometry.location.lng,
            details.types?.[0],
          )
        : [];

      return {
        photos,
        reviews,
        workingHours,
        coverPhotoUrl: photos[0],
        sourceUrls: { googleMaps: `https://www.google.com/maps/place/?q=place_id:${placeId}` },
        stats: {
          googleRating: details.rating,
          googleReviewCount: details.user_ratings_total,
        },
        competitors,
      };
    } catch (error) {
      this.logger.warn(`Google Maps enrichment failed for "${businessName}": ${error}`);
      return {};
    }
  }

  private async findPlace(businessName: string, city?: string): Promise<string | null> {
    const query = city ? `${businessName} ${city}` : businessName;
    const url =
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
      `?input=${encodeURIComponent(query)}` +
      `&inputtype=textquery` +
      `&fields=place_id` +
      `&key=${this.apiKey}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        this.logger.warn(`Google Maps findplace failed: ${response.status}`);
        return null;
      }

      const data = (await response.json()) as GoogleFindPlaceResponse;
      if (data.status !== 'OK' || !data.candidates || data.candidates.length === 0) {
        this.logger.warn(`Google Maps findplace returned no results, status: ${data.status}`);
        return null;
      }

      return data.candidates[0].place_id;
    } catch (error) {
      this.logger.warn(`Google Maps findplace error: ${error}`);
      return null;
    }
  }

  private async getPlaceDetails(placeId: string): Promise<GooglePlaceDetailsResult | null> {
    const fields = [
      'photos',
      'reviews',
      'rating',
      'opening_hours',
      'website',
      'formatted_phone_number',
      'formatted_address',
      'types',
      'geometry',
    ].join(',');

    const url =
      `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${placeId}` +
      `&fields=${fields}` +
      `&key=${this.apiKey}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        this.logger.warn(`Google Maps place details failed: ${response.status}`);
        return null;
      }

      const data = (await response.json()) as GooglePlaceDetailsResponse;
      if (data.status !== 'OK') {
        this.logger.warn(`Google Maps place details status: ${data.status}`);
        return null;
      }

      return data.result;
    } catch (error) {
      this.logger.warn(`Google Maps place details error: ${error}`);
      return null;
    }
  }

  private async findCompetitors(
    lat: number,
    lng: number,
    type?: string,
  ): Promise<CompetitorInfo[]> {
    let url =
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
      `?location=${lat},${lng}` +
      `&radius=5000` +
      `&rankby=prominence` +
      `&key=${this.apiKey}`;

    if (type) {
      url += `&type=${type}`;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        this.logger.warn(`Google Maps nearbysearch failed: ${response.status}`);
        return [];
      }

      const data = (await response.json()) as GoogleNearbyResponse;
      if (data.status !== 'OK' || !data.results) {
        return [];
      }

      return data.results.map((r) => this.mapCompetitor(r));
    } catch (error) {
      this.logger.warn(`Google Maps nearbysearch error: ${error}`);
      return [];
    }
  }

  private buildPhotoUrls(photos?: GooglePhoto[]): string[] {
    if (!photos || photos.length === 0) return [];
    return photos.map(
      (p) =>
        `https://maps.googleapis.com/maps/api/place/photo` +
        `?maxwidth=800` +
        `&photoreference=${p.photo_reference}` +
        `&key=${this.apiKey}`,
    );
  }

  private mapReviews(reviews?: GoogleReview[]): EnrichmentReview[] {
    if (!reviews) return [];
    return reviews
      .filter((r) => r.text || r.author_name)
      .map((r) => ({
        author: r.author_name || 'Anonymous',
        text: r.text || '',
        rating: r.rating,
      }));
  }

  private mapHours(hours?: GoogleOpeningHours): EnrichmentWorkingHours[] {
    if (!hours?.weekday_text) return [];

    return hours.weekday_text
      .map((line) => {
        const colonIndex = line.indexOf(': ');
        if (colonIndex === -1) return null;

        const day = line.slice(0, colonIndex);
        const timePart = line.slice(colonIndex + 2);
        const dashIndex = timePart.indexOf(' – ');
        if (dashIndex === -1) return null;

        const open = timePart.slice(0, dashIndex);
        const close = timePart.slice(dashIndex + 3);

        if (!day || !open || !close) return null;

        return { day, open, close };
      })
      .filter((h): h is EnrichmentWorkingHours => h !== null);
  }

  private mapCompetitor(result: GoogleNearbyResult): CompetitorInfo {
    return {
      name: result.name,
      googleMapsUrl: `https://www.google.com/maps/place/?q=place_id:${result.place_id}`,
      rating: result.rating ?? 0,
      reviewCount: result.user_ratings_total ?? 0,
      distance: result.vicinity,
      services: [],
      positioning: '',
      uniqueSellingPoints: [],
    };
  }
}
