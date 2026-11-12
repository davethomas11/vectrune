// Shared action and derived-state execution for browser and embedded tests.
import { ctx } from './context';
import { evaluateExpression, resolveValue } from './expression';
import { buildScope } from './scope';
import { normalizeLiteral, valueToString } from './utils';
import { executeSteps } from './statement';
import { playSound, playMusic, stopMusic, pauseMusic, resumeMusic } from './audio';
import type { RuneApp } from './types';

export function createLogicApp(render: RuneApp['render']): RuneApp {
  return {
    state: {} as Record<string, unknown>,
    derived: {},
    playSound,
    playMusic,
    stopMusic,
    pauseMusic,
    resumeMusic,
    computeDerived() {
      const context = ctx();
      const baseScope = buildScope({});
      for (const [name, def] of Object.entries(
        context.derivedDefinitions,
      )) {
        const sourceValue = resolveValue(def.source, baseScope);
        const sourceKey = valueToString(sourceValue);
        let resolved: unknown = undefined;

        for (const currentCase of def.cases || []) {
          const matcher = normalizeLiteral(currentCase.matcher);
          if (matcher === '_' || matcher === sourceKey) {
            resolved = evaluateExpression(
              currentCase.value,
              buildScope({}),
            );
            break;
          }
        }

        this.derived[name] = resolved;
      }
    },
    render,
    invokeAction(
      name: string,
      args: unknown[],
      locals?: Record<string, unknown>,
    ) {
      const context = ctx();
      const def = context.actionDefinitions[name];
      if (!def) {
        if (typeof window !== 'undefined' && typeof (window as any)[name] === 'function') {
          (window as any)[name](...args);
        }
        return;
      }
      const scopedLocals: Record<string, unknown> = Object.assign(
        {},
        locals || {},
      );
      (def.params || []).forEach((param, index) => {
        scopedLocals[param] = args[index];
      });
      executeSteps(def.steps || [], scopedLocals);
    },
  };

}
