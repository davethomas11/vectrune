# fetch, fetch-json and @Values

Outbound HTTP GET for Rune apps. Server and Rune-Web share the names, the assignment form, `catch`/`then` clauses and the limits.
In Rune-Web the assignment form suspends the action while the request runs, because browsers cannot block on the network.

## Forms (both runtimes)

| Form | Result |
| --- | --- |
| `x = fetch-json url` | `x` is the parsed JSON |
| `x = fetch url` | `x` is `{ status, ok, url, content_type, body }` (non-2xx is returned, not raised) |
| `x = fetch-json url catch handler` | on failure `handler` is called with `{ status, message }` |
| `fetch-json url then handler [catch handler]` | success calls `handler` with the value |

`status` in an error is the upstream HTTP status, or `0` when no response was received (network, CORS, timeout, size, bad JSON on a 2xx).

## Server (REST, GraphQL, WebSocket routes)

```rune
@Values
weather_url = "https://api.open-meteo.com/v1/forecast?latitude=49.28&longitude=-123.12&current=temperature_2m"

@Route/GET /weather
run:
    weather = fetch-json weather_url
    respond 200 weather

@Route/GET /weather-explicit
run:
    response = fetch weather_url
    weather = parse-json response.body
    respond 200 weather
```

Run it: `vectrune examples/weather.rune`, then `curl localhost:3000/weather`.

- `fetch url` assigns `{ status, ok, url, content_type, body }`. A non-2xx status is returned, not raised.
- `fetch-json url` assigns parsed JSON. A non-2xx or non-JSON answer responds `502`; a timeout responds `504`.
- `url` is a literal `http://` / `https://` URL, or a name resolved from context (including `@Values`). Other schemes are rejected (500).
- `catch <func>` / `then <func>` call a `func` defined earlier in the route. The handler reads its argument as `$1`. With `x = ... catch f`, a response produced by `f` is assigned to `x`, and the route continues. Server `func` support is basic: `respond 200 $1` works, but path reads like `$1.message` are not expanded by `respond`. An undefined handler is a 500.
- Without `catch`, failures end the route.
- Limits (not configurable yet): 10s total timeout, 5 redirects, 1 MiB response body. Exceeding them responds `502`/`504`.
- Error messages omit credentials, query string and fragment, so API keys in URLs are not echoed.
- `@Values` names are seeded after request data and are read-only (assignment or `delete` fails with 500).

## Rune-Web

```rune
@Page/weather
logic = weather
state:
    url = "https://api.open-meteo.com/v1/forecast?latitude=49.28&longitude=-123.12&current=temperature_2m"
    temperature = "?"
    error = ""
view:
    main:
        h1 "Vancouver: {temperature}°C"
        p "{error}"
        button click="loadWeather()" "Refresh"

@Logic/weather
action loadWeather():
    weather = fetch-json url catch weatherFailed
    temperature = weather.current.temperature_2m
    error = ""

action weatherFailed(failure):
    error = failure.message
```

Full example: `examples/weather_web.rune` (`vectrune examples/weather_web.rune`).

- `x = fetch-json <url> [catch <action>]` is a **top-level action step**. The action pauses there, and the remaining steps run when the response arrives, followed by a re-render. `x` is assigned like any other step (a local if one exists, otherwise page state).
- `x = fetch ...` followed by `y = parse-json x.body` is the explicit form; `parse-json` is also new in Rune-Web (`x = parse-json <string expr>`, invalid JSON throws).
- Inside `if` or `for` blocks the assignment form throws a clear error. Use the callback form there: `fetch-json <url> then <action> [catch <action>]` (the `then` action receives the value; `catch` receives `{ status, message }`).
- On failure the remaining steps are skipped and the `catch` action runs. Without `catch`, a warning is logged.
- Overlapping runs are not serialized: a second click while a request is pending starts a second request.
- `<url>` is an expression: a quoted string or a state/local variable. Relative URLs resolve against the page.
- `@Values` is **not** supported in Rune-Web; keep URLs in `@State` or literals.

### CORS and browser limits

- The browser enforces CORS. The target must send `Access-Control-Allow-Origin` for your page's origin, or the request fails with `status: 0` ("network error or blocked by CORS"). A CORS block cannot be told apart from a network failure.
- Only simple GETs are sent: no custom headers, `credentials: "omit"` (no cookies), no referrer. This avoids preflight requests.
- An `https://` page cannot fetch `http://` URLs (mixed content), except `localhost` in most browsers.
- Redirects are followed using the browser's own limit, not 5. Cross-origin redirects must also satisfy CORS.
- The 10s timeout and 1 MiB cap are enforced in the runtime while streaming.
- If an API lacks CORS, call it from a server route with `fetch-json` and have the page call that route.
- Anything in a Rune-Web page, including URLs and keys, is visible to the user. Put secrets in server `@Values`, not in the page.

## Not implemented yet

Methods other than GET, fetch assignment inside nested Rune-Web blocks, serialized/cancellable requests, headers, request bodies, authentication, query-parameter helpers, configurable timeouts, outbound-host allow lists, environment-backed values, `@Every` scheduling, and `@Values` in Rune-Web.

## Sources

`src/builtins/builtin/http_fetch.rs`, `src/core/mod.rs`, `runtime/rune-web/src/builtins/fetch.ts`, `tests/fetch_builtin.rs`, `runtime/rune-web/tests/builtins/fetch.test.ts`, `examples/weather.rune`.
