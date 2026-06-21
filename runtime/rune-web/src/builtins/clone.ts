// Builtin command: clone
import { evaluateExpression } from "../expression";
import { assignPath } from "../statement";
import { buildScope } from "../scope";
import type { BuiltinCommand, CommandResult } from "./command";

/**
 * Handle the `clone` builtin.
 * Syntax: clone <srcPath> to <destPath>
 * Deep‑copies the value at srcPath into destPath.
 */
export function handleClone(statement: string, locals: any): CommandResult {
  if (!statement.startsWith('clone ')) return undefined;
  const rest = statement.slice(6).trim();
  const match = rest.match(/^(.*?)\s+to\s+(.*)$/);
  let src: string;
  let dest: string | null = null;
  if (!match) {
    src = rest;
  } else {
    src = match[1].trim();
    dest = match[2].trim();
  }
  if (!src) return undefined;
  const value = evaluateExpression(src, buildScope(locals));
  // Simple deep copy via JSON (good enough for primitives and plain objects/arrays)
  const copy = JSON.parse(JSON.stringify(value));
  if (dest) {
    assignPath(dest, copy, locals);
  }
  return copy;
}

export const cloneCommand: BuiltinCommand = {
  prefix: ["clone"],
  signature: "clone <srcPath> to <destPath>",
  description: "Deep‑copies a value from source to destination",
  handler: handleClone,
};
