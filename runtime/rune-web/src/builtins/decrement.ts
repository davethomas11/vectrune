// Builtin command: -- (decrement)
import { evaluateExpression } from "../expression";
import { assignPath } from "../statement";
import { buildScope } from "../scope";
import type { BuiltinCommand, CommandResult } from "./command";

export function handleDecrement(statement: string, locals: any): CommandResult {
  if (statement.startsWith('decrement') || statement.startsWith('dec')) {
    const trimmed = statement.replace('decrement ', '').replace('dec ', '');
    const tokens = trimmed.split(' ');
    if (tokens.length != 3) return undefined;
    if (tokens[1] != "by") return undefined;
    const path = tokens[0];
    const valueExpression = tokens[2];
    const value = evaluateExpression(valueExpression, buildScope(locals));
    return decrementBy(path, Number(value), locals);
  }

  if (!statement.endsWith('--')) return undefined;
  const path = statement.slice(0, -2).trim();
  return decrementBy(path, 1, locals);
}

function decrementBy(path: string, value: number, locals: any): number {
  let evaled = evaluateExpression(path, buildScope(locals));
  if (evaled === path) evaled = 0;
  let current = Number(evaled);
  if (isNaN(current)) current = 0;
  const newValue = current - value;
  assignPath(path, newValue, locals);
  return newValue;
}

export const decrementCommand: BuiltinCommand = {
  postfix: ["--"],
  prefix: ["decrement", "dec"],
  signature: "<path>-- or decrement <path> by <value> or dec <path> by <value>",
  description: "Decrements a numeric value at the given path",
  handler: handleDecrement,
};
