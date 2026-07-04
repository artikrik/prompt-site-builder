import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('should merge class names', () => {
    const result = cn('px-4', 'py-2');
    expect(result).toContain('px-4');
    expect(result).toContain('py-2');
  });

  it('should filter out falsy values', () => {
    const result = cn('base',  undefined, null, 'extra');
    expect(result).toContain('base');
    expect(result).toContain('extra');
    expect(result).not.toContain('hidden');
  });

  it('should merge tailwind conflicts', () => {
    const result = cn('px-4', 'px-2');
    expect(result).toContain('px-2');
    expect(result).not.toContain('px-4');
  });

  it('should return empty string for no args', () => {
    expect(cn()).toBe('');
  });
});
