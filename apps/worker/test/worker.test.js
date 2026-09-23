import { describe, expect, it } from 'vitest';
import { run } from '../src/index.js';

describe('worker entrypoint', () => {
  it('exports a run function', () => {
    expect(typeof run).toBe('function');
  });
});
