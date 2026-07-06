import { Injectable } from '@nestjs/common';
import { IEnrichmentProvider, EnrichmentSource } from './types';
import { InstagramProvider } from '../../scraping/providers/instagram.provider';
import { FacebookProvider } from './facebook.provider';
import { GoogleMapsProvider } from './google-maps.provider';

@Injectable()
export class EnrichmentFactory {
  constructor(
    private readonly instagramProvider: InstagramProvider,
    private readonly facebookProvider: FacebookProvider,
    private readonly googleMapsProvider: GoogleMapsProvider,
  ) {}

  createForProvider(source: EnrichmentSource): IEnrichmentProvider | null {
    switch (source) {
      case 'instagram':
        return this.wrapInstagramProvider();
      case 'facebook':
        return this.facebookProvider;
      case 'googleMaps':
        return this.googleMapsProvider;
      default:
        return null;
    }
  }

  private wrapInstagramProvider(): IEnrichmentProvider {
    return {
      source: 'instagram',
      enrich: async (businessName: string, _city?: string, url?: string) => {
        const username = url
          ? this.instagramProvider.extractUsernameFromUrl(url)
          : businessName;
        if (!username) {
          return {};
        }

        const result = await this.instagramProvider.enrichFull(username);
        if (!result) return {};

        return {
          services: result.services,
          photos: result.photos,
          videos: result.videos,
          logoUrl: result.logoUrl ?? undefined,
          toneOfVoice: result.toneOfVoice ?? undefined,
          customerJourney: result.customerJourney,
          stats: {
            instagramPosts: result.postsCount ?? undefined,
            instagramFollowers: result.followers ?? undefined,
          },
          sourceUrls: {
            instagram: result.sourceUrl,
          },
        };
      },
    };
  }
}
