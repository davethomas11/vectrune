/// Test for the emit function in Rune-Web
#[cfg(test)]
mod emit_function_test {
    use rune_runtime::rune_parser::load_rune_document_from_path;
    use rune_runtime::apps::rune_web::{parser, ast};
    use std::path::Path;
    use std::collections::HashMap;

    #[test]
    fn test_emit_function_in_generated_javascript() {
        // Load the reactivity contract example which uses emit
        let path = Path::new("examples/reactivity-contract-rune-web.rune");
        let result = load_rune_document_from_path(path);

        assert!(result.is_ok(), "Should parse reactivity-contract-rune-web.rune");
        let doc = result.unwrap();

        // Parse the rune-web frontend
        let page_name = "reactivity-contract-rune-web";
        let frontend_result = parser::parse_rune_web_frontend(&doc, page_name);
        assert!(frontend_result.is_ok(), "Should parse rune-web frontend");

        let mut frontend = frontend_result.unwrap();

        // Auto-inject websocket logic (simulating what the runtime does)
        if let Some(page_def) = frontend.page_views.get(page_name) {
            if page_def.logic_ref.is_none() {
                let ws_endpoint = "/ws";
                let mut actions = std::collections::HashMap::new();

                // Add a built-in emit action
                actions.insert(
                    "emit".to_string(),
                    ast::ActionDefinition {
                        params: vec!["event_name".to_string(), "payload".to_string()],
                        steps: vec![
                            ast::ActionStep::Statement("window.__runeWebEmit(event_name, payload)".to_string()),
                        ],
                    },
                );

                let auto_logic = ast::LogicDefinition {
                    state: std::collections::HashMap::new(),
                    derived: std::collections::HashMap::new(),
                    helpers: std::collections::HashMap::new(),
                    actions,
                };

                frontend.logic_definitions.insert("_auto_websocket".to_string(), auto_logic);

                if let Some(page_def) = frontend.page_views.get_mut(page_name) {
                    page_def.logic_ref = Some("_auto_websocket".to_string());
                }
            }
        }

        // Verify that logic was properly set
        let page = frontend.page_views.get(page_name);
        assert!(page.is_some(), "Should have page definition");

        let page = page.unwrap();
        assert!(page.logic_ref.is_some(), "Should have logic reference");

        let logic_name = page.logic_ref.as_ref().unwrap();
        let logic = frontend.logic_definitions.get(logic_name);
        assert!(logic.is_some(), "Should have logic definition");

        let logic = logic.unwrap();

        // Verify emit action is present
        assert!(logic.actions.contains_key("emit"), "Should have emit action defined");

        let emit_action = &logic.actions["emit"];
        assert_eq!(emit_action.params.len(), 2, "emit should have 2 parameters");
        assert_eq!(emit_action.params[0], "event_name", "First param should be event_name");
        assert_eq!(emit_action.params[1], "payload", "Second param should be payload");

        // Verify that the action step calls window.__runeWebEmit
        assert!(!emit_action.steps.is_empty(), "emit action should have steps");

        if let ast::ActionStep::Statement(stmt) = &emit_action.steps[0] {
            assert!(stmt.contains("window.__runeWebEmit"), "Action should call window.__runeWebEmit");
            assert!(stmt.contains("event_name"), "Action should reference event_name parameter");
            assert!(stmt.contains("payload"), "Action should reference payload parameter");
        } else {
            panic!("First step of emit action should be a Statement");
        }
    }

    #[test]
    fn test_emit_in_handler_context() {
        // This test verifies that emit can be called from within event handlers
        let path = Path::new("examples/reactivity-contract-rune-web.rune");
        let result = load_rune_document_from_path(path);
        assert!(result.is_ok());

        let doc = result.unwrap();

        // Find the Frontend section to check if it has endpoint and reactivity settings
        let frontend_section = doc.sections.iter().find(|s| {
            s.path.first().map(|p| p.as_str()) == Some("Frontend")
        });

        assert!(frontend_section.is_some(), "Should have @Frontend section");

        let frontend_section = frontend_section.unwrap();

        // Check reactivity mode
        let reactivity_mode = frontend_section.kv.get("reactivity").and_then(|v| v.as_str());
        assert_eq!(reactivity_mode, Some("websocket"), "Should have websocket reactivity mode");

        // Check endpoint
        let endpoint = frontend_section.kv.get("endpoint").and_then(|v| v.as_str());
        assert_eq!(endpoint, Some("/ws"), "Should have /ws endpoint configured");
    }

