// Shared action and derived-state execution for browser and embedded tests.
import { ctx } from './context';
import { evaluateExpression, resolveValue } from './expression';
import { buildScope } from './scope';
import { normalizeLiteral, valueToString } from './utils';
import { executeSteps } from './statement';
import { playSound, playMusic, stopMusic, pauseMusic, resumeMusic } from './audio';
import type { RuneApp } from './types';
import { callableName, inLogicScope } from './modular';

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
      name = callableName(name, 'action');
      let def = context.actionDefinitions[name];
      let receiver: Record<string, unknown> | undefined;
      if (def?.scope?.startsWith('@') && def.scope === context.logicOwner) receiver = context.logicState;
      if (!def && name.includes('.')) {
        const dot = name.lastIndexOf('.');
        const value = evaluateExpression(name.slice(0, dot), buildScope(locals || {}));
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          receiver = value as Record<string, unknown>;
          const type = receiver.__type;
          if (typeof type === 'string') def = context.actionDefinitions[`${type}.${name.slice(dot + 1)}`];
        }
      }
      if (!def) {
        if (name.includes('.') || context.logicOwner) throw new Error(`Unknown Rune-Web action: ${name}`);
        if (typeof window !== 'undefined' && typeof (window as any)[name] === 'function') {
          (window as any)[name](...args);
        }
        return;
      }
      const scopedLocals: Record<string, unknown> = def.scope ? {} : Object.assign({}, locals);
      if (receiver) scopedLocals.self = receiver;
      (def.params || []).forEach((param, index) => {
        scopedLocals[param] = args[index];
      });
      inLogicScope(name, def, receiver, () => executeSteps(def.steps || [], scopedLocals));
    },
  };

}
