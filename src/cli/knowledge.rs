use anyhow::{bail, Context, Result};
use clap::ArgMatches;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Deserialize)]
struct KnowledgeManifestSource {
    version: u32,
    status: Option<String>,
    pages: Vec<ManifestEntry>,
    references: Vec<ManifestEntry>,
}

#[derive(Debug, Deserialize)]
struct ManifestEntry {
    id: String,
    title: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct BuiltinsSource {
    version: u32,
    status: Option<String>,
    builtins: Vec<BuiltinEntry>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct BuiltinEntry {
    name: String,
    aliases: Option<Vec<String>>,
    category: Option<String>,
    summary: String,
    behavior: Option<BuiltinBehavior>,
    arguments: Option<Vec<BuiltinArgument>>,
    writes_context: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct BuiltinBehavior {
    placeholder_expansion: Option<bool>,
    expansion_syntax: Option<String>,
    notes: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct BuiltinArgument {
    name: String,
    variadic: Option<bool>,
    optional: Option<bool>,
    default: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct RuntimeContextSource {
    version: u32,
    status: Option<String>,
    context_values: Vec<ContextValue>,
    path_resolution: Option<PathResolution>,
    placeholder_expansion: Option<PlaceholderExpansion>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct ContextValue {
    name: String,
    summary: String,
    notes: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct PathResolution {
    summary: String,
    supported_patterns: Option<Vec<String>>,
    notes: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct PlaceholderExpansion {
    current_users: Option<Vec<String>>,
    syntax: Option<String>,
    behavior: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct AppTypesSource {
    version: u32,
    status: Option<String>,
    app_types: Vec<AppType>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct AppType {
    name: String,
    summary: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct ExamplesSource {
    version: u32,
    status: Option<String>,
    examples: Vec<ExampleEntry>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct ExampleEntry {
    id: String,
    title: String,
    summary: String,
    source_path: String,
    companion_files: Option<Vec<String>>,
    app_type: String,
    concepts: Option<Vec<String>>,
    builtins: Option<Vec<String>>,
    runtime_context: Option<Vec<String>>,
    cli_workflows: Option<Vec<String>>,
    test_refs: Option<Vec<String>>,
    related_knowledge: Option<Vec<String>>,
    status: Option<String>,
    notes: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
struct DocsKnowledgeManifest {
    version: u32,
    status: String,
    source_of_truth: String,
    sections: Vec<DocsSection>,
    data_files: DocsDataFiles,
}

#[derive(Debug, Serialize)]
struct DocsSection {
    id: String,
    title: String,
    description: String,
}

#[derive(Debug, Serialize)]
struct DocsDataFiles {
    builtins: String,
    #[serde(rename = "appTypes")]
    app_types: String,
    #[serde(rename = "runtimeContext")]
    runtime_context: String,
    examples: String,
}

#[derive(Debug, Serialize)]
struct AiPackManifest {
    version: u32,
    status: String,
    source_of_truth: String,
    files: Vec<AiPackManifestFile>,
    notes: Vec<String>,
}

#[derive(Debug, Serialize)]
struct AiPackManifestFile {
    path: String,
    kind: String,
    source: Option<String>,
}

pub fn handle_knowledge(matches: &ArgMatches) -> Result<()> {
    match matches.subcommand() {
        Some(("export", args)) => {
            let root = args
                .get_one::<String>("root")
                .map(PathBuf::from)
                .unwrap_or(std::env::current_dir().context("Unable to determine current directory")?);
            export_knowledge_assets(&root)?;
            println!("Knowledge exports refreshed from {}", root.display());
            Ok(())
        }
        _ => bail!("Unsupported knowledge command. Try 'vectrune knowledge export --help'."),
    }
}

pub fn export_knowledge_assets(root: &Path) -> Result<()> {
    let knowledge_dir = root.join("knowledge");
    let reference_dir = knowledge_dir.join("reference");
    let docs_data_dir = root.join("language").join("docs").join("data");
    let ai_pack_dir = root.join("documents").join("ai").join("vectrune-llm-pack");

    ensure_dir(&knowledge_dir, "knowledge directory")?;
    ensure_dir(&reference_dir, "knowledge reference directory")?;
    fs::create_dir_all(&docs_data_dir).context("Failed to create docs data directory")?;
    fs::create_dir_all(&ai_pack_dir).context("Failed to create AI pack directory")?;

    let manifest: KnowledgeManifestSource = read_yaml(&knowledge_dir.join("manifest.yaml"))?;
    let builtins: BuiltinsSource = read_yaml(&reference_dir.join("builtins.yaml"))?;
    let runtime_context: RuntimeContextSource = read_yaml(&reference_dir.join("runtime-context.yaml"))?;
    let app_types: AppTypesSource = read_yaml(&reference_dir.join("app-types.yaml"))?;
    let examples: ExamplesSource = read_yaml(&reference_dir.join("examples.yaml"))?;

    write_json(
        &docs_data_dir.join("knowledge-manifest.json"),
        &build_docs_manifest(&manifest),
    )?;
    write_json(&docs_data_dir.join("builtins.json"), &builtins)?;
    write_json(&docs_data_dir.join("runtime-context.json"), &runtime_context)?;
    write_json(&docs_data_dir.join("app-types.json"), &app_types)?;
    write_json(&docs_data_dir.join("examples.json"), &examples)?;

    write_json(&ai_pack_dir.join("builtins.json"), &builtins)?;
    write_json(&ai_pack_dir.join("runtime-context.json"), &runtime_context)?;
    write_json(&ai_pack_dir.join("app-types.json"), &app_types)?;
    write_examples_jsonl(&ai_pack_dir.join("examples.jsonl"), &examples.examples)?;
    write_yaml(&ai_pack_dir.join("manifest.yaml"), &build_ai_manifest())?;

    Ok(())
}

fn ensure_dir(path: &Path, label: &str) -> Result<()> {
    if !path.exists() {
        bail!("{} '{}' not found", label, path.display());
    }
    Ok(())
}

fn read_yaml<T>(path: &Path) -> Result<T>
where
    T: for<'de> Deserialize<'de>,
{
    let contents = fs::read_to_string(path)
        .with_context(|| format!("Failed to read {}", path.display()))?;
    serde_yaml::from_str(&contents)
        .with_context(|| format!("Failed to parse YAML from {}", path.display()))
}

fn write_json<T>(path: &Path, value: &T) -> Result<()>
where
    T: Serialize,
{
    let json = serde_json::to_string_pretty(value)
        .with_context(|| format!("Failed to serialize JSON for {}", path.display()))?;
    fs::write(path, json).with_context(|| format!("Failed to write {}", path.display()))
}

fn write_yaml<T>(path: &Path, value: &T) -> Result<()>
where
    T: Serialize,
{
    let yaml = serde_yaml::to_string(value)
        .with_context(|| format!("Failed to serialize YAML for {}", path.display()))?;
    fs::write(path, yaml).with_context(|| format!("Failed to write {}", path.display()))
}

fn write_examples_jsonl(path: &Path, examples: &[ExampleEntry]) -> Result<()> {
    let mut output = String::new();
    for example in examples {
        output.push_str(
            &serde_json::to_string(example)
                .with_context(|| format!("Failed to serialize example '{}'", example.id))?,
        );
        output.push('\n');
    }
    fs::write(path, output).with_context(|| format!("Failed to write {}", path.display()))
}

fn build_docs_manifest(manifest: &KnowledgeManifestSource) -> DocsKnowledgeManifest {
    let reference_quick_look_title = manifest
        .references
        .iter()
        .find(|entry| entry.id == "reference.app-types")
        .map(|entry| entry.title.clone())
        .unwrap_or_else(|| "Reference Quick Look".to_string());
    let builtins_title = manifest
        .references
        .iter()
        .find(|entry| entry.id == "reference.builtins")
        .map(|entry| entry.title.clone())
        .unwrap_or_else(|| "Builtins Snapshot".to_string());
    let examples_title = manifest
        .pages
        .iter()
        .find(|entry| entry.id == "examples.curated")
        .map(|entry| entry.title.clone())
        .unwrap_or_else(|| "Curated Examples".to_string());

    DocsKnowledgeManifest {
        version: manifest.version,
        status: manifest
            .status
            .clone()
            .unwrap_or_else(|| "generated".to_string()),
        source_of_truth: "knowledge/".to_string(),
        sections: vec![
            DocsSection {
                id: "reference-quick-look".to_string(),
                title: reference_quick_look_title,
                description: "Small generated snapshot of runtime context and supported app types."
                    .to_string(),
            },
            DocsSection {
                id: "builtin-reference".to_string(),
                title: builtins_title,
                description: "Starter builtin reference generated from the shared knowledge source."
                    .to_string(),
            },
            DocsSection {
                id: "curated-examples".to_string(),
                title: examples_title,
                description: "High-signal examples recommended for learning and AI retrieval."
                    .to_string(),
            },
        ],
        data_files: DocsDataFiles {
            builtins: "data/builtins.json".to_string(),
            app_types: "data/app-types.json".to_string(),
            runtime_context: "data/runtime-context.json".to_string(),
            examples: "data/examples.json".to_string(),
        },
    }
}

fn build_ai_manifest() -> AiPackManifest {
    AiPackManifest {
        version: 1,
        status: "generated".to_string(),
        source_of_truth: "knowledge/".to_string(),
        files: vec![
            AiPackManifestFile {
                path: "builtins.json".to_string(),
                kind: "structured-export".to_string(),
                source: Some("knowledge/reference/builtins.yaml".to_string()),
            },
            AiPackManifestFile {
                path: "runtime-context.json".to_string(),
                kind: "structured-export".to_string(),
                source: Some("knowledge/reference/runtime-context.yaml".to_string()),
            },
            AiPackManifestFile {
                path: "app-types.json".to_string(),
                kind: "structured-export".to_string(),
                source: Some("knowledge/reference/app-types.yaml".to_string()),
            },
            AiPackManifestFile {
                path: "examples.jsonl".to_string(),
                kind: "retrieval-corpus".to_string(),
                source: Some("knowledge/reference/examples.yaml".to_string()),
            },
        ],
        notes: vec![
            "This pack is generated from knowledge/ and should not drift from it.".to_string(),
            "Hand-authored README files may remain curated while data files are regenerated."
                .to_string(),
        ],
    }
}

#[cfg(test)]
mod tests {
    use super::export_knowledge_assets;
    use serde_json::Value;
    use tempfile::tempdir;
    use std::fs;
    use std::path::Path;

    #[test]
    fn exports_docs_and_ai_artifacts_from_knowledge_sources() {
        let temp = tempdir().unwrap();
        let root = temp.path();

        fs::create_dir_all(root.join("knowledge/reference")).unwrap();
        fs::create_dir_all(root.join("language/docs/data")).unwrap();
        fs::create_dir_all(root.join("documents/ai/vectrune-llm-pack")).unwrap();

        write_file(
            &root.join("knowledge/manifest.yaml"),
            r#"version: 1
status: starter
pages:
  - id: examples.curated
    title: Curated Examples
references:
  - id: reference.builtins
    title: Builtins
  - id: reference.app-types
    title: App Types
"#,
        );
        write_file(
            &root.join("knowledge/reference/builtins.yaml"),
            r#"version: 1
status: starter
builtins:
  - name: log
    category: diagnostics
    summary: Log a message.
"#,
        );
        write_file(
            &root.join("knowledge/reference/runtime-context.yaml"),
            r#"version: 1
status: starter
context_values:
  - name: body
    summary: Request body.
path_resolution:
  summary: Shared lookup.
placeholder_expansion:
  syntax: "{expr}"
"#,
        );
        write_file(
            &root.join("knowledge/reference/app-types.yaml"),
            r#"version: 1
status: starter
app_types:
  - name: REST
    summary: REST app.
"#,
        );
        write_file(
            &root.join("knowledge/reference/examples.yaml"),
            r#"version: 1
status: starter
examples:
  - id: example.rest.minimal
    title: Minimal REST App
    summary: Small REST app.
    source_path: examples/app.rune
    app_type: REST
    status: recommended
"#,
        );

        export_knowledge_assets(root).unwrap();

        assert_json_file(root.join("language/docs/data/builtins.json"));
        assert_json_file(root.join("language/docs/data/app-types.json"));
        assert_json_file(root.join("language/docs/data/runtime-context.json"));
        assert_json_file(root.join("language/docs/data/examples.json"));
        assert_json_file(root.join("language/docs/data/knowledge-manifest.json"));
        assert_json_file(root.join("documents/ai/vectrune-llm-pack/builtins.json"));
        assert_json_file(root.join("documents/ai/vectrune-llm-pack/runtime-context.json"));
        assert_json_file(root.join("documents/ai/vectrune-llm-pack/app-types.json"));
        assert_yaml_file(root.join("documents/ai/vectrune-llm-pack/manifest.yaml"));

        let examples_jsonl = fs::read_to_string(root.join("documents/ai/vectrune-llm-pack/examples.jsonl")).unwrap();
        let first_line = examples_jsonl.lines().find(|line| !line.trim().is_empty()).unwrap();
        let parsed: Value = serde_json::from_str(first_line).unwrap();
        assert_eq!(parsed["id"], "example.rest.minimal");
    }

    fn write_file(path: &Path, contents: &str) {
        fs::write(path, contents).unwrap();
    }

    fn assert_json_file(path: impl AsRef<Path>) {
        let contents = fs::read_to_string(path).unwrap();
        let _: Value = serde_json::from_str(&contents).unwrap();
    }

    fn assert_yaml_file(path: impl AsRef<Path>) {
        let contents = fs::read_to_string(path).unwrap();
        let _: serde_yaml::Value = serde_yaml::from_str(&contents).unwrap();
    }
}



