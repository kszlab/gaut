import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../public/${name}`, import.meta.url), 'utf8');

test('the site editor has a jump bar inside its sticky header, built from the sections on the page', () => {
  const html = read('site-editor.html'), js = read('site-editor.js'), css = read('site-editor.css');
  const bar = html.slice(html.indexOf('class="editor-bar"'), html.indexOf('<p class="field-hint">'));
  assert.ok(bar.includes('id="jump"'), 'the jump bar sits in the sticky bar, so it is always at hand');
  assert.ok(js.includes('function renderJump()') && /renderVersions\(\); renderJump\(\);/.test(js), 'rebuilt with every full render');
  assert.ok(js.includes("data-jump=\"${i}\"") || js.includes('data-jump=\\"${i}\\"'), 'chips jump by position: two sections share a title');
  assert.ok(css.includes('scroll-margin-top: calc(var(--bar-h'), 'the section title is not hidden under the sticky bar');
});
