// Builtin command: count
import { evaluateExpression } from "../expression";
import { assignPath } from "../statement";
import { buildScope } from "../scope";
import type { BuiltinCommand, CommandResult } from "./command";

/**
 * Handle the `count` builtin.
 * Syntax: count <path> as <var>
 * Evaluates the expression at <path> and stores its length (array length or object key count) into <var>.
 */
export function handleCount(statement: string, locals: any): CommandResult {
  if (!statement.startsWith('count ')) return undefined;
  const rest = statement.slice(6).trim();
  const [pathPart, varPart] = rest.split(/\s+as\s+/);
  if (!pathPart) return undefined;
  const value = evaluateExpression(pathPart, buildScope(locals));
  let count: number;
  if (Array.isArray(value)) {
    count = value.length;
  } else if (value && typeof value === 'object') {
    count = Object.keys(value).length;
  } else {
    count = 0;
  }
  if (varPart) {
    assignPath(varPart, count, locals);
  }
  return count;
}

export const countCommand: BuiltinCommand = {
  prefix: ["count"],
  signature: "count <path> as <var>",
  description: "Stores the length of an array or object keys count into a variable",
  handler: handleCount,
};
