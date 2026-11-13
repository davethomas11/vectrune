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

// The embedded runner shares production expressions/actions; only browser effects differ.
const { resolve } = await import('node:path');
await build({
  entryPoints: ['src/testing/index.ts'],
  bundle: true,
  minify: false,
  format: 'iife',
  globalName: '__RuneWeb',
  outfile: 'dist/rune-logic-test.js',
  target: ['es2020'],
  plugins: [{
    name: 'logic-test-host',
    setup(builder) {
      builder.onResolve({ filter: /^\.\/(audio|effects)$/ }, () => ({
        path: resolve('src/testing/host.ts'),
      }));
    },
  }],
});
console.log('Built dist/rune-logic-test.js');

await build({
  entryPoints: ['src/pixel/index.ts'], bundle: true, minify: false,
  format: 'iife', globalName: '__RunePixelRuntime', outfile: 'dist/rune-pixel.js', target: ['es2020'],
});
console.log('Built dist/rune-pixel.js');
