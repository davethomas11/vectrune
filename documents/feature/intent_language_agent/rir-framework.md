# Technical Specification: Resilient Intent Resolution (RIR) Framework

**Project:** `davethomas11/vectrune`  
**Version:** 1.0 (Post-`ccceb32`)  
**Target Components:** `src/vectrune/`, `src/execution/`, `knowledge/languages/`

> **Relationship:** This document expands on [`where_to_go_next.md`](./where_to_go_next.md), which defines the three-tier stack. This spec covers the full pipeline mechanics, BYOAI interface requirements, dataset quality standards, the learning loop, and Definition of Done.

---

## 1. Vision & Goals

The RIR Framework implements a tiered approach to understanding user intent. It prioritizes local determinism for speed and privacy, while utilizing LLM classification as a safety net to ensure the system never fails to route a valid request.

| Goal | Target |
|---|---|
| **Zero-Failure Routing** | Every input must map to an Intent variant or a structured `UNKNOWN` |
| **Performance First** | Deterministic matches must resolve in < 5ms |
| **Privacy First** | Local fallback (Ollama/Llama.cpp) preferred over cloud APIs |

---

## 2. Core Architecture: The Resolution Pipeline

The `VectruneEngine` shall process input through the following sequence:

### Tier 1 — Deterministic Pattern Match (The "Hard" Layer)

- **Implementation:** Regex-based matching using `knowledge/languages/en.rune`
- **Worker Task:** Expand `en.rune` to include "Platinum" phrase sets for `WeightTimelineSurvey`, `Onboarding`, and `DataCollectionFlow`
- **Requirement:** Avoid overlapping regex patterns to prevent intent collisions

### Tier 2 — Semantic / Levenshtein Match (The "Soft" Layer)

- **Implementation:** Fuzzy string matching with edit distance < 2 for minor typos (e.g. `"wieght"` vs `"weight"`)
- **Logic:** If Tier 1 fails but Tier 2 finds a high-confidence match, resolve and flag for **Tier 1 Promotion**

### Tier 3 — AI Fallback (The "Elastic" Layer)

- **Trigger:** Total failure of Tier 1 and Tier 2
- **Workflow:** Dispatch raw input to the `AIClassifierAgent`
- **Response:** The agent returns a valid variant name from the `Intent` enum in `src/vectrune/ast.rs`

---

## 3. Technical Requirements: Bring Your Own AI (BYOAI)

### A. Provider Interface

Implement a `trait AIProvider` to allow hot-swapping between backends:

| Provider | Mechanism | Auth |
|---|---|---|
| **OpenAI / Gemini** | REST API calls via `reqwest` | `VECTRUNE_AI_KEY` env var |
| **Local (Ollama)** | Localhost RPC calls | None (offline) |
| **WASM Proxy** | Routes through `wasm-init.js` bridge | — |

### B. The Classification Prompt

The system must generate a dynamic prompt derived from `knowledge/reference/intents.md`:

```
You are the VectRune Intent Dispatcher. Map the user input '{INPUT}' to exactly
one of the following Intent variants: {VARIANT_LIST}.
Return ONLY the variant name. If no variant fits, return UNKNOWN.
```

`VARIANT_LIST` is populated at runtime from the `Intent` enum in `src/vectrune/ast.rs` to stay automatically in sync as new intents are added.

---

## 4. Dataset Specification: The "Strong English" Library

AI workers assigned to `knowledge/languages/en.rune` must populate the file to the following quality standard:

| Category | Minimum | Examples |
|---|---|---|
| **Identity** | 15+ phrases | `"Who are you?"`, `"What is VectRune?"`, `"What can you do?"` |
| **Health / Weight** | 30+ phrases | `"I'm 180 today"`, `"Scale says 85kg"`, `"Just weighed in at..."`, `"Current weight"` |
| **Navigation** | 10+ phrases | `"Go back"`, `"Undo"`, `"Start over"`, `"Restart the flow"` |

**Format:** Use the existing `.rune` key-value structure for easy parsing by `manifest_engine.rs`. Do not invent new syntax — extend what is already there.

---

## 5. The Learning Loop (Post-Execution)

Implement a `LearningAgent` to prevent Tier 3 from becoming a permanent dependency.

```
Tier 3 resolves "How heavy am I?" → WeightTimelineSurvey
         ↓
Log resolution as a Candidate Pattern
         ↓
Aggregate "Common Misses" across sessions
         ↓
Generate patch/PR: promote phrase to Tier 1 en.rune
         ↓
Next time: resolved in < 5ms, no API call needed
```

The agent must:
1. Log every successful Tier 3 resolution to a local append-only file
2. Aggregate common misses above a hit-count threshold
3. Propose additions to `en.rune` — either via prompt or automated PR — moving phrases from paid/slow to free/instant

---

## 6. Definition of Done

- [ ] `src/execution/ai_adapter.rs` exists and handles at least **OpenAI** and **local Ollama** providers via the `AIProvider` trait
- [ ] `knowledge/languages/en.rune` contains at least **100 deterministic patterns** across Identity, Health, and Navigation categories
- [ ] `sandbox.js` successfully visualizes the transition from "Deterministic Fail" to "AI Fallback Success" in the teaching website sandbox
- [ ] Tier 2 fuzzy matching is implemented and covered by at least one test with a deliberate typo input
- [ ] The Learning Loop logs Tier 3 resolutions to a local file and can propose a Tier 1 promotion via CLI prompt

---

## 7. File Map

| File | Role |
|---|---|
| `src/vectrune/ast.rs` | `Intent` enum — source of truth for valid variants |
| `src/vectrune/english.rs` | Tier 1 English matching logic |
| `src/vectrune/compiler.rs` | Orchestrates the resolution pipeline |
| `src/execution/ai_adapter.rs` | *(to be created)* BYOAI trait and provider implementations |
| `knowledge/languages/en.rune` | Deterministic phrase patterns for Tier 1 |
| `knowledge/reference/intents.md` | Intent registry — feeds the AI classifier prompt |
| `teaching_website/sandbox.js` | UI visualization of tier fallback |
| `wasm-init.js` | WASM bridge for AI calls from the teaching site |

