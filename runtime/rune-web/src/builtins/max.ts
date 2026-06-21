// Builtin command: max
import { evaluateExpression } from "../expression";
import { assignPath } from "../statement";
import { buildScope } from "../scope";
import type { BuiltinCommand, CommandResult } from "./command";

/**
 * Handle the `max` builtin.
 * Syntax: max <arrayPath> as <var>
 * Finds the maximum numeric value in an array and stores it.
 */
export function handleMax(statement: string, locals: any): CommandResult {
  if (!statement.startsWith('max ')) return undefined;
  const rest = statement.slice(4).trim();
  const [pathPart, varPart] = rest.split(/\s+as\s+/);
  if (!pathPart) return undefined;
  const arr = evaluateExpression(pathPart, buildScope(locals));
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  const maxVal = Math.max(...arr.map((v) => Number(v)));
  if (varPart) {
    assignPath(varPart, maxVal, locals);
  }
  return maxVal;
}

export const maxCommand: BuiltinCommand = {
  prefix: ["max"],
  signature: "max <arrayPath> as <var>",
  description: "Finds maximum numeric value in an array",
  handler: handleMax,
};
