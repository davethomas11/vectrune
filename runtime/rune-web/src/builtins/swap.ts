// Builtin command: swap
import { evaluateExpression } from "../expression";
import { assignPath } from "../statement";
import { buildScope } from "../scope";
import type { BuiltinCommand } from "./command";

export function handleSwap(statement: string, locals: any): boolean | undefined {
  if (!statement.startsWith('swap ')) return undefined;
  const tokens = statement.split(/\s+/);
  if (tokens.length < 3) return undefined;
  const targetPath = tokens[1];
  if (tokens.length === 3) {
    const val = evaluateExpression(tokens[2], buildScope(locals));
    assignPath(targetPath, val, locals);
    return true;
  }
  const aExpr = tokens[2];
  const bExpr = tokens[3];
  const aValue = evaluateExpression(aExpr, buildScope(locals));
  const bValue = evaluateExpression(bExpr, buildScope(locals));
  const current = evaluateExpression(targetPath, buildScope(locals));
  if (current === aValue) {
    assignPath(targetPath, bValue, locals);
  } else {
    assignPath(targetPath, aValue, locals);
  }
  return true;
}

export const swapCommand: BuiltinCommand = {
  prefix: ["swap"],
  signature: "swap <path> <A> <B>",
  description: "Swaps the values of A and B at path",
  handler: handleSwap,
};