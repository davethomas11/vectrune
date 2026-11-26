import assert from 'node:assert/strict';
import test from 'node:test';
import { compilePage, prepareHtml } from '../scripts/build.mjs';

const html = '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body><div id="app"></div></body></html>';

test('packages HTML and enables safe areas without changing app code', () => {
  const result = prepareHtml(html);
  assert.match(result, /initial-scale=1.0, viewport-fit=cover/);
  assert.match(result, /<div id="app"><\/div>/);
});

test('rejects diagnostic output and truncated exports', () => {
  for (const output of ['Compiler error', 'Starting server\n' + html, '<!doctype html><head>']) {
    assert.throws(() => prepareHtml(output), /complete HTML/);
  }
});

test('compiler failure cannot be packaged as a successful app', () => {
  assert.throws(() => compilePage({ source: 'missing.rune', run: () => ({ status: 1, stderr: 'missing source' }) }), /missing source/);
  assert.throws(() => compilePage({ source: 'app.rune', run: () => ({ error: new Error('cargo missing') }) }), /cargo missing/);
});

test('explicit compiler paths and source paths are passed without a shell', () => {
  const result = compilePage({
    source: '/tmp/mobile app.rune', binary: '/tmp/compiler with spaces',
    run(command, args, options) {
      assert.equal(command, '/tmp/compiler with spaces');
      assert.deepEqual(args, ['/tmp/mobile app.rune', '-o', 'html']);
      assert.equal(options.shell, undefined);
      return { status: 0, stdout: html };
    },
  });
  assert.match(result, /viewport-fit=cover/);
});
