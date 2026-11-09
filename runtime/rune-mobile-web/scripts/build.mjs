import { spawnSync } from 'node:child_process';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(mobileRoot, '../..');

// The existing compiler embeds Rune-Web's runtime. No parser or VM is duplicated here.
export function compilePage({ source, binary, run = spawnSync }) {
  const args = [resolve(source), '-o', 'html'];
  const result = binary
    ? run(binary, args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
    : run('cargo', ['run', '--quiet', '--manifest-path', resolve(repoRoot, 'Cargo.toml'), '--', ...args],
      { cwd: repoRoot, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Rune compilation failed:\n${result.stderr || result.signal || result.status}`);
  return prepareHtml(result.stdout);
}

export function prepareHtml(html) {
  if (!/^\s*<!doctype html>/i.test(html) || !/<head>/i.test(html) || !/<\/body>/i.test(html)) {
    throw new Error('Expected a complete HTML document from vectrune; refusing to package compiler output.');
  }
  // Let the Rune styles account for device cutouts using env(safe-area-inset-*).
  return html.replace(
    /(<meta\s+name="viewport"\s+content=")([^"]*)(")/i,
    (_, start, value, end) => `${start}${value}, viewport-fit=cover${end}`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const source = process.argv[2] || resolve(repoRoot, 'examples/rune_mobile_web/app.rune');
    const html = compilePage({ source, binary: process.env.VECTRUNE_BIN });
    const destination = resolve(mobileRoot, 'www');
    mkdirSync(destination, { recursive: true });
    writeFileSync(resolve(destination, 'index.html.tmp'), html);
    renameSync(resolve(destination, 'index.html.tmp'), resolve(destination, 'index.html'));
    console.log(`Built ${source} → runtime/rune-mobile-web/www/index.html`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
