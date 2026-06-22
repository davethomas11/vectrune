// ============================================================================
// Event delegation — DOM event binding and handler dispatch
// ============================================================================

import { ctx } from './context';
import { evaluateExpression } from './expression';
import { getWindowProp, setWindowProp } from './globals';
import { buildScope } from './scope';
import { splitTopLevel } from './utils';
import { renderNode } from './rendering';
import { executeStatement } from './statement';

// ---------------------------------------------------------------------------
// parseHandlerSpec — parse "actionName(arg1, arg2)" from data-on-* attribute
// ---------------------------------------------------------------------------

export function parseHandlerSpec(
  spec: string,
): { name: string; args: string[]; raw: string } | null {
  const trimmed = String(spec || '').trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^([A-Za-z_][\w-]*)(?:\((.*)\))?$/);
  if (match) {
    const args = match[2] ? splitTopLevel(match[2], ',') : [];
    return { name: match[1], args, raw: trimmed };
  }
  // Allow arbitrary statements like "activePage = 'home'"
  return { name: '', args: [], raw: trimmed };
}

// ---------------------------------------------------------------------------
// readScope — parse the data-rune-scope attribute from a DOM element
// ---------------------------------------------------------------------------

export function readScope(element: Element): Record<string, unknown> {
  const raw = element.getAttribute('data-rune-scope');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (_err) {
    return {};
  }
}

// ---------------------------------------------------------------------------
// bindEvent — register a delegated event listener for a given event name
// ---------------------------------------------------------------------------

export function bindEvent(eventName: string): void {
  document.addEventListener(eventName, function (event: Event) {
    const selector = `[data-on-${eventName}]`;
    const element =
      event.target && (event.target as Element).closest
        ? (event.target as Element).closest(selector)
        : null;
    if (!element) return;
    const spec = parseHandlerSpec(
      element.getAttribute(`data-on-${eventName}`) || '',
    );
    if (!spec) return;
    const locals = readScope(element);
    
    if (spec.name) {
      const scope = buildScope(
        Object.assign({}, locals, { this: element }),
      );
      const args = spec.args.map((arg) =>
        evaluateExpression(arg, scope),
      );
      ctx().app.invokeAction(spec.name, args, locals);
    } else {
      executeStatement(spec.raw, locals);
    }
  });
}

// ---------------------------------------------------------------------------
// createComponentRender — create a render function for a specific component
// ---------------------------------------------------------------------------

export function createComponentRender(
  componentId: string,
): () => void {
  return function () {
    const context = ctx();
    setWindowProp('__renderingComponent', componentId);
    context.app.computeDerived();
    const elem = document.getElementById(componentId);
    if (elem) {
      const newHtml = renderNode(context.pageTree, {});
      elem.innerHTML = newHtml;
    }
    setWindowProp('__renderingComponent', null);
  };
}

// ---------------------------------------------------------------------------
// setupMemoryUpdateListener — listen for memory_update messages via WebSocket
// ---------------------------------------------------------------------------

export function setupMemoryUpdateListener(): void {
  const context = ctx();
  const ws = getWindowProp('__ws');
  if (ws && (ws as EventTarget).addEventListener) {
    (ws as EventTarget).addEventListener('message', function (event: Event) {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        if (data.type === 'memory_update' && data.key) {
          context.app.state[data.key] = data.value;
          if (context.memorySubscriptions[data.key]) {
            context.memorySubscriptions[data.key].forEach(
              (componentId: string) => {
                if (componentId === 'app') {
                  requestAnimationFrame(
                    context.app.render.bind(context.app),
                  );
                } else {
                  const componentRender =
                    createComponentRender(componentId);
                  requestAnimationFrame(componentRender);
                }
              },
            );
          } else {
            requestAnimationFrame(context.app.render.bind(context.app));
          }
        }
      } catch (_err) {
        // Ignore malformed messages
      }
    });
  }
}
