import { Injectable, Logger } from '@nestjs/common';

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
