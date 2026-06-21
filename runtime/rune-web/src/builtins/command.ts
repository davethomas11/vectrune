// do_not_action: a constant that is returned by a builtin command to indicate that no action should be taken
export const STOP = "stop";
export const NO_ACTION = "do_not_action";
export type CommandResult = boolean | typeof STOP | undefined | number | string | Array<unknown> | typeof NO_ACTION;

// Builtin command type definition
export interface BuiltinCommand {
  /** Name of the builtin, as used in a rune script */
  prefix?: string[];
  postfix?: string[];
  infix?: string[];
  /** Signature showing the expected usage, e.g. "log <expr>" */
  signature: string;
  /** Optional short description */
  description?: string;
  /** Handler function – returns true if handled, undefined if not a match */
  handler: (statement: string, locals: any) => CommandResult;
}
