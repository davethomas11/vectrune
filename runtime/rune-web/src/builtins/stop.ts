// Builtin command: stop
import { STOP, type BuiltinCommand, type CommandResult } from "./command";

/**
 * Handle the `stop` builtin.
 * When encountered, execution should halt. Returning false signals the caller
 * to stop processing further statements.
 */
export function handleStop(statement: string, locals: any): CommandResult {
  if (statement.trim() !== STOP) return undefined;
  // Returning false will cause executeStatement to return false (stop).
  return STOP;
}

export const stopCommand: BuiltinCommand = {
  prefix: [STOP],
  signature: STOP,
  description: "Stops execution of the current script",
  handler: handleStop,
};
