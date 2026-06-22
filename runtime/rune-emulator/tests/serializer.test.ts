import { describe, it, expect } from 'vitest';
import { toJson, toYaml, toXml, serialize } from '../src/serializer/index';

// ---------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------

describe('serializer — JSON', () => {
  it('serializes an object', () => {
    const result = toJson({ name: 'Alice', age: 30 });
    const parsed = JSON.parse(result);
    expect(parsed).toMatchObject({ name: 'Alice', age: 30 });
  });

  it('serializes an array', () => {
    const result = toJson([1, 2, 3]);
    expect(JSON.parse(result)).toEqual([1, 2, 3]);
  });

  it('serializes null', () => {
    expect(toJson(null)).toBe('null');
  });

  it('serializes nested objects', () => {
    const val = { users: [{ id: 1, name: 'Alice' }] };
    const result = toJson(val);
    expect(JSON.parse(result)).toMatchObject(val);
  });
});

// ---------------------------------------------------------------------------
// YAML
// ---------------------------------------------------------------------------

describe('serializer — YAML', () => {
  it('serializes a string', () => {
    expect(toYaml('hello')).toBe('hello');
  });

  it('serializes a number', () => {
    expect(toYaml(42)).toBe('42');
  });

  it('serializes a boolean', () => {
    expect(toYaml(true)).toBe('true');
    expect(toYaml(false)).toBe('false');
  });

  it('serializes null', () => {
    expect(toYaml(null)).toBe('null');
  });

  it('serializes a flat object', () => {
    const yaml = toYaml({ name: 'Alice', age: 30 });
    expect(yaml).toContain('name: Alice');
    expect(yaml).toContain('age: 30');
  });

  it('serializes an array', () => {
    const yaml = toYaml(['a', 'b', 'c']);
    expect(yaml).toContain('- a');
    expect(yaml).toContain('- b');
    expect(yaml).toContain('- c');
  });

  it('serializes a list of objects', () => {
    const yaml = toYaml([{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]);
    expect(yaml).toContain('id: 1');
    expect(yaml).toContain('name: Alice');
    expect(yaml).toContain('id: 2');
    expect(yaml).toContain('name: Bob');
  });

  it('quotes strings that look like YAML special values', () => {
    expect(toYaml('null')).toContain('"null"');
    expect(toYaml('true')).toContain('"true"');
  });

  it('serializes empty array as []', () => {
    expect(toYaml([])).toBe('[]');
  });

  it('serializes empty object as {}', () => {
    expect(toYaml({})).toBe('{}');
  });
});

// ---------------------------------------------------------------------------
// XML
// ---------------------------------------------------------------------------

describe('serializer — XML', () => {
  it('wraps a string in a root element', () => {
    const xml = toXml('hello', 'message');
    expect(xml).toBe('<message>hello</message>');
  });

  it('wraps a number', () => {
    const xml = toXml(42, 'count');
    expect(xml).toBe('<count>42</count>');
  });

  it('represents null as nil attribute', () => {
    const xml = toXml(null, 'item');
    expect(xml).toContain('nil="true"');
  });

  it('serializes an object to child elements', () => {
    const xml = toXml({ name: 'Alice', age: 30 }, 'user');
    expect(xml).toContain('<name>Alice</name>');
    expect(xml).toContain('<age>30</age>');
    expect(xml).toContain('<user>');
    expect(xml).toContain('</user>');
  });

  it('serializes an array with singularized item tags', () => {
    const xml = toXml([{ id: 1 }, { id: 2 }], 'users');
    expect(xml).toContain('<users>');
    expect(xml).toContain('<user>');
    expect(xml).toContain('<id>1</id>');
    expect(xml).toContain('<id>2</id>');
  });

  it('escapes special XML characters', () => {
    const xml = toXml('<hello & world>', 'msg');
    expect(xml).toContain('&lt;hello &amp; world&gt;');
  });

  it('serializes empty object as self-closing tag', () => {
    const xml = toXml({}, 'empty');
    expect(xml).toContain('/>');
  });
});

// ---------------------------------------------------------------------------
// serialize() dispatcher
// ---------------------------------------------------------------------------

describe('serializer — serialize()', () => {
  it('dispatches to JSON', () => {
    const result = serialize({ x: 1 }, 'json');
    expect(JSON.parse(result)).toMatchObject({ x: 1 });
  });

  it('dispatches to YAML', () => {
    const result = serialize({ x: 1 }, 'yaml');
    expect(result).toContain('x: 1');
  });

  it('dispatches to XML', () => {
    const result = serialize({ x: 1 }, 'xml', 'data');
    expect(result).toContain('<data>');
    expect(result).toContain('<x>1</x>');
  });
});
