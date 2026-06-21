// Builtin command: log
import { interpolate } from "../interpolation";
import { buildScope } from "../scope";
import type { BuiltinCommand, CommandResult } from "./command";

export function handleLog(statement: string, locals: any): CommandResult {
  if (!statement.startsWith("log ")) return undefined;
  const msg = interpolate(statement.slice(4), buildScope(locals));
  console.log(msg);
  return msg;
}

export const logCommand: BuiltinCommand = {
  prefix: ["log"],
  signature: "log <expression>",
  description: "Logs the interpolated expression to the console",
  handler: handleLog,
};