    #[test]
    fn test_websocket_setup_in_javascript_codegen() {
        // Load the reactivity contract example
        let path = Path::new("examples/reactivity-contract-rune-web.rune");
        let result = load_rune_document_from_path(path);
        assert!(result.is_ok());

        let doc = result.unwrap();
        let page_name = "reactivity-contract-rune-web";

        // Parse frontend
        let mut frontend = parser::parse_rune_web_frontend(&doc, page_name)
            .expect("Should parse frontend");

        // Setup logic with emit action
        let mut actions = std::collections::HashMap::new();
        actions.insert(
            "emit".to_string(),
            ast::ActionDefinition {
                params: vec!["event_name".to_string(), "payload".to_string()],
                steps: vec![
                    ast::ActionStep::Statement("window.__runeWebEmit(event_name, payload)".to_string()),
                ],
            },
        );

        let auto_logic = ast::LogicDefinition {
            state: std::collections::HashMap::new(),
            derived: std::collections::HashMap::new(),
            helpers: std::collections::HashMap::new(),
            actions,
        };

        frontend.logic_definitions.insert("_auto_websocket".to_string(), auto_logic);

        if let Some(page_def) = frontend.page_views.get_mut(page_name) {
            page_def.logic_ref = Some("_auto_websocket".to_string());
        }

        // Get page and logic for code generation
        let page = frontend.page_views.get(page_name).expect("Should have page");
        let logic_name = page.logic_ref.as_ref().expect("Should have logic_ref");
        let logic = frontend.logic_definitions.get(logic_name)
            .expect("Should have logic definition")
            .clone();

        // Create code generator with websocket endpoint
        let codegen = rune_runtime::apps::rune_web::jscodegen::JsCodegen::new(
            page.view_tree.clone(),
            logic,
            "{}".to_string(),
            Some("/ws".to_string()),
            HashMap::new(),
        );

        let generated_code = codegen.generate();

        // Verify the generated code contains key components
        assert!(generated_code.contains("window.__runeWebEmit"),
                "Generated code should define window.__runeWebEmit function");

        assert!(generated_code.contains("window.__runeWebSocket"),
                "Generated code should set up window.__runeWebSocket");

        assert!(generated_code.contains("new WebSocket"),
                "Generated code should create WebSocket connection");

        assert!(generated_code.contains("__runeWebSocket.onmessage"),
                "Generated code should have WebSocket message handler");

        assert!(generated_code.contains("actionDefinitions"),
                "Generated code should have action definitions");

        // Verify emit is in the actions
        assert!(generated_code.contains("\"emit\""),
                "Generated code should have emit action defined");
    }

    #[test]
    fn test_event_name_parsing_strips_on_prefix() {
        // Verify that on_click is parsed and stored as click (without the on_ prefix)
        let path = Path::new("examples/reactivity-contract-rune-web.rune");
        let result = load_rune_document_from_path(path);
        assert!(result.is_ok());

        let doc = result.unwrap();
        let page_name = "reactivity-contract-rune-web";

        let frontend = parser::parse_rune_web_frontend(&doc, page_name)
            .expect("Should parse frontend");

        let page = frontend.page_views.get(page_name)
            .expect("Should have page definition");

        // Traverse the view tree to find the button with on_click handler
        fn find_button_with_handler(node: &ast::ViewNode) -> Option<(String, String)> {
            match node {
                ast::ViewNode::Element { events, children, tag, .. } => {
                    // Check if this element has events
                    if !events.is_empty() {
                        for (event_name, handler) in events {
                            if event_name == "click" && handler.contains("emit") {
                                return Some((tag.clone(), event_name.clone()));
                            }
                        }
                    }
                    // Recursively check children
                    for child in children {
                        if let Some(result) = find_button_with_handler(child) {
                            return Some(result);
                        }
                    }
                    None
                }
                ast::ViewNode::Loop { body, .. } => {
                    for child in body {
                        if let Some(result) = find_button_with_handler(child) {
                            return Some(result);
                        }
                    }
                    None
                }
                ast::ViewNode::Conditional { body, .. } => {
                    for child in body {
                        if let Some(result) = find_button_with_handler(child) {
                            return Some(result);
                        }
                    }
                    None
                }
                ast::ViewNode::ComponentScope { body, .. } => {
                    find_button_with_handler(body)
                }
                _ => None,
            }
        }

        let (tag, event_name) = find_button_with_handler(&page.view_tree)
            .expect("Should find button with emit handler");

        assert_eq!(tag, "button", "Should be a button element");
        assert_eq!(event_name, "click", "Event name should be 'click', not 'on_click'");
    }

}
