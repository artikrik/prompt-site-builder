import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('main.ts', () => {
  it('should not use console.log for startup messages', () => {
    const content = readFileSync(resolve(__dirname, 'main.ts'), 'utf-8');
    expect(content).not.toMatch(/console\.log/);
    expect(content).toContain('Logger');
  });
});
