import { evaluateExpression } from '../../src/expression';
import { buildScope } from '../../src/scope';
import { handleBuiltin } from '../../src/builtins';
import { initContext } from '../../src/context';

// Initialize a mock context for tests so that `ctx()` doesn't throw
initContext({
  app: { state: {}, derived: {}, render: () => {}, invokeAction: () => {} } as any,
  derivedDefinitions: {},
  helperDefinitions: {},
  actionDefinitions: {},
  i18nData: {},
  pageTree: {} as any,
  isRendering: false,
  memorySubscriptions: {}
});

export const createLocals = (): Record<string, any> => ({});

export const runBuiltin = (stmt: string, locals: Record<string, any>) => {
  return handleBuiltin(stmt, locals);
};

export const readPath = (locals: Record<string, any>, path: string) => {
  return evaluateExpression(path, buildScope(locals));
};
