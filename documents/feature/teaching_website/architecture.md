# Vectrune Teaching Website – Architecture

## Overview
- **Frontend:** Rune-Web page/style sections served from `teaching_website/teaching.rune`
- **Playground Backend:** Simple API endpoint (Node, Rust, or serverless) that runs vectrune CLI and returns output/errors
- **Content:** Markdown docs, example .rune files, and walkthroughs
- **Syntax Highlighting:** Local self-hosted JS highlighter for `rune`, PowerShell, and shell samples during the MVP phase; token colors now live in the Rune-Web `@Style` section

## Playground Flow
1. User edits code in browser (Monaco/CodeMirror editor)
2. User clicks "Run"
3. Frontend sends code to backend API (POST /run)
4. Backend runs vectrune CLI with code, returns output/errors
5. Output panel displays result or error

## Folder Structure
- `/teaching_website/teaching.rune` – REST app entry and `@Frontend` mount
- `/teaching_website/parts/` – Rune-Web `@Page` and `@Style` definitions
- `/teaching_website/syntax-highlight.js` – self-hosted code highlighter runtime
- `/docs` – Markdown docs for language tour, API reference, FAQ
- `/examples` – Example .rune files (memory_api.rune, book_graphql.rune, etc.)
- `/playground` – Playground HTML/JS and backend API

## MVP teaching-site note
- Keep code highlighting self-hosted for now so the site works without a frontend framework or CDN dependency.
- Prefer expressing page structure and layout in Rune-Web so the teaching site doubles as a real product example.
- Reuse or extend the local Rune token rules when adding walkthrough pages or a future playground editor.

## Security
- Backend runs vectrune in a sandboxed process (resource/time limits)
- No persistent user data unless accounts are added (stretch goal)
