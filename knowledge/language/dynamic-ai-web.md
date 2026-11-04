# Dynamic AI sites

`@App type = dynamic-ai-web` serves a website and JSON APIs from a descriptive Rune document. An AI engine generates each declared response. This is an experimental, native-server application mode.

```rune
@App
name = Little Cafe
type = dynamic-ai-web
engine = ollama
model = phi4

@Site
title = Little Cafe
style = Responsive, accessible, teal and coral, with inline styles.

@Data/Menu
+ id = tea
  name = Tea
  price = 3

@Page/home
path = /
description = Make a friendly cafe homepage using Data/Menu. Include a form that sends JSON to /api/recommend.

@Route/POST /api/recommend
response = json
description = Read the request preferences, choose an item from Data/Menu, and return its id, name and a short reason as JSON.
```

There is no `view:` tree or `run:` block to implement in this mode. The document describes the response; the engine supplies HTML or JSON. Generated APIs return data only. Persistence, authorization, transactions, and external business actions require separate application logic.

## Describing a site

- `@Site` holds shared identity, tone, layout and style instructions.
- `@Content/<name>` holds prose and other content.
- `@Data/<name>` holds grounding data, including `+` records.
- `@Schema/<name>` may describe data shapes to the engine. This mode currently validates JSON syntax rather than enforcing these schemas.
- `@Page/<name>` describes an HTML page. `path` selects its URL; `home` and `index` default to `/`, and other names default to `/<name>`.
- `@Route/METHOD /path` describes a JSON endpoint. GET, POST, PUT, PATCH and DELETE are supported; named parameters such as `/api/items/{id}` are available to the engine.

Only declared paths invoke the engine. Unknown paths return 404 and unsupported methods return 405. HEAD checks on GET routes return headers without generating a response. `run:` blocks on AI routes are rejected instead of being silently executed or ignored.

The generation prompt includes the public Site, Content, Data and Schema sections, the page/API definitions, and the current request's method, route template, decoded path parameters, raw query string and parsed JSON body. Incoming headers, cookies, authorization values, App configuration, and source file paths are excluded. Put public content in these descriptive sections.

## Engines

### Ollama

```rune
@App
type = dynamic-ai-web
engine = ollama
model = phi4
endpoint = http://127.0.0.1:11434/api/generate
```

Run Ollama with the model available locally. The adapter uses `/api/generate` with `stream = false`; JSON endpoints also request `format = json`. `endpoint` is the full generation URL. When omitted, `VECTRUNE_OLLAMA_URL` is used, then the local URL above.

### Codex CLI

```rune
@App
type = dynamic-ai-web
engine = codex
```

Install and authenticate Codex CLI first. The adapter uses `codex exec`, reads the prompt from stdin, and captures its final stdout response. It uses an ephemeral run in an empty temporary workspace, read-only sandboxing, no command execution, disabled plugins/hooks/delegation, and disabled web search. User config is not loaded; saved CLI authentication is retained. The adapter has been exercised with Codex CLI 0.164.0.

### Copilot CLI

```rune
@App
type = dynamic-ai-web
engine = copilot
```

Install and authenticate GitHub Copilot CLI first. The adapter pipes the prompt to noninteractive silent mode, selects an empty tool allowlist, denies shell/read/write/URL/memory permissions, and disables built-in MCPs and custom instructions. It runs in an empty temporary workspace. The adapter has been exercised with Copilot CLI 1.0.21.

`codex-cli` and `copilot-cli` are accepted aliases. When switching from Ollama, remove `model = phi4` or choose a model supported by the selected CLI. Without a model setting, a CLI uses its own model default. CLI account access, provider retention, and usage limits still apply. CLI restrictions are generation controls, not a substitute for isolating a publicly deployed server.

Prompts go through stdin and processes are launched directly, without a shell. HTTP input cannot choose an executable, model, endpoint, tool permissions, or engine. A timed-out process is killed; stdout and stderr reads are bounded. Backend stderr is excluded from HTTP error responses.

## Configuration

All fields belong to `@App`.

| Field | Default | Meaning |
| --- | --- | --- |
| `engine` | `ollama` | `ollama`, `codex`, or `copilot` |
| `model` | Environment, then `phi4` for Ollama or CLI default | Explicit model; `VECTRUNE_AI_MODEL` supplies the environment fallback |
| `endpoint` | Environment, then local Ollama URL | Ollama generation endpoint |
| `executable` | `codex` or `copilot` from PATH | Optional trusted CLI executable path; no extra arguments or shell expansion |
| `timeout_seconds` | 120 | Generation deadline, 1–600 seconds |
| `max_concurrent` | 2 | Concurrent generation limit, 1–32 |
| `cache_seconds` | 60 | Server-side page cache lifetime, 0–86400; zero disables caching |
| `cache_entries` | 32 | Maximum cached pages, 1–256 |
| `host`, `port` | `127.0.0.1`, 3000 | Standard server settings, overridable with CLI flags |

A relative executable containing a directory component is resolved from the Rune source directory. A simple executable name is found through PATH. Executable configuration is trusted application configuration, not a request parameter.

## Generation progress and server logs

