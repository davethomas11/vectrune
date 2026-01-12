Vectrune
========

Vectrune is a **declarative + functional** configuration language intended for:
- describing structured data

Tagline: Vectrune: Structured data in motion.

What does Vectrune look like?
----------------------------
Here is a simple example of a Vectrune script showing some basic data about some skateboarders:

```rune
#!RUNE
@Skateboarder
+ name = Tony Hawk
  age = 53
  style = Vert
 
+ name = Nyjah Huston
  age = 26
  style = Street
  
+ name = Leticia Bufoni
  age = 28
  style = Street
```

Vectrune can also be used for:
- declaring HTTP routes

Example:

```rune
#!RUNE
@Route/GET /health
run:
  respond 200 ok
```

(Things to come: )
- defining executable workflows
- binding to built‑in or plugin‑provided functions
- powering lightweight APIs and automation systems
- DSL integrations into popular frameworks SaaS platforms

Things you can do with Vectrune
-----------------------
Vectrune is a small DSL and runtime for building HTTP APIs (backed by Axum). This repository contains the runtime, built-ins, examples, and integration tests.

Prerequisites
-------------

- Rust toolchain (stable) with Cargo
- macOS/Linux/Windows supported via Rust

Verify your toolchain:

    rustc --version
    cargo --version

Build
-----

From the project root:

    cargo build

Run examples
------------

There are sample Vectrune scripts in "examples/":

- examples/app.rune
- examples/user_api.rune

How to run the binary depends on your local workflow; if you’d like a dedicated CLI entrypoint for executing Vectrune scripts, open an issue or ask for a helper command and we’ll add it. For now, this repository focuses on the runtime and tests.

Tests
-----

This project has unit and integration tests. Integration tests live under "tests/":

- tests/integration_app.rs
- tests/integration_user_api.rs

Run all tests:

    cargo test

Run only a specific integration test file:

    # integration_app.rs
    cargo test --test integration_app

    # integration_user_api.rs
    cargo test --test integration_user_api

Run a single test function (exact name) and show logs/output:

    # From integration_app.rs
    cargo test --test integration_app health_route_returns_ok -- --exact --nocapture

    # From integration_user_api.rs
    cargo test --test integration_user_api get_users_returns_array -- --exact --nocapture
    cargo test --test integration_user_api get_user_by_id_not_found -- --exact --nocapture
    cargo test --test integration_user_api put_user_mismatched_id_triggers_validate -- --exact --nocapture

Useful flags:

    # Show logs if using env_logger/tracing
    RUST_LOG=debug cargo test --test integration_user_api -- --nocapture

    # Run tests single-threaded (if needed for shared resources)
    cargo test -- --test-threads=1

Repository layout
-----------------

- src/ — runtime and built-ins
- examples/ — example Rune scripts
- tests/ — integration tests
- users.csv — sample data file used by examples/tests

License
-------

TBD. Add your license of choice (e.g., MIT/Apache-2.0) here.
