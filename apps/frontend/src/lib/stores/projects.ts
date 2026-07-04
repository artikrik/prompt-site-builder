import { writable } from 'svelte/store';
import { api } from '$lib/api/client';

export interface Project {
  id: string;
  leadId: string;
  slug: string;
  status: string;
  hugoConfig: Record<string, unknown>;
  publishedUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
  lead?: {
    id: string;
    businessName: string;
    category: string | null;
  };
}

interface ProjectsState {
  projects: Project[];
  isLoading: boolean;
  error: string | null;
}

function createProjectsStore() {
  const { subscribe, update } = writable<ProjectsState>({
    projects: [],
    isLoading: false,
    error: null,
  });

  return {
    subscribe,
    async fetchAll() {
      update((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const projects = await api.get<Project[]>('/projects');
        update((s) => ({ ...s, projects, isLoading: false }));
      } catch (error) {
        update((s) => ({ ...s, isLoading: false, error: error instanceof Error ? error.message : 'Failed to fetch projects' }));
      }
    },
    async fetchOne(id: string) {
      const project = await api.get<Project>(`/projects/${id}`);
      return project;
    },
    async create(leadId: string) {
      const project = await api.post<Project>('/projects', { leadId });
      update((s) => ({ ...s, projects: [project, ...s.projects] }));
      return project;
    },
    async generate(projectId: string, theme?: string) {
      await api.post(`/generation/${projectId}/generate`, { theme: theme || 'auto' });
      update((s) => ({
        ...s,
        projects: s.projects.map((p) =>
          p.id === projectId ? { ...p, status: 'GENERATING' } : p
        ),
      }));
    },
    async remove(id: string) {
      await api.delete(`/projects/${id}`);
      update((s) => ({ ...s, projects: s.projects.filter((p) => p.id !== id) }));
    },
  };
}

export const projects = createProjectsStore();
