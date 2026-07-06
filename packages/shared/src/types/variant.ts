import { VariantStatus } from '../enums';

export interface SiteVariant {
  id: string;
  projectId: string;
  variantName: string;
  status: VariantStatus;
  hugoConfig: any;
  content: any;
  modelUsed?: string;
  imageModel?: string;
  themeName?: string;
  previewUrl?: string;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVariantDto {
  model?: string;
  imageModel?: string;
  theme?: string;
}

export interface VariantListItem {
  id: string;
  variantName: string;
  status: VariantStatus;
  modelUsed?: string;
  imageModel?: string;
  themeName?: string;
  createdAt: Date;
}
