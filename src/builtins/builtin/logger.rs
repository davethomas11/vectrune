use crate::builtins::{BuiltinResult, Context, LAST_EXEC_RESULT};
use crate::util::{LogLevel, log};

pub fn builtin_log(args: &[String], ctx: &mut Context) -> BuiltinResult {
    let message = args.join(" ");
    log(LogLevel::Info, &message);
    ctx.insert(LAST_EXEC_RESULT.to_string(), message.into());
    BuiltinResult::Ok
}
