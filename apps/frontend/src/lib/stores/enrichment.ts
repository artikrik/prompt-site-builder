import { writable } from 'svelte/store';
import { api } from '$lib/api/client';

// Note: This is a simplified view of the full EnrichmentData from @prompt-site-builder/shared.
// The shared type has required array fields and additional analysis fields.
export interface EnrichmentData {
  photos?: string[];
  logoUrl?: string;
  brandColors?: { primary?: string; secondary?: string; accent?: string; extractedFrom?: string };
  toneOfVoice?: { style?: string; formality?: string; emojiUsage?: string; keyPhrases?: string[]; languageMix?: string; sampleBio?: string };
  businessHours?: Record<string, string>;
  services?: Array<{ name: string; price?: string }>;
  reviews?: Array<{ author: string; rating?: number; text: string }>;
  competitors?: Array<{ name: string; distance?: string; rating?: number; website?: string; positioning?: string; uniqueSellingPoints?: string[]; websiteAnalysis?: Record<string, unknown> }>;
  salesOpportunities?: Array<{ gap?: string; currentState?: string; recommendation?: string; pitchAngle?: string; revenueImpact?: string; scriptExcerpt?: string }>;
  salesScript?: Record<string, unknown>;
  customerJourney?: { bookingChannels?: string[]; paymentMethods?: string[]; messagingApps?: string[] };
  stats?: Record<string, number>;
  sourceUrl?: string;
}

interface EnrichmentState {
  data: Record<string, EnrichmentData | null>;
  isLoading: boolean;
  error: string | null;
}

function createEnrichmentStore() {
  const { subscribe, update } = writable<EnrichmentState>({
    data: {},
    isLoading: false,
    error: null,
  });

  return {
    subscribe,

    async fetchForLead(leadId: string) {
      update((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const result = await api.get<{ data: EnrichmentData | null; enrichedAt: string | null; sources: string[] }>(
          `/leads/${leadId}/enrichment`,
        );
        update((s) => ({
          ...s,
          data: { ...s.data, [leadId]: result.data },
          isLoading: false,
        }));
        return result;
      } catch (error) {
        update((s) => ({
          ...s,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch enrichment',
        }));
        return null;
      }
    },

    async enrichLead(leadId: string) {
      update((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const result = await api.post<{ jobId: string }>(`/leads/${leadId}/enrich`);
        return result;
      } catch (error) {
        update((s) => ({
          ...s,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to start enrichment',
        }));
        return null;
      }
    },

    async updateSources(leadId: string, sources: string[]) {
      await api.put(`/leads/${leadId}/enrichment-sources`, { sources });
    },
  };
}

export const enrichment = createEnrichmentStore();
