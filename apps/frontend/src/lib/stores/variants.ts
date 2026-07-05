import { writable } from 'svelte/store';
import { api } from '$lib/api/client';

export interface VariantListItem {
  id: string;
  variantName: string;
  status: string;
  modelUsed?: string;
  imageModel?: string;
  themeName?: string;
  createdAt: string;
}

export interface SiteVariant {
  id: string;
  projectId: string;
  variantName: string;
  status: string;
  hugoConfig: any;
  content: any;
  modelUsed?: string;
  imageModel?: string;
  themeName?: string;
  previewUrl?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface VariantsState {
  variantsByProject: Record<string, VariantListItem[]>;
  currentVariant: SiteVariant | null;
  isLoading: boolean;
  error: string | null;
}

function createVariantsStore() {
  const { subscribe, update } = writable<VariantsState>({
    variantsByProject: {},
    currentVariant: null,
    isLoading: false,
    error: null,
  });

  return {
    subscribe,

    async fetchForProject(projectId: string) {
      update((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const variants = await api.get<VariantListItem[]>(`/projects/${projectId}/variants`);
        update((s) => ({
          ...s,
          variantsByProject: { ...s.variantsByProject, [projectId]: variants },
          isLoading: false,
        }));
        return variants;
      } catch (error) {
        update((s) => ({
          ...s,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch variants',
        }));
        return [];
      }
    },

    async create(projectId: string, data: { model?: string; imageModel?: string; theme?: string }) {
      const variant = await api.post<SiteVariant>(`/projects/${projectId}/variants`, data);
      update((s) => {
        const existing = s.variantsByProject[projectId] || [];
        return {
          ...s,
          variantsByProject: {
            ...s.variantsByProject,
            [projectId]: [variant, ...existing],
          },
        };
      });
      return variant;
    },

    async fetchById(variantId: string) {
      update((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const variant = await api.get<SiteVariant & { project: any; assets: any[] }>(`/variants/${variantId}`);
        update((s) => ({ ...s, currentVariant: variant, isLoading: false }));
        return variant;
      } catch (error) {
        update((s) => ({
          ...s,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch variant',
        }));
        return null;
      }
    },

    async activate(variantId: string) {
      await api.put(`/variants/${variantId}/activate`, {});
    },

    async remove(variantId: string, projectId: string) {
      await api.delete(`/variants/${variantId}`);
      update((s) => {
        const existing = s.variantsByProject[projectId] || [];
        return {
          ...s,
          variantsByProject: {
            ...s.variantsByProject,
            [projectId]: existing.filter((v) => v.id !== variantId),
          },
        };
      });
    },
  };
}

export const variants = createVariantsStore();
