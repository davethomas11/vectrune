//! `fetch` and `fetch-json`: small, safe-by-default outbound HTTP GET.
//!
//! Both share one request path (`get`) so limits and error behavior never drift.

use crate::builtins::{BuiltinResult, Context, LAST_EXEC_RESULT};
use crate::builtins::builtin::function::invoke_func;
use crate::core::{resolve_path, AppState};
use reqwest::{redirect::Policy, Client, Url};
use serde_json::{json, Value as JsonValue};
use std::time::Duration;

#[derive(Clone, Copy, Debug)]
pub struct Limits {
    pub timeout: Duration,
    pub max_redirects: usize,
    pub max_body_bytes: usize,
}

pub const DEFAULT_LIMITS: Limits = Limits {
    timeout: Duration::from_secs(10),
    max_redirects: 5,
    max_body_bytes: 1024 * 1024,
};

pub struct Fetched {
    pub status: u16,
    pub final_url: String,
    pub content_type: String,
    pub body: String,
}

impl Fetched {
    pub fn is_success(&self) -> bool {
        (200..300).contains(&self.status)
    }

    fn to_json(&self) -> JsonValue {
        json!({
            "status": self.status,
            "ok": self.is_success(),
            "url": self.final_url,
            "content_type": self.content_type,
            "body": self.body,
        })
    }
}

/// A failed fetch. `status` is the upstream HTTP status (0 when none was received),
/// `respond` is what an uncaught failure answers the route with.
pub struct FetchError {
    pub status: u16,
    pub respond: u16,
    pub message: String,
}

fn fail(respond: u16, message: String) -> FetchError {
    FetchError { status: 0, respond, message }
}

/// Drops credentials, query and fragment so secrets in URLs never reach logs or responses.
fn redact(url: &Url) -> String {
    let mut safe = url.clone();
    let _ = safe.set_username("");
    let _ = safe.set_password(None);
    safe.set_query(None);
    safe.set_fragment(None);
    safe.to_string()
}

/// A literal `http(s)://` URL is used as-is; anything else is a variable or `@Values` name.
fn resolve_url(name: &str, args: &[String], ctx: &Context) -> Result<Url, String> {
    let [arg] = args else {
        return Err(format!("{name}: expected one argument, e.g. `{name} weather_url`"));
    };
    let text = if arg.starts_with("http://") || arg.starts_with("https://") {
        arg.clone()
    } else {
        match resolve_path(ctx, arg, None) {
            Some(JsonValue::String(s)) => s,
            Some(_) => return Err(format!("{name}: '{arg}' is not a string URL")),
            None => return Err(format!("{name}: '{arg}' is not defined (declare it in @Values or assign it first)")),
        }
    };
    let url = Url::parse(&text).map_err(|_| format!("{name}: '{arg}' is not a valid URL"))?;
    match url.scheme() {
        "http" | "https" => Ok(url),
        other => Err(format!("{name}: unsupported URL scheme '{other}' (only http and https)")),
    }
}

