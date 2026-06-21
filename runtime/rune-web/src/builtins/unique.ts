// Builtin command: unique
import { evaluateExpression } from "../expression";
import { assignPath } from "../statement";
import { buildScope } from "../scope";
import type { BuiltinCommand, CommandResult } from "./command";

/**
 * Handle the `unique` builtin.
 * Syntax: unique <arrayPath> as <var>
 * Removes duplicate values from an array and stores the deduped array.
 */
export function handleUnique(statement: string, locals: any): CommandResult {
  if (!statement.startsWith('unique ')) return undefined;
  const rest = statement.slice(7).trim();
  const [pathPart, varPart] = rest.split(/\s+as\s+/);
  if (!pathPart) return undefined;
  const arr = evaluateExpression(pathPart, buildScope(locals));
  if (!Array.isArray(arr)) return undefined;
  const uniq = Array.from(new Set(arr));
  if (varPart) {
    assignPath(varPart, uniq, locals);
  }
  return uniq;
}

export const uniqueCommand: BuiltinCommand = {
  prefix: ["unique"],
  signature: "unique <arrayPath> as <var>",
  description: "Removes duplicate entries from an array",
  handler: handleUnique,
};
