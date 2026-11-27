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

## Request options

Pass a binding after `options` in either form, before any `then` or `catch` clause.

```rune
request_options = { headers: { "Accept": "application/json", "X-Client": "rune-demo" }, timeout_ms: 3000, max_body_bytes: 262144 }
weather = fetch-json weather_url options request_options
```

| Field | Behavior |
| --- | --- |
| `headers` | A map of HTTP header names to ASCII strings. Transport and browser-controlled headers such as `Host`, `Cookie`, and `Content-Length` are rejected. |
| `timeout_ms` | Total request and response-read timeout in milliseconds, 1–60000. Defaults to 10000. |
| `max_body_bytes` | Response cap in bytes, 1–8388608. Defaults to 1048576. |
| `redirect` | `"follow"` uses the host's redirect limit. `"error"` rejects redirects. A request with custom headers uses `"error"` to keep those headers on the original request. |

Unknown fields and malformed options are rejected before the request.

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

Run it: `vectrune examples/api/weather.rune`, then `curl localhost:3000/weather`.

- `fetch url` assigns `{ status, ok, url, content_type, body }`. A non-2xx status is returned, not raised.
- `fetch-json url` assigns parsed JSON. A non-2xx or non-JSON answer responds `502`; a timeout responds `504`.
- `url` is a literal `http://` / `https://` URL, or a name resolved from context (including `@Values`). Other schemes are rejected (500).
- `catch <func>` / `then <func>` call a `func` defined earlier in the route. The handler reads its argument as `$1`. With `x = ... catch f`, a response produced by `f` is assigned to `x`, and the route continues. Server `func` support is basic: `respond 200 $1` works, but path reads like `$1.message` are not expanded by `respond`. An undefined handler is a 500.
- Without `catch`, failures end the route.
- Defaults are a 10-second total timeout, up to five redirects, and a 1 MiB response body. Size and redirect errors respond `502`, and timeouts respond `504`.
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

Full example: `examples/rune-web/weather_web.rune` (`vectrune examples/rune-web/weather_web.rune`).
The weather page starts with Vancouver, or the user's device location when
browser permission is already granted. Search uses Open-Meteo's geocoding API;
the OpenStreetMap tile map also permits choosing a point. Weather is requested
only when the visitor selects **Check weather**, using `timezone=auto` and
displaying the returned timezone. A reading is cleared when the selected place
changes; a failed refresh retains and labels the last reading for that same
place. Search, geolocation and weather requests use generation tokens so late
results cannot replace a newer choice. Browser networking and CORS still apply.
Search text and chosen coordinates are sent to Open-Meteo; map tiles go to
OpenStreetMap. Both providers receive the browser's IP address. Device
geolocation requires permission and generally HTTPS or localhost. See the
[Rune-Web guide](../language/rune-web-guide.md) for map and permission details.

- `x = fetch-json <url> [catch <action>]` is a **top-level action step**. The action pauses there, and the remaining steps run when the response arrives, followed by a re-render. `x` is assigned like any other step (a local if one exists, otherwise page state).
- `x = fetch ...` followed by `y = parse-json x.body` is the explicit form; `parse-json` is also new in Rune-Web (`x = parse-json <string expr>`, invalid JSON throws).
- Inside `if` or `for` blocks the assignment form throws a clear error. Use the callback form there: `fetch-json <url> then <action> [catch <action>]` (the `then` action receives the value; `catch` receives `{ status, message }`).
- On failure the remaining steps are skipped and the `catch` action runs with
  the requesting action's local bindings available; without `catch`, a warning
  is logged. Parameters can carry request tokens for stale-result checks.
- Overlapping runs are not serialized: a second click while a request is pending starts a second request.
- `<url>` is an expression: a quoted string or a state/local variable. Relative URLs resolve against the page.
- `@Values` is **not** supported in Rune-Web; keep URLs in `@State` or literals.

### CORS and browser limits

- The browser enforces CORS. The target must send `Access-Control-Allow-Origin` for your page's origin, or the request fails with `status: 0` ("network error or blocked by CORS"). A CORS block cannot be told apart from a network failure.
- Requests use GET with `credentials: "omit"` and no referrer. Custom headers can trigger a CORS preflight and must be allowed by the target.
- An `https://` page cannot fetch `http://` URLs (mixed content), except `localhost` in most browsers.
- When redirects are enabled, the browser applies its own limit and CORS rules.
- The timeout and response cap are enforced while streaming.
- If an API lacks CORS, call it from a server route with `fetch-json` and have the page call that route.
- Anything in a Rune-Web page, including URLs and keys, is visible to the user. Put secrets in server `@Values`, not in the page.

## Not implemented yet

Methods other than GET, fetch assignment inside nested Rune-Web blocks, serialized/cancellable requests, request bodies, query-parameter builders, outbound-host allow lists, environment-backed values, `@Every` scheduling, and `@Values` in Rune-Web. Rune-Web provides `url_encode(value)` for an individual URL component.

## Sources

`src/builtins/builtin/http_fetch.rs`, `src/core/mod.rs`, `runtime/rune-web/src/builtins/fetch.ts`, `tests/fetch_builtin.rs`, `runtime/rune-web/tests/builtins/fetch.test.ts`, `examples/api/weather.rune`.
