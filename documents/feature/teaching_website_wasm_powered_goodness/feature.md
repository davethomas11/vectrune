# Feature: Wasm-Powered Interactive Sandbox

## Vision
Transform the Vectrune teaching website into an interactive learning platform by bringing the **actual production runtime** into the browser via WebAssembly (Wasm). Users should be able to write, run, and test Rune code with zero installation, seeing real results in a virtual terminal and a "magic" mocked network layer.

## Core Pillars

### 1. The Browser-Native Runtime
Instead of mocking Rune's behavior with JavaScript, we ship the Rust core (`parser`, `AST`, `execution engine`) as a Wasm module.
- **Source of Truth:** The same Rust code that powers the CLI also powers the sandbox.
- **Tooling:** Built using `wasm-pack` and `wasm-bindgen`.
- **Target:** `wasm32-unknown-unknown` with `web` target.

### 2. "Magic" REST Mocking (Service Worker Model)
To teach API development, the sandbox needs to feel like a real network environment.
- **The Bridge:** A Service Worker intercepts `fetch()` calls to a virtual domain (e.g., `http://sandbox.local`).
- **The Handoff:** Intercepted requests are passed to the Vectrune Wasm module.
- **The Result:** Users can use the browser's real **Network Tab** to inspect requests and responses, making the learning experience 100% authentic to real-world development.

### 3. Stateful Sandbox Memory
The sandbox maintains a persistent `AppState` in the Wasm memory space.
- **Persistence:** Data saved via `set-memory` in one "Run" remains available for subsequent "Requests".
- **Interaction:** Users can `POST` data in the editor and then `GET` it back, simulating a full stateful backend.

### 4. Swappable Language Models (.rune)
The sandbox leverages the new data-driven language model architecture.
- **Embedded Defaults:** Core languages (English, French) are baked into the Wasm binary.
- **Interactive Tuning:** Advanced users can even try writing their own language definitions in the sandbox to see how natural-language intents are resolved.

## Technical Architecture

### Component Diagram
```text
[ Browser UI ] <-> [ sandbox.js ] <-> [ Vectrune Wasm ]
                                             |
                                     [ Virtual Network ]
                                             |
                                     [ Service Worker ]
```

### Key Modules
- **`src/wasm.rs`**: The high-level API exposed to JavaScript (e.g., `run_rune_wasm`, `dispatch_request`).
- **`teaching_website/sandbox.js`**: Orchestrates the UI events, Wasm loading, and terminal output.
- **`teaching_website/sw.js`**: The Service Worker responsible for the virtual domain interception.

## Implementation Roadmap

### Phase 1: The Terminal (Current)
- [x] Basic UI layout in `teaching_website/`.
- [x] Sandbox component in Rune-Web.
- [x] Mock JS bridge for execution.
- [x] Initial `src/wasm.rs` skeleton.

### Phase 2: The Core Handoff
- [ ] Add `wasm-bindgen` and `wasm-pack` support to `Cargo.toml`.
- [ ] Implement `#[cfg(target_arch = "wasm32")]` gates for non-Wasm dependencies (Axum, SQLx).
- [ ] Compile and load the first "Hello World" Wasm module.

### Phase 3: The Virtual Server
- [ ] Implement the `VirtualServer` struct in Rust.
- [ ] Wire up the Service Worker interception.
- [ ] Enable the browser Network Tab for virtual requests.

### Phase 4: State & Intents
- [ ] Connect the `ManifestEngine` to the sandbox for natural-language parsing.
- [ ] Implement persistent `AppState` across the sandbox session.

## Security & Performance
- **Client-Side Isolation:** All code runs in the user's browser; no server-side execution is required.
- **Lazy Loading:** The Wasm module (approx. 1-2MB compressed) is loaded only when the user enters the sandbox section.
