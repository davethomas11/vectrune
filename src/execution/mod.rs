pub mod ir;
pub mod runtime;

pub use ir::{ExecBranch, ExecProgram, ExecStmt};
pub use runtime::run_program_with_io;


