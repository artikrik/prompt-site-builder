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
      enrich: async (businessName: string, _city?: string) => {
        const result = await this.instagramProvider.enrichFromProfile(businessName);
        if (!result) return {};

        return {
          photos: result.profilePicUrl ? [result.profilePicUrl] : [],
          logoUrl: result.profilePicUrl ?? undefined,
          stats: {
            instagramPosts: result.postsCount ?? undefined,
            instagramFollowers: result.followers ?? undefined,
          },
          sourceUrls: {
            instagram: `https://instagram.com/${businessName}`,
          },
        };
      },
    };
  }
}
