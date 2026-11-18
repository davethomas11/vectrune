// Builtin commands: fetch, fetch-json
//
// Browser code cannot block on the network, so there are two forms:
//   fetch <url> then <action> [catch <action>]       -> action({ status, ok, url, content_type, body })
//   fetch-json <url> then <action> [catch <action>]  -> action(parsedJson)
//   x = fetch-json <url> [catch <action>]            -> action step suspends, then resumes with x set
//                                                       (handled by executeSteps; see parseFetchAssignment)
// A failure calls the catch action with { status, message }, or logs a warning without one.
// The browser enforces CORS; see knowledge/runtime/fetch.md.
import { ctx } from "../context";
import { evaluateExpression } from "../expression";
import { buildScope } from "../scope";
import type { BuiltinCommand, CommandResult } from "./command";

export interface FetchLimits {
  timeoutMs: number;
  maxBodyBytes: number;
}

export const DEFAULT_FETCH_LIMITS: FetchLimits = { timeoutMs: 10_000, maxBodyBytes: 1024 * 1024 };

export interface FetchResult {
  status: number;
  ok: boolean;
  url: string;
  content_type: string;
  body: string;
}

/** `status` is the upstream HTTP status, or 0 when no response was received or accepted. */
export class FetchError extends Error {
  constructor(message: string, public status = 0) {
    super(message);
  }
}

/** Drops credentials, query and fragment so secrets in URLs never reach logs or actions. */
export function redactUrl(url: URL): string {
  const safe = new URL(url.href);
  safe.username = "";
  safe.password = "";
  safe.search = "";
  safe.hash = "";
  return safe.href;
}

function parseUrl(value: unknown): URL {
  if (typeof value !== "string" || !value) throw new FetchError("fetch: URL must be a non-empty string");
  const base = typeof location !== "undefined" ? location.href : undefined;
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    throw new FetchError("fetch: not a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new FetchError(`fetch: unsupported URL scheme '${url.protocol.slice(0, -1)}' (only http and https)`);
  }
  return url;
}

export async function runFetch(
  target: unknown,
  limits: FetchLimits = DEFAULT_FETCH_LIMITS,
): Promise<FetchResult> {
  const url = parseUrl(target);
  const shown = redactUrl(url);
  const tooLarge = () => new FetchError(`fetch: ${shown} response exceeded ${limits.maxBodyBytes} bytes`);

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, limits.timeoutMs);

  try {
    const response = await fetch(url.href, {
      method: "GET",
      redirect: "follow",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    const declared = Number(response.headers.get("content-length"));
    if (declared > limits.maxBodyBytes) throw tooLarge();

    // Content-Length can be absent or wrong, so enforce the cap while streaming.
    const chunks: Uint8Array[] = [];
    let total = 0;
    const reader = response.body?.getReader();
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > limits.maxBodyBytes) {
          await reader.cancel();
          throw tooLarge();
        }
        chunks.push(value);
      }
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return {
      status: response.status,
      ok: response.ok,
      url: response.url ? redactUrl(new URL(response.url)) : shown,
      content_type: response.headers.get("content-type") ?? "",
      body: new TextDecoder().decode(bytes),
    };
  } catch (error) {
    if (error instanceof FetchError) throw error;
    if (timedOut) throw new FetchError(`fetch: ${shown} timed out after ${limits.timeoutMs / 1000}s`);
    throw new FetchError(`fetch: request to ${shown} failed (network error or blocked by CORS)`);
  } finally {
    clearTimeout(timer);
  }
}

export async function runFetchJson(target: unknown, limits?: FetchLimits): Promise<unknown> {
  const result = await runFetch(target, limits);
  const shown = redactUrl(new URL(result.url));
  if (!result.ok) throw new FetchError(`fetch-json: ${shown} returned HTTP ${result.status}`, result.status);
  try {
    return JSON.parse(result.body);
  } catch {
    throw new FetchError(`fetch-json: ${shown} did not return valid JSON`, result.status);
  }
}

export interface FetchAssignment {
  target: string;
  kind: "fetch" | "fetch-json";
  urlExpr: string;
  onError?: string;
}

/** Matches `x = fetch <url> [catch <action>]` and `x = fetch-json <url> [catch <action>]`. */
export function parseFetchAssignment(statement: string): FetchAssignment | null {
  const match = statement
    .trim()
    .match(/^([A-Za-z_][\w.[\]'"]*)\s*=\s*(fetch|fetch-json)\s+(.+?)(?:\s+catch\s+(\S+))?$/);
  if (!match) return null;
  return { target: match[1], kind: match[2] as FetchAssignment["kind"], urlExpr: match[3], onError: match[4] };
}

/** Runs the request for an assignment form. Rejects with a FetchError. */
export function runFetchAssignment(pending: FetchAssignment, locals: any): Promise<unknown> {
  const run = pending.kind === "fetch" ? runFetch : runFetchJson;
  return Promise.resolve().then(() => run(evaluateExpression(pending.urlExpr, buildScope(locals, pending.urlExpr))));
}

/** Calls the catch action with { status, message }, or logs a warning when there is none. */
export function reportFetchFailure(error: unknown, onError?: string): void {
  const message = error instanceof Error ? error.message : String(error);
  if (onError) deliver(onError, { status: error instanceof FetchError ? error.status : 0, message });
  else console.warn(message);
}

function deliver(action: string, payload: unknown): void {
  const app = ctx().app;
  app.invokeAction(action, [payload]);
  app.render();
}

function makeHandler(name: "fetch" | "fetch-json") {
  return (statement: string, locals: any): CommandResult => {
    const match = statement
      .trim()
      .match(new RegExp(`^${name}\\s+(.+?)\\s+then\\s+(\\S+)(?:\\s+catch\\s+(\\S+))?$`));
    if (!match) return undefined;
    const [, urlExpr, onSuccess, onError] = match;

    const run = name === "fetch" ? runFetch : runFetchJson;
    Promise.resolve()
      .then(() => run(evaluateExpression(urlExpr, buildScope(locals, statement))))
      .then(
        (value) => deliver(onSuccess, value),
        (error) => reportFetchFailure(error, onError),
      );
    return true;
  };
}

export const fetchCommand: BuiltinCommand = {
  prefix: ["fetch"],
  signature: "fetch <url> then <action> [catch <action>]",
  description: "HTTP GET; calls the action with { status, ok, url, content_type, body }",
  handler: makeHandler("fetch"),
};

export const fetchJsonCommand: BuiltinCommand = {
  prefix: ["fetch-json"],
  signature: "fetch-json <url> then <action> [catch <action>]",
  description: "HTTP GET; calls the action with the parsed JSON, or the catch action on failure",
  handler: makeHandler("fetch-json"),
};
