#[derive(Debug, Clone, PartialEq)]
pub struct ExecProgram {
    pub statements: Vec<ExecStmt>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ExecStmt {
    Print { line_no: usize, text: String },
    ReadInput { line_no: usize, var_name: String },
    /// Assign a literal value (string or number) to a variable.
    Set { line_no: usize, var_name: String, value: String },
    IfChain {
        line_no: usize,
        branches: Vec<ExecBranch>,
        else_body: Vec<ExecStmt>,
    },
    /// Loop repeatedly while `condition` evaluates true.
    While {
        line_no: usize,
        condition: String,
        body: Vec<ExecStmt>,
    },
    /// Invoke a builtin function with args and optional assignment.
    Builtin {
        line_no: usize,
        name: String,
        args: Vec<String>,
        assign_to: Option<String>,
    },
    RepeatLine { line_no: usize, target_line: usize },
    /// Terminate program execution immediately with an optional message.
    Stop { line_no: usize, message: Option<String> },
    CollectWeightTimeline {
        line_no: usize,
        birth_year_var: String,
        target_var: String,
    },
    RenderWeightGraph {
        line_no: usize,
        series_var: String,
        title: String,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub struct ExecBranch {
    pub condition: String,
    pub body: Vec<ExecStmt>,
}

