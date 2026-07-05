import { Injectable } from '@nestjs/common';
import { DallE3Strategy } from './dalle3.strategy';
import { ImagenStrategy } from './imagen.strategy';
import { FluxStrategy } from './flux.strategy';
import type { IImageGenerationStrategy } from './image-strategy.interface';

@Injectable()
export class ImageStrategyFactory {
  constructor(
    private readonly dalle3: DallE3Strategy,
    private readonly imagen: ImagenStrategy,
    private readonly flux: FluxStrategy,
  ) {}

  create(provider?: string): IImageGenerationStrategy {
    const map: Record<string, IImageGenerationStrategy> = {
      openai: this.dalle3,
      google: this.imagen,
      bfl: this.flux,
    };
    return map[provider || 'openai'] || this.dalle3;
  }
}
