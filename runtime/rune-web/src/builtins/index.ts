import { BuiltinCommand, CommandResult, NO_ACTION } from "./command";
import { logCommand } from "./log";
import { deleteCommand } from "./delete";
import { invertCommand } from "./invert";
import { incrementCommand } from "./increment";
import { decrementCommand } from "./decrement";
import { swapCommand } from "./swap";

// Mutable map for O(1) lookup of builtins
export const postfixMap: Record<string, BuiltinCommand> = {};
export const prefixMap: Record<string, BuiltinCommand> = {};
export const infixMap: Record<string, BuiltinCommand> = {};

// Imports required for when handling
import { evaluateExpression } from "../expression";
import { buildScope } from "../scope";
import { stopCommand } from "./stop";
import { pushCommand } from "./push";
import { maxCommand } from "./max";
import { minCommand } from "./min";
import { delayCommand } from "./delay";
import { uniqueCommand } from "./unique";
import { sumCommand } from "./sum";
import { randomizeCommand } from "./randomize";
import { countCommand } from "./count";
import { flattenCommand } from "./flatten";
import { avgCommand } from "./avg";
import { cloneCommand } from "./clone";

/** Register a builtin command */
export function registerCommand(cmd: BuiltinCommand): void {
  for (const name of cmd.prefix || []) {
    prefixMap[name] = cmd;
  }
  for (const name of cmd.postfix || []) {
    postfixMap[name] = cmd;
  }
  for (const name of cmd.infix || []) {
    infixMap[name] = cmd;
  }
}

// Register all builtins
registerCommand(logCommand);
registerCommand(deleteCommand);
registerCommand(invertCommand);
registerCommand(incrementCommand);
registerCommand(decrementCommand);
registerCommand(swapCommand);
registerCommand(stopCommand);
registerCommand(pushCommand);
registerCommand(maxCommand);
registerCommand(minCommand);
registerCommand(delayCommand);
registerCommand(uniqueCommand);
registerCommand(sumCommand);
registerCommand(randomizeCommand);
registerCommand(countCommand);
registerCommand(flattenCommand);
registerCommand(avgCommand);
registerCommand(cloneCommand);

/**
 * Process conditional 'when' suffix.
 * If the statement contains a ' when ' clause, evaluate the condition.
 * Returns the command part if condition true, or null to skip execution.
 */
export function handleWhen(statement: string, locals: any): string | null {
  const whenIndex = statement.lastIndexOf(' when ');
  if (whenIndex === -1) return statement;
  const conditionExpr = statement.slice(whenIndex + 6).trim();
  const commandPart = statement.slice(0, whenIndex).trim();
  const condResult = Boolean(evaluateExpression(conditionExpr, buildScope(locals)));
  return condResult ? commandPart : null;
}

/**
 * Dispatch a statement to the appropriate builtin handler.
 * Returns true if a builtin handled the statement; otherwise false.
 */
export function handleBuiltin(statement: string, locals: any): CommandResult {
  const cmd = getPrefixCmd(statement, locals) || getInfixCmd(statement, locals) || getPostfixCmd(statement, locals);
  if (!cmd) return undefined;
  // First, process any 'when' conditional
  const processed = handleWhen(statement, locals);
  if (processed === null) return NO_ACTION; // condition false, skip command
  const result = cmd.handler(processed, locals);
  return result !== undefined ? result : false;
}

function getPrefixCmd(statement: string, locals: any): BuiltinCommand | undefined {
  const trimmed = statement.trim();
  const firstSpace = trimmed.indexOf(' ');
  const cmdName = firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace);
  return prefixMap[cmdName]
}

function getInfixCmd(statement: string, locals: any): BuiltinCommand | undefined {
  const whenIdx = statement.lastIndexOf(' when ');
  const everythingBeforeWhen = whenIdx !== -1 ? statement.slice(0, whenIdx) : statement;
  const parts = everythingBeforeWhen.split(' ');
  for (const part of parts) {
    if (infixMap[part]) {
      return infixMap[part];
    }
  }
  return undefined;
}

function getPostfixCmd(statement: string, locals: any): BuiltinCommand | undefined {
  const whenIdx = statement.lastIndexOf(' when ');
  const everythingBeforeWhen = whenIdx !== -1 ? statement.slice(0, whenIdx).trim() : statement.trim();
  for (const cmd of Object.values(postfixMap)) {
    if (cmd.postfix?.some(cmd => everythingBeforeWhen.endsWith(cmd))) {
      return cmd;
    }
  }
  return undefined;
}

