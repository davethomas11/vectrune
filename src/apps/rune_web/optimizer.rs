/// Optimizer and chunk extraction for Rune-Web applications.
///
/// Handles route-based code splitting and on-demand XHR loading (`dynamic_xhr = on/auto`)
/// declared in `@Optimizer`.

use super::ast::{MatchCase, OptimizerDefinition, ViewNode};
use std::collections::HashMap;

/// Named destinations used by a navigator, independent of code splitting.
pub fn navigation_routes(root: &ViewNode, bind: &str) -> Vec<String> {
    fn visit(node: &ViewNode, bind: &str, routes: &mut std::collections::HashSet<String>) {
        match node {
            ViewNode::Match { expression, cases } => {
                let is_route = expression.trim() == bind || expression.trim().ends_with(&format!(".{}", bind));
                for case in cases {
                    let name = case.matcher.trim().trim_matches('"').trim_matches('\'');
                    if is_route && !name.is_empty() && name != "_" { routes.insert(name.to_string()); }
                    for child in &case.body { visit(child, bind, routes); }
                }
            }
            ViewNode::Element { children, .. } => { for child in children { visit(child, bind, routes); } }
            ViewNode::Loop { body, .. } | ViewNode::Conditional { body, .. } | ViewNode::MemoryBinding { body, .. } => {
                for child in body { visit(child, bind, routes); }
            }
            ViewNode::ComponentScope { body, .. } => visit(body, bind, routes),
            _ => {}
        }
    }
    let mut routes = std::collections::HashSet::new();
    visit(root, bind, &mut routes);
    let mut routes: Vec<_> = routes.into_iter().collect();
    routes.sort();
    routes
}

/// Result of optimizing a view tree for dynamic XHR loading.
pub struct OptimizedView {
    /// The pruned view tree with lazy route stubs for non-active routes.
    pub view_tree: ViewNode,
    /// Extracted route chunks, keyed by route name (e.g., "documents", "vectworms").
    pub chunks: HashMap<String, Vec<ViewNode>>,
}

/// Traverse the view tree and extract non-active match cases into standalone route chunks.
pub fn extract_route_chunks(
    root: &ViewNode,
    active_route: Option<&str>,
    optimizer: &OptimizerDefinition,
    bound_var: Option<&str>,
) -> OptimizedView {
    if !optimizer.is_active() || !optimizer.is_automatic() {
        return OptimizedView {
            view_tree: root.clone(),
            chunks: HashMap::new(),
        };
    }

    let mut chunks = HashMap::new();
    let initial_route = active_route.unwrap_or("home").trim().to_lowercase();
    let bind = bound_var.unwrap_or("activePage");
    let chunk_base = optimizer.chunk_path.trim_end_matches('/');

    let pruned_tree = prune_node(root, Some(&initial_route), bind, chunk_base, &mut chunks);

    OptimizedView {
        view_tree: pruned_tree,
        chunks,
    }
}

/// Static export needs every named branch, including the normal home branch.
pub fn extract_all_route_chunks(
    root: &ViewNode,
    optimizer: &OptimizerDefinition,
    bound_var: Option<&str>,
) -> OptimizedView {
    let mut chunks = HashMap::new();
    let view_tree = if optimizer.is_active() && optimizer.is_automatic() {
        prune_node(root, None, bound_var.unwrap_or("activePage"), optimizer.chunk_path.trim_end_matches('/'), &mut chunks)
    } else { root.clone() };
    OptimizedView { view_tree, chunks }
}

fn prune_node(
    node: &ViewNode,
    active_route: Option<&str>,
    bind_var: &str,
    chunk_base: &str,
    chunks: &mut HashMap<String, Vec<ViewNode>>,
) -> ViewNode {
    match node {
        ViewNode::Match { expression, cases } => {
            let expr_trimmed = expression.trim();
            let is_route_match = expr_trimmed == bind_var || expr_trimmed.ends_with(&format!(".{}", bind_var));

            if is_route_match {
                let mut new_cases = Vec::new();
                for c in cases {
                    let clean_matcher = c.matcher.trim().trim_matches('"').trim_matches('\'').to_lowercase();
                    if active_route == Some(clean_matcher.as_str()) || clean_matcher == "_" {
                        // Keep active route or default fallback inlined
                        new_cases.push(MatchCase {
                            matcher: c.matcher.clone(),
                            body: c.body.iter().map(|child| prune_node(child, active_route, bind_var, chunk_base, chunks)).collect(),
                        });
                    } else {
                        // Extract to chunk
                        chunks.insert(clean_matcher.clone(), c.body.clone());
                        let chunk_url = format!("{}/{}.json", chunk_base, clean_matcher);
                        new_cases.push(MatchCase {
                            matcher: c.matcher.clone(),
                            body: vec![ViewNode::LazyRoute {
                                route: clean_matcher,
                                chunk_url,
                                fallback: Vec::new(),
                            }],
                        });
                    }
                }
                ViewNode::Match {
                    expression: expression.clone(),
                    cases: new_cases,
                }
            } else {
                ViewNode::Match {
                    expression: expression.clone(),
                    cases: cases.iter().map(|c| MatchCase {
                        matcher: c.matcher.clone(),
                        body: c.body.iter().map(|child| prune_node(child, active_route, bind_var, chunk_base, chunks)).collect(),
                    }).collect(),
                }
            }
        }
        ViewNode::Element {
            tag,
            classes,
            id,
            attrs,
            events,
            text,
            for_each,
            children,
        } => ViewNode::Element {
            tag: tag.clone(),
            classes: classes.clone(),
            id: id.clone(),
            attrs: attrs.clone(),
            events: events.clone(),
            text: text.clone(),
            for_each: for_each.clone(),
            children: children.iter().map(|child| prune_node(child, active_route, bind_var, chunk_base, chunks)).collect(),
        },
        ViewNode::Loop {
            item_name,
            index_name,
            collection,
            body,
        } => ViewNode::Loop {
            item_name: item_name.clone(),
            index_name: index_name.clone(),
            collection: collection.clone(),
            body: body.iter().map(|child| prune_node(child, active_route, bind_var, chunk_base, chunks)).collect(),
        },
        ViewNode::Conditional { condition, body } => ViewNode::Conditional {
            condition: condition.clone(),
            body: body.iter().map(|child| prune_node(child, active_route, bind_var, chunk_base, chunks)).collect(),
        },
        ViewNode::ComponentScope { props, body } => ViewNode::ComponentScope {
            props: props.clone(),
            body: Box::new(prune_node(body, active_route, bind_var, chunk_base, chunks)),
        },
        ViewNode::MemoryBinding { var, key, body } => ViewNode::MemoryBinding {
            var: var.clone(),
            key: key.clone(),
            body: body.iter().map(|child| prune_node(child, active_route, bind_var, chunk_base, chunks)).collect(),
        },
        ViewNode::Comment(s) => ViewNode::Comment(s.clone()),
        ViewNode::Text(s) => ViewNode::Text(s.clone()),
        ViewNode::LazyRoute { route, chunk_url, fallback } => ViewNode::LazyRoute {
            route: route.clone(),
            chunk_url: chunk_url.clone(),
            fallback: fallback.clone(),
        },
    }
}

