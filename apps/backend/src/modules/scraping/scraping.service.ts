import { Injectable, Logger } from '@nestjs/common';
import { ApifyProvider } from './providers/apify.provider';
import { InstagramProvider } from './providers/instagram.provider';
import { GoogleMapsScraperProvider } from './providers/google-maps-scraper.provider';
import { LeadsService } from '../leads/leads.service';
import { CreateLeadDto } from '@prompt-site-builder/shared';

@Injectable()
export class ScrapingService {
  private readonly logger = new Logger(ScrapingService.name);

  constructor(
    private readonly apifyProvider: ApifyProvider,
    private readonly instagramProvider: InstagramProvider,
    private readonly googleMapsScraper: GoogleMapsScraperProvider,
    private readonly leadsService: LeadsService,
  ) {}

  async scrapeAndCreateLeads(params: {
    city: string;
    category: string;
    limit?: number;
  }): Promise<{ scraped: number; created: number; skipped: number }> {
    this.logger.log(`Starting scrape for "${params.category}" in "${params.city}"`);

    // Try Google Maps Scraper first (direct API), fall back to Apify
    let businesses = await this.googleMapsScraper.scrapeBusinesses({
      city: params.city,
      category: params.category,
      limit: params.limit || 20,
    });

    if (businesses.length === 0) {
      this.logger.log('Google Maps scraper returned no results, trying Apify');
      businesses = await this.apifyProvider.scrapeGoogleMaps({
        city: params.city,
        category: params.category,
        limit: params.limit || 20,
      });
    }

    // Filter businesses without websites (potential leads)
    const noWebsite = businesses.filter((b) => !b.website);
    this.logger.log(`Found ${businesses.length} businesses, ${noWebsite.length} without website`);

    let created = 0;
    let skipped = 0;

    for (const business of noWebsite) {
      try {
        // Dedup: check if lead with same businessName + city already exists
        const existingLeads = await this.leadsService.findAll({
          search: business.businessName,
          city: business.city || params.city,
        });
        const isDuplicate = existingLeads.some(
          (l) => l.businessName.toLowerCase() === business.businessName.toLowerCase() &&
                 l.city?.toLowerCase() === (business.city || params.city).toLowerCase(),
        );

        if (isDuplicate) {
          this.logger.log(`Skipping duplicate: "${business.businessName}" in ${business.city || params.city}`);
          skipped++;
          continue;
        }

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
        ...((lead as any).scrapedData as Record<string, unknown>),
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

  async scrapeLead(leadId: string, platforms: string[]): Promise<void> {
    const lead = await this.leadsService.findOne(leadId);
    this.logger.log(`Scraping lead ${leadId} (${lead.businessName}) for platforms: ${platforms.join(', ')}`);

    const scrapedData: Record<string, unknown> = {
      ...((lead as any).scrapedData as Record<string, unknown> || {}),
    };

    for (const platform of platforms) {
      try {
        switch (platform) {
          case 'googleMaps': {
            // Scrape Google Maps for this specific business
            const results = await this.googleMapsScraper.scrapeBusinesses({
              city: lead.city || '',
              category: lead.category || lead.businessName,
              limit: 5,
            });
            // Find the best match by business name similarity
            const match = results.find((r) =>
              r.businessName.toLowerCase().includes(lead.businessName.toLowerCase()) ||
              lead.businessName.toLowerCase().includes(r.businessName.toLowerCase()),
            );
            if (match) {
              scrapedData.googleMaps = {
                placeId: match.placeId,
                rating: match.rating,
                reviewCount: match.reviewCount,
                address: match.address,
                phone: match.phone,
                website: match.website,
              };
              this.logger.log(`Scraped Google Maps data for lead ${leadId}`);
            } else {
              this.logger.warn(`No Google Maps match found for "${lead.businessName}"`);
            }
            break;
          }
          case 'instagram': {
            // Scrape Instagram profile
            const socialUrl = lead.socialUrls?.find((url) => url.includes('instagram.com'));
            if (socialUrl) {
              const username = this.instagramProvider.extractUsernameFromUrl(socialUrl);
              if (username) {
                const profile = await this.instagramProvider.enrichFromProfile(username);
                if (profile) {
                  scrapedData.instagram = {
                    username: profile.username,
                    fullName: profile.fullName,
                    bio: profile.bio,
                    followers: profile.followers,
                    postsCount: profile.postsCount,
                    isVerified: profile.isVerified,
                    recentPosts: profile.recentPosts,
                    profilePicUrl: profile.profilePicUrl,
                  };
                  this.logger.log(`Scraped Instagram data for lead ${leadId}`);
                }
              }
            } else {
              this.logger.warn(`Lead ${leadId} has no Instagram URL`);
            }
            break;
          }
          default:
            this.logger.warn(`Unknown scraping platform: ${platform}`);
        }
      } catch (error) {
        this.logger.error(`Failed to scrape ${platform} for lead ${leadId}: ${error}`);
      }
    }

    // Update lead with scraped data
    await this.leadsService.update(leadId, { scrapedData });
    this.logger.log(`Scraping complete for lead ${leadId}`);
  }
}
