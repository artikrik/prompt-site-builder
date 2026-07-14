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
    this.logger.log(`Starting scrape for "${params.category}" in "${params.city}" (limit: ${params.limit || 20})`);

    // Try Google Maps Scraper first (direct API), fall back to Apify
    this.logger.log('Attempting Google Maps scraper...');
    let businesses = await this.googleMapsScraper.scrapeBusinesses({
      city: params.city,
      category: params.category,
      limit: params.limit || 20,
    });
    this.logger.log(`Google Maps scraper returned ${businesses.length} businesses`);

    if (businesses.length === 0) {
      this.logger.log('Google Maps scraper returned no results, trying Apify...');
      businesses = await this.apifyProvider.scrapeGoogleMaps({
        city: params.city,
        category: params.category,
        limit: params.limit || 20,
      });
      this.logger.log(`Apify returned ${businesses.length} businesses`);
    }

    // Filter businesses without websites (potential leads)
    const noWebsite = businesses.filter((b) => !b.website);
    this.logger.log(`Found ${businesses.length} total businesses, ${noWebsite.length} without website (potential leads)`);

    let created = 0;
    let skipped = 0;

    for (const business of noWebsite) {
      try {
        this.logger.log(`Processing: "${business.businessName}" (${business.phone || 'no phone'}, ${business.city || params.city})`);

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

        const lead = await this.leadsService.create(dto);
        this.logger.log(`Created lead: "${business.businessName}" (ID: ${lead.id})`);
        created++;
      } catch (error) {
        this.logger.warn(`Skipped "${business.businessName}": ${error}`);
        skipped++;
      }
    }

    this.logger.log(`Scraping complete: ${businesses.length} found, ${created} leads created, ${skipped} skipped`);
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
    this.logger.log(`Scraping lead ${leadId} ("${lead.businessName}") for platforms: ${platforms.join(', ')}`);
    this.logger.log(`Lead details: city=${lead.city || 'none'}, category=${lead.category || 'none'}, socialUrls=${lead.socialUrls?.length || 0}`);

    const scrapedData: Record<string, unknown> = {
      ...((lead as any).scrapedData as Record<string, unknown> || {}),
    };

    for (const platform of platforms) {
      this.logger.log(`Starting ${platform} scraping for lead ${leadId}...`);
      const startTime = Date.now();

      try {
        switch (platform) {
          case 'googleMaps': {
            // Scrape Google Maps for this specific business
            this.logger.log(`Querying Google Maps for "${lead.businessName}" in "${lead.city || 'unknown'}"...`);
            const results = await this.googleMapsScraper.scrapeBusinesses({
              city: lead.city || '',
              category: lead.category || lead.businessName,
              limit: 5,
            });
            this.logger.log(`Google Maps returned ${results.length} results`);

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
              this.logger.log(`Scraped Google Maps data for lead ${leadId}: rating=${match.rating}, reviews=${match.reviewCount}`);
            } else {
              this.logger.warn(`No Google Maps match found for "${lead.businessName}" in ${results.length} results`);
            }
            break;
          }
          case 'instagram': {
            // Scrape Instagram profile
            const socialUrl = lead.socialUrls?.find((url) => url.includes('instagram.com'));
            if (socialUrl) {
              this.logger.log(`Extracting Instagram username from: ${socialUrl}`);
              const username = this.instagramProvider.extractUsernameFromUrl(socialUrl);
              if (username) {
                this.logger.log(`Fetching Instagram profile for @${username}...`);
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
                  this.logger.log(`Scraped Instagram data for lead ${leadId}: @${profile.username}, ${profile.followers} followers, ${profile.postsCount} posts`);
                } else {
                  this.logger.warn(`Instagram profile not found for @${username}`);
                }
              } else {
                this.logger.warn(`Could not extract Instagram username from URL: ${socialUrl}`);
              }
            } else {
              this.logger.warn(`Lead ${leadId} has no Instagram URL in socialUrls: [${lead.socialUrls?.join(', ') || 'none'}]`);
            }
            break;
          }
          default:
            this.logger.warn(`Unknown scraping platform: ${platform}`);
        }
      } catch (error) {
        this.logger.error(`Failed to scrape ${platform} for lead ${leadId}: ${error}`);
      }

      const duration = Date.now() - startTime;
      this.logger.log(`${platform} scraping completed for lead ${leadId} in ${duration}ms`);
    }

    // Update lead with scraped data
    this.logger.log(`Updating lead ${leadId} with scraped data...`);
    await this.leadsService.update(leadId, { scrapedData });
    this.logger.log(`Scraping complete for lead ${leadId}. Data keys: ${Object.keys(scrapedData).join(', ')}`);
  }
}
