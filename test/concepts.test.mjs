import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeServer } from '../server.mjs';
import { renderConcept, renderConceptIndex, CONCEPTS } from '../site/concepts.mjs';

async function withServer(fn) {
  const dataDir = mkdtempSync(join(tmpdir(), 'gaut-concepts-'));
  const server = makeServer({ dataDir, password: 'teszt-jelszo-123456' });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try { await fn(`http://127.0.0.1:${server.address().port}`); } finally { await new Promise(r => server.close(r)); rmSync(dataDir, { recursive: true, force: true }); }
}
const textOf = html => html.replace(/<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>|<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ');

test('the concept previews are served without login, hidden from search engines, with their own styles', async () => {
  await withServer(async base => {
    const index = await fetch(`${base}/koncepcio`);
    assert.equal(index.status, 200);
    const indexHtml = await index.text();
    assert.match(indexHtml, /noindex/);
    for (const key of ['a', 'b', 'c']) {
      const res = await fetch(`${base}/koncepcio/${key}`);
      assert.equal(res.status, 200, key);
      const html = await res.text();
      assert.match(html, /name="robots" content="noindex, nofollow"/);
      assert.ok(html.includes(`class="c${key}"`) && html.includes(`/site/${CONCEPTS[key].css}`), key);
      assert.ok(indexHtml.includes(`href="/koncepcio/${key}"`), `the overview links to concept ${key}`);
      const css = await fetch(`${base}/site/${CONCEPTS[key].css}`);
      assert.equal(css.status, 200); assert.equal(css.headers.get('content-type'), 'text/css; charset=utf-8');
    }
    assert.equal((await fetch(`${base}/site/concept-base.css`)).status, 200);
    const mosaicJs = await fetch(`${base}/site/mosaic.js`);
    assert.equal(mosaicJs.status, 200); assert.equal(mosaicJs.headers.get('content-type'), 'text/javascript; charset=utf-8');
    assert.equal((await fetch(`${base}/koncepcio/d`)).status, 404);
    assert.equal((await fetch(`${base}/site/fonts/ibm-plex-mono-latin-400-normal.woff2`)).status, 200);
    assert.equal((await fetch(`${base}/koncepcio/a`, { method: 'POST', headers: { 'x-gaut-request': '1' } })).status, 404);
  });
});

test('the three concepts really differ in structure, and use only the real company copy', () => {
  const [a, b, c] = ['a', 'b', 'c'].map(renderConcept);
  assert.ok(renderConceptIndex().length > 500);
  // different building blocks, not recoloured copies
  assert.ok(a.includes('class="index"') && !b.includes('class="index"') && !c.includes('class="index"'), 'only A has the ruled reference index');
  assert.ok(b.includes('class="mosaic"') && b.includes('/site/mosaic.js') && !a.includes('class="mosaic"') && !c.includes('class="mosaic"'), 'only B shows the references as a mosaic of image tiles');
  assert.ok(b.includes('/site/img/hero-2.webp') && !a.includes('/site/img/') && !c.includes('/site/img/'), 'only B is photo-led');
  assert.ok(c.includes('<svg class="diagram"') && !a.includes('class="diagram"') && !b.includes('class="diagram"'), 'only C carries the architecture diagram');
  assert.ok(c.includes('<table>') && !a.includes('<table>') && !b.includes('<table>'), 'only C presents references as a table');
  const fonts = Object.fromEntries(['a', 'b', 'c'].map(k => [k, readFileSync(new URL(`../public/site/concept-${k}.css`, import.meta.url), 'utf8').match(/--body: "([^"]+)"/)[1]]));
  assert.equal(new Set(Object.values(fonts)).size, 3, 'three different body typefaces');
  // real copy from the company description, and nothing invented: no figures about years, projects or references
  for (const html of [a, b, c]) {
    const text = textOf(html);
    assert.ok(text.includes('DDC- és PLC-készülékek') && text.includes('Gyártófüggetlen választás'), 'the real company text is used');
    assert.ok(!/\d+\s*(év|éves|projekt|referencia|munkatárs|ügyfél)/i.test(text.replace(/Tervév\s*\d{4}/g, '')), 'no invented statistics');
    assert.ok(text.includes('Minta') || text.includes('Mintaprojektek'), 'sample content is labelled');
  }
  // the diagram uses only terms from the company description
  const diagram = /<svg class="diagram"[\s\S]*?<\/svg>/.exec(c)[0];
  for (const term of ['DDC / PLC', 'Vezérlőszekrény', 'Épületfelügyeleti rendszer', 'Légtechnika', 'Hő- és füstelvezetés']) assert.ok(diagram.includes(term), term);
  assert.ok(/<title id="dg-t">/.test(diagram) && /<desc id="dg-d">/.test(diagram), 'the diagram has an accessible name and description');
});

// --- accessibility guard for the live site themes: small accent text and muted text must reach 4.5:1 ---
const lum = hex => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (x, y) => { const [hi, lo] = [lum(x), lum(y)].sort((p, q) => q - p); return (hi + 0.05) / (lo + 0.05); };
test('small accent and muted text meet WCAG AA contrast in every identity draft', () => {
  const css = readFileSync(new URL('../public/site/site.css', import.meta.url), 'utf8');
  for (const theme of ['rendszer', 'struktura', 'szinkron']) {
    const block = new RegExp(`\\[data-theme="${theme}"\\]\\s*\\{([^}]*)\\}`).exec(css)[1];
    const v = name => new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(block)[1];
    for (const surface of ['bg', 'alt', 'surface']) {
      assert.ok(ratio(v('accent-text'), v(surface)) >= 4.5, `${theme}: accent text on ${surface} is ${ratio(v('accent-text'), v(surface)).toFixed(2)}`);
      assert.ok(ratio(v('muted'), v(surface)) >= 4.5, `${theme}: muted text on ${surface}`);
      assert.ok(ratio(v('ink'), v(surface)) >= 7, `${theme}: body text on ${surface}`);
    }
    assert.ok(ratio(v('on-accent'), v('accent-strong')) >= 4.5, `${theme}: button text`);
  }
});
