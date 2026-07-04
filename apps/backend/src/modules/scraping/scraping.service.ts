import { Injectable, Logger } from '@nestjs/common';
import { ApifyProvider } from './providers/apify.provider';
import { InstagramProvider } from './providers/instagram.provider';
import { LeadsService } from '../leads/leads.service';
import { CreateLeadDto } from '@prompt-site-builder/shared';

@Injectable()
export class ScrapingService {
  private readonly logger = new Logger(ScrapingService.name);

  constructor(
    private readonly apifyProvider: ApifyProvider,
    private readonly instagramProvider: InstagramProvider,
    private readonly leadsService: LeadsService,
  ) {}

  async scrapeAndCreateLeads(params: {
    city: string;
    category: string;
    limit?: number;
  }): Promise<{ scraped: number; created: number; skipped: number }> {
    this.logger.log(`Starting scrape for "${params.category}" in "${params.city}"`);

    const businesses = await this.apifyProvider.scrapeGoogleMaps({
      city: params.city,
      category: params.category,
      limit: params.limit || 20,
    });

    const noWebsite = businesses.filter((b) => !b.website);
    this.logger.log(`Found ${businesses.length} businesses, ${noWebsite.length} without website`);

    let created = 0;
    let skipped = 0;

    for (const business of noWebsite) {
      try {
        const dto: CreateLeadDto = {
          businessName: business.businessName,
          phone: business.phone || undefined,
          address: business.address || undefined,
          city: business.city || params.city,
          category: business.category || params.category,
          source: 'google-maps',
          scrapedData: {
            placeId: business.placeId,
            rating: business.rating,
            reviewCount: business.reviewCount,
          },
        };

        await this.leadsService.create(dto);
        created++;
      } catch (error) {
        this.logger.warn(`Skipped "${business.businessName}": ${error}`);
        skipped++;
      }
    }

    this.logger.log(`Scraping complete: ${created} leads created, ${skipped} skipped`);
    return { scraped: businesses.length, created, skipped };
  }

  async enrichLeadWithInstagram(leadId: string): Promise<boolean> {
    const lead = await this.leadsService.findOne(leadId);
    const socialUrl = (lead as any).socialUrl;

    if (!socialUrl || !socialUrl.includes('instagram.com')) {
      this.logger.warn(`Lead ${leadId} has no Instagram URL`);
      return false;
    }

    const username = this.instagramProvider.extractUsernameFromUrl(socialUrl);
    if (!username) {
      this.logger.warn(`Could not extract username from ${socialUrl}`);
      return false;
    }

    const profile = await this.instagramProvider.enrichFromProfile(username);
    if (!profile) {
      return false;
    }

    await this.leadsService.update(leadId, {
      scrapedData: {
        ...(lead as any).scrapedData,
        instagram: {
          username: profile.username,
          fullName: profile.fullName,
          bio: profile.bio,
          followers: profile.followers,
          postsCount: profile.postsCount,
          isVerified: profile.isVerified,
          recentPosts: profile.recentPosts,
        },
      },
    });

    this.logger.log(`Lead ${leadId} enriched with Instagram data`);
    return true;
  }
}
