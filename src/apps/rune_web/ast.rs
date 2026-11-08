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

    /// URL Navigation state synchronization (from `@Navigator`)
    pub navigator: Option<NavigatorDefinition>,

    /// SEO configuration and route metadata (from `@SEO` and `@SEO/<route>`)
    pub seo: Option<SeoDefinition>,

    /// Optimizer configuration for code splitting and on-demand XHR loading (from `@Optimizer`)
    pub optimizer: Option<OptimizerDefinition>,
}

/// Optimizer configuration from `@Optimizer`.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct OptimizerDefinition {
    /// "on", "auto", "lazy", or "off"
    pub dynamic_xhr: String,
    /// Whether to background pre-load all route chunks while on the main page
    pub pre_load: bool,
    /// Base URL path for route chunks (defaults to "/assets/routes")
    pub chunk_path: String,
}

impl OptimizerDefinition {
    pub fn is_active(&self) -> bool {
        self.dynamic_xhr == "on" || self.dynamic_xhr == "auto" || self.dynamic_xhr == "lazy"
    }

    pub fn is_automatic(&self) -> bool {
        self.dynamic_xhr == "on" || self.dynamic_xhr == "auto"
    }
}

/// SEO configuration for an individual route or page.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct SeoRouteConfig {
    /// Page title displayed in browser tab and social link previews
    pub title: Option<String>,
    /// Meta description for search engines and social card previews
    pub description: Option<String>,
    /// OpenGraph and Twitter card preview image URL
    pub image: Option<String>,
}

/// Global SEO definition from `@SEO` and `@SEO/<route>`.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct SeoDefinition {
    /// Default application title
    pub title: Option<String>,
    /// Default meta description
    pub description: Option<String>,
    /// Default social preview image URL
    pub image: Option<String>,
    /// Route-specific SEO overrides, keyed by route name (e.g. "games", "vectworms")
    pub routes: HashMap<String, SeoRouteConfig>,
}

/// A navigator definition for URL state synchronization (from `@Navigator`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NavigatorDefinition {
    /// The reactive state property bound to URL (e.g. "activePage")
    pub bind: String,
    /// Navigation mode: "auto", "query", "hash", or "path" (defaults to "auto")
    pub mode: String,
    /// Parameter name in query string or hash prefix (e.g. "page", defaults to "page")
    pub param: String,
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

    /// Meta description for SEO and social previews
    pub description: Option<String>,

    /// Reference to the style definition to apply
    pub style_ref: Option<String>,

    /// Reference to the logic definition for client behavior
    pub logic_ref: Option<String>,

    /// Inline state variables
    pub state: HashMap<String, String>,

    /// The view tree structure
    pub view_tree: ViewNode,
}

/// A declared prop for a `@Component/<name>`.
///
/// Props ending with `?` in the source are optional; all others are required.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PropDeclaration {
    /// The prop name without any trailing `?`.
    pub name: String,
    /// `true` when the prop was declared with a trailing `?` (e.g., `name?`).
    pub required: bool,
}

/// A reusable component definition from `@Component/<name>`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct ComponentDefinition {
    /// Declared props (from `props: [name, id?, ...]`).
    /// When `None`, the component declares no props and no validation is performed.
    /// When `Some(vec)`, each required prop must be passed at every invocation site.
    pub props: Option<Vec<PropDeclaration>>,

    /// Inline state variables
    pub state: HashMap<String, String>,

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

    /// A match switch: `match expression: ...`
    Match {
        expression: String,
        cases: Vec<MatchCase>,
    },

    /// A component invocation scope: injects props as locals before rendering the body.
    /// Props are static string values passed at the component invocation site.
    ComponentScope {
        /// Prop values passed at the invocation site, e.g., `title="Hello"`
        props: HashMap<String, String>,

        /// The expanded component view tree
        body: Box<ViewNode>,
    },

    /// A memory binding: `var = get-memory key`
    /// Reads `key` from server memory into a local variable `var` for child nodes.
    MemoryBinding {
        /// The local variable name to bind the memory value to
        var: String,
        /// The memory key to read from
        key: String,
        /// Child nodes rendered with `var` in scope
        body: Vec<ViewNode>,
    },

    /// HTML comment (not escaped)
    Comment(String),

    /// Raw text content
    Text(String),

    /// A lazy route chunk loaded on-demand via network request (from `@Optimizer dynamic_xhr = on/auto`)
    LazyRoute {
        route: String,
        chunk_url: String,
        fallback: Vec<ViewNode>,
    },
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

    /// Responsive overrides in source order, applied after the base rules.
    /// Authored as `responsive:` with media conditions such as
    /// `(max-width: 640px):` containing the same selector/property syntax as `rules:`.
    #[serde(default)]
    pub responsive: Vec<ResponsiveStyleRule>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponsiveStyleRule {
    pub condition: String,
    pub rules: HashMap<String, HashMap<String, String>>,
}

/// A logic definition from `@Logic/<name>`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct LogicDefinition {
    /// Local state variables with initial values
    pub state: HashMap<String, String>,

    /// Template locals / constants (not exported to public stateJson)
    #[serde(default)]
    pub locals: HashMap<String, String>,

    /// Derived values computed from state
    pub derived: HashMap<String, DerivedDefinition>,

    /// Helper functions scoped to this logic block
    pub helpers: HashMap<String, HelperDefinition>,

    /// Named action handlers (event handlers, lifecycle)
    pub actions: HashMap<String, ActionDefinition>,

    /// Periodic timer ticker (e.g., "tick 40ms")
    pub timer: Option<String>,

    /// Key bindings mapping key name or code to action name (e.g. "ArrowLeft" -> "moveLeft")
    pub keys: HashMap<String, String>,
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
    ForLoop {
        item_name: String,
        index_name: Option<String>,
        collection: String,
        steps: Vec<ActionStep>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchCase {
    pub matcher: String,
    pub body: Vec<ViewNode>,
}
