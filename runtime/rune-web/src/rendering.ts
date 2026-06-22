// ============================================================================
// Rendering — convert the page AST into HTML strings
// ============================================================================

import { ctx } from './context';
import { evaluateExpression } from './expression';
import { interpolate } from './interpolation';
import { buildScope } from './scope';
import { escapeHtml, normalizeLiteral } from './utils';
import type { ViewNode, ElementNode } from './types';

// ---------------------------------------------------------------------------
// renderNode — dispatch on node type
// ---------------------------------------------------------------------------

export function renderNode(
  node: ViewNode,
  locals: Record<string, unknown>,
): string {
  if (node.Element) {
    const element = node.Element;
    if (element.for_each) {
      const collection = evaluateExpression(
        element.for_each.collection,
        buildScope(locals),
      );
      if (!Array.isArray(collection)) return '';
      return collection
        .map((item: unknown, index: number) => {
          const childLocals: Record<string, unknown> = Object.assign(
            {},
            locals || {},
          );
          childLocals[element.for_each!.item_name] = item;
          if (element.for_each!.index_name)
            childLocals[element.for_each!.index_name!] = index;
          return renderElement(element, childLocals);
        })
        .join('');
    }
    return renderElement(element, locals);
  }

  if (node.Loop) {
    const loop = node.Loop;
    const collection = evaluateExpression(
      loop.collection,
      buildScope(locals),
    );
    if (!Array.isArray(collection)) return '';
    return collection
      .map((item: unknown, index: number) => {
        const childLocals: Record<string, unknown> = Object.assign(
          {},
          locals || {},
        );
        childLocals[loop.item_name] = item;
        if (loop.index_name) childLocals[loop.index_name] = index;
        return (loop.body || [])
          .map((child: ViewNode) => renderNode(child, childLocals))
          .join('');
      })
      .join('');
  }

  if (node.Conditional) {
    const conditional = node.Conditional;
    if (
      Boolean(
        evaluateExpression(
          conditional.condition,
          buildScope(locals),
        ),
      )
    ) {
      return (conditional.body || [])
        .map((child: ViewNode) => renderNode(child, locals))
        .join('');
    }
    return '';
  }

  if (node.Match) {
    const match = node.Match;
    const value = String(evaluateExpression(match.expression, buildScope(locals)));
    for (const caseDef of match.cases) {
      let matcher = normalizeLiteral(caseDef.matcher);
      if (matcher === '_' || matcher === value) {
        return (caseDef.body || [])
          .map((child: ViewNode) => renderNode(child, locals))
          .join('');
      }
    }
    return '';
  }

  if (node.ComponentScope) {
    const scope = node.ComponentScope;
    const childLocals: Record<string, unknown> = Object.assign(
      {},
      locals || {},
    );
    for (const [key, value] of Object.entries(scope.props || {})) {
      let exprStr = String(value).trim();
      if (exprStr.startsWith('{') && exprStr.endsWith('}')) {
        exprStr = exprStr.slice(1, -1).trim();
      }
      childLocals[key] = evaluateExpression(
        exprStr,
        buildScope(locals),
      );
    }
    return renderNode(scope.body, childLocals);
  }

  if (node.MemoryBinding) {
    const binding = node.MemoryBinding;
    const memValue = ctx().app.state[binding.key];
    const childLocals: Record<string, unknown> = Object.assign(
      {},
      locals || {},
      { [binding.var]: memValue },
    );
    return (binding.body || [])
      .map((child: ViewNode) => renderNode(child, childLocals))
      .join('');
  }

  if (node.Text !== undefined) {
    return escapeHtml(interpolate(node.Text, buildScope(locals)));
  }

  if (node.Comment !== undefined) {
    return `<!--${interpolate(node.Comment, buildScope(locals))}-->`;
  }

  return '';
}

// ---------------------------------------------------------------------------
// renderElement — render a single element node to an HTML string
// ---------------------------------------------------------------------------

export function renderElement(
  element: ElementNode,
  locals: Record<string, unknown>,
): string {
  const scope = buildScope(locals);
  let attrs = '';
  if (element.id)
    attrs += ` id="${escapeHtml(interpolate(element.id, scope))}"`;
  if (element.classes && element.classes.length) {
    const renderedClasses = element.classes
      .map((c: string) => interpolate(c, scope))
      .filter((c: string) => c.length > 0);
    if (renderedClasses.length)
      attrs += ` class="${renderedClasses.join(' ')}"`;
  }

  for (const [key, value] of Object.entries(element.attrs || {})) {
    const renderedValue = interpolate(value, scope);
    if (
      renderedValue === 'false' ||
      renderedValue === 'undefined' ||
      renderedValue === 'null'
    ) {
      const boolAttrs = [
        'checked',
        'disabled',
        'readonly',
        'selected',
        'hidden',
        'required',
        'multiple',
        'autofocus',
      ];
      if (boolAttrs.includes(key)) continue;
    }
    attrs += ` ${key}="${escapeHtml(renderedValue)}"`;
  }
  if (locals && Object.keys(locals).length) {
    attrs += ` data-rune-scope="${escapeHtml(JSON.stringify(locals))}"`;
  }
  for (const [eventName, handler] of Object.entries(
    element.events || {},
  )) {
    attrs += ` data-on-${eventName}="${escapeHtml(interpolate(handler, scope))}"`;
  }

  const text = element.text
    ? escapeHtml(interpolate(element.text, scope))
    : '';
  const children = (element.children || [])
    .map((child: ViewNode) => renderNode(child, locals))
    .join('');
  return `<${element.tag}${attrs}>${text}${children}</${element.tag}>`;
}
