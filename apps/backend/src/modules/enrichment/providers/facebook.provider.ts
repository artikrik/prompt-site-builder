import { Injectable, Logger } from '@nestjs/common';
import { IEnrichmentProvider } from './types';
import type {
  EnrichmentData,
  EnrichmentReview,
  EnrichmentService,
  EnrichmentWorkingHours,
} from '@prompt-site-builder/shared';

interface FacebookPage {
  id: string;
  name?: string;
  about?: string;
  description?: string;
  category?: string;
  phone?: string;
  emails?: string[];
  website?: string;
  location?: { city?: string; street?: string; zip?: string };
  cover?: { source?: string };
  rating_count?: number;
  overall_star_rating?: number;
  hours?: Record<string, string>;
}

interface FacebookPost {
  message?: string;
  full_picture?: string;
  created_time?: string;
}

interface FacebookRating {
  reviewer?: { name?: string };
  review_text?: string;
  rating?: number;
  created_time?: string;
}

@Injectable()
export class FacebookProvider implements IEnrichmentProvider {
  readonly source = 'facebook' as const;
  private readonly logger = new Logger(FacebookProvider.name);

  async enrich(
    businessName: string,
    city?: string,
    url?: string,
  ): Promise<Partial<EnrichmentData>> {
    const token = process.env.FACEBOOK_ACCESS_TOKEN;
    if (!token) {
      this.logger.warn('FACEBOOK_ACCESS_TOKEN not set, skipping Facebook enrichment');
      return {};
    }

    try {
      const page = await this.findPage(businessName, city, url, token);
      if (!page) {
        this.logger.warn(`No Facebook page found for "${businessName}"`);
        return {};
      }

      const [posts, ratings] = await Promise.all([
        this.fetchPosts(page.id, token),
        this.fetchRatings(page.id, token),
      ]);

      const [photos, albumPhotos] = await Promise.all([
        Promise.resolve(this.collectPostPhotos(posts)),
        this.fetchAlbumPhotos(page.id, token),
      ]);

      const services = this.extractServices(posts);
      const reviews = this.mapRatings(ratings);
      const workingHours = this.mapHours(page.hours);

      return {
        services,
        reviews,
        workingHours,
        photos: [...photos, ...albumPhotos],
        coverPhotoUrl: page.cover?.source,
        sourceUrls: { facebook: `https://www.facebook.com/${page.id}` },
        stats: { facebookReviews: page.rating_count ?? 0 },
      };
    } catch (error) {
      this.logger.warn(`Facebook enrichment failed for "${businessName}": ${error}`);
      return {};
    }
  }

