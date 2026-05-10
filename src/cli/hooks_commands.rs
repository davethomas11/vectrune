/// CLI Commands for Hook Debugging and Management
///
/// Provides command-line tools for inspecting, validating, and debugging
/// memory hooks in Rune documents.

#[allow(dead_code)]

use crate::memory::parse_hooks_from_document;
use crate::rune_ast::RuneDocument;
use crate::util::{log, LogLevel};
use std::fs;

/// Hook debug command handler
pub async fn cmd_hooks(args: &[String]) -> Result<(), String> {
    match args.get(0).map(|s| s.as_str()) {
        Some("--list") => cmd_hooks_list(args).await,
        Some("--validate") => cmd_hooks_validate(args).await,
        Some("--debug") => cmd_hooks_debug(args).await,
        Some("--info") => cmd_hooks_info(args).await,
        _ => Err(
            "Usage: vectrune hooks [--list <file> | --validate <file> | --debug <file> <hook-id> | --info <file>]"
                .to_string(),
        ),
    }
}

/// List all hooks in a Rune file
/// Usage: vectrune hooks --list <file.rune>
async fn cmd_hooks_list(args: &[String]) -> Result<(), String> {
    let file_path = args.get(1).ok_or("Missing file argument")?;

    log(LogLevel::Info, &format!("Loading hooks from: {}", file_path));

    let content = fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let doc = RuneDocument::from_str(&content)
        .map_err(|e| format!("Failed to parse Rune file: {}", e))?;

    let hooks = parse_hooks_from_document(&doc);

    if hooks.is_empty() {
        println!("No hooks found in {}", file_path);
        return Ok(());
    }

    println!("\n  📋 Hooks in {}:\n", file_path);
    for (idx, hook) in hooks.iter().enumerate() {
        println!("  [{}] {}", idx + 1, hook.id);
        println!("      → Target: {}", hook.target_key);
        println!("      → Observer: {:?}", hook.observer_type);
        if !hook.observer_config.is_empty() {
            println!("      → Config:");
            for (k, v) in &hook.observer_config {
                println!("         • {} = {}", k, v);
            }
        }
        if hook.custom_logic.is_some() {
            println!("      → Has custom logic: Yes");
        }
        println!();
    }

    println!("  Total: {} hook(s)\n", hooks.len());
    Ok(())
}

/// Validate hooks in a Rune file for errors
/// Usage: vectrune hooks --validate <file.rune>
async fn cmd_hooks_validate(args: &[String]) -> Result<(), String> {
    let file_path = args.get(1).ok_or("Missing file argument")?;

    log(LogLevel::Info, &format!("Validating hooks in: {}", file_path));

    let content = fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let doc = RuneDocument::from_str(&content)
        .map_err(|e| format!("Failed to parse Rune file: {}", e))?;

    let hooks = parse_hooks_from_document(&doc);

    let mut errors = Vec::new();

    // Validate each hook
    for hook in &hooks {
        // Check for required fields
        if hook.target_key.is_empty() {
            errors.push(format!("Hook '{}': target_key is empty", hook.id));
        }

        // Check for observer-specific config
        match hook.observer_type {
            crate::memory::ReactivityProvider::Poll => {
                if !hook.observer_config.contains_key("webhook_url") {
                    errors.push(format!(
                        "Hook '{}': Poll observer requires 'webhook_url' config",
                        hook.id
                    ));
                }
            }
            crate::memory::ReactivityProvider::WebSocket => {
                // WebSocket is optional but endpoint should be valid
                if let Some(endpoint) = hook.observer_config.get("endpoint") {
                    if !endpoint.starts_with('/') {
                        errors.push(format!(
                            "Hook '{}': endpoint should start with '/' (got: {})",
                            hook.id, endpoint
                        ));
                    }
                }
            }
            _ => {}
        }
    }

    println!("\n  ✓ Validation Results:\n");
    if errors.is_empty() {
        println!("  ✅ All {} hook(s) are valid\n", hooks.len());
        Ok(())
    } else {
        println!("  ❌ Found {} error(s):\n", errors.len());
        for (idx, error) in errors.iter().enumerate() {
            println!("     [{}] {}", idx + 1, error);
        }
        println!();
        Err(format!("{} validation error(s)", errors.len()))
    }
}

