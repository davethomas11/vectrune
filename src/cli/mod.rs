mod ai;
pub mod calculate;
pub mod lambda;
pub mod merge;
pub mod transform;
pub mod repl;

pub use ai::handle_ai;
pub use calculate::handle_calculate;
pub use lambda::handle_lambda;
pub use merge::handle_merge;
pub use transform::handle_transform;
pub use repl::handle_repl;

pub fn handle_sam_generate(bundle_path: &str, output_path: &str) -> anyhow::Result<()> {
    // Generate a basic SAM YAML file for the Lambda ZIP bundle
    use std::fs;
    let sam_yaml = format!(r#"AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Resources:
  RuneFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: bootstrap
      Runtime: provided.al2
      CodeUri: {}
      Events:
        Api:
          Type: Api
          Properties:
            Path: "/{{proxy}}+
            Method: ANY
"#, bundle_path);
    fs::write(output_path, sam_yaml)?;
    println!("SAM YAML generated at {}", output_path);
    Ok(())
}

pub fn handle_sam_local(bundle_path: &str, sam_path: &str) -> anyhow::Result<()> {
    // Run local SAM testing using AWS SAM CLI
    use std::process::Command;
    println!("Running local SAM testing for bundle {} using {}", bundle_path, sam_path);
    let status = Command::new("sam")
        .arg("local")
        .arg("start-api")
        .arg("--template")
        .arg(sam_path)
        .status()?;
    if !status.success() {
        eprintln!("SAM local testing failed.");
        std::process::exit(1);
    }
    Ok(())
}
