/// Internal abstract syntax tree for Rune-Web frontends.
///
/// This module defines the normalized data structures that represent
/// the parsed `@Page`, `@Style`, and `@Logic` sections.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// A complete Rune-Web frontend definition.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuneWebFrontend {
    /// All page views, keyed by name (e.g., "tic-tac-toe")
    pub page_views: HashMap<String, PageDefinition>,

    /// All reusable component views, keyed by name (e.g., "HeroBanner")
    pub component_definitions: HashMap<String, ComponentDefinition>,

    /// All style definitions, keyed by name (e.g., "game")
    pub style_definitions: HashMap<String, StyleDefinition>,

    /// All logic definitions, keyed by name (e.g., "game")
    pub logic_definitions: HashMap<String, LogicDefinition>,

    /// All i18n locale bundles, keyed by locale code (e.g., "en_us")
    pub i18n_sections: HashMap<String, I18nSection>,
}

/// An i18n locale bundle from `@I18N/<locale>`.
///
/// Each locale bundle holds named translation groups:
/// ```text
/// @I18N/en_us
/// Nav {
///     home = "Home"
///     about = "About"
/// }
/// ```
/// Translations are referenced in view strings as `{i18n.Nav.home}` or `%i18n.Nav.home%`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct I18nSection {
    /// Translation groups, keyed by group name (e.g., "Nav").
    /// Each group maps translation keys to localized strings.
    pub groups: HashMap<String, HashMap<String, String>>,
}

/// A page definition from `@Page/<name>`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct PageDefinition {
    /// Human-readable page title
    pub title: String,

    /// Reference to the style definition to apply
    pub style_ref: Option<String>,

    /// Reference to the logic definition for client behavior
    pub logic_ref: Option<String>,

    /// The view tree structure
    pub view_tree: ViewNode,
}

/// A reusable component definition from `@Component/<name>`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct ComponentDefinition {
    /// The component's normalized view tree.
    pub view_tree: ViewNode,
}

/// A single node in the page view tree.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub enum ViewNode {
    /// An element: `<tag .class #id attr="value" event="handler">`
    Element {
        tag: String,
        classes: Vec<String>,
        id: Option<String>,
        attrs: HashMap<String, String>,
        events: HashMap<String, String>,
        text: Option<String>,
        for_each: Option<ForEachDefinition>,
        children: Vec<ViewNode>,
    },

    /// A loop: `each name, index in list: ...`
    Loop {
        item_name: String,
        index_name: Option<String>,
        collection: String,
        body: Vec<ViewNode>,
    },

    /// A conditional: `if condition: ...`
    Conditional {
        condition: String,
        body: Vec<ViewNode>,
    },

    /// A component invocation scope: injects props as locals before rendering the body.
    /// Props are static string values passed at the component invocation site.
    ComponentScope {
        /// Prop values passed at the invocation site, e.g., `title="Hello"`
        props: HashMap<String, String>,

        /// The expanded component view tree
        body: Box<ViewNode>,
    },

    /// Raw text content
    Text(String),
}

/// A style definition from `@Style/<name>`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct StyleDefinition {
    /// Design tokens: repeated values like colors, sizes
    pub tokens: HashMap<String, String>,

    /// Reusable style presets: named groups of properties
    pub presets: HashMap<String, HashMap<String, String>>,

    /// CSS rules, keyed by selector
    pub rules: HashMap<String, HashMap<String, String>>,
}

/// A logic definition from `@Logic/<name>`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct LogicDefinition {
    /// Local state variables with initial values
    pub state: HashMap<String, String>,

    /// Derived values computed from state
    pub derived: HashMap<String, DerivedDefinition>,

    /// Helper functions scoped to this logic block
    pub helpers: HashMap<String, HelperDefinition>,

    /// Named action handlers (event handlers, lifecycle)
    pub actions: HashMap<String, ActionDefinition>,
}

/// A single action handler.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct ActionDefinition {
    /// Parameters (e.g., from `action play(index):`)
    pub params: Vec<String>,

    /// Body steps (raw Rune-like code for now)
    pub steps: Vec<ActionStep>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForEachDefinition {
    pub item_name: String,
    pub index_name: Option<String>,
    pub collection: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DerivedDefinition {
    pub source: String,
    pub cases: Vec<DerivedCase>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DerivedCase {
    pub matcher: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HelperDefinition {
    pub params: Vec<String>,
    pub body: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ActionStep {
    Statement(String),
    Conditional {
        condition: String,
        steps: Vec<ActionStep>,
    },
}