/// Get detailed info about a specific hook
/// Usage: vectrune hooks --debug <file.rune> <hook-id>
async fn cmd_hooks_debug(args: &[String]) -> Result<(), String> {
    let file_path = args.get(1).ok_or("Missing file argument")?;
    let hook_id = args.get(2).ok_or("Missing hook-id argument")?;

    log(
        LogLevel::Info,
        &format!("Debug info for hook '{}' in: {}", hook_id, file_path),
    );

    let content = fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let doc = RuneDocument::from_str(&content)
        .map_err(|e| format!("Failed to parse Rune file: {}", e))?;

    let hooks = parse_hooks_from_document(&doc);

    let hook = hooks
        .iter()
        .find(|h| h.id == *hook_id)
        .ok_or_else(|| format!("Hook '{}' not found", hook_id))?;

    println!("\n  🔍 Debug Info for Hook: {}\n", hook.id);
    println!("  ID:               {}", hook.id);
    println!("  Target Key:       {}", hook.target_key);
    println!("  Observer Type:    {:?}", hook.observer_type);
    println!("  Observer Config:");
    for (k, v) in &hook.observer_config {
        println!("    • {} = {}", k, v);
    }
    println!();
    println!("  Custom Logic:     {}", if hook.custom_logic.is_some() { "Yes" } else { "No" });

    if let Some(logic) = &hook.custom_logic {
        println!("\n  Logic Preview:");
        for (line_num, line) in logic.iter().enumerate() {
            println!("    {:3} | {}", line_num + 1, line);
        }
    }

    println!("\n  Status: Ready to use ✓\n");
    Ok(())
}

/// Show general hook information for a file
/// Usage: vectrune hooks --info <file.rune>
async fn cmd_hooks_info(args: &[String]) -> Result<(), String> {
    let file_path = args.get(1).ok_or("Missing file argument")?;

    log(LogLevel::Info, &format!("Hook info for: {}", file_path));

    let content = fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let doc = RuneDocument::from_str(&content)
        .map_err(|e| format!("Failed to parse Rune file: {}", e))?;

    let hooks = parse_hooks_from_document(&doc);

    println!("\n  📊 Hook Statistics:\n");
    println!("  File:              {}", file_path);
    println!("  Total Hooks:       {}", hooks.len());

    if hooks.is_empty() {
        println!("  Status:            No hooks defined");
        println!();
        return Ok(());
    }

    // Count by observer type
    let mut ws_count = 0;
    let mut poll_count = 0;
    let mut sse_count = 0;
    let mut none_count = 0;

    for hook in &hooks {
        match hook.observer_type {
            crate::memory::ReactivityProvider::WebSocket => ws_count += 1,
            crate::memory::ReactivityProvider::Poll => poll_count += 1,
            crate::memory::ReactivityProvider::SSE => sse_count += 1,
            crate::memory::ReactivityProvider::None => none_count += 1,
        }
    }

    println!("  By Type:");
    if ws_count > 0 {
        println!("    • WebSocket:     {}", ws_count);
    }
    if poll_count > 0 {
        println!("    • Poll (HTTP):   {}", poll_count);
    }
    if sse_count > 0 {
        println!("    • SSE:           {}", sse_count);
    }
    if none_count > 0 {
        println!("    • None:          {}", none_count);
    }

    // Unique target keys
    let mut targets: Vec<_> = hooks.iter().map(|h| h.target_key.clone()).collect();
    targets.sort();
    targets.dedup();

    println!("  Unique Targets:    {}", targets.len());
    for target in &targets {
        let count = hooks.iter().filter(|h| h.target_key == *target).count();
        println!("    • {}: {} hook(s)", target, count);
    }

    // Hooks with custom logic
    let custom_logic_count = hooks.iter().filter(|h| h.custom_logic.is_some()).count();
    println!("  With Custom Logic: {}", custom_logic_count);
    println!("  Status:            ✓ Ready\n");

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn invalid_subcommand_error() {
        let result = cmd_hooks(&vec!["--invalid".to_string()]).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn list_missing_file_error() {
        let result = cmd_hooks_list(&vec![]).await;
        assert!(result.is_err());
    }
}




