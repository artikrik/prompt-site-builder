// Using const objects (matching Prisma's generated enum pattern) for compatibility
// between Prisma client types and shared API types.

export const LeadStatus = {
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  QUALIFIED: 'QUALIFIED',
  CONVERTED: 'CONVERTED',
  REJECTED: 'REJECTED',
} as const;
export type LeadStatus = (typeof LeadStatus)[keyof typeof LeadStatus];

export const ProjectStatus = {
  DRAFT: 'DRAFT',
  GENERATING: 'GENERATING',
  GENERATED: 'GENERATED',
  PUBLISHING: 'PUBLISHING',
  PUBLISHED: 'PUBLISHED',
  FAILED: 'FAILED',
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const JobType = {
  SCRAPE_LEAD: 'SCRAPE_LEAD',
  ENRICH_LEAD: 'ENRICH_LEAD',
  GENERATE_SITE: 'GENERATE_SITE',
  PUBLISH_SITE: 'PUBLISH_SITE',
} as const;
export type JobType = (typeof JobType)[keyof typeof JobType];

export const JobStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export const WidgetType = {
  BOOKING: 'BOOKING',
  PAYMENT: 'PAYMENT',
} as const;
export type WidgetType = (typeof WidgetType)[keyof typeof WidgetType];

export const ImageAssetType = {
  HERO: 'HERO',
  LOGO: 'LOGO',
  THUMBNAIL: 'THUMBNAIL',
  GALLERY: 'GALLERY',
} as const;
export type ImageAssetType = (typeof ImageAssetType)[keyof typeof ImageAssetType];

export const VariantStatus = {
  DRAFT: 'DRAFT',
  GENERATING: 'GENERATING',
  GENERATED: 'GENERATED',
  PUBLISHED: 'PUBLISHED',
} as const;
export type VariantStatus = (typeof VariantStatus)[keyof typeof VariantStatus];