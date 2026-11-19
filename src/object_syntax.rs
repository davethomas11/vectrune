//! Portable object expressions used by backend steps and Rune-Web state values.
//! Browser/Vect's matching AST lives in runtime/rune-web/src/core_expression.ts;
//! tests/conformance/objects.json is the common behavioral contract.
use serde_json::{json, Map, Value};
use std::collections::HashMap;

#[derive(Clone, Debug)]
enum Expr {
    Literal(Value),
    Name(String),
    Array(Vec<Expr>),
    Object(Vec<(String, Expr)>),
    Member(Box<Expr>, Box<Expr>),
    Lookup(Box<Expr>, String),
    Unary(String, Box<Expr>),
    Binary(String, Box<Expr>, Box<Expr>),
    Conditional(Box<Expr>, Box<Expr>, Box<Expr>),
    Overlay(Box<Expr>, Box<Expr>),
    Generate(Box<Expr>, Box<Expr>, Vec<String>, Box<Expr>, Box<Expr>),
    Grid(Vec<Expr>),
}
#[derive(Clone)]
struct Token {
    text: String,
    string: bool,
}
type Result<T> = std::result::Result<T, String>;
type Resolver<'a> = dyn Fn(&str) -> Option<Value> + 'a;

fn key(s: &str) -> Result<String> {
    if ["__proto__", "prototype", "constructor"].contains(&s) {
        return Err(format!("Invalid member: {s}"));
    }
    Ok(s.to_owned())
}
fn identifier(s: &str) -> bool {
    let mut chars = s.chars();
    chars
        .next()
        .is_some_and(|c| c.is_ascii_alphabetic() || c == '_' || c == '$')
        && chars.all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '$')
}
fn tokens(source: &str) -> Result<Vec<Token>> {
    let mut out = Vec::new();
    let mut chars = source.char_indices().peekable();
    while let Some((start, c)) = chars.next() {
        if c.is_whitespace() {
            continue;
        }
        let mut text = c.to_string();
        let mut string = false;
        if c == '"' || c == '\'' {
            string = true;
            text.clear();
            let mut closed = false;
            while let Some((_, ch)) = chars.next() {
                if ch == c {
                    closed = true;
                    break;
                }
                text.push(if ch == '\\' {
                    match chars.next().map(|(_, c)| c) {
                        Some('n') => '\n',
                        Some('r') => '\r',
                        Some('t') => '\t',
                        Some('b') => '\u{0008}',
                        Some('f') => '\u{000c}',
                        Some('/') => '/',
                        Some('u') => {
                            fn unit(
                                chars: &mut impl Iterator<Item = (usize, char)>,
                            ) -> Result<u16> {
                                let hex = (0..4)
                                    .map(|_| {
                                        chars.next().map(|(_, c)| c).ok_or("Invalid Unicode escape")
                                    })
                                    .collect::<std::result::Result<String, _>>()?;
                                u16::from_str_radix(&hex, 16)
                                    .map_err(|_| "Invalid Unicode escape".into())
                            }
                            let high = unit(&mut chars)?;
                            let code = if (0xd800..=0xdbff).contains(&high) {
                                if chars.next().map(|(_, c)| c) != Some('\\')
                                    || chars.next().map(|(_, c)| c) != Some('u')
                                {
                                    return Err("Invalid Unicode surrogate pair".into());
                                }
                                let low = unit(&mut chars)?;
                                if !(0xdc00..=0xdfff).contains(&low) {
                                    return Err("Invalid Unicode surrogate pair".into());
                                }
                                0x10000 + ((high as u32 - 0xd800) << 10) + low as u32 - 0xdc00
                            } else {
                                high as u32
                            };
                            char::from_u32(code).ok_or("Invalid Unicode escape")?
                        }
                        Some(c @ ('\\' | '"' | '\'')) => c,
                        _ => return Err("Invalid string escape".into()),
                    }
                } else {
                    ch
                });
            }
            if !closed {
                return Err("Unclosed string".into());
            }
        } else if c.is_ascii_digit()
            || (c == '.' && chars.peek().is_some_and(|(_, c)| c.is_ascii_digit()))
        {
            while chars
                .peek()
                .is_some_and(|(_, c)| c.is_ascii_digit() || *c == '.')
            {
                text.push(chars.next().unwrap().1);
            }
            if chars.peek().is_some_and(|(_, c)| *c == 'e' || *c == 'E') {
                text.push(chars.next().unwrap().1);
                if chars.peek().is_some_and(|(_, c)| *c == '+' || *c == '-') {
                    text.push(chars.next().unwrap().1);
                }
                while chars.peek().is_some_and(|(_, c)| c.is_ascii_digit()) {
                    text.push(chars.next().unwrap().1);
                }
            }
        } else if c.is_ascii_alphabetic() || c == '_' || c == '$' {
            while chars
                .peek()
                .is_some_and(|(_, c)| c.is_ascii_alphanumeric() || *c == '_' || *c == '$')
            {
                text.push(chars.next().unwrap().1);
            }
        } else {
            if let Some((_, next)) = chars.peek() {
                let pair = format!("{c}{next}");
                if ["??", "&&", "||", "==", "!=", "<=", ">="].contains(&pair.as_str()) {
                    text = pair;
                    chars.next();
                }
            }
            if !"+-*/%<>()[]{},.:?!".contains(c) && text.len() == 1 {
                return Err(format!("Unexpected token at {start}"));
            }
        }
        out.push(Token { text, string });
    }
    out.push(Token {
        text: String::new(),
        string: false,
    });
    Ok(out)
}
struct Parser {
    tokens: Vec<Token>,
    pos: usize,
    depth: usize,
}
impl Parser {
    fn peek(&self) -> &str {
        self.tokens
            .get(self.pos)
            .map(|t| t.text.as_str())
            .unwrap_or("")
    }
    fn take(&mut self) -> Result<Token> {
        let token = self
            .tokens
            .get(self.pos)
            .filter(|t| !t.text.is_empty() || t.string)
            .cloned()
            .ok_or("Expected expression")?;
        self.pos += 1;
        Ok(token)
    }
    fn expect(&mut self, s: &str) -> Result<()> {
        let token = self.take()?;
        if token.string || token.text != s {
            return Err(format!("Expected {s}"));
        }
        Ok(())
    }
    fn expr(&mut self, min: u8) -> Result<Expr> {
        self.depth += 1;
        if self.depth > 128 {
            return Err("Expression nesting exceeds 128".into());
        }
        let t = self.take()?;
        let mut left = if t.string {
            Expr::Literal(Value::String(t.text))
        } else if let Ok(n) = t.text.parse::<f64>() {
            Expr::Literal(serde_json::from_str::<Value>(&t.text).unwrap_or_else(|_| numeric(n)))
        } else {
            match t.text.as_str() {
                "true" => Expr::Literal(json!(true)),
                "false" => Expr::Literal(json!(false)),
                "null" => Expr::Literal(Value::Null),
                "-" | "+" | "!" | "not" => Expr::Unary(t.text, Box::new(self.expr(8)?)),
                "(" => {
                    let e = self.expr(0)?;
                    self.expect(")")?;
                    e
                }
                "[" => {
                    let mut items = Vec::new();
                    while self.peek() != "]" {
                        items.push(self.expr(0)?);
                        if self.peek() != "," {
                            break;
                        }
                        self.take()?;
                    }
                    self.expect("]")?;
                    Expr::Array(items)
                }
                "{" => {
                    let mut items = Vec::new();
                    while self.peek() != "}" {
                        let k = self.take()?;
                        if !k.string && !identifier(&k.text) {
                            return Err("Invalid object key".into());
                        }
                        let value = if self.peek() == ":" {
                            self.take()?;
                            self.expr(0)?
                        } else if !k.string && [",", "}"].contains(&self.peek()) {
                            Expr::Name(k.text.clone())
                        } else {
                            return Err("Expected : after object key".into());
                        };
                        items.push((key(&k.text)?, value));
                        if self.peek() != "," {
                            break;
                        }
                        self.take()?;
                    }
                    self.expect("}")?;
                    Expr::Object(items)
                }
                "grid" if !["", ".", "["].contains(&self.peek()) => {
                    let cols = self.expr(8)?;
                    self.expect("x")?;
                    let rows = self.expr(8)?;
                    let kw = self.take()?;
                    if !["at", "from"].contains(&kw.text.as_str()) {
                        return Err("Expected at or from".into());
                    }
                    self.expect("(")?;
                    let x = self.expr(0)?;
                    self.expect(",")?;
                    let y = self.expr(0)?;
                    self.expect(")")?;
                    self.expect("step")?;
                    self.expect("(")?;
                    let dx = self.expr(0)?;
                    self.expect(",")?;
                    let dy = self.expr(0)?;
                    self.expect(")")?;
                    let overrides = if self.peek() == "with" {
                        self.take()?;
                        self.expr(8)?
                    } else {
                        Expr::Object(vec![])
                    };
                    Expr::Grid(vec![cols, rows, x, y, dx, dy, overrides])
                }
                name if identifier(name) => Expr::Name(name.to_string()),
                _ => return Err(format!("Expected expression, got {}", t.text)),
            }
        };
        loop {
            match self.peek() {
                "." => {
                    self.take()?;
                    if self.peek() == "[" {
                        continue;
                    } // legacy Rune path: state.[id]
                    let k = self.take()?;
                    if k.string || !identifier(&k.text) {
                        return Err("Expected member name".into());
                    }
                    left = Expr::Member(
                        Box::new(left),
                        Box::new(Expr::Literal(Value::String(key(&k.text)?))),
                    );
                    continue;
                }
                "[" => {
                    self.take()?;
                    if self.peek() == "]" {
                        self.take()?;
                        let k = self.take()?;
                        if k.string || !identifier(&k.text) {
                            return Err("Expected lookup property after []".into());
                        }
                        left = Expr::Lookup(Box::new(left), key(&k.text)?);
                    } else {
                        let k = self.expr(0)?;
                        self.expect("]")?;
                        left = Expr::Member(Box::new(left), Box::new(k));
                    }
                    continue;
                }
                "with" | "all" if min == 0 => {
                    self.take()?;
                    left = Expr::Overlay(Box::new(left), Box::new(self.expr(8)?));
                    continue;
                }
                "*" if min <= 7 && matches!(left, Expr::Object(_)) => {
                    self.take()?;
                    let count = self.expr(8)?;
                    let mut props = Vec::new();
                    let mut step = Expr::Literal(json!(0));
                    if self.peek() == "inc" {
                        self.take()?;
                        let parens = self.peek() == "(";
                        if parens {
                            self.take()?;
                        }
                        loop {
                            let p = self.take()?;
                            if !p.string && !identifier(&p.text) {
                                return Err("Expected increment property".into());
                            }
                            props.push(key(&p.text)?);
                            if self.peek() != "," {
                                break;
                            }
                            self.take()?;
                        }
                        if parens {
                            self.expect(")")?;
                        }
                        self.expect("by")?;
                        step = self.expr(8)?;
                    }
                    let overrides = if self.peek() == "with" {
                        self.take()?;
                        self.expr(8)?
                    } else {
                        Expr::Object(vec![])
                    };
                    left = Expr::Generate(
                        Box::new(left),
                        Box::new(count),
                        props,
                        Box::new(step),
                        Box::new(overrides),
                    );
                    continue;
                }
                _ => {}
            }
            let rank = match self.peek() {
                "??" => 1,
                "or" | "||" => 2,
                "and" | "&&" => 3,
                "==" | "!=" | "contains" => 4,
                "<" | ">" | "<=" | ">=" => 5,
                "+" | "-" => 6,
                "*" | "/" | "%" => 7,
                _ => break,
            };
            if rank < min {
                break;
            }
            let op = self.take()?.text;
            let right = self.expr(rank + 1)?;
            left = Expr::Binary(op, Box::new(left), Box::new(right));
        }
        if min == 0 && self.peek() == "?" {
            self.take()?;
            let yes = self.expr(0)?;
            self.expect(":")?;
            let no = self.expr(0)?;
            left = Expr::Conditional(Box::new(left), Box::new(yes), Box::new(no));
        }
        self.depth -= 1;
        Ok(left)
    }
}
fn parse(source: &str) -> Result<Expr> {
    let mut parser = Parser {
        tokens: tokens(source)?,
        pos: 0,
        depth: 0,
    };
    let expr = parser.expr(0)?;
    if !parser.peek().is_empty() {
        return Err(format!("Unexpected token: {}", parser.peek()));
    }
    Ok(expr)
}
fn numeric(n: f64) -> Value {
    if n.is_finite() && n.fract() == 0.0 && n >= i64::MIN as f64 && n < i64::MAX as f64 {
        json!(n as i64)
    } else {
        json!(n)
    }
}
fn text(value: &Value) -> String {
    if value.as_number().is_some_and(|n| n.is_i64() || n.is_u64()) {
        return value.to_string();
    }
    if let Some(n) = value.as_f64() {
        return numeric(n).to_string();
    }
    value
        .as_str()
        .map(str::to_owned)
        .unwrap_or_else(|| value.to_string())
}
fn number(value: &Value) -> Result<f64> {
    let n = value
        .as_f64()
        .or_else(|| value.as_str().and_then(|s| s.parse().ok()))
        .ok_or("Expected a number")?;
    if !n.is_finite() {
        return Err("Expected a finite number".into());
    }
    Ok(n)
}
fn count(value: &Value) -> Result<usize> {
    if !value.is_number() {
        return Err("Generator count must be a number".into());
    }
    let n = number(value)?;
    if n < 0.0 || n > 1_000_000.0 || n.fract() != 0.0 {
        return Err("Invalid generator count (0..1000000)".into());
    }
    Ok(n as usize)
}
fn finite(value: &Value) -> Result<f64> {
    value
        .as_f64()
        .filter(|n| n.is_finite())
        .ok_or_else(|| "Generator coordinates and steps must be finite numbers".into())
}
fn truth(value: &Value) -> bool {
    match value {
        Value::Null => false,
        Value::Bool(b) => *b,
        Value::Number(n) => n.as_f64() != Some(0.0),
        Value::String(s) => !s.is_empty(),
        _ => true,
    }
}
fn overlay(source: Value, overrides: Value) -> Result<Value> {
    let extra = overrides.as_object().ok_or("with/all requires an object")?;
    let copy = |mut item: Value| {
        if let Value::Object(ref mut map) = item {
            map.extend(extra.clone());
        }
        item
    };
    match source {
        Value::Array(items) => Ok(Value::Array(items.into_iter().map(copy).collect())),
        Value::Object(_) => Ok(copy(source)),
        _ => Err("with/all requires an object or array".into()),
    }
}
fn static_path(expr: &Expr) -> Option<String> {
    match expr {
        Expr::Name(name) => Some(name.clone()),
        Expr::Member(parent, k) => Some(format!(
            "{}.{}",
            static_path(parent)?,
            k.as_literal_string()?
        )),
        _ => None,
    }
}
impl Expr {
    fn as_literal_string(&self) -> Option<&str> {
        if let Expr::Literal(Value::String(s)) = self {
            Some(s)
        } else {
            None
        }
    }
    fn expands(&self) -> bool {
        matches!(
            self,
            Expr::Generate(..) | Expr::Grid(..) | Expr::Overlay(..)
        )
    }
    fn eval(&self, resolve: &Resolver<'_>, vars: &HashMap<String, Value>) -> Result<Value> {
        let ev = |expr: &Expr| expr.eval(resolve, vars);
        Ok(match self {
            Expr::Literal(value) => value.clone(),
            Expr::Name(name) => vars
                .get(name)
                .cloned()
                .or_else(|| resolve(name))
                .ok_or_else(|| format!("Unknown variable: {name}"))?,
            Expr::Array(items) => {
                let mut out = Vec::new();
                for item in items {
                    let value = ev(item)?;
                    if item.expands() {
                        if let Value::Array(values) = value {
                            out.extend(values);
                            continue;
                        }
                    }
                    out.push(value);
                }
                Value::Array(out)
            }
            Expr::Object(items) => Value::Object(
                items
                    .iter()
                    .map(|(k, v)| Ok((k.clone(), ev(v)?)))
                    .collect::<Result<Map<_, _>>>()?,
            ),
            Expr::Member(parent, k) => {
                if let Some(value) = static_path(self).and_then(|path| resolve(&path)) {
                    return Ok(value);
                }
                let source = ev(parent)?;
                let k = key(&text(&ev(k)?))?;
                match &source {
                    Value::Array(items) if k == "length" => json!(items.len()),
                    Value::Array(items) => k
                        .parse::<usize>()
                        .ok()
                        .and_then(|i| items.get(i))
                        .cloned()
                        .unwrap_or(Value::Null),
                    Value::Object(items) => items.get(&k).cloned().unwrap_or(Value::Null),
                    _ => Value::Null,
                }
            }
            Expr::Lookup(parent, k) => {
                let source = ev(parent)?;
                let Some(expected) = vars.get(k).cloned().or_else(|| resolve(k)) else {
                    return Ok(Value::Null);
                };
                source
                    .as_array()
                    .and_then(|items| {
                        items.iter().find(|item| {
                            item.get(k)
                                .is_some_and(|value| text(value) == text(&expected))
                        })
                    })
                    .cloned()
                    .unwrap_or(Value::Null)
            }
            Expr::Unary(op, value) => {
                let value = ev(value)?;
                match op.as_str() {
                    "-" => json!(-number(&value)?),
                    "+" => json!(number(&value)?),
                    _ => json!(!truth(&value)),
                }
            }
            Expr::Conditional(c, yes, no) => {
                if truth(&ev(c)?) {
                    ev(yes)?
                } else {
                    ev(no)?
                }
            }
            Expr::Binary(op, a, b) => {
                let x = ev(a)?;
                match op.as_str() {
                    "??" => {
                        if x.is_null() || x.as_str() == Some("") {
                            ev(b)?
                        } else {
                            x
                        }
                    }
                    "and" | "&&" => json!(truth(&x) && truth(&ev(b)?)),
                    "or" | "||" => json!(truth(&x) || truth(&ev(b)?)),
                    _ => {
                        let y = ev(b)?;
                        match op.as_str() {
                            "+" if x.is_string() || y.is_string() => {
                                Value::String(text(&x) + &text(&y))
                            }
                            "+" => json!(number(&x)? + number(&y)?),
                            "-" => json!(number(&x)? - number(&y)?),
                            "*" => json!(number(&x)? * number(&y)?),
                            "/" => json!(number(&x)? / number(&y)?),
                            "%" => json!(number(&x)? % number(&y)?),
                            "==" => json!(text(&x) == text(&y)),
                            "!=" => json!(text(&x) != text(&y)),
                            "contains" => {
                                json!(text(&x).to_lowercase().contains(&text(&y).to_lowercase()))
                            }
                            "<" => json!(number(&x)? < number(&y)?),
                            ">" => json!(number(&x)? > number(&y)?),
                            "<=" => json!(number(&x)? <= number(&y)?),
                            ">=" => json!(number(&x)? >= number(&y)?),
                            _ => unreachable!(),
                        }
                    }
                }
            }
            Expr::Overlay(source, extra) => {
                let value = match source.as_ref() {
                    Expr::Name(name) => ev(source).or_else(|missing| {
                        resolve(&format!("{name}_batch")).ok_or(missing)
                    })?,
                    _ => ev(source)?,
                };
                overlay(value, ev(extra)?)?
            }
            Expr::Generate(template, n, props, step, extra) => {
                let n = count(&ev(n)?)?;
                let step = finite(&ev(step)?)?;
                let mut out = Vec::new();
                for i in 0..n {
                    let mut vars = vars.clone();
                    vars.insert("i".into(), json!(i));
                    let mut item = template.eval(resolve, &vars)?;
                    for prop in props {
                        if let Some(value) = item.get_mut(prop) {
                            if value.is_number() {
                                *value = json!(number(value)? + i as f64 * step);
                            }
                        }
                    }
                    out.push(overlay(item, extra.eval(resolve, &vars)?)?);
                }
                Value::Array(out)
            }
            Expr::Grid(items) => {
                let cols = count(&ev(&items[0])?)?;
                let rows = count(&ev(&items[1])?)?;
                let n = count(&json!(cols * rows))?;
                let x = finite(&ev(&items[2])?)?;
                let y = finite(&ev(&items[3])?)?;
                let dx = finite(&ev(&items[4])?)?;
                let dy = finite(&ev(&items[5])?)?;
                let mut out = Vec::new();
                for i in 0..n {
                    let col = i % cols;
                    let row = i / cols;
                    let mut vars = vars.clone();
                    for (k, value) in [("i", i), ("col", col), ("row", row), ("c", col), ("r", row)]
                    {
                        vars.insert(k.into(), json!(value));
                    }
                    let item = json!({"x": x + col as f64 * dx, "y": y + row as f64 * dy, "start_x": x + col as f64 * dx, "start_y": y + row as f64 * dy, "col": col, "row": row});
                    out.push(overlay(item, items[6].eval(resolve, &vars)?)?);
                }
                Value::Array(out)
            }
        })
    }
}

