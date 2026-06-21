// Builtin command: min
import { evaluateExpression } from "../expression";
import { assignPath } from "../statement";
import { buildScope } from "../scope";
import type { BuiltinCommand, CommandResult } from "./command";

/**
 * Handle the `min` builtin.
 * Syntax: min <arrayPath> as <var>
 * Finds the minimum numeric value in an array and stores it.
 */
export function handleMin(statement: string, locals: any): CommandResult {
  if (!statement.startsWith('min ')) return undefined;
  const rest = statement.slice(4).trim();
  const [pathPart, varPart] = rest.split(/\s+as\s+/);
  if (!pathPart) return undefined;
  const arr = evaluateExpression(pathPart, buildScope(locals));
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  const minVal = Math.min(...arr.map((v) => Number(v)));
  if (varPart) {
    assignPath(varPart, minVal, locals);
  }
  return minVal;
}

export const minCommand: BuiltinCommand = {
  prefix: ["min"],
  signature: "min <arrayPath> as <var>",
  description: "Finds minimum numeric value in an array",
  handler: handleMin,
};
