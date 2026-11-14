//! Native I/O adapter for the expression engine also shipped in Rune-Web.
use super::ExecProgram;
use anyhow::{anyhow, Context as _, Result};
use rquickjs::{CaughtError, Function};
use std::{
    io::{BufRead, Write},
    path::Path,
    sync::mpsc,
    time::{Duration, Instant},
};

enum IoRequest {
    Print(String, mpsc::SyncSender<std::result::Result<(), String>>),
    Read(mpsc::SyncSender<std::result::Result<String, String>>),
}
fn host_error(message: impl ToString) -> rquickjs::Error {
    rquickjs::Error::new_from_js_message("Vect host", "I/O", message.to_string())
}

pub fn run<R: BufRead, W: Write>(
    program: &ExecProgram,
    input: &mut R,
    output: &mut W,
    script_dir: &Path,
) -> Result<()> {
    let root = script_dir
        .canonicalize()
        .context("Cannot resolve Vect script directory")?;
    let json = serde_json::to_string(program)?;
    let (send, receive) = mpsc::channel();
    // Channels keep borrowed stdio on the caller's thread, without unsafe
    // lifetimes or buffering interactive input until EOF.
    std::thread::scope(|scope| -> Result<()> {
        let execution = scope.spawn(move || -> Result<()> {
            let runtime = rquickjs::Runtime::new()?;
            runtime.set_memory_limit(128 * 1024 * 1024);
            runtime.set_max_stack_size(1024 * 1024);
            let deadline = Instant::now() + Duration::from_secs(120);
            runtime.set_interrupt_handler(Some(Box::new(move || Instant::now() >= deadline)));
            let context = rquickjs::Context::full(&runtime)?;
            context.with(|ctx| -> Result<()> {
                let printer = send.clone();
                ctx.globals().set("__vectPrint", Function::new(ctx.clone(), move |text: String| -> rquickjs::Result<()> {
                    let (reply, result) = mpsc::sync_channel(1);
                    printer.send(IoRequest::Print(text, reply)).map_err(host_error)?;
                    result.recv().map_err(host_error)?.map_err(host_error)
                })?)?;
                ctx.globals().set("__vectRead", Function::new(ctx.clone(), move || -> rquickjs::Result<String> {
                    let (reply, result) = mpsc::sync_channel(1);
                    send.send(IoRequest::Read(reply)).map_err(host_error)?;
                    result.recv().map_err(host_error)?.map_err(host_error)
                })?)?;
                let write_root = root.clone();
                ctx.globals().set("__vectWrite", Function::new(ctx.clone(), move |path: String, contents: String| -> rquickjs::Result<()> {
                    std::fs::write(write_root.join(path), contents).map_err(host_error)
                })?)?;
                let source = format!("{}\n__RuneVect.run({}, {{print:__vectPrint,read:__vectRead,write:__vectWrite}}, {});",
                    include_str!("../../runtime/rune-web/dist/rune-vect.js"), json,
                    serde_json::to_string(&root.to_string_lossy())?);
                ctx.eval::<(), _>(source).map_err(|e| anyhow!(CaughtError::from_error(&ctx, e).to_string()))
            })
        });
        for request in receive {
            match request {
                IoRequest::Print(text, reply) => {
                    let result = writeln!(output, "{text}")
                        .and_then(|_| output.flush())
                        .map_err(|e| e.to_string());
                    let _ = reply.send(result);
                }
                IoRequest::Read(reply) => {
                    let mut line = String::new();
                    let result = input
                        .read_line(&mut line)
                        .map_err(|e| e.to_string())
                        .and_then(|n| {
                            if n == 0 {
                                Err("stdio input ended unexpectedly".into())
                            } else {
                                Ok(line.trim_end_matches(['\r', '\n']).to_string())
                            }
                        });
                    let _ = reply.send(result);
                }
            }
        }
        execution
            .join()
            .map_err(|_| anyhow!("Vect execution thread panicked"))?
    })
}