pub async fn get(url: Url, limits: Limits) -> Result<Fetched, FetchError> {
    let shown = redact(&url);
    let client = Client::builder()
        .timeout(limits.timeout)
        .redirect(Policy::limited(limits.max_redirects))
        .user_agent(concat!("vectrune/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| fail(500, format!("fetch: could not build HTTP client: {e}")))?;

    let map_err = |e: reqwest::Error| {
        if e.is_timeout() {
            fail(504, format!("fetch: {shown} timed out after {}s", limits.timeout.as_secs_f32()))
        } else if e.is_redirect() {
            fail(502, format!("fetch: {shown} exceeded {} redirects", limits.max_redirects))
        } else {
            fail(502, format!("fetch: request to {shown} failed"))
        }
    };

    let mut response = client.get(url).send().await.map_err(map_err)?;
    let too_large = || {
        fail(502, format!("fetch: {shown} response exceeded {} bytes", limits.max_body_bytes))
    };
    if response.content_length().is_some_and(|n| n > limits.max_body_bytes as u64) {
        return Err(too_large());
    }

    let status = response.status().as_u16();
    let final_url = redact(response.url());
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    // Content-Length can be absent or wrong, so enforce the cap while streaming.
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(map_err)? {
        if bytes.len() + chunk.len() > limits.max_body_bytes {
            return Err(too_large());
        }
        bytes.extend_from_slice(&chunk);
    }

    Ok(Fetched {
        status,
        final_url,
        content_type,
        body: String::from_utf8_lossy(&bytes).into_owned(),
    })
}

fn store(ctx: &mut Context, assign_to: Option<&str>, value: JsonValue) {
    ctx.insert(LAST_EXEC_RESULT.to_string(), value.clone());
    if let Some(var) = assign_to {
        ctx.insert(var.to_string(), value);
    }
}

/// `fetch` returns `{ status, ok, url, content_type, body }` and never fails on non-2xx.
/// `fetch-json` returns parsed JSON; non-2xx or non-JSON answers are failures.
async fn fetch_value(name: &str, url: Url) -> Result<JsonValue, FetchError> {
    let shown = redact(&url);
    let fetched = get(url, DEFAULT_LIMITS).await?;
    if name == "fetch" {
        return Ok(fetched.to_json());
    }
    if !fetched.is_success() {
        return Err(FetchError {
            status: fetched.status,
            respond: 502,
            message: format!("fetch-json: {shown} returned HTTP {}", fetched.status),
        });
    }
    serde_json::from_str(&fetched.body).map_err(|_| FetchError {
        status: fetched.status,
        respond: 502,
        message: format!("fetch-json: {shown} did not return valid JSON"),
    })
}

/// Splits `<url> [then <func>] [catch <func>]`.
fn split_clauses(name: &str, args: &[String]) -> Result<(Vec<String>, Option<String>, Option<String>), String> {
    let first_clause = args
        .iter()
        .position(|a| a == "then" || a == "catch")
        .unwrap_or(args.len());
    let (mut then, mut catch) = (None, None);
    let mut rest = args[first_clause..].iter();
    while let Some(keyword) = rest.next() {
        let target = match keyword.as_str() {
            "then" => &mut then,
            "catch" => &mut catch,
            _ => return Err(format!("{name}: unexpected '{keyword}'")),
        };
        match rest.next() {
            Some(func) if target.is_none() => *target = Some(func.clone()),
            _ => return Err(format!("{name}: expected one function after each of then/catch")),
        }
    }
    Ok((args[..first_clause].to_vec(), then, catch))
}

async fn call_handler(
    func: &str,
    payload: JsonValue,
    ctx: &mut Context,
    app_state: &AppState,
    assign_to: Option<&str>,
) -> BuiltinResult {
    if !ctx.contains_key(&format!("func:{func}")) {
        return BuiltinResult::Error(format!("fetch: function '{func}' is not defined"));
    }
    // The handler reads its argument as $1.
    ctx.insert("$1".to_string(), payload);
    let result = invoke_func(app_state, func, ctx, &[], assign_to).await;
    ctx.remove("$1");
    result
}

/// Shared by `fetch` and `fetch-json`:
///   `x = fetch-json url`                         assigns the value
///   `x = fetch-json url catch handler`           failures call `handler` with { status, message }
///   `fetch-json url then handler`                success calls `handler` with the value
/// Without `catch`, a failure responds 502 (upstream/JSON problem) or 504 (timeout).
pub async fn builtin_fetch_like(
    name: &str,
    args: &[String],
    ctx: &mut Context,
    app_state: &AppState,
    assign_to: Option<&str>,
) -> BuiltinResult {
    let (url_args, then, catch) = match split_clauses(name, args) {
        Ok(parts) => parts,
        Err(msg) => return BuiltinResult::Error(msg),
    };
    let url = match resolve_url(name, &url_args, ctx) {
        Ok(url) => url,
        Err(msg) => return BuiltinResult::Error(msg),
    };
    match fetch_value(name, url).await {
        Ok(value) => {
            store(ctx, assign_to, value.clone());
            match then {
                Some(func) => call_handler(&func, value, ctx, app_state, None).await,
                None => BuiltinResult::Ok,
            }
        }
        Err(e) => match catch {
            Some(func) => {
                let payload = json!({ "status": e.status, "message": e.message });
                call_handler(&func, payload, ctx, app_state, assign_to).await
            }
            None => BuiltinResult::Respond(e.respond, e.message),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{routing::get as route, Router};
    use tokio::net::TcpListener;

    async fn serve() -> String {
        let app = Router::new()
            .route("/big", route(|| async { "x".repeat(2048) }))
            .route("/slow", route(|| async {
                tokio::time::sleep(Duration::from_secs(2)).await;
                "late"
            }))
            .route("/loop", route(|| async {
                (axum::http::StatusCode::FOUND, [("location", "/loop")])
            }));
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
        format!("http://{addr}")
    }

    fn tight() -> Limits {
        Limits { timeout: Duration::from_millis(300), max_redirects: 3, max_body_bytes: 1024 }
    }

    #[tokio::test]
    async fn enforces_response_size_limit() {
        let base = serve().await;
        let err = get(Url::parse(&format!("{base}/big")).unwrap(), tight()).await.err().unwrap();
        assert_eq!(err.respond, 502);
        assert!(err.message.contains("exceeded 1024 bytes"), "{}", err.message);
    }

    #[tokio::test]
    async fn enforces_timeout() {
        let base = serve().await;
        let err = get(Url::parse(&format!("{base}/slow")).unwrap(), tight()).await.err().unwrap();
        assert_eq!(err.respond, 504);
    }

    #[tokio::test]
    async fn enforces_redirect_limit() {
        let base = serve().await;
        let err = get(Url::parse(&format!("{base}/loop")).unwrap(), tight()).await.err().unwrap();
        assert_eq!(err.respond, 502);
        assert!(err.message.contains("redirects"), "{}", err.message);
    }

    #[test]
    fn redacts_query_and_credentials() {
        let url = Url::parse("https://user:pw@example.com/a?key=secret#x").unwrap();
        assert_eq!(redact(&url), "https://example.com/a");
    }

    #[test]
    fn splits_then_and_catch_clauses() {
        let args: Vec<String> = ["u", "then", "a", "catch", "b"].iter().map(|s| s.to_string()).collect();
        let (url, then, catch) = split_clauses("fetch", &args).unwrap();
        assert_eq!((url, then, catch), (vec!["u".to_string()], Some("a".into()), Some("b".into())));
        assert!(split_clauses("fetch", &["u".into(), "then".into()]).is_err());
        assert!(split_clauses("fetch", &["u".into(), "catch".into(), "a".into(), "catch".into(), "b".into()]).is_err());
    }

    #[test]
    fn rejects_non_http_schemes_and_unknown_names() {
        let mut ctx = Context::new();
        ctx.insert("f".into(), JsonValue::String("file:///etc/passwd".into()));
        assert!(resolve_url("fetch", &["f".into()], &ctx).unwrap_err().contains("scheme"));
        assert!(resolve_url("fetch", &["nope".into()], &ctx).unwrap_err().contains("not defined"));
        assert!(resolve_url("fetch", &[], &ctx).is_err());
    }
}
