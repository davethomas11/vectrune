use crate::builtins::{BuiltinResult, Context};

fn interpolate_response(message: &str, ctx: &Context) -> Result<String, serde_json::Error> {
    let mut result = String::with_capacity(message.len());
    let mut chars = message.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '\\' && matches!(chars.peek(), Some('{' | '}')) {
            result.push(chars.next().expect("peeked escaped brace"));
        } else if ch == '{' {
            let mut placeholder = String::new();
            while chars.peek().is_some_and(|c| *c != '}' && *c != '{') {
                placeholder.push(chars.next().expect("peeked placeholder character"));
            }
            if chars.peek() != Some(&'}') {
                result.push('{');
                result.push_str(&placeholder);
                continue;
            }
            chars.next();
            let expr = placeholder.trim();
            let pretty = expr.strip_prefix("pretty ")
                .map(str::trim)
                .filter(|path| !path.is_empty());
            let path = pretty.unwrap_or(expr);
            if let Some(value) = crate::core::resolve_path(ctx, path, None) {
                if pretty.is_some() {
                    result.push_str(&serde_json::to_string_pretty(&value)?);
                } else if let Some(text) = value.as_str() {
                    result.push_str(text);
                } else {
                    result.push_str(&value.to_string());
                }
            } else {
                result.push('{');
                result.push_str(&placeholder);
                result.push('}');
            }
        } else {
            result.push(ch);
        }
    }
    Ok(result)
}

pub fn builtin_respond(args: &[String], ctx: &Context) -> BuiltinResult {
    let status: u16 = args.get(0).and_then(|s| s.parse().ok()).unwrap_or(200);
    let msg = if args.len() > 1 {
        if let Some(val) = ctx.get(&args[1]) {
            val.to_string()
        } else {
            match interpolate_response(&args[1..].join(" "), ctx) {
                Ok(message) => message,
                Err(error) => return BuiltinResult::Error(format!("respond interpolation failed: {error}")),
            }
        }

    } else {
        "OK".to_string()
    };
    BuiltinResult::Respond(status, msg)
}

#[cfg(test)]
mod tests {
    use super::interpolate_response;
    use crate::builtins::Context;
    use serde_json::json;

    #[test]
    fn interpolates_context_paths_and_pretty_values() {
        let mut ctx = Context::new();
        ctx.insert("data".into(), json!({"name":"Ada", "items":[1,2]}));
        ctx.insert("index".into(), json!(1));
        let value = interpolate_response(
            "Hi {data.name}: {data.items.[index]}\n{pretty data} {missing} {pretty missing}",
            &ctx,
        ).unwrap();
        assert!(value.starts_with("Hi Ada: 2\n{\n"));
        assert!(value.contains("\"items\": [\n"));
        assert!(value.ends_with(" {missing} {pretty missing}"));
    }

    #[test]
    fn supports_literal_braces_without_recursive_expansion() {
        let mut ctx = Context::new();
        ctx.insert("name".into(), json!("Ada"));
        ctx.insert("message".into(), json!("{name}"));
        assert_eq!(
            interpolate_response(r"\{name\} {name} {message} {unfinished", &ctx).unwrap(),
            "{name} Ada {name} {unfinished"
        );
    }
}
