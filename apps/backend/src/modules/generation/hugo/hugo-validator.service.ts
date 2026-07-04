import { Injectable } from '@nestjs/common';
import { GeneratedSiteStructure } from '@prompt-site-builder/shared';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

@Injectable()
export class HugoValidatorService {
  private readonly requiredContentFiles = ['content/index.md', 'content/_index.md'];

  validate(structure: GeneratedSiteStructure): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate hugo.toml
    if (!structure.config || structure.config.trim() === '') {
      errors.push('hugo.toml is empty or missing');
    } else {
      if (!structure.config.includes('baseURL')) {
        errors.push('hugo.toml missing baseURL');
      }
      if (!structure.config.includes('title')) {
        warnings.push('hugo.toml missing title');
      }
      if (!structure.config.includes('theme')) {
        warnings.push('hugo.toml missing theme');
      }
    }

    // Validate content files
    const hasIndex = structure.content.some(
      (f) => f.path === 'content/index.md' || f.path === 'content/_index.md',
    );
    if (!hasIndex) {
      errors.push('Missing homepage content (content/index.md or content/_index.md)');
    }

    // Validate content frontmatter
    for (const file of structure.content) {
      if (!file.body.startsWith('---')) {
        errors.push(`${file.path} missing YAML frontmatter`);
      }
      if (!file.body.includes('title:')) {
        warnings.push(`${file.path} missing title in frontmatter`);
      }
    }

    // Validate static assets
    const hasImages = structure.static.some((f) => f.path.startsWith('static/images/'));
    if (!hasImages && structure.assets.length === 0) {
      warnings.push('No images in static/images directory');
    }

    // Validate TOML syntax (basic checks)
    const tomlLines = structure.config.split('\n');
    for (const line of tomlLines) {
      const trimmed = line.trim();
      if (trimmed === '' || trimmed.startsWith('#')) continue;
      if (trimmed.includes('==') && !trimmed.startsWith('[')) {
        // TOML uses = not ==
        if (trimmed.includes('===')) {
          errors.push(`Invalid TOML syntax (triple equals): ${trimmed}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateFile(path: string, content: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (path.endsWith('.toml')) {
      if (!content.includes('baseURL')) {
        errors.push('Missing baseURL in TOML config');
      }
    }

    if (path.endsWith('.md')) {
      if (!content.startsWith('---')) {
        errors.push('Markdown file missing frontmatter');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
