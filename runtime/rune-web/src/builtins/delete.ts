// Builtin command: delete
import { deletePath } from "../statement";
import type { BuiltinCommand } from "./command";

export function handleDelete(statement: string, locals: any): boolean | undefined {
  if (!statement.startsWith("delete ")) return undefined;
  const path = statement.slice(7).trim();
  deletePath(path, locals);
  return true;
}

export const deleteCommand: BuiltinCommand = {
  prefix: ["delete", "del", "rm", "remove", "rmv", "destroy"],
  signature: "delete <path>",
  description: "Deletes a value at the given path from locals",
  handler: handleDelete,
};
