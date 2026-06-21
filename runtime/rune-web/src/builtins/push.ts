// Builtin command: push
import { evaluateExpression } from "../expression";
import { assignPath } from "../statement";
import { buildScope } from "../scope";
import type { BuiltinCommand, CommandResult } from "./command";

/**
 * Handle the `push` builtin.
 * Syntax: push <path> <valueExpression>
 * Evaluates the value expression and pushes it onto the array at the given path.
 */
export function handlePush(statement: string, locals: any): CommandResult {
  if (!statement.startsWith('push ')) return undefined;
  const tokens = statement.split(/\s+/);
  if (tokens.length < 3) return undefined;
  const targetPath = tokens[1];
  const valueExpr = tokens.slice(2).join(' ');
  const collection = evaluateExpression(targetPath, buildScope(locals));
  if (!Array.isArray(collection)) return undefined;
  const value = evaluateExpression(valueExpr, buildScope(locals));
  collection.push(value);
  assignPath(targetPath, collection, locals);
  return true;
}

export const pushCommand: BuiltinCommand = {
  prefix: ["push"],
  signature: "push <path> <valueExpression>",
  description: "Pushes a value onto the array at the given path",
  handler: handlePush,
};
