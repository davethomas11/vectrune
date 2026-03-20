// Arithmetic expression parser and evaluator for Rune
// Supports +, -, *, /, parentheses, and numbers

#[derive(Debug, PartialEq)]
pub enum Token {
    Number(f64),
    Plus,
    Minus,
    Mul,
    Div,
    LParen,
    RParen,
}

pub fn tokenize(expr: &str) -> Result<Vec<Token>, String> {
    let mut tokens = Vec::new();
    let mut chars = expr.chars().peekable();
    while let Some(&c) = chars.peek() {
        match c {
            ' ' | '\t' => { chars.next(); },
            '+' => { tokens.push(Token::Plus); chars.next(); },
            '-' => { tokens.push(Token::Minus); chars.next(); },
            '*' => { tokens.push(Token::Mul); chars.next(); },
            '/' => { tokens.push(Token::Div); chars.next(); },
            '(' => { tokens.push(Token::LParen); chars.next(); },
            ')' => { tokens.push(Token::RParen); chars.next(); },
            '0'..='9' | '.' => {
                let mut num = String::new();
                while let Some(&d) = chars.peek() {
                    if d.is_digit(10) || d == '.' {
                        num.push(d);
                        chars.next();
                    } else {
                        break;
                    }
                }
                let val = num.parse::<f64>().map_err(|_| format!("Invalid number: {}", num))?;
                tokens.push(Token::Number(val));
            },
            _ => return Err(format!("Invalid character: {}", c)),
        }
    }
    Ok(tokens)
}

// Recursive descent parser
pub fn eval_arithmetic(expr: &str) -> Result<f64, String> {
    // If expr is just a number, return it directly
    let trimmed = expr.trim();
    if let Ok(val) = trimmed.parse::<f64>() {
        return Ok(val);
    }
    let tokens = tokenize(expr)?;
    let mut pos = 0;
    fn parse_expr(tokens: &[Token], pos: &mut usize) -> Result<f64, String> {
        let mut val = parse_term(tokens, pos)?;
        while *pos < tokens.len() {
            match tokens[*pos] {
                Token::Plus => {
                    *pos += 1;
                    val += parse_term(tokens, pos)?;
                },
                Token::Minus => {
                    *pos += 1;
                    val -= parse_term(tokens, pos)?;
                },
                _ => break,
            }
        }
        Ok(val)
    }
    fn parse_term(tokens: &[Token], pos: &mut usize) -> Result<f64, String> {
        let mut val = parse_factor(tokens, pos)?;
        while *pos < tokens.len() {
            match tokens[*pos] {
                Token::Mul => {
                    *pos += 1;
                    val *= parse_factor(tokens, pos)?;
                },
                Token::Div => {
                    *pos += 1;
                    val /= parse_factor(tokens, pos)?;
                },
                _ => break,
            }
        }
        Ok(val)
    }
    fn parse_factor(tokens: &[Token], pos: &mut usize) -> Result<f64, String> {
        match tokens.get(*pos) {
            Some(Token::Number(n)) => {
                *pos += 1;
                Ok(*n)
            },
            Some(Token::LParen) => {
                *pos += 1;
                let val = parse_expr(tokens, pos)?;
                if let Some(Token::RParen) = tokens.get(*pos) {
                    *pos += 1;
                    Ok(val)
                } else {
                    Err("Missing closing parenthesis".to_string())
                }
            },
            Some(Token::Minus) => {
                *pos += 1;
                Ok(-parse_factor(tokens, pos)?)
            },
            _ => Err("Unexpected token".to_string()),
        }
    }
    parse_expr(&tokens, &mut pos)
}



