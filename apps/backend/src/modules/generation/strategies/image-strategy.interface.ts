export interface ImageGenerationOptions {
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural';
}

export interface ImageGenerationResponse {
  url: string;
  revisedPrompt: string;
}

export interface IImageGenerationStrategy {
  generateImage(prompt: string, options?: ImageGenerationOptions): Promise<ImageGenerationResponse>;
  generateHeroImage(businessName: string, category: string | null): Promise<ImageGenerationResponse>;
  generatePlaceholder(category: string): Promise<ImageGenerationResponse>;
}
