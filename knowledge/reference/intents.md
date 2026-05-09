# Intent Reference

> **Source of truth:** `src/vectrune/ast.rs` — `Intent` enum  
> **Agent:** Intent and Language Building Agent (`documents/feature/intent_language_agent/feature.md`)

Intents encode what a Vectrune document *wants to do* at a semantic level. Each intent maps to a variant of the `Intent` enum and governs how the runtime (or a future execution layer) drives the interaction.

---

## WeightTimelineSurvey

**Status:** partial

A multi-step survey that collects temporal weight or life-event data from a user.

| Field | Type | Description |
|---|---|---|
| `title` | `String` | Displayed title of the survey |
| `intro` | `String` | Introductory text shown before the first question |
| `birth_year_prompt` | `String` | Prompt text asking the user for their birth year |

**Example (`.rune` sketch):**

```
language: en
intent: WeightTimelineSurvey
  title: "Your Weight History"
  intro: "We'll walk through key moments in your life."
  birth_year_prompt: "What year were you born?"
```

---

## Onboarding

**Status:** partial

Guides a new user through a welcome message, a series of named steps (prompts or labels), and a completion acknowledgment.

| Field | Type | Description |
|---|---|---|
| `welcome_message` | `String` | Shown before the first step |
| `steps` | `Vec<String>` | Ordered list of prompts or step labels |
| `completion_message` | `String` | Shown after all steps complete |

**Example (`.rune` sketch):**

```
language: en
intent: Onboarding
  welcome_message: "Welcome to Vectrune! Let's get you set up."
  steps:
    - "What is your name?"
    - "What is your role? (developer / designer / other)"
  completion_message: "You're all set. Happy building!"
```

---

## FormWizard

**Status:** partial

A step-by-step guided form with optional validation at each step before proceeding.

| Field | Type | Description |
|---|---|---|
| `title` | `String` | Title shown at the top of the form |
| `steps` | `Vec<String>` | Ordered step names or prompts |
| `submit_label` | `String` | Label for the final submission action |

---

## QADialog

**Status:** partial

A question-and-answer dialog where the app asks and the user responds sequentially.

| Field | Type | Description |
|---|---|---|
| `questions` | `Vec<String>` | Ordered list of questions posed to the user |
| `completion_message` | `Option<String>` | Optional message shown after all questions are answered |

---

## DataCollectionFlow

**Status:** partial

A structured data capture flow with named fields and optional branching.

| Field | Type | Description |
|---|---|---|
| `title` | `String` | Title of the collection flow |
| `fields` | `Vec<String>` | List of field names to collect |
| `completion_message` | `Option<String>` | Optional message shown on completion |

---

## Adding a New Intent

To add a new intent type:

1. Add the variant to the `Intent` enum in `src/vectrune/ast.rs` with all required fields. All variants must derive `Debug`, `Clone`, `PartialEq`.
2. Add a parser stub or dispatch arm (use `// TODO: implement runtime for <IntentName>` if execution is not yet implemented).
3. Add a `.rune` example under `examples/`.
4. Add an entry to this file with: variant name, status label, fields table, and a `.rune` example sketch.
5. Update `knowledge/manifest.yaml` if a new knowledge page is created.
6. Update `knowledge/language/core-language.md` to mention the new intent.

**Never remove an existing variant.** To retire an intent, label it `// deprecated` in the source and note it here.

