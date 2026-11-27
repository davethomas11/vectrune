// ============================================================================
// Template interpolation — {expr} expansion in text/attributes
// ============================================================================

import { evaluateExpression, resolvePath } from './expression';
import { decodeEscapes, expandPercentI18n, valueToString } from './utils';
import type { Scope } from './types';

/**
 * Interpolate `{expression}` placeholders in a template string.
 * Handles nested interpolation and escape sequences.
 */
export function interpolate(template: string, scope: Scope): string {
  const OPEN = '\uE000';
  const CLOSE = '\uE001';
  return expandPercentI18n(decodeEscapes(String(template || '')))
    .replace(/\{([^}]+)\}/g, function (_match: string, expr: string) {
      const path = expr.trim();
      const i18nValue = /^i18n(?:\.[A-Za-z0-9_$-]+)+$/.test(path)
        ? resolvePath(path, scope)
        : undefined;
      const resolved = valueToString(i18nValue === undefined ? evaluateExpression(expr, scope) : i18nValue);
      return resolved.includes('{') && resolved.includes('}')
        ? interpolate(resolved, scope)
        : resolved;
    })
    .replace(new RegExp(OPEN, 'g'), '{')
    .replace(new RegExp(CLOSE, 'g'), '}');
}
