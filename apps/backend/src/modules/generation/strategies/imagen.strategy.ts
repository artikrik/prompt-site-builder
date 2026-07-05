import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { SettingsService } from '../../settings/settings.service';
import {
  IImageGenerationStrategy,
  ImageGenerationOptions,
  ImageGenerationResponse,
} from './image-strategy.interface';

@Injectable()
export class ImagenStrategy implements IImageGenerationStrategy {
  private readonly logger = new Logger(ImagenStrategy.name);

  constructor(private readonly settingsService: SettingsService) {}

  private async getClient(): Promise<OpenAI> {
    const apiKey = await this.settingsService.getApiKey('google');
    if (!apiKey) throw new Error('Google API key not configured');
    return new OpenAI({
      apiKey,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    });
  }

  private async getModel(): Promise<string> {
    return this.settingsService.getEffectiveModel('google', 'image');
  }

  async generateImage(
    prompt: string,
    options?: ImageGenerationOptions,
  ): Promise<ImageGenerationResponse> {
    const client = await this.getClient();
    const model = options?.model || (await this.getModel());

    const response = await client.images.generate({
      model,
      prompt,
      n: 1,
      size: ((options?.size as '1024x1024') || '1024x1024'),
    });

    const data = response.data as
      | { url: string; revised_prompt?: string }[]
      | undefined;
    const image = data?.[0];
    if (!image) {
      throw new Error('Imagen returned no image data');
    }

    return {
      url: image.url || '',
      revisedPrompt: image.revised_prompt || prompt,
    };
  }

  async generateHeroImage(
    businessName: string,
    category: string | null,
  ): Promise<ImageGenerationResponse> {
    const prompt = `Professional hero background image for ${businessName}, a ${category || 'business'} company.
    Modern, clean, corporate design with subtle gradients.
    No text or logos in the image.
    High quality, professional photography style,
    wide landscape composition suitable for a website hero section.`;

    return this.generateImage(prompt, {
      size: '1792x1024',
      quality: 'hd',
      style: 'natural',
    });
  }

  async generatePlaceholder(category: string): Promise<ImageGenerationResponse> {
    const prompt = `Professional stock photo style image representing ${category} industry.
    Clean, modern, corporate aesthetic. No text or logos.`;

    return this.generateImage(prompt, {
      size: '1024x1024',
      quality: 'standard',
      style: 'natural',
    });
  }
}
