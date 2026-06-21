// Builtin command: randomize
import { evaluateExpression } from "../expression";
import { assignPath } from "../statement";
import { buildScope } from "../scope";
import type { BuiltinCommand, CommandResult } from "./command";

/**
 * Handle the `randomize` builtin.
 * Supports two forms:
 *   1. randomize <min> <max> as <var>   – generates a random integer in [min, max]
 *   2. randomize <arrayPath> as <var>   – shuffles an array and stores the result.
 */
export function handleRandomize(statement: string, locals: any): CommandResult {
    if (!statement.startsWith('randomize ')) return undefined;
    const rest = statement.slice(9).trim();
    const parts = rest.split(/\s+/);

    // Form 1: numeric range
    if (parts.length >= 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
        const min = Number(parts[0]);
        const max = Number(parts[1]);
        let varName: string | undefined;
        if (parts.length > 3 && parts[2] === 'as') {
            varName = parts[3];
        }
        const rand = Math.floor(Math.random() * (max - min + 1)) + min;
        if (varName) {
            assignPath(varName, rand, locals);
        }
        return rand;
    }

    // Form 2: shuffle array
    const asIndex = parts.indexOf('as');
    if (parts.length >= 1) {
        const pathExpr = parts.slice(0, asIndex).join(' ');
        const varName = parts[asIndex + 1];
        const arr = evaluateExpression(pathExpr, buildScope(locals));
        if (!Array.isArray(arr)) return undefined;
        const shuffled = arr.slice();
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        if (varName) {
            assignPath(varName, shuffled, locals);
        }
        return shuffled;
    }

    return undefined;
}

export const randomizeCommand: BuiltinCommand = {
    prefix: ["randomize"],
    signature: "randomize <min> <max> as <var> | randomize <arrayPath> as <var>",
    description: "Generates a random number in a range or shuffles an array",
    handler: handleRandomize,
};
