# 📘 Vectrune Runtime — RFC Overview

This repository contains the reference implementation of **Vectrune**, a human‑readable declarative configuration and functional execution format. Vectrune is designed to describe structured data, workflows, and lightweight API behavior in a single unified language. This document provides an RFC‑style overview of the format, runtime, and design goals.

---

## 🧭 1. Purpose

Vectrune is a **declarative + functional** configuration language intended for:

- describing structured data
- defining executable workflows
- declaring HTTP routes
- binding to built‑in or plugin‑provided functions
- powering lightweight APIs and automation systems

The official Vectrune runtime (implemented in Rust) interprets `.rune` files and exposes their declared behavior through an extensible execution engine.

---

## 📄 2. File Format Summary

Vectrune files are UTF‑8 text documents composed of **sections**, **key/value pairs**, **lists**, and **executable steps**.

### 2.1 File Signature

```
#!RUNE
```

### 2.2 MIME Type

```
text/rune
```

### 2.3 File Extension

```
.rune
```

---

## 🧱 3. Core Syntax

### 3.1 Sections

Sections begin with `@` and may include hierarchical paths:

```
@App
@Database/Credentials
@Route/GET /health
```

### 3.2 Key/Value Assignments

```
name = Example API
version = 1.0
debug = true
```

### 3.3 Inline Lists

```
modes = (safe fast debug)
```

### 3.4 Series Lists

```
run:
    log "Starting"
    db.connect
    respond 200 "OK"
```

### 3.5 Record Lists

```
+ host = api.local
  port = 8080

+ host = db.local
  port = 5432
```

### 3.6 Multiline Strings

```
description >
    This is a block of text.
    It ends at the next blank line.
```

---

## ⚙️ 4. Functional Extensions

Vectrune supports executable behavior through **workflows**, **actions**, and **routes**.

### 4.1 Workflows

```
@Workflow/OnStartup
run:
    log "Booting..."
    db.connect
```

### 4.2 Routes

```
@Route/GET /health
run:
    respond 200 "OK"
```

### 4.3 Built‑in Functions

The runtime includes built‑ins such as:

- `log`
- `respond`
- `parse-json`

Additional functions can be added via Rust plugins.

---

## 🦀 5. Runtime Architecture (Rust)

The RUNE runtime consists of:

### 5.1 Parser
Converts `.rune` text into an AST.

### 5.2 Executor
Runs workflows and route steps in order.

### 5.3 Router
Maps `@Route` sections to HTTP handlers.

### 5.4 Plugin System
Allows external Rust libraries to register new functions.

### 5.5 Context Engine
Stores shared state across steps (e.g., parsed JSON bodies).

---

## 📂 6. Repository Structure

```
rune-runtime/
├─ src/
│  ├─ rune_ast.rs        # AST definitions
│  ├─ rune_parser.rs     # RUNE → AST parser
│  ├─ runtime.rs         # Execution engine + router
│  ├─ builtins.rs        # Built-in functions
│  └─ main.rs            # Runtime entrypoint
├─ examples/
│  └─ app.rune           # Example RUNE application
└─ README.md             # This document
```

---

## 🚀 7. Example RUNE Application

```
#!RUNE

@App
name = Example API
version = 1.0

@Route/GET /health
run:
    log "Health check"
    respond 200 "OK"

@Route/POST /echo
run:
    parse-json
    respond 200 "Echoed"
```

---

## 🔒 8. Security Considerations

- RUNE does not execute arbitrary code.
- Only registered built‑ins or plugins may be invoked.
- Plugins must be explicitly loaded by the runtime.
- No remote includes or dynamic evaluation are supported.

---

## 📜 9. Status

RUNE is currently in **experimental** status.  
The syntax, runtime behavior, and plugin API may evolve as the ecosystem grows.

---

## 🤝 10. Contributing

Contributions are welcome.  
Areas of interest include:

- parser improvements
- plugin system design
- schema validation
- standard library functions
- documentation and examples

