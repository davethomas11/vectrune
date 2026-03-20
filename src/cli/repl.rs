use std::io::{self, Write};
use crate::rune_parser::parse_rune_line; // Assume this exists or will be implemented
use crate::core::{ExecutionContext};
use crate::util::{log, LogLevel};

pub async fn handle_repl() -> anyhow::Result<()> {
    log(LogLevel::Info, "Vectrune REPL started. Type 'exit' or 'quit' to leave.");
    let mut ctx = ExecutionContext::default(); // Or whatever context is needed
    loop {
        print!("vectrune> ");
        io::stdout().flush()?;
        let mut input = String::new();
        io::stdin().read_line(&mut input)?;
        let line = input.trim();
        if line.eq_ignore_ascii_case("exit") || line.eq_ignore_ascii_case("quit") {
            log(LogLevel::Info, "Exiting Vectrune REPL.");
            break;
        }
        if line.is_empty() {
            continue;
        }
        match parse_rune_line(line) {
            Ok(parsed) => {
                match crate::core::execute_line(&mut ctx, &parsed).await {
                    Ok(result) => println!("{:?}", result),
                    Err(e) => log(LogLevel::Error, &format!("Execution error: {}", e)),
                }
            },
            Err(e) => log(LogLevel::Error, &format!("Parse error: {}", e)),
        }
    }
    Ok(())
}
