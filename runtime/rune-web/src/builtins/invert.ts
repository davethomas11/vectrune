// Builtin command: invert (boolean toggle)
import { evaluateExpression } from "../expression";
import { assignPath } from "../statement";
import { buildScope } from "../scope";
import type { BuiltinCommand, CommandResult } from "./command";

/**
 * Handle the `invert` builtin.
 * Syntax: invert <path>
 * Evaluates the expression at the given path, coerces to boolean, and writes the negated value back.
 */
export function handleInvert(statement: string, locals: any): CommandResult {
  if (!statement.startsWith("invert ")) return undefined;
  const path = statement.slice(7).trim();
  const current = Boolean(evaluateExpression(path, buildScope(locals)));
  assignPath(path, !current, locals);
  return !current;
}

export const invertCommand: BuiltinCommand = {
  prefix: ["invert"],
  signature: "invert <path>",
  description: "Inverts a boolean value at the given path",
  handler: handleInvert,
};
