# Vectrune Teaching Website – Architecture

## Overview
- **Frontend:** Static site (Astro, Next.js, or plain HTML/JS for MVP)
- **Playground Backend:** Simple API endpoint (Node, Rust, or serverless) that runs vectrune CLI and returns output/errors
- **Content:** Markdown docs, example .rune files, and walkthroughs
- **Syntax Highlighting:** Local static JS/CSS highlighter for `rune`, PowerShell, and shell samples during the MVP phase

## Playground Flow
1. User edits code in browser (Monaco/CodeMirror editor)
2. User clicks "Run"
3. Frontend sends code to backend API (POST /run)
4. Backend runs vectrune CLI with code, returns output/errors
5. Output panel displays result or error

## Folder Structure
- `/public` – Static assets (logo, CSS, JS)
- `/docs` – Markdown docs for language tour, API reference, FAQ
- `/examples` – Example .rune files (memory_api.rune, book_graphql.rune, etc.)
- `/playground` – Playground HTML/JS and backend API

## MVP teaching-site note
- Keep code highlighting self-hosted and static for now so the site works without a frontend framework or CDN dependency.
- Reuse or extend the local Rune token rules when adding walkthrough pages or a future playground editor.

## Security
- Backend runs vectrune in a sandboxed process (resource/time limits)
- No persistent user data unless accounts are added (stretch goal)
