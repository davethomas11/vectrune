// Builtin command: avg
import { evaluateExpression } from "../expression";
import { assignPath } from "../statement";
import { buildScope } from "../scope";
import type { BuiltinCommand, CommandResult } from "./command";

/**
 * Handle the `avg` builtin.
 * Syntax: avg <arrayPath> as <var>
 * Computes the average of numeric values in an array and stores the result.
 */
export function handleAvg(statement: string, locals: any): CommandResult {
  if (!statement.startsWith('avg ')) return undefined;
  const rest = statement.slice(4).trim();
  const [pathPart, varPart] = rest.split(/\s+as\s+/);
  if (!pathPart) return undefined;
  const arr = evaluateExpression(pathPart, buildScope(locals));
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  const total = arr.reduce((acc: number, cur: any) => acc + Number(cur), 0);
  const avg = total / arr.length;
  if (varPart) {
    assignPath(varPart, avg, locals);
  }
  return avg;
}

export const avgCommand: BuiltinCommand = {
  prefix: ["avg"],
  signature: "avg <arrayPath> as <var>",
  description: "Computes average of numeric array values",
  handler: handleAvg,
};
