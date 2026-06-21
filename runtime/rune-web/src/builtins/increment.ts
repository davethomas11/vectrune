// Builtin command: ++ (increment)
import { evaluateExpression } from "../expression";
import { assignPath } from "../statement";
import { buildScope } from "../scope";
import type { BuiltinCommand, CommandResult } from "./command";

export function handleIncrement(statement: string, locals: any): CommandResult {
  if (statement.startsWith('increment') || statement.startsWith('inc')) {
    const trimmed = statement.replace('increment ', '').replace('inc ', '');
    const tokens = trimmed.split(' ');
    if (tokens.length != 3) return undefined;
    if (tokens[1] != "by") return undefined;
    const path = tokens[0];
    const valueExpression = tokens[2];
    const value = evaluateExpression(valueExpression, buildScope(locals));
    return incrementBy(path, Number(value), locals);
  }

  if (!statement.endsWith('++')) return undefined;
  const path = statement.slice(0, -2).trim();
  return incrementBy(path, 1, locals);
}

function incrementBy(path: string, value: number, locals: any): number {
  let evaled = evaluateExpression(path, buildScope(locals));
  if (evaled === path) evaled = 0;
  let current = Number(evaled);
  if (isNaN(current)) current = 0;
  const newValue = current + value;
  assignPath(path, newValue, locals);
  return newValue;
}

export const incrementCommand: BuiltinCommand = {
  prefix: ["increment", "inc"],
  postfix: ["++"],
  signature: "<path>++ | increment <path> by <number> | inc <path> by <number>",
  description: "Increments a numeric value at the given path",
  handler: handleIncrement
};
