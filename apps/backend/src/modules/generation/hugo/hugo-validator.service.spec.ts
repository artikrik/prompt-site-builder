import { describe, it, expect } from 'vitest';
import { HugoValidatorService } from './hugo-validator.service';
import { GeneratedSiteStructure } from '@prompt-site-builder/shared';

describe('HugoValidatorService', () => {
  const validator = new HugoValidatorService();

  const validStructure: GeneratedSiteStructure = {
    config: `baseURL = "https://test.sitenow.pp.ua"
languageCode = "uk"
title = "Test Site"
theme = "hugo-theme-zen"`,
    content: [
      {
        path: 'content/index.md',
        body: `---
title: "Home"
description: "Test"
---

# Welcome`,
      },
    ],
    layouts: [],
    static: [],
    assets: [],
  };

  describe('validate', () => {
    it('should return valid for correct structure', () => {
      const result = validator.validate(validStructure);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for missing hugo.toml', () => {
      const structure = { ...validStructure, config: '' };
      const result = validator.validate(structure);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('hugo.toml is empty or missing');
    });

    it('should return errors for missing baseURL', () => {
      const structure = { ...validStructure, config: 'title = "Test"' };
      const result = validator.validate(structure);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('hugo.toml missing baseURL');
    });

    it('should return warnings for missing title', () => {
      const structure = { ...validStructure, config: 'baseURL = "https://test.com"' };
      const result = validator.validate(structure);
      expect(result.warnings).toContain('hugo.toml missing title');
    });

    it('should return errors for missing homepage content', () => {
      const structure = {
        ...validStructure,
        content: [{ path: 'content/about.md', body: '---\ntitle: About\n---\n# About' }],
      };
      const result = validator.validate(structure);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing homepage content (content/index.md or content/_index.md)');
    });

    it('should return errors for missing frontmatter', () => {
      const structure = {
        ...validStructure,
        content: [{ path: 'content/index.md', body: '# No frontmatter' }],
      };
      const result = validator.validate(structure);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('missing YAML frontmatter'))).toBe(true);
    });

    it('should warn about missing images', () => {
      const result = validator.validate(validStructure);
      expect(result.warnings.some((w) => w.includes('No images'))).toBe(true);
    });
  });

  describe('validateFile', () => {
    it('should validate TOML files', () => {
      const result = validator.validateFile('hugo.toml', 'baseURL = "https://test.com"\ntitle = "Test"');
      expect(result.valid).toBe(true);
    });

    it('should validate Markdown files', () => {
      const result = validator.validateFile('content/index.md', '---\ntitle: Home\n---\n# Home');
      expect(result.valid).toBe(true);
    });

    it('should catch missing frontmatter in MD', () => {
      const result = validator.validateFile('content/index.md', '# No frontmatter');
      expect(result.valid).toBe(false);
    });
  });
});
