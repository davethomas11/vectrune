import { describe, it, expect, beforeEach } from 'vitest';
import { interpolate } from '../src/interpolation';
import { initContext } from '../src/context';
import { buildScope } from '../src/scope';
import type { RuneApp } from '../src/types';

function setupTestContext(state: Record<string, unknown> = {}) {
  const app: RuneApp = {
    state: { ...state, i18n: { greeting: 'Hello' } },
    derived: {},
    computeDerived: () => {},
    render: () => {},
    invokeAction: () => {},
  };
  initContext({
    pageTree: { Text: '' },
    derivedDefinitions: {},
    helperDefinitions: {},
    actionDefinitions: {},
    i18nData: {
      greeting: 'Hello',
    },
    app,
    isRendering: false,
    memorySubscriptions: {},
  });
  return app;
}

describe('interpolate', () => {
  beforeEach(() => {
    setupTestContext({ name: 'Dave' });
  });

  it('interpolates a simple expression', () => {
    expect(interpolate('My name is {name}', buildScope({ name: 'Dave' }))).toBe('My name is Dave');
  });

  it('handles multiple expressions', () => {
    expect(interpolate('{name} is {age}', buildScope({ name: 'Dave', age: 30 }))).toBe('Dave is 30');
  });

  it('evaluates expressions', () => {
    expect(interpolate('{age + 5}', buildScope({ age: 30 }))).toBe('35');
  });

  it('handles missing variables', () => {
    expect(interpolate('{missing}', buildScope({}))).toBe('missing'); // Falls back to literal name
  });

  it('handles nested interpolation', () => {
    // If a variable contains an interpolation block, it should be resolved
    expect(interpolate('{msg}', buildScope({ msg: 'My name is {name}', name: 'Dave' }))).toBe('My name is Dave');
  });

  it('expands %i18n% markers', () => {
    expect(interpolate('%i18n.greeting% {name}', buildScope({ name: 'Dave' }))).toBe('Hello Dave');
  });

  it('decodes escapes', () => {
    expect(interpolate('Line 1\\nLine 2', buildScope({}))).toBe('Line 1\nLine 2');
    expect(interpolate('\\{escaped\\}', buildScope({}))).toBe('{escaped}');
  });
});
