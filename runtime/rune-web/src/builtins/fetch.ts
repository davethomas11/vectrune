// Builtin commands: fetch, fetch-json
//
// Browser code cannot block on the network, so there are two forms:
//   fetch <url> then <action> [catch <action>]       -> action({ status, ok, url, content_type, body })
//   fetch-json <url> then <action> [catch <action>]  -> action(parsedJson)
//   x = fetch-json <url> [catch <action>]            -> action step suspends, then resumes with x set
//                                                       (handled by executeSteps; see parseFetchAssignment)
// A failure calls the catch action with { status, message }, or logs a warning without one.
// The browser enforces CORS; see knowledge/runtime/fetch.md.
import { ctx, withContext } from "../context";
import { evaluateExpression } from "../expression";
import { buildScope } from "../scope";
import type { BuiltinCommand, CommandResult } from "./command";

export interface FetchLimits {
  timeoutMs: number;
  maxBodyBytes: number;
}

interface FetchOptions extends FetchLimits {
  headers?: Headers;
  redirect?: "follow" | "error";
}

export const DEFAULT_FETCH_LIMITS: FetchLimits = { timeoutMs: 10_000, maxBodyBytes: 1024 * 1024 };

const forbiddenHeaders = new Set([
  "accept-charset", "accept-encoding", "access-control-request-headers", "access-control-request-method",
  "connection", "content-length", "cookie", "cookie2", "date", "dnt", "expect", "host",
  "keep-alive", "origin", "permissions-policy", "referer", "set-cookie", "te", "trailer",
  "transfer-encoding", "upgrade", "user-agent", "via", "x-http-method", "x-http-method-override", "x-method-override",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseRequestOptions(value: unknown): FetchOptions {
  if (!isObject(value)) throw new FetchError("fetch: options must be an object");
  const options: FetchOptions = { ...DEFAULT_FETCH_LIMITS };
  const boundedInteger = (item: unknown, field: string, max: number): number => {
    if (typeof item === "number" && Number.isInteger(item) && item >= 1 && item <= max) return item;
    throw new FetchError(`fetch: ${field} must be an integer from 1 to ${max}`);
  };
  for (const [field, item] of Object.entries(value)) {
    switch (field) {
      case "timeout_ms":
        options.timeoutMs = boundedInteger(item, field, 60_000);
        break;
      case "max_body_bytes":
        options.maxBodyBytes = boundedInteger(item, field, 8 * 1024 * 1024);
        break;
      case "redirect":
        if (item !== "follow" && item !== "error") throw new FetchError("fetch: redirect must be follow or error");
        options.redirect = item;
        break;
      case "headers": {
        if (!isObject(item)) throw new FetchError("fetch: headers must be an object");
        const headers = new Headers();
        for (const [header, value] of Object.entries(item)) {
          const name = header.toLowerCase();
          if (!/^[!#$%&'*+.^_`|~0-9a-z-]+$/.test(name)) throw new FetchError("fetch: invalid header name");
          if (forbiddenHeaders.has(name) || name.startsWith("proxy-") || name.startsWith("sec-")) {
            throw new FetchError(`fetch: request header ${name} is not supported`);
          }
          if (typeof value !== "string") throw new FetchError("fetch: header values must be strings");
          if (/[^\t\x20-\x7e]/.test(value)) throw new FetchError("fetch: invalid header value");
          if (headers.has(name)) throw new FetchError("fetch: duplicate header name");
          headers.set(name, value);
        }
        if (Object.keys(item).length > 0) options.headers = headers;
        break;
      }
      default:
        throw new FetchError(`fetch: unknown option ${field}`);
    }
  }
  if (options.headers) {
    if (options.redirect === "follow") throw new FetchError("fetch: requests with custom headers cannot follow redirects");
    options.redirect = "error";
  }
  return options;
}

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
  limits: FetchOptions = DEFAULT_FETCH_LIMITS,
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
      redirect: limits.redirect ?? "follow",
      headers: limits.headers,
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
    const reason = limits.redirect === "error" ? "network error, redirect, or blocked by CORS" : "network error or blocked by CORS";
    throw new FetchError(`fetch: request to ${shown} failed (${reason})`);
  } finally {
    clearTimeout(timer);
  }
}

export async function runFetchJson(target: unknown, limits?: FetchOptions): Promise<unknown> {
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
  const context = ctx();
  return Promise.resolve().then(() => withContext(context, () => runRequest(pending.kind, pending.urlExpr, locals)));
}

function runRequest(kind: FetchAssignment["kind"], request: string, locals: Record<string, unknown>): Promise<unknown> {
  const options = request.match(/\s+options\s+([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)$/);
  const url = options ? request.slice(0, options.index) : request;
  const scope = buildScope(locals, request);
  const config = options ? parseRequestOptions(evaluateExpression(options[1], scope)) : undefined;
  return (kind === "fetch" ? runFetch : runFetchJson)(evaluateExpression(url, scope), config);
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
    const context = ctx();

    Promise.resolve()
      .then(() => withContext(context, () => runRequest(name, urlExpr, locals)))
      .then(
        (value) => withContext(context, () => deliver(onSuccess, value)),
        (error) => withContext(context, () => reportFetchFailure(error, onError)),
      );
    return true;
  };
}

export const fetchCommand: BuiltinCommand = {
  prefix: ["fetch"],
  signature: "fetch <url> [options <binding>] then <action> [catch <action>]",
  description: "HTTP GET; calls the action with { status, ok, url, content_type, body }",
  handler: makeHandler("fetch"),
};

export const fetchJsonCommand: BuiltinCommand = {
  prefix: ["fetch-json"],
  signature: "fetch-json <url> [options <binding>] then <action> [catch <action>]",
  description: "HTTP GET; calls the action with the parsed JSON, or the catch action on failure",
  handler: makeHandler("fetch-json"),
};
