import { ProjectStatus } from '../enums';

export interface Project {
  id: string;
  leadId: string;
  slug: string;
  status: ProjectStatus;
  hugoConfig: HugoConfig;
  generatedAt: Date | null;
  publishedAt: Date | null;
  publishedUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface HugoConfig {
  title: string;
  description: string;
  theme: string;
  languageCode: string;
  baseUrl: string;
  params: Record<string, unknown>;
}

export interface CreateProjectDto {
  leadId: string;
  hugoConfig?: Partial<HugoConfig>;
}

export interface UpdateProjectDto {
  status?: ProjectStatus;
  hugoConfig?: Partial<HugoConfig>;
}

export interface SiteGenerationRequest {
  projectId: string;
  leadId: string;
  businessName: string;
  slug: string;
  category: string | null;
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  socialUrl: string | null;
  theme?: string;
}

export interface GeneratedSiteStructure {
  config: string;
  content: Array<{ path: string; body: string }>;
  layouts: Array<{ path: string; body: string }>;
  static: Array<{ path: string; body: string }>;
  assets: Array<{ path: string; data: Buffer }>;
}
