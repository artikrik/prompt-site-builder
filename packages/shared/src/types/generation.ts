import { JobStatus, JobType } from '../enums';

export interface GenerationJob {
  id: string;
  projectId: string;
  type: JobType;
  status: JobStatus;
  result: Record<string, unknown> | null;
  error: string | null;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LLMResponse {
  content: string;
  model: string;
  tokensUsed: number;
}

export interface ImageGenerationResponse {
  url: string;
  revisedPrompt: string;
}

export interface HugoBuildResult {
  success: boolean;
  outputDir: string;
  errors: string[];
  warnings: string[];
}
