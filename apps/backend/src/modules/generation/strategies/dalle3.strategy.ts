import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { IImageGenerationStrategy, ImageGenerationOptions, ImageGenerationResponse } from './image-strategy.interface';

@Injectable()
export class DallE3Strategy implements IImageGenerationStrategy {
  private client: OpenAI;

  constructor(private readonly configService: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async generateImage(prompt: string, options?: ImageGenerationOptions): Promise<ImageGenerationResponse> {
    const response = await this.client.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: options?.size || '1792x1024',
      quality: options?.quality || 'hd',
      style: options?.style || 'natural',
      response_format: 'url',
    });

    const image = response.data[0];

    return {
      url: image.url || '',
      revisedPrompt: image.revised_prompt || prompt,
    };
  }

  async generateHeroImage(businessName: string, category: string | null): Promise<ImageGenerationResponse> {
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
