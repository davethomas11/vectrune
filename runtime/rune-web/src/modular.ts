import { ctx, currentContext, withContext } from './context';
import type { ActionDefinition, HelperDefinition } from './types';

export function callableName(name: string, kind: 'action' | 'helper'): string {
  const c = ctx();
  if (!c.logicOwner) return name;
  const definitions = kind === 'action' ? c.actionDefinitions : c.helperDefinitions;
  const qualified = `${c.logicOwner.replace(/^@/, '')}.${name}`;
  return Object.prototype.hasOwnProperty.call(definitions, qualified) ? qualified : name;
}

export function inLogicScope<T>(
  name: string, definition: ActionDefinition | HelperDefinition,
  receiver: Record<string, unknown> | undefined, run: () => T,
): T {
  const c = ctx(), owner = definition.scope;
  if (c.logicOwner && !owner) throw new Error(`Scoped logic cannot call unscoped member: ${name}`);
  if (definition.private && c.logicOwner !== owner) throw new Error(`Private Rune-Web member: ${name}`);
  if (!owner && !c.logicState) return run();
  if (!owner) return withContext({ ...c, logicState: undefined, logicOwner: undefined }, run);
  const state = owner.startsWith('@') ? receiver : c.app.state[owner];
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new Error(`Rune-Web ${name} requires ${owner.startsWith('@') ? 'an entity receiver' : 'module state'}`);
  }
  return withContext({ ...c, logicState: state as Record<string, unknown>, logicOwner: owner }, run);
}

const moduleNames = new WeakMap<object, Set<string>>();
const readonlyValues = new WeakMap<object, Map<string, object>>();

export function readonlyModuleValue<T>(value: T, owner: string): T {
  if (!value || typeof value !== 'object') return value;
  let owners = readonlyValues.get(value);
  if (!owners) {
    owners = new Map();
    readonlyValues.set(value, owners);
  }
  let wrapped = owners.get(owner);
  if (!wrapped) {
    const app = ctx().app;
    const guard = () => {
      const context = currentContext();
      if (context?.app !== app || context.logicOwner !== owner) throw new Error('Module state is read-only outside its actions');
    };
    wrapped = new Proxy(value, {
      get: (target, key) => readonlyModuleValue(Reflect.get(target, key), owner),
      set: (target, key, next) => { guard(); return Reflect.set(target, key, next); },
      deleteProperty: (target, key) => { guard(); return Reflect.deleteProperty(target, key); },
      defineProperty: (target, key, property) => { guard(); return Reflect.defineProperty(target, key, property); },
      setPrototypeOf: (target, prototype) => { guard(); return Reflect.setPrototypeOf(target, prototype); },
    });
    owners.set(owner, wrapped);
  }
  return wrapped as T;
}

export function moduleStateNames(): ReadonlySet<string> {
  const c = ctx();
  let names = moduleNames.get(c.actionDefinitions);
  if (!names) {
    names = new Set([...Object.values(c.actionDefinitions), ...Object.values(c.helperDefinitions)]
      .map(def => def.scope).filter((owner): owner is string => Boolean(owner && !owner.startsWith('@'))));
    moduleNames.set(c.actionDefinitions, names);
  }
  return names;
}

export function moduleState(name: string): boolean {
  return moduleStateNames().has(name);
}
