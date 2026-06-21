import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  includesTopLevel,
  splitTopLevel,
  normalizeLiteral,
  valueToString,
  decodeEscapes,
} from '../src/utils';

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<div class="test">')).toBe(
      '&lt;div class=&quot;test&quot;&gt;',
    );
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('handles non-string values', () => {
    expect(escapeHtml(42)).toBe('42');
    expect(escapeHtml(null)).toBe('null');
    expect(escapeHtml(undefined)).toBe('undefined');
  });
});

describe('includesTopLevel', () => {
  it('finds delimiter at top level', () => {
    expect(includesTopLevel('a + b', ' + ')).toBe(true);
  });

  it('ignores delimiter inside parens', () => {
    expect(includesTopLevel('fn(a + b)', ' + ')).toBe(false);
  });

  it('ignores delimiter inside quotes', () => {
    expect(includesTopLevel('"a + b"', ' + ')).toBe(false);
  });

  it('ignores delimiter inside brackets', () => {
    expect(includesTopLevel('[a + b]', ' + ')).toBe(false);
  });
});

describe('splitTopLevel', () => {
  it('splits on top-level delimiter', () => {
    expect(splitTopLevel('a + b + c', ' + ')).toEqual(['a', 'b', 'c']);
  });

  it('preserves nested delimiters', () => {
    expect(splitTopLevel('fn(a, b), c', ', ')).toEqual(['fn(a, b)', 'c']);
  });

  it('handles single item', () => {
    expect(splitTopLevel('abc', ' + ')).toEqual(['abc']);
  });
});

describe('normalizeLiteral', () => {
  it('strips double quotes', () => {
    expect(normalizeLiteral('"hello"')).toBe('hello');
  });

  it('strips single quotes', () => {
    expect(normalizeLiteral("'world'")).toBe('world');
  });

  it('leaves unquoted strings alone', () => {
    expect(normalizeLiteral('foo')).toBe('foo');
  });
});

describe('valueToString', () => {
  it('converts strings', () => {
    expect(valueToString('hello')).toBe('hello');
  });

  it('converts numbers', () => {
    expect(valueToString(42)).toBe('42');
  });

  it('converts booleans', () => {
    expect(valueToString(true)).toBe('true');
  });

  it('converts null/undefined to empty string', () => {
    expect(valueToString(null)).toBe('');
    expect(valueToString(undefined)).toBe('');
  });

  it('converts objects to JSON', () => {
    expect(valueToString({ a: 1 })).toBe('{"a":1}');
  });
});

describe('decodeEscapes', () => {
  it('decodes \\n', () => {
    expect(decodeEscapes('a\\nb')).toBe('a\nb');
  });

  it('decodes \\t', () => {
    expect(decodeEscapes('a\\tb')).toBe('a\tb');
  });

  it('converts \\{ and \\} to private use chars (for interpolation protection)', () => {
    const result = decodeEscapes('\\{hello\\}');
    expect(result).toBe('\uE000hello\uE001');
  });
});
