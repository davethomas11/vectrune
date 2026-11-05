// Builtin command: timer controls (start-timer, stop-timer)
import { ctx } from "../context";
import type { BuiltinCommand, CommandResult } from "./command";

export function handleStartTimer(statement: string, _locals: any): CommandResult {
  if (!statement.startsWith("start-timer ") && !statement.startsWith("interval ")) return undefined;
  const rest = statement.startsWith("start-timer ") ? statement.slice(12).trim() : statement.slice(9).trim();
  const match = rest.match(/^([A-Za-z_][\w-]*)\s*([0-9]*\.?[0-9]+)\s*(ms|s)?$/i);
  if (!match) return undefined;
  const action = match[1];
  let ms = Number(match[2]);
  if (match[3]?.toLowerCase() === "s") ms *= 1000;
  const app = ctx().app;
  if (app.startTimer) {
    app.startTimer(action, ms);
  }
  return true;
}

export function handleStopTimer(statement: string, _locals: any): CommandResult {
  const trimmed = statement.trim();
  if (trimmed !== "stop-timer" && trimmed !== "clear-timer" && trimmed !== "clear-interval") return undefined;
  const app = ctx().app;
  if (app.stopTimer) {
    app.stopTimer();
  }
  return true;
}

export const startTimerCommand: BuiltinCommand = {
  prefix: ["start-timer", "interval"],
  signature: "start-timer <action> <duration>ms",
  description: "Starts a periodic timer calling the named action",
  handler: handleStartTimer,
};

export const stopTimerCommand: BuiltinCommand = {
  prefix: ["stop-timer", "clear-timer", "clear-interval"],
  signature: "stop-timer",
  description: "Stops the active periodic timer",
  handler: handleStopTimer,
};
