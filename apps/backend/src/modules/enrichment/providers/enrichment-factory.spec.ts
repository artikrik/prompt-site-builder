import { describe, it, expect, beforeEach } from 'vitest';
import { EnrichmentFactory } from './enrichment-factory';
import { InstagramProvider } from '../../scraping/providers/instagram.provider';
import { FacebookProvider } from './facebook.provider';
import { GoogleMapsProvider } from './google-maps.provider';

describe('EnrichmentFactory', () => {
  let factory: EnrichmentFactory;
  let instagramProvider: InstagramProvider;
  let facebookProvider: FacebookProvider;
  let googleMapsProvider: GoogleMapsProvider;

  beforeEach(() => {
    instagramProvider = new InstagramProvider();
    facebookProvider = new FacebookProvider();
    googleMapsProvider = new GoogleMapsProvider();
    factory = new EnrichmentFactory(instagramProvider, facebookProvider, googleMapsProvider);
  });

  describe('createForProvider', () => {
    it("createForProvider('facebook') returns FacebookProvider", () => {
      const result = factory.createForProvider('facebook');
      expect(result).toBe(facebookProvider);
    });

    it("createForProvider('googleMaps') returns GoogleMapsProvider", () => {
      const result = factory.createForProvider('googleMaps');
      expect(result).toBe(googleMapsProvider);
    });

    it("createForProvider('instagram') returns wrapped provider with source='instagram'", () => {
      const result = factory.createForProvider('instagram');
      expect(result).not.toBeNull();
      expect(result!.source).toBe('instagram');
      expect(typeof result!.enrich).toBe('function');
    });

    it("createForProvider('unknown') returns null", () => {
      const result = factory.createForProvider('unknown' as any);
      expect(result).toBeNull();
    });
  });
});
