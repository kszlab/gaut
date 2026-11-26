import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeServer } from '../server.mjs';
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

test('the server really serves every script and stylesheet the public page links (mode.js was once forgotten)', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'gaut-assets-'));
  const server = makeServer({ dataDir, password: 'teszt-jelszo-123456' });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const html = await (await fetch(`${base}/hu`)).text();
    const assets = [...html.matchAll(/(?:src|href)="(\/site\/[^"]+\.(?:js|css))"/g)].map(m => m[1]);
    assert.ok(assets.includes('/site/mode.js') && assets.includes('/site/site.js') && assets.includes('/site/site.css'));
    for (const a of assets) assert.equal((await fetch(`${base}${a}`)).status, 200, a);
  } finally { await new Promise(r => server.close(r)); rmSync(dataDir, { recursive: true, force: true }); }
});

test('the mode script only accepts light and dark', () => {
  const js = readFileSync(new URL('../public/site/mode.js', import.meta.url), 'utf8');
  assert.ok(js.includes("'gaut-mode'") && js.includes("saved === 'light' || saved === 'dark'"));
});

test('night: an uploaded Struktúra image is recoloured like the Rendszer render, the bundled photo only dimmed', () => {
  const darkStruktura = css.split(':root[data-theme="struktura"][data-mode="dark"]')[1].split('}')[0];
  assert.match(darkStruktura, /--hero-filter: invert\(1\) hue-rotate\(180deg\)/);
  assert.match(darkStruktura, /--hero-builtin-filter: brightness\(\.78\)/);
  assert.match(css, /\.hero-img\.hero-builtin \{ filter: var\(--hero-builtin-filter, var\(--hero-filter, none\)\); \}/);
  const builtin = renderSite({ lang: 'hu', theme: 'struktura' });
  assert.ok(builtin.includes('class="hero-img hero-struktura hero-builtin"'), 'the bundled image is marked');
  const custom = renderSite({ lang: 'hu', theme: 'struktura', media: { 'hero.struktura': { id: 'aaaaaaaa-bbbb-cccc-dddd-000000000001', widths: [800, 1600], width: 1600, height: 1000, alt: { hu: '', en: '' } } } });
  assert.ok(/class="hero-img hero-struktura"/.test(custom) && !/hero-struktura hero-builtin/.test(custom), 'an uploaded image is not');
});

test('menu: the page or section in view is underlined in every identity, not only the subpage link', () => {
  assert.ok(css.includes('.nav a:hover, .nav a[aria-current] { border-color: var(--accent); }'));
  assert.ok(!css.includes('.nav a[aria-current="page"] {'));
});
