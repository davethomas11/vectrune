# Vectrune Teaching Website – Feature Plan

## Goal
Create an interactive website that teaches users how to use the Vectrune language and runtime, including a playground, language tour, API reference, and runnable examples.

## Key Features
- Homepage: What is Vectrune, key features, and quickstart.
- Playground: Live code editor for .rune files, run button, output panel.
- Language Tour: Step-by-step guide to Vectrune syntax and features.
- API Reference: Builtins, schema, configuration, and environment options.
- Examples Gallery: Runnable, real-world .rune examples.
- How it Works: Architecture, request flow, memory/state, extensibility.
- Getting Started: Install, run, deploy.
- FAQ/Troubleshooting: Common issues and solutions.

## MVP Scope
- Static site (Astro, Next.js, or plain HTML/JS for MVP)
- Playground backend: simple API endpoint that runs vectrune CLI and returns output/errors
- Initial content: memory_api.rune walkthrough, schema, REST route, memory/state, validation

## Stretch Goals
- User accounts and save/share playground sessions
- Interactive REST/GraphQL API explorer
- Visual schema editor
- Lambda deployment walkthrough

## Next Steps
1. Scaffold site structure (folders, index.html, playground.html, etc.)
2. Add initial docs and example walkthroughs
3. Implement playground backend (Node, Rust, or serverless)
4. Integrate code editor and output panel
5. Iterate with user feedback
