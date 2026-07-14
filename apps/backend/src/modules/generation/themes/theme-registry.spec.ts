import { describe, it, expect } from 'vitest';
import {
  HUGO_THEMES,
  getThemesByCategory,
  getThemeByName,
  getThemeNames,
} from './theme-registry';

describe('ThemeRegistry', () => {
  it('should contain 13 curated themes', () => {
    expect(HUGO_THEMES).toHaveLength(13);
  });

  it('should find theme by name', () => {
    const theme = getThemeByName('ananke');
    expect(theme).toBeDefined();
    expect(theme!.name).toBe('ananke');
    expect(theme!.category).toBe('business');
  });

  it('should return undefined for unknown theme', () => {
    expect(getThemeByName('nonexistent')).toBeUndefined();
  });

  it('should filter themes by category', () => {
    const business = getThemesByCategory('business');
    expect(business.length).toBeGreaterThanOrEqual(2);
    expect(business.every((t) => t.category === 'business')).toBe(true);
  });

  it('should return all theme names', () => {
    const names = getThemeNames();
    expect(names).toHaveLength(13);
    expect(names).toContain('hugo-theme-zen');
    expect(names).toContain('PaperMod');
    expect(names).toContain('hugo-fresh');
    expect(names).toContain('hugo-hero-theme');
    expect(names).toContain('hugo-scroll');
  });

  it('should have all required fields for each theme', () => {
    for (const theme of HUGO_THEMES) {
      expect(theme.name).toBeTruthy();
      expect(theme.repoUrl).toBeTruthy();
      expect(theme.description).toBeTruthy();
      expect(theme.tags.length).toBeGreaterThan(0);
      expect(theme.category).toBeTruthy();
    }
  });
});
