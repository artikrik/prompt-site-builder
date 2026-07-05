import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';
import {
  IImageGenerationStrategy,
  ImageGenerationOptions,
  ImageGenerationResponse,
} from './image-strategy.interface';

@Injectable()
export class FluxStrategy implements IImageGenerationStrategy {
  private readonly logger = new Logger(FluxStrategy.name);
  private readonly baseUrl = 'https://fal.run';

  constructor(private readonly settingsService: SettingsService) {}

  private async getApiKey(): Promise<string> {
    const apiKey = await this.settingsService.getApiKey('bfl');
    if (!apiKey) throw new Error('BFL API key not configured');
    return apiKey;
  }

  async generateImage(
    prompt: string,
    options?: ImageGenerationOptions,
  ): Promise<ImageGenerationResponse> {
    const apiKey = await this.getApiKey();

    const response = await fetch(`${this.baseUrl}/fal-ai/flux-pro`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        image_size: options?.size || 'landscape_4_3',
        num_images: 1,
      }),
    });

    if (!response.ok) {
      throw new Error(`Flux API error: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      images?: { url?: string }[];
    };

    return {
      url: data.images?.[0]?.url || '',
      revisedPrompt: prompt,
    };
  }

  async generateHeroImage(
    businessName: string,
    category: string | null,
  ): Promise<ImageGenerationResponse> {
    const prompt = `Professional hero banner image for ${businessName}${category ? `, a ${category} business` : ''}. Modern, photorealistic, high-quality.`;
    return this.generateImage(prompt);
  }

  async generatePlaceholder(category: string): Promise<ImageGenerationResponse> {
    return this.generateImage(
      `Generic placeholder image for ${category} category, clean, simple`,
    );
  }
}
