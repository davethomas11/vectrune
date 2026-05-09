# Technical Specification: Resilient Intent Resolution (RIR)

**Feature ID:** V-FT-RIR-001  
**Status:** Draft / Specification  
**Core Components:** `intent_engine`, `ai_adapter`, `linguistic_manifest`

---

## 1. System Architecture

VectRune shall transition from a single-pass parser to a **Three-Tier Resolution Stack**. This ensures that the system is *"Never Wrong, Always Learning."*

### The Resolution Stack

| Tier | Name | Mechanism | Source | Performance |
|---|---|---|---|---|
| 1 | **Literal Match** (Fast Path) | Regex and string-token matching | `knowledge/languages/{lang}.rune` | O(1) to O(n) patterns |
| 2 | **Semantic Normalized Match** (Warm Path) | Substring `contains` + lemmatization (root-word stripping) | — | Avoids API calls |
| 3 | **LLM Fallback** (Elastic Path) | Classification via external Agent — Bring Your Own AI (BYOAI) | — | Network-bound |

---

## 2. Tier 1: The "Healthy" English Intent Library

The first deliverable for AI workers is the expansion of `knowledge/languages/en.rune`.

### Specification for AI Workers

Generate 50+ deterministic patterns for the following core Intents. Ensure patterns are **exclusive** to avoid collision.

#### Intent: `WeightTimelineSurvey`

Required patterns:
- `"How much do I weigh"`
- `"Current weight"`
- `"Weight check"`
- `"poids"` *(FR-EN cross-pollination)*

#### Intent: `Onboarding`

Required patterns:
- `"Let's start"`
- `"Help me set up"`
- `"I am new"`
- `"What is this"`

#### Intent: `DataCollectionFlow`

Required patterns:
- `"Log an entry"`
- `"Record data"`
- `"Save this"`
- `"Track"`

---

## 3. Tier 3: AI Fallback (The BYOAI Adapter)

The `rune-runtime` must implement a **trait-based adapter system** for AI Fallback.

### Configuration Schema (`vectrune.yaml`)

```yaml
ai_fallback:
  enabled: true
  provider: "openai"  # Options: openai, gemini, groq, ollama, custom
  model: "gpt-4o-mini"
  local_endpoint: "http://localhost:11434"  # For Ollama/local workers
  retry_policy:
    max_attempts: 2
    timeout_ms: 1500
```

### The Classifier Prompt Logic

When a Fallback is triggered, the engine shall construct the following context:

- **The Input:** The raw user string.
- **The Registry:** A dynamic list of valid Intent variants from `src/vectrune/ast.rs`.
- **The Directive:** *"Classify the input into one of the Registry variants. If it is a 90%+ match for an intent, return only the variant name. Otherwise, return `UNKNOWN`."*

---

## 4. Integration & Learning Loop

To prevent the AI Fallback from being a "money pit," the system must implement a **Synthetic Learning Loop**.

| Step | Description |
|---|---|
| **Trigger** | Fallback successfully resolves `"How heavy am I?"` → `WeightTimelineSurvey` |
| **Action** | The CLI flags this as a *Candidate Pattern* |
| **Prompt** | `VectRune learned a new way to say 'WeightTimelineSurvey'. Add to en.rune? [Y/n]` |
| **Persist** | New pattern written back to the local `.rune` language file, moving from Tier 3 (paid/slow) → Tier 1 (free/instant) |

---

## 5. Implementation Task List for AI Agents

- [ ] **Agent-Code:** Implement `src/execution/ai_adapter.rs` with support for `reqwest` to OpenAI/Gemini endpoints.
- [ ] **Agent-Language:** Populate `en.rune` with 100 high-probability weight/health/navigation phrases.
- [ ] **Agent-WASM:** Ensure `wasm-init.js` can handle the async nature of an AI API call without blocking the UI thread.