pub fn evaluate(source: &str, resolve: &Resolver<'_>) -> Result<Value> {
    fn normalize(value: Value) -> Value {
        match value {
            Value::Number(n) if n.is_i64() || n.is_u64() => Value::Number(n),
            Value::Number(ref n) => numeric(n.as_f64().unwrap_or(f64::NAN)),
            Value::Array(items) => Value::Array(items.into_iter().map(normalize).collect()),
            Value::Object(items) => {
                Value::Object(items.into_iter().map(|(k, v)| (k, normalize(v))).collect())
            }
            other => other,
        }
    }
    Ok(normalize(parse(source)?.eval(resolve, &HashMap::new())?))
}

/// Expand a matching-object target into concrete keys before mutably borrowing
/// context. A missing match is a no-op, as in Rune-Web.
pub fn assignment_path(source: &str, resolve: &Resolver<'_>) -> Result<Option<Vec<String>>> {
    fn path(expr: &Expr, resolve: &Resolver<'_>) -> Result<Option<Vec<String>>> {
        let vars = HashMap::new();
        match expr {
            Expr::Name(name) => Ok(Some(vec![key(name)?])),
            Expr::Member(parent, k) => {
                let Some(mut parts) = path(parent, resolve)? else {
                    return Ok(None);
                };
                parts.push(key(&text(&k.eval(resolve, &vars)?))?);
                Ok(Some(parts))
            }
            Expr::Lookup(parent, k) => {
                let Some(mut parts) = path(parent, resolve)? else {
                    return Ok(None);
                };
                let source = parent.eval(resolve, &vars)?;
                let Some(expected) = resolve(k) else {
                    return Ok(None);
                };
                let index = source.as_array().and_then(|items| {
                    items
                        .iter()
                        .position(|item| item.get(k).is_some_and(|v| text(v) == text(&expected)))
                });
                let Some(index) = index else {
                    return Ok(None);
                };
                parts.push(index.to_string());
                Ok(Some(parts))
            }
            _ => Err("Invalid assignment target".into()),
        }
    }
    path(&parse(source)?, resolve)
}

pub fn is_structured(source: &str) -> bool {
    let s = source.trim_start();
    if s.starts_with('{') || s.starts_with('[') || s.starts_with("grid ") {
        return true;
    }
    let Ok(tokens) = tokens(s) else {
        return false;
    };
    tokens
        .iter()
        .any(|t| !t.string && matches!(t.text.as_str(), "with" | "all"))
        || tokens.windows(2).any(|pair| {
            !pair[0].string && !pair[1].string && pair[0].text == "[" && pair[1].text == "]"
        })
}
