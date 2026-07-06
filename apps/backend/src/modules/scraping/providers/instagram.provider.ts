import { Injectable, Logger } from '@nestjs/common';

export interface InstagramEnrichment {
  services: Array<{ name: string; price?: string; description?: string }>;
  photos: string[];
  videos: string[];
  logoUrl: string | null;
  bio: string | null;
  category: string | null;
  followers: number | null;
  postsCount: number | null;
  recentPostTexts: string[];
  toneOfVoice: {
    style: string;
    formality: string;
    keyPhrases: string[];
    languageMix: string;
    emojiUsage: string;
    sampleBio: string;
  } | null;
  customerJourney: {
    bookingChannels: string[];
    paymentMethods: string[];
    messagingApps: string[];
  };
  sourceUrl: string;
}

export interface InstagramProfile {
  username: string;
  fullName: string | null;
  bio: string | null;
  followers: number | null;
  following: number | null;
  postsCount: number | null;
  isVerified: boolean;
  profilePicUrl: string | null;
  recentPosts: Array<{
    caption: string | null;
    likes: number | null;
    timestamp: string | null;
  }>;
}

@Injectable()
export class InstagramProvider {
  private readonly logger = new Logger(InstagramProvider.name);

  async enrichFromProfile(username: string): Promise<InstagramProfile | null> {
    this.logger.log(`Fetching Instagram profile: ${username}`);

    try {
      const response = await fetch(
        `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'X-IG-App-ID': '936619743392459',
          },
        },
      );

      if (!response.ok) {
        this.logger.warn(`Instagram API returned ${response.status} for ${username}`);
        return null;
      }

      const data = await response.json();
      return this.parseProfile(data);
    } catch (error) {
      this.logger.warn(`Instagram enrichment failed for ${username}: ${error}`);
      return null;
    }
  }

  extractUsernameFromUrl(url: string): string | null {
    const match = url.match(/instagram\.com\/([^/?]+)/);
    return match ? match[1] : null;
  }

  async enrichFull(username: string): Promise<InstagramEnrichment | null> {
    const profile = await this.enrichFromProfile(username);
    if (!profile) return null;

    const allText = [
      profile.bio || '',
      ...profile.recentPosts.map((p) => p.caption || ''),
    ].join('\n');

    const services = this.extractServices(allText);
    const photos = this.collectPhotos(profile);
    const customerJourney = this.detectCustomerJourney(allText);
    const toneOfVoice = this.analyzeTone(allText, profile.bio || '');

    return {
      services,
      photos,
      videos: [],
      logoUrl: profile.profilePicUrl,
      bio: profile.bio,
      category: null,
      followers: profile.followers,
      postsCount: profile.postsCount,
      recentPostTexts: profile.recentPosts.map((p) => p.caption || '').filter(Boolean),
      toneOfVoice,
      customerJourney,
      sourceUrl: `https://www.instagram.com/${username}/`,
    };
  }

  private extractServices(
    text: string,
  ): Array<{ name: string; price?: string; description?: string }> {
    const priceRegex = /(\d{2,5})\s*(?:₴|грн|грн\.|USD|EUR|\$)/gi;
    const lines = text.split(/\n|(?<=[.!?])\s+/);
    const result: Array<{ name: string; price?: string; description?: string }> = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const priceMatch = trimmed.match(priceRegex);
      if (priceMatch) {
        const cleaned = trimmed.replace(priceRegex, '').replace(/[-–—:]/g, '').trim();
        result.push({
          name: cleaned || trimmed,
          price: priceMatch[0],
          description: trimmed,
        });
      } else if (trimmed.length > 3 && trimmed.length < 120) {
        if (!result.some((s) => s.name === trimmed)) {
          result.push({ name: trimmed, description: trimmed });
        }
      }
    }

    return result;
  }

  private collectPhotos(profile: InstagramProfile): string[] {
    const photos: string[] = [];
    if (profile.profilePicUrl) {
      photos.push(profile.profilePicUrl);
    }
    return photos;
  }

