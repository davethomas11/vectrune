// ============================================================================
// Lexer — tokenize raw .rune source text into a flat token stream
// ============================================================================

export type TokenKind =
  | 'Shebang'       // #!RUNE
  | 'Comment'       // # ...
  | 'Import'        // import "..."
  | 'Section'       // @App, @Route/GET /users, etc.
  | 'KeyValue'      // key = value  (top-level key-value inside a section)
  | 'BlockHeader'   // run:, fields:, props: (colon-terminated block openers)
  | 'BlockLine'     // indented content inside a block
  | 'Blank';        // empty line

export interface Token {
  kind: TokenKind;
  raw: string;
  indent: number;   // number of leading spaces
  line: number;     // 1-based line number
}

// ---------------------------------------------------------------------------

const SECTION_RE = /^@([A-Za-z][A-Za-z0-9_/-]*)(.*)$/;
const SHEBANG_RE = /^#!RUNE\s*$/;
const COMMENT_RE = /^#/;
const IMPORT_RE = /^import\s+"(.+)"\s*$/;
const KV_RE = /^([A-Za-z_][\w.-]*)\s*=\s*(.*)$/;
// A block header ends with a bare colon (not part of a URL / value)
const BLOCK_HEADER_RE = /^([A-Za-z_][\w-]*):\s*(?:#.*)?$/;

function countLeadingSpaces(line: string): number {
  let i = 0;
  while (i < line.length && line[i] === ' ') i++;
  return i;
}

/**
 * Tokenize a raw .rune source string.
 * Returns an array of tokens describing the structural units of the document.
 */
export function tokenize(source: string): Token[] {
  const lines = source.split(/\r?\n/);
  const tokens: Token[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const lineNum = i + 1;
    const indent = countLeadingSpaces(rawLine);
    const trimmed = rawLine.slice(indent);

    // Blank line
    if (trimmed === '') {
      tokens.push({ kind: 'Blank', raw: rawLine, indent, line: lineNum });
      continue;
    }

    // Top-level (indent === 0) special cases
    if (indent === 0) {
      // Shebang
      if (SHEBANG_RE.test(trimmed)) {
        tokens.push({ kind: 'Shebang', raw: trimmed, indent: 0, line: lineNum });
        continue;
      }

      // Comment
      if (COMMENT_RE.test(trimmed)) {
        tokens.push({ kind: 'Comment', raw: trimmed, indent: 0, line: lineNum });
        continue;
      }

      // Import
      const importMatch = trimmed.match(IMPORT_RE);
      if (importMatch) {
        tokens.push({ kind: 'Import', raw: importMatch[1], indent: 0, line: lineNum });
        continue;
      }

      // Section header (@...)
      const sectionMatch = trimmed.match(SECTION_RE);
      if (sectionMatch) {
        tokens.push({ kind: 'Section', raw: trimmed, indent: 0, line: lineNum });
        continue;
      }

      // Block header (e.g. run:, fields:)
      if (BLOCK_HEADER_RE.test(trimmed)) {
        tokens.push({ kind: 'BlockHeader', raw: trimmed, indent: 0, line: lineNum });
        continue;
      }

      // Top-level key = value
      if (KV_RE.test(trimmed)) {
        tokens.push({ kind: 'KeyValue', raw: trimmed, indent: 0, line: lineNum });
        continue;
      }

      // Fallback — treat as block line at top level
      tokens.push({ kind: 'BlockLine', raw: trimmed, indent: 0, line: lineNum });
      continue;
    }

    // Indented content — could be a block header or a block line
    if (BLOCK_HEADER_RE.test(trimmed)) {
      tokens.push({ kind: 'BlockHeader', raw: trimmed, indent, line: lineNum });
      continue;
    }

    tokens.push({ kind: 'BlockLine', raw: trimmed, indent, line: lineNum });
  }

  return tokens;
}
