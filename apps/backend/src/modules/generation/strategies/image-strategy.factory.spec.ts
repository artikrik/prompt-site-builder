import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ImageStrategyFactory } from './image-strategy.factory';
import { DallE3Strategy } from './dalle3.strategy';
import { ImagenStrategy } from './imagen.strategy';
import { FluxStrategy } from './flux.strategy';
import type { IImageGenerationStrategy } from './image-strategy.interface';

describe('ImageStrategyFactory', () => {
  let factory: ImageStrategyFactory;
  let mockDalle3: IImageGenerationStrategy;
  let mockImagen: IImageGenerationStrategy;
  let mockFlux: IImageGenerationStrategy;

  beforeEach(() => {
    mockDalle3 = { generateImage: vi.fn(), generateHeroImage: vi.fn(), generatePlaceholder: vi.fn() };
    mockImagen = { generateImage: vi.fn(), generateHeroImage: vi.fn(), generatePlaceholder: vi.fn() };
    mockFlux = { generateImage: vi.fn(), generateHeroImage: vi.fn(), generatePlaceholder: vi.fn() };

    factory = new ImageStrategyFactory(
      mockDalle3 as DallE3Strategy,
      mockImagen as ImagenStrategy,
      mockFlux as FluxStrategy,
    );
  });

  it('should return DallE3 as default when no provider specified', () => {
    const strategy = factory.create();
    expect(strategy).toBe(mockDalle3);
  });

  it('should return DallE3 for "openai" provider', () => {
    const strategy = factory.create('openai');
    expect(strategy).toBe(mockDalle3);
  });

  it('should return Imagen for "google" provider', () => {
    const strategy = factory.create('google');
    expect(strategy).toBe(mockImagen);
  });

  it('should return Flux for "bfl" provider', () => {
    const strategy = factory.create('bfl');
    expect(strategy).toBe(mockFlux);
  });

  it('should fallback to DallE3 for unknown provider', () => {
    const strategy = factory.create('unknown');
    expect(strategy).toBe(mockDalle3);
  });
});
