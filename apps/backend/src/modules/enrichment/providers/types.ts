import { EnrichmentData } from '@prompt-site-builder/shared';

export type EnrichmentSource = 'instagram' | 'facebook' | 'googleMaps';

export interface IEnrichmentProvider {
  readonly source: EnrichmentSource;
  enrich(businessName: string, city?: string, url?: string): Promise<Partial<EnrichmentData>>;
}
