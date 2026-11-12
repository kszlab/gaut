import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderSite, THEMES } from '../site/site.mjs';

const css = readFileSync(new URL('../public/site/site.css', import.meta.url), 'utf8');

test('every page carries the day / night switch and loads the mode script before the stylesheet', () => {
  for (const [lang, names] of [['hu', 'automatikus|világos|sötét'], ['en', 'automatic|light|dark']]) {
    const html = renderSite({ lang });
    assert.equal((html.match(/data-mode-btn/g) || []).length, 1);
    assert.ok(html.includes(`data-names="${names}"`));
    assert.ok(html.indexOf('/site/mode.js') > -1 && html.indexOf('/site/mode.js') < html.indexOf('/site/site.css'), 'the saved choice is applied before the first paint');
    assert.ok(/<script src="\/site\/mode\.js"><\/script>/.test(html), 'a plain external script: the CSP forbids inline scripts');
  }
  assert.ok(renderSite({ lang: 'hu', page: 'references' }).includes('data-mode-btn'));
});

test('each identity has a palette for the mode it does not have by default, for the device setting and for the forced choice', () => {
  const need = { rendszer: 'dark', struktura: 'dark', szinkron: 'light' };
  assert.deepEqual(Object.keys(need).sort(), [...THEMES].sort());
  for (const [theme, scheme] of Object.entries(need)) {
    const other = scheme === 'dark' ? 'light' : 'dark';
    assert.ok(css.includes(`@media (prefers-color-scheme: ${scheme}) { :root[data-theme="${theme}"]:not([data-mode="${other}"])`), `${theme}: follows the device`);
    assert.ok(css.includes(`:root[data-theme="${theme}"][data-mode="${scheme}"] {`), `${theme}: forced choice`);
  }
});

test('the mode script only accepts light and dark', () => {
  const js = readFileSync(new URL('../public/site/mode.js', import.meta.url), 'utf8');
  assert.ok(js.includes("'gaut-mode'") && js.includes("saved === 'light' || saved === 'dark'"));
});
