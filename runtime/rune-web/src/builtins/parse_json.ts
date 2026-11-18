// Builtin command: parse-json
import { evaluateExpression } from "../expression";
import { buildScope } from "../scope";
import type { BuiltinCommand, CommandResult } from "./command";

/** `x = parse-json response.body` returns the parsed value; invalid JSON throws. */
export function handleParseJson(statement: string, locals: any): CommandResult {
  const match = statement.trim().match(/^parse-json\s+(.+)$/);
  if (!match) return undefined;
  const source = evaluateExpression(match[1], buildScope(locals, statement));
  if (typeof source !== "string") throw new Error("parse-json: expected a string");
  try {
    return JSON.parse(source) as CommandResult;
  } catch {
    throw new Error("parse-json: invalid JSON");
  }
}

export const parseJsonCommand: BuiltinCommand = {
  prefix: ["parse-json"],
  signature: "x = parse-json <expr>",
  description: "Parses a JSON string and returns the value",
  handler: handleParseJson,
};