  private async findPage(
    businessName: string,
    city: string | undefined,
    url: string | undefined,
    token: string,
  ): Promise<FacebookPage | null> {
    if (url) {
      const pageId = this.extractPageId(url);
      if (pageId) {
        return this.fetchPageDetails(pageId, token);
      }
    }

    const query = city ? `${businessName} ${city}` : businessName;
    const searchUrl =
      `https://graph.facebook.com/v18.0/pages/search?q=${encodeURIComponent(query)}` +
      `&fields=id,name,location&access_token=${token}`;

    const response = await fetch(searchUrl);
    if (!response.ok) {
      this.logger.warn(`Facebook page search failed: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as { data?: Array<{ id: string }> };
    if (!data.data || data.data.length === 0) {
      return null;
    }

    return this.fetchPageDetails(data.data[0].id, token);
  }

  private async fetchPageDetails(pageId: string, token: string): Promise<FacebookPage | null> {
    const fields = [
      'name',
      'about',
      'description',
      'category',
      'phone',
      'emails',
      'website',
      'location',
      'cover',
      'rating_count',
      'overall_star_rating',
      'hours',
    ].join(',');

    const url = `https://graph.facebook.com/v18.0/${pageId}?fields=${fields}&access_token=${token}`;
    const response = await fetch(url);
    if (!response.ok) {
      this.logger.warn(`Facebook page details fetch failed for ${pageId}: ${response.status}`);
      return null;
    }

    return (await response.json()) as FacebookPage;
  }

  private async fetchPosts(pageId: string, token: string): Promise<FacebookPost[]> {
    try {
      const url =
        `https://graph.facebook.com/v18.0/${pageId}/posts` +
        `?fields=message,full_picture,created_time&limit=50&access_token=${token}`;
      const response = await fetch(url);
      if (!response.ok) {
        this.logger.warn(`Facebook posts fetch failed: ${response.status}`);
        return [];
      }
      const data = (await response.json()) as { data?: FacebookPost[] };
      return data.data || [];
    } catch {
      return [];
    }
  }

  private async fetchRatings(pageId: string, token: string): Promise<FacebookRating[]> {
    try {
      const url =
        `https://graph.facebook.com/v18.0/${pageId}/ratings` +
        `?fields=reviewer{name},review_text,rating,created_time&limit=100&access_token=${token}`;
      const response = await fetch(url);
      if (!response.ok) {
        this.logger.warn(`Facebook ratings fetch failed: ${response.status}`);
        return [];
      }
      const data = (await response.json()) as { data?: FacebookRating[] };
      return data.data || [];
    } catch {
      return [];
    }
  }

  private collectPostPhotos(posts: FacebookPost[]): string[] {
    return posts.map((p) => p.full_picture).filter((url): url is string => !!url);
  }

  private async fetchAlbumPhotos(pageId: string, token: string): Promise<string[]> {
    try {
      const albumsUrl =
        `https://graph.facebook.com/v18.0/${pageId}/albums` +
        `?fields=id,name&limit=10&access_token=${token}`;
      const albumsResponse = await fetch(albumsUrl);
      if (!albumsResponse.ok) return [];
      const albums = (await albumsResponse.json()) as { data?: Array<{ id: string }> };
      if (!albums.data?.length) return [];

      const photos: string[] = [];
      for (const album of albums.data.slice(0, 5)) {
        const photosUrl =
          `https://graph.facebook.com/v18.0/${album.id}/photos` +
          `?fields=images&limit=20&access_token=${token}`;
        const photosResponse = await fetch(photosUrl);
        if (!photosResponse.ok) continue;
        const photosData = (await photosResponse.json()) as { data?: Array<{ images?: Array<{ source: string }> }> };
        for (const photo of photosData.data || []) {
          if (photo.images?.[0]?.source) {
            photos.push(photo.images[0].source);
          }
        }
      }
      return photos;
    } catch {
      return [];
    }
  }

  private extractPageId(url: string): string | null {
    const numericMatch = url.match(/facebook\.com\/(?:pages\/[^/]+\/)?(\d+)/);
    if (numericMatch) return numericMatch[1];

    const usernameMatch = url.match(/facebook\.com\/([^/?]+)/);
    if (usernameMatch) {
      const username = usernameMatch[1];
      if (username !== 'pages' && username !== 'groups') {
        return username;
      }
    }

    return null;
  }

  private extractServices(posts: FacebookPost[]): EnrichmentService[] {
    const services: EnrichmentService[] = [];
    const seen = new Set<string>();
    const priceRegex = /(\d{2,6})\s*(?:₴|грн|грн\.|USD|EUR|\$)/gi;

    for (const post of posts) {
      if (!post.message) continue;
      const lines = post.message.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length < 3 || trimmed.length > 120) continue;

        const priceMatch = trimmed.match(priceRegex);
        const name = trimmed.replace(priceRegex, '').replace(/[-–—:]/g, '').trim();

        if (name && !seen.has(name.toLowerCase())) {
          seen.add(name.toLowerCase());
          services.push({
            name,
            price: priceMatch ? priceMatch[0] : undefined,
            description: trimmed,
          });
        }
      }
    }

    return services;
  }

  private mapRatings(ratings: FacebookRating[]): EnrichmentReview[] {
    return ratings
      .filter((r) => r.review_text || r.reviewer?.name)
      .map((r) => ({
        author: r.reviewer?.name || 'Anonymous',
        text: r.review_text || '',
        rating: r.rating ?? undefined,
      }));
  }

  private mapHours(hours?: Record<string, string>): EnrichmentWorkingHours[] {
    if (!hours) return [];

    const dayMap: Record<string, string> = {
      mon: 'Monday',
      tue: 'Tuesday',
      wed: 'Wednesday',
      thu: 'Thursday',
      fri: 'Friday',
      sat: 'Saturday',
      sun: 'Sunday',
    };

    const result: EnrichmentWorkingHours[] = [];

    for (const [dayKey, label] of Object.entries(dayMap)) {
      const openKey = `${dayKey}_1_open`;
      const closeKey = `${dayKey}_1_close`;

      if (hours[openKey] && hours[closeKey]) {
        result.push({ day: label, open: hours[openKey], close: hours[closeKey] });
      }
    }

    return result;
  }
}
