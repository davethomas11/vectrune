import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: false,
  format: 'iife',
  globalName: '__RuneWeb',
  outfile: 'dist/rune-runtime.js',
  target: ['es2020'],
});

console.log('Built dist/rune-runtime.js');
