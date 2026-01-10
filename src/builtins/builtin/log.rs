// src/builtin/log.rs
use crate::builtins::BuiltinResult;

pub fn builtin_log(args: &[String]) -> BuiltinResult {
    eprintln!("[LOG] {}", args.join(" "));
    BuiltinResult::Ok
}
