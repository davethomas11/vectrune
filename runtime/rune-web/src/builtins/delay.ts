// Builtin command: delay
import type { BuiltinCommand, CommandResult } from "./command";

/**
 * Handle the `delay` builtin.
 * Syntax: delay <duration>ms
 * Blocks execution for the given number of milliseconds using a simple busy‑wait.
 */
export function handleDelay(statement: string, locals: any): CommandResult {
  if (!statement.startsWith('delay ')) return undefined;
  const rest = statement.slice(6).trim();
  // Accept "500", "500ms", or "0.5s" (seconds) – we normalize to ms
  const msMatch = rest.match(/^([0-9]*\.?[0-9]+)\s*(ms|s)?$/i);
  if (!msMatch) return undefined;
  let ms = Number(msMatch[1]);
  const unit = msMatch[2] ? msMatch[2].toLowerCase() : 'ms';
  if (unit === 's') ms *= 1000;
  const start = Date.now();
  while (Date.now() - start < ms) {
    // busy‑wait – acceptable for short delays in this sandbox
  }
  return true;
}

export const delayCommand: BuiltinCommand = {
  prefix: ["delay"],
  signature: "delay <duration>ms",
  description: "Pauses execution for a given number of milliseconds",
  handler: handleDelay,
};
