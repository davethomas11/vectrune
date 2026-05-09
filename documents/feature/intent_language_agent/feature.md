# Intent and Language Building Agent – Feature Document

## Overview

The **Intent and Language Building Agent** is a specialized AI agent whose sole responsibility is to expand and maintain the `Intent` enum in `src/vectrune/ast.rs` and the associated `VectruneDocument` language structures.

Given a plain-language description of a new user interaction pattern (e.g., a survey, a wizard, a form, a dialog), the agent:

1. Defines a new `Intent` variant in `src/vectrune/ast.rs`.
2. Ensures the variant is properly integrated into the parser, executor, and runtime dispatch.
3. Generates or updates a `.rune` example demonstrating the intent.
4. Updates `knowledge/` to document the new intent type.

---

## Motivation

Intents encode what a Vectrune document *wants to do* at a semantic level. As the language grows, the set of supported intents will expand. Managing this manually is error-prone. A dedicated agent keeps intent definitions consistent, well-documented, and properly wired.

---

## Scope

### In Scope

- Adding new `Intent` variants to `src/vectrune/ast.rs`
- Adding new `VectruneDocument` language metadata fields as required by new intent types
- Generating corresponding parser recognition stubs or dispatch arms (with TODO markers where full runtime logic is deferred)
- Generating `.rune` examples under `examples/` for each new intent
- Updating `knowledge/language/core-language.md` and `knowledge/reference/` with the new intent semantics
- Updating `knowledge/manifest.yaml` when a new knowledge page is added

### Out of Scope

- Full runtime execution logic for a new intent (handed off to the executor/runtime agent or a human)
- UI rendering or frontend output for intent-driven flows
- Deployment or Lambda packaging

---

## Intent Taxonomy (initial)

| Intent Variant | Description |
|---|---|
| `WeightTimelineSurvey` | Multi-step survey that collects temporal weight/event data from a user |
| `FormWizard` | Step-by-step guided form with validation at each step |
| `QADialog` | Question-and-answer dialog where the app asks and the user responds |
| `DataCollectionFlow` | Structured data capture flow (name, fields, optional branches) |
| `Onboarding` | First-run onboarding experience with intro, steps, and a completion action |

---

## Agent Responsibilities

### Input

The agent receives a plain-language description such as:

> "Add an intent for a multi-step onboarding flow that shows a welcome message, collects the user's name and role, and then confirms completion."

### Output

1. **AST update** – A new variant added to the `Intent` enum in `src/vectrune/ast.rs`, with all fields required by the described flow.
2. **Parser stub** – A recognition arm or TODO stub in the relevant parser file so the new intent is at least parseable or flagged as unimplemented.
3. **Example `.rune` file** – A minimal working (or illustrative) `.rune` file under `examples/` demonstrating the new intent.
4. **Knowledge update** – Updated `knowledge/language/core-language.md` and any new reference pages, plus `knowledge/manifest.yaml` if a new page is added.

---

## File Targets

| File | Role |
|---|---|
| `src/vectrune/ast.rs` | Primary home of the `Intent` enum and `VectruneDocument` struct |
| `src/vectrune/` | Parser and runtime dispatch files that must be kept in sync with AST changes |
| `examples/` | One `.rune` example per new intent type |
| `knowledge/language/core-language.md` | Public-facing description of each intent type |
| `knowledge/reference/intents.md` | Reference page for all supported intent variants (create if missing) |
| `knowledge/manifest.yaml` | Updated when a new knowledge page is added |

---

## User Stories

### Story 1: Add a new intent variant from a description

- **As a** Vectrune language author
- **I want** to describe a new user interaction pattern in plain language
- **So that** the agent produces a correct `Intent` variant, a parser stub, and an example `.rune` file

**Acceptance Criteria:**
- The new variant compiles in `src/vectrune/ast.rs` without errors.
- A corresponding `.rune` example exists under `examples/`.
- `knowledge/language/core-language.md` documents the new intent with at least one example snippet.

---

### Story 2: Keep intent variants consistent with the parser

- **As a** Vectrune runtime engineer
- **I want** every `Intent` variant to have at least a stub arm in the parser and executor
- **So that** new intents don't silently fall through at runtime

**Acceptance Criteria:**
- The agent flags or adds a `// TODO: implement runtime for <IntentName>` arm when full execution is not yet supported.
- No `Intent` variant exists in the AST without a corresponding acknowledgment in the parser dispatch.

---

### Story 3: Self-documenting intent registry

- **As a** developer exploring Vectrune intents
- **I want** a single `knowledge/reference/intents.md` file that lists every supported intent variant with its fields and a `.rune` example
- **So that** I can quickly understand what intent types are available without reading source code

**Acceptance Criteria:**
- `knowledge/reference/intents.md` exists and is up to date after any agent run.
- Each entry includes: variant name, fields and types, a `.rune` example, and a status label (`stable` / `partial` / `planned`).

---

## Implementation Notes

- The agent should treat `src/vectrune/ast.rs` as the source of truth. If `knowledge/` and the AST disagree, update `knowledge/`.
- When adding fields to an `Intent` variant, prefer `String` and `Option<String>` for language-level values. Use `Vec<String>` for ordered lists of prompts or steps.
- All new intent variants must derive `Debug`, `Clone`, and `PartialEq` (matching existing derives).
- The agent must never remove existing `Intent` variants — only add or deprecate (label with a `// deprecated` comment and a note in `knowledge/`).

---

## Example: Adding `Onboarding` Intent

### AST change (`src/vectrune/ast.rs`)

```rust
#[derive(Debug, Clone, PartialEq)]
pub enum Intent {
    WeightTimelineSurvey {
        title: String,
        intro: String,
        birth_year_prompt: String,
    },
    Onboarding {
        welcome_message: String,
        steps: Vec<String>,
        completion_message: String,
    },
}
```

### Example `.rune` (`examples/onboarding.rune`)

```
language: en
intent: Onboarding
  welcome_message: "Welcome to Vectrune! Let's get you set up."
  steps:
    - "What is your name?"
    - "What is your role? (developer / designer / other)"
  completion_message: "You're all set. Happy building!"
```

### Knowledge entry (`knowledge/reference/intents.md`)

```markdown
## Onboarding

**Status:** partial

Guides a new user through a welcome message, a series of named steps, and a completion acknowledgment.

| Field | Type | Description |
|---|---|---|
| `welcome_message` | `String` | Shown before the first step |
| `steps` | `Vec<String>` | Ordered list of prompts or step labels |
| `completion_message` | `String` | Shown after all steps complete |
```

---

## Done Criteria

A task handled by this agent is complete when:

1. The new `Intent` variant compiles in `src/vectrune/ast.rs`.
2. A parser stub or dispatch arm exists (even if it returns `unimplemented!()`).
3. A `.rune` example exists under `examples/`.
4. `knowledge/reference/intents.md` is updated.
5. `knowledge/manifest.yaml` references the intents reference page.
6. `knowledge/language/core-language.md` mentions the new intent type.

