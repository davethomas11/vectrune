import { describe, it, expect, beforeEach } from 'vitest';
import { renderNode, renderElement } from '../src/rendering';
import { initContext } from '../src/context';
import type { RuneApp, ViewNode } from '../src/types';

function setupTestContext(state: Record<string, unknown> = {}) {
  const app: RuneApp = {
    state: { ...state },
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
    i18nData: {},
    app,
    isRendering: false,
    memorySubscriptions: {},
  });
  return app;
}

describe('renderNode', () => {
  beforeEach(() => {
    setupTestContext({ 
      user: 'Dave', 
      items: [1, 2],
      show: true 
    });
  });

  it('renders Text nodes with interpolation', () => {
    const node: ViewNode = { Text: 'Hello {user}' };
    expect(renderNode(node, {})).toBe('Hello Dave');
  });

  it('renders Comment nodes', () => {
    const node: ViewNode = { Comment: 'this is a comment' };
    expect(renderNode(node, {})).toBe('<!--this is a comment-->');
  });

  it('renders Conditional nodes when true', () => {
    const node: ViewNode = {
      Conditional: {
        condition: 'show == true',
        body: [{ Text: 'Visible' }]
      }
    };
    expect(renderNode(node, {})).toBe('Visible');
  });

  it('does not render Conditional nodes when false', () => {
    const node: ViewNode = {
      Conditional: {
        condition: 'show == false',
        body: [{ Text: 'Visible' }]
      }
    };
    expect(renderNode(node, {})).toBe('');
  });

  it('renders Loop nodes', () => {
    const node: ViewNode = {
      Loop: {
        item_name: 'item',
        index_name: 'i',
        collection: 'items',
        body: [{ Text: 'Item {i}: {item}, ' }]
      }
    };
    expect(renderNode(node, {})).toBe('Item 0: 1, Item 1: 2, ');
  });

  it('renders ComponentScope nodes with props', () => {
    const node: ViewNode = {
      ComponentScope: {
        props: { localName: '{user}' },
        body: { Text: 'Component {localName}' }
      }
    };
    expect(renderNode(node, {})).toBe('Component Dave');
  });
});

describe('renderElement', () => {
  beforeEach(() => {
    setupTestContext({ count: 5 });
  });

  it('renders basic element', () => {
    const el = {
      tag: 'div',
      classes: [],
      id: null,
      attrs: {},
      events: {},
      text: null,
      for_each: null,
      children: []
    };
    expect(renderElement(el, {})).toBe('<div></div>');
  });

  it('renders element with id and classes', () => {
    const el = {
      tag: 'span',
      classes: ['btn', 'btn-{count}'],
      id: 'span-{count}',
      attrs: {},
      events: {},
      text: null,
      for_each: null,
      children: []
    };
    expect(renderElement(el, {})).toBe('<span id="span-5" class="btn btn-5"></span>');
  });

  it('renders boolean attributes correctly', () => {
    const el = {
      tag: 'input',
      classes: [],
      id: null,
      attrs: {
        disabled: 'true',
        checked: 'false', // Should be omitted
        type: 'text'
      },
      events: {},
      text: null,
      for_each: null,
      children: []
    };
    expect(renderElement(el, {})).toBe('<input disabled="true" type="text"></input>');
  });

  it('renders events as data-on-* attributes', () => {
    const el = {
      tag: 'button',
      classes: [],
      id: null,
      attrs: {},
      events: { click: 'increment({count})' },
      text: 'Click me',
      for_each: null,
      children: []
    };
    expect(renderElement(el, {})).toBe('<button data-on-click="increment(5)">Click me</button>');
  });
});