Browser HTML requests on a cache miss immediately receive a built-in Vectrune thinking page with rotating messages, elapsed seconds and reduced-motion support. It fetches the same URL once with `Accept: application/vnd.vectrune.generated-html`, then replaces itself with the generated document, including its inline scripts. Cached pages open directly. API routes never receive a thinking page.

The generation fetch retains normal HTTP failure statuses. On a timeout, busy engine or generation error, the thinking page shows an error and a manual retry button; it does not repeatedly spend AI requests. JavaScript is required for this progress UI. For direct HTML without the UI, use the generated-HTML Accept header; clients without `Accept: text/html` (including ordinary curl requests) also receive direct output. GET requests with a JSON body receive direct output to preserve their request data.

At Info level the native server logs each matched request, generation start, completion, cache hit and thinking-page delivery. Logs include a request ID, method, route template, engine, elapsed milliseconds, generation milliseconds and output bytes where relevant. Timeouts, busy capacity and invalid output are logged too. URL parameter values, query strings, request bodies and prompts are excluded. A browser's initial thinking-page request and its generation fetch have separate IDs.

Example server messages:

```text
[INFO] dynamic-ai-web request=2 GET / engine=ollama Generating page cache=miss elapsed_ms=0
[INFO] dynamic-ai-web request=2 GET / engine=ollama Generated page status=200 generation_ms=12500 bytes=4454 cached=true elapsed_ms=12501
[INFO] dynamic-ai-web request=3 GET / engine=ollama Serving page from cache cache=hit elapsed_ms=0
```

## Requests, caching, and output

Nonempty request bodies must be JSON and are limited to 64 KiB. Combined site/route descriptions are limited to 128 KiB, and the full prompt is limited to 256 KiB. Generated responses are limited to 1 MiB.

The cache is implemented by the reusable native [`TtlCache<K, V>` module](../../src/cache.rs), with synchronization supplied by each caller. It supports bounded entries and insertion-based expiration; zero capacity or TTL disables storage. It is a Rust runtime utility, not yet a Rune builtin or cross-process cache.

Pages are cached by route, path parameters, query and JSON body. The cache expires entries and evicts the earliest-expiring entry at capacity. API responses are always generated anew. Concurrent misses can generate independently; the cache is process-local. `--watch` rebuilds the app and clears its cache when Rune sources change.

Responses include `X-Vectrune-AI-Engine` and `X-Vectrune-AI-Cache` (`hit`, `miss`, `disabled`, or `pending` for the thinking page). Browser/proxy caching is disabled with `Cache-Control: no-store`.

HTML output must be a complete document. Its content policy permits inline styles/scripts, data images, and same-origin API connections, while blocking remote assets, external scripts, framing and foreign form targets. Generated sites should use inline CSS rather than CDNs. JSON must parse successfully. A single surrounding markdown code fence is accepted; commentary or invalid output is rejected.

| Status | Meaning |
| --- | --- |
| 400 | Request body is not valid JSON |
| 413 | Request body or complete prompt is too large |
| 500 | Invalid site configuration |
| 502 | Engine failure, excessive output, or invalid generated HTML/JSON |
| 503 | All generation slots are busy; includes `Retry-After: 1` |
| 504 | Generation deadline exceeded |

AI responses are nondeterministic and their content depends on the model. JSON validity is checked; factual correctness, UI accessibility, and response-contract semantics remain model-dependent. The mode serves live HTTP responses; `-o html` export remains a Rune-Web/static frontend feature. The browser teaching sandbox does not run AI providers.

## Try the example

```sh
cargo run -- examples/dynamic_ai_web.rune --watch
# Open http://127.0.0.1:3000/
curl http://127.0.0.1:3000/api/menu
curl -H 'Content-Type: application/json' -d '{"preferences":"vegan and creamy"}' http://127.0.0.1:3000/api/recommend
```

Ready-to-run CLI variants (install and authenticate the corresponding CLI first):

```sh
cargo run -- examples/dynamic_ai_web_codex.rune --watch
cargo run -- examples/dynamic_ai_web_copilot.rune --watch
```

Run one at a time, or pass different `--port` values. These variants use their CLI's default model rather than `phi4`.

The [complete cafe](../../examples/dynamic_ai_web.rune) contains only descriptions and menu records. It generates a homepage, a menu page, and two AI-backed APIs. The existing `vectrune --ai` CLI shortcut is separate from this server mode.

## Sources and extension points

- [Routing, limits, prompt construction and caching](../../src/apps/dynamic_ai_web/mod.rs)
- [AiEngine trait and Ollama/Codex/Copilot adapters](../../src/apps/dynamic_ai_web/engine.rs)
- [Deterministic HTTP/provider tests](../../tests/dynamic_ai_web.rs)
- [CLI isolation, prompt piping and cancellation tests](../../tests/dynamic_ai_cli.rs)
- [Ollama generation API](https://docs.ollama.com/api/generate)
- [Codex noninteractive mode](https://developers.openai.com/codex/noninteractive)
- [Copilot programmatic invocation](https://docs.github.com/en/copilot/how-tos/copilot-cli/automate-copilot-cli/run-cli-programmatically)

New providers implement `AiEngine` and are registered in the configuration/factory. `router_with_engine` supports deterministic providers for tests and embedding.
