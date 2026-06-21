// Builtin command: sum
import { evaluateExpression } from "../expression";
import { assignPath } from "../statement";
import { buildScope } from "../scope";
import type { BuiltinCommand, CommandResult } from "./command";

/**
 * Handle the `sum` builtin.
 * Syntax: sum <arrayPath> as <var>
 * Calculates the numeric sum of the array elements and stores the result.
 */
export function handleSum(statement: string, locals: any): CommandResult {
  if (!statement.startsWith('sum ')) return undefined;
  const rest = statement.slice(4).trim();
  const [pathPart, varPart] = rest.split(/\s+as\s+/);
  if (!pathPart) return undefined;
  const arr = evaluateExpression(pathPart, buildScope(locals));
  if (!Array.isArray(arr)) return undefined;
  const total = arr.reduce((acc: number, cur: any) => acc + Number(cur), 0);
  if (varPart) {
    assignPath(varPart, total, locals);
  }
  return total;
}

export const sumCommand: BuiltinCommand = {
  prefix: ["sum"],
  signature: "sum <arrayPath> as <var>",
  description: "Sums numeric values in an array and stores the result",
  handler: handleSum,
};
