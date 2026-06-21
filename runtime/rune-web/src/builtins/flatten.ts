// Builtin command: flatten
import { evaluateExpression } from "../expression";
import { assignPath } from "../statement";
import { buildScope } from "../scope";
import type { BuiltinCommand, CommandResult } from "./command";

/**
 * Handle the `flatten` builtin.
 * Syntax: flatten <arrayPath> as <var>
 * Flattens a nested array (any depth) into a single‑dimensional array.
 */
export function handleFlatten(statement: string, locals: any): CommandResult {
  if (!statement.startsWith('flatten ')) return undefined;
  const rest = statement.slice(8).trim();
  const [pathPart, varPart] = rest.split(/\s+as\s+/);
  if (!pathPart) return undefined;
  const value = evaluateExpression(pathPart, buildScope(locals));
  if (!Array.isArray(value)) return undefined;
  const flatten = (arr: any[]): any[] => {
    const out: any[] = [];
    for (const item of arr) {
      if (Array.isArray(item)) {
        out.push(...flatten(item));
      } else {
        out.push(item);
      }
    }
    return out;
  };
  const flat = flatten(value);
  if (varPart) {
    assignPath(varPart, flat, locals);
  }
  return flat;
}

export const flattenCommand: BuiltinCommand = {
  prefix: ["flatten"],
  signature: "flatten <arrayPath> as <var>",
  description: "Flattens a nested array into a one‑dimensional array",
  handler: handleFlatten,
};
