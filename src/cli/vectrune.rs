use anyhow::Result;
use std::io::BufReader;
use std::path::Path;

use crate::execution::run_program_with_io;
use crate::vectrune::{compile_document, load_document_from_path};

pub fn handle_vectrune_file(path: &Path) -> Result<()> {
    let document = load_document_from_path(path)?;
    let program = compile_document(&document)?;
    let stdin = std::io::stdin();
    let mut input = BufReader::new(stdin.lock());
    let mut output = std::io::stdout();
    run_program_with_io(&program, &mut input, &mut output)
}



