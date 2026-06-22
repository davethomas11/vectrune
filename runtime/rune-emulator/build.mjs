import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

const outPath = 'dist/rune-emulator.js';

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'esm',
  outfile: outPath,
  sourcemap: true,
  target: 'es2020',
});

console.log(`Build complete: ${outPath}`);

const targetPath = path.resolve('../../teaching_website/rune-emulator.js');
fs.copyFileSync(outPath, targetPath);
console.log(`Copied emulator to: ${targetPath}`);