  private detectCustomerJourney(text: string): {
    bookingChannels: string[];
    paymentMethods: string[];
    messagingApps: string[];
  } {
    const lower = text.toLowerCase();

    const bookingKeywords: Array<{ pattern: RegExp; label: string }> = [
      { pattern: /запис/ui, label: 'запис' },
      { pattern: /direct/ui, label: 'Direct' },
      { pattern: /\bdm\b/ui, label: 'DM' },
      { pattern: /дзвін|дзвон|телефон/ui, label: 'дзвінок' },
      { pattern: /бронювання/ui, label: 'бронювання' },
    ];

    const paymentKeywords: Array<{ pattern: RegExp; label: string }> = [
      { pattern: /оплат/ui, label: 'оплата' },
      { pattern: /карт/ui, label: 'картка' },
      { pattern: /переказ/ui, label: 'переказ' },
      { pattern: /готівк/ui, label: 'готівка' },
    ];

    const messagingKeywords: Array<{ pattern: RegExp; label: string }> = [
      { pattern: /viber|вайбер/ui, label: 'Viber' },
      { pattern: /telegram|телеграм/ui, label: 'Telegram' },
      { pattern: /whatsapp|ватсап/ui, label: 'WhatsApp' },
    ];

    const bookingChannels = bookingKeywords
      .filter((kw) => kw.pattern.test(lower))
      .map((kw) => kw.label);

    const paymentMethods = paymentKeywords
      .filter((kw) => kw.pattern.test(lower))
      .map((kw) => kw.label);

    const messagingApps = messagingKeywords
      .filter((kw) => kw.pattern.test(lower))
      .map((kw) => kw.label);

    return { bookingChannels, paymentMethods, messagingApps };
  }

  private analyzeTone(
    text: string,
    bio: string,
  ): {
    style: string;
    formality: string;
    keyPhrases: string[];
    languageMix: string;
    emojiUsage: string;
    sampleBio: string;
  } | null {
    if (!text.trim()) return null;

    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    const emojiMatches = text.match(emojiRegex) || [];

    let emojiUsage: string;
    if (emojiMatches.length === 0) emojiUsage = 'none';
    else if (emojiMatches.length <= 3) emojiUsage = 'sparse';
    else if (emojiMatches.length <= 10) emojiUsage = 'moderate';
    else emojiUsage = 'heavy';

    const hasVy = /(?<![а-яіїєґ])(ви|Ви|ВИ)(?![а-яіїєґ])/u.test(text);
    const hasTy = /(?<![а-яіїєґ])(ти|Ти|ТИ)(?![а-яіїєґ])/u.test(text);
    let formality: string;
    if (hasVy && !hasTy) formality = 'formal (Ви)';
    else if (hasTy && !hasVy) formality = 'informal (ти)';
    else if (hasVy && hasTy) formality = 'mixed';
    else formality = 'neutral';

    const exclamationCount = (text.match(/!/g) || []).length;
    let style: string;
    if (emojiMatches.length > 5 && exclamationCount > 3) style = 'energetic';
    else if (emojiMatches.length > 0) style = 'friendly';
    else if (text.length < 200) style = 'concise';
    else style = 'descriptive';

    // Extract key phrases (hashtags + common patterns)
    const hashtags = (text.match(/#([\wЀ-ӿ]+)/g) || []).map((t: string) => t.replace('#', ''));
    const keyPhrases = [...new Set(hashtags)].slice(0, 6);

    // Detect language mix
    const hasUkrainian = /[іїєґ]/iu.test(text);
    const hasEnglish = /\b[a-z]{3,}\b/gi.test(text);
    let languageMix: string;
    if (hasUkrainian && hasEnglish) languageMix = 'ukrainian + english';
    else if (hasUkrainian) languageMix = 'ukrainian';
    else if (hasEnglish) languageMix = 'english';
    else languageMix = 'ukrainian';

    return {
      style,
      formality,
      keyPhrases,
      languageMix,
      emojiUsage,
      sampleBio: bio.slice(0, 200),
    };
  }

  private parseProfile(data: any): InstagramProfile | null {
    const user = data?.data?.user;
    if (!user) return null;

    return {
      username: user.username,
      fullName: user.full_name || null,
      bio: user.biography || null,
      followers: user.edge_followed_by?.count || null,
      following: user.edge_follow?.count || null,
      postsCount: user.edge_owner_to_timeline_media?.count || null,
      isVerified: user.is_verified || false,
      profilePicUrl: user.profile_pic_url_hd || user.profile_pic_url || null,
      recentPosts: (user.edge_owner_to_timeline_media?.edges || []).slice(0, 5).map((edge: any) => ({
        caption: edge.node?.edge_media_to_caption?.edges?.[0]?.node?.text || null,
        likes: edge.node?.edge_liked_by?.count || null,
        timestamp: edge.node?.taken_at_timestamp
          ? new Date(edge.node.taken_at_timestamp * 1000).toISOString()
          : null,
      })),
    };
  }
}
