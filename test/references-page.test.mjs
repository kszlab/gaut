import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeServer } from '../server.mjs';
import { renderSite, homeReferences, dayOf, HOME_REFERENCES, REFERENCES_PATH } from '../site/site.mjs';
import { INITIAL_CATEGORY_LIST } from '../reference-categories.mjs';

const ref = (id, extra = {}) => ({ id, kind: 'tower', category: 'Szállodák', categoryId: 'szallodak', year: '2020', place: { hu: 'Budapest', en: 'Budapest' }, title: { hu: `Projekt ${id}`, en: '' }, summary: { hu: '', en: '' }, tags: { hu: [], en: [] }, featured: false, cover: null, ...extra });
const many = (n, extra = () => ({})) => Array.from({ length: n }, (_, i) => ref(`r${String(i).padStart(2, '0')}`, extra(i)));
const tiles = html => [...html.matchAll(/<strong>(Projekt [^<]*)<\/strong>/g)].map(m => m[1].slice(8));
const section = html => html.slice(html.indexOf('id="referenciak"'), html.indexOf('</dialog>'));

test('home selection: featured references, a different order each day, the same within a day; the newest fill the gaps', () => {
  assert.equal(HOME_REFERENCES, 9);
  const list = many(30, i => ({ featured: i % 2 === 0 })); // 15 featured
  const monday = homeReferences(list, '2026-11-09'), again = homeReferences(list, '2026-11-09'), tuesday = homeReferences(list, '2026-11-10');
  assert.equal(monday.length, 9); assert.ok(monday.every(r => r.featured));
  assert.deepEqual(monday.map(r => r.id), again.map(r => r.id), 'stable within a day');
  assert.notDeepEqual(monday.map(r => r.id), tuesday.map(r => r.id), 'changes from one day to the next');
  const seen = new Set(); for (let d = 1; d <= 28; d++) for (const r of homeReferences(list, `2026-12-${String(d).padStart(2, '0')}`)) seen.add(r.id);
  assert.equal(seen.size, 15, 'over a few weeks every featured reference gets its turn');
  // too few featured ones: they all show, and the newest others fill up to nine (the list arrives newest first)
  const few = many(20, i => ({ featured: i === 7 || i === 15 }));
  const picked = homeReferences(few, '2026-11-09').map(r => r.id);
  assert.equal(picked.length, 9); assert.ok(picked.includes('r07') && picked.includes('r15'));
  assert.deepEqual(picked.filter(id => id !== 'r07' && id !== 'r15'), ['r00', 'r01', 'r02', 'r03', 'r04', 'r05', 'r06']);
  assert.deepEqual(homeReferences(many(4), '2026-11-09').map(r => r.id), ['r00', 'r01', 'r02', 'r03'], 'fewer than nine references: all of them');
  assert.match(dayOf(new Date('2026-11-09T23:30:00Z')), /^2026-11-10$/, 'the day follows Budapest time');
});

test('home page shows nine tiles without a filter and a counted link to the subpage; all tiles have one size', () => {
  const list = many(30, i => ({ featured: i < 12 }));
  const hu = renderSite({ lang: 'hu', references: list, categories: INITIAL_CATEGORY_LIST, day: '2026-11-09' });
  assert.equal(tiles(section(hu)).length, 9);
  assert.deepEqual(tiles(section(hu)).sort(), homeReferences(list, '2026-11-09').map(r => r.id).sort());
  assert.ok(!section(hu).includes('class="filters"') && !section(hu).includes('data-filter'), 'no category filter over nine tiles');
  assert.match(hu, /<p class="refs-more"><a class="btn" href="\/referenciak">Összes referencia \(30\) /);
  assert.match(renderSite({ lang: 'en', references: list, day: '2026-11-09' }), /<a class="btn" href="\/en\/references">All projects \(30\) /);
  assert.ok(!hu.includes('mt big'));
  assert.ok(!renderSite({ lang: 'hu', references: many(5) }).includes('refs-more'), 'nothing more to show, no button');
  const edited = renderSite({ lang: 'hu', references: list, content: { hu: { refsAll: 'Minden munkánk' }, en: {} } });
  assert.ok(edited.includes('>Minden munkánk (30) '), 'the button label is editable');
  assert.ok(!readFileSync(new URL('../public/site/site.css', import.meta.url), 'utf8').includes('.mt.big'));
  assert.ok(readFileSync(new URL('../public/references.html', import.meta.url), 'utf8').includes('Kiemelt referencia (megjelenhet a főoldali válogatásban)'));
});

test('references subpage: every reference, the category comes from the address, same shell as the home page', () => {
  const list = [...many(12), ...many(3, () => ({ categoryId: 'irodahazak', category: 'Irodaházak' })).map((r, i) => ({ ...r, id: `o${i}`, title: { hu: `Projekt o${i}`, en: '' } }))];
  const opts = { page: 'references', references: list, categories: INITIAL_CATEGORY_LIST };
  const all = renderSite({ lang: 'hu', ...opts });
  assert.equal((all.match(/<h1[ >]/g) || []).length, 1); assert.ok(all.includes('<h1 class="page-title">Referenciák</h1>'));
  assert.ok(all.includes('<title>Referenciák | GAUT Mérnökiroda</title>') && all.includes('class="theme-switch"'));
  assert.equal(tiles(all).length, 15, 'no upper limit on the subpage');
  assert.ok(all.includes('<a class="chip on" href="/referenciak" aria-current="true">Mind</a>'));
  const offices = renderSite({ lang: 'hu', ...opts, category: 'irodahazak' });
  assert.deepEqual(tiles(offices), ['o0', 'o1', 'o2']);
  assert.ok(offices.includes('<a class="chip on" href="/referenciak?kategoria=irodahazak" aria-current="true">Irodaházak</a>') && offices.includes('<a class="chip" href="/referenciak">Mind</a>'));
  assert.ok(offices.includes('href="/referenciak?kategoria=szallodak"'), 'the other categories stay reachable from a filtered page');
  for (const unknown of ['nincs-ilyen', 'lakoepuletek', '"><script>']) assert.equal(tiles(renderSite({ lang: 'hu', ...opts, category: unknown })).length, 15, 'an unknown or empty category shows everything');
  assert.ok(!renderSite({ lang: 'hu', ...opts, category: '"><script>' }).includes('"><script>'));
  // navigation
  assert.ok(all.includes(`<a href="${REFERENCES_PATH.hu}" aria-current="page">Referenciák</a>`) && all.includes('<a href="/#kapcsolat">Kapcsolat</a>'));
  assert.ok(all.includes('<a class="lang" href="/en/references"') && renderSite({ lang: 'en', ...opts }).includes('<a class="lang" href="/referenciak"'));
  assert.ok(all.includes('<link rel="alternate" hreflang="hu" href="/referenciak"><link rel="alternate" hreflang="en" href="/en/references">'));
  assert.ok(renderSite({ lang: 'hu', references: list }).includes('<a href="#referenciak">Referenciák</a>'), 'on the home page the menu item still jumps to the section');
});

test('the subpage is served in both languages and filters by ?kategoria=', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'gaut-refpage-'));
  const server = makeServer({ dataDir, password: 'teszt-jelszo-123456' });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const [path, title] of [['/referenciak', 'Referenciák | GAUT Mérnökiroda'], ['/en/references', 'Projects | GAUT Engineering'], ['/referenciak?kategoria=szallodak&tema=3', 'Referenciák | GAUT Mérnökiroda']]) {
      const r = await fetch(`${base}${path}`, { redirect: 'manual' });
      assert.equal(r.status, 200, path);
      const html = await r.text();
      assert.ok(html.includes(`<title>${title}</title>`) && html.includes('noindex') && html.includes('class="mosaic"'), path);
    }
    assert.equal((await fetch(`${base}/referenciak/`, { redirect: 'manual' })).status, 404);
    assert.ok((await (await fetch(`${base}/munkater/referenciak`)).text()).includes('/references.js'), 'the workspace keeps its own address');
  } finally { await new Promise(r => server.close(r)); rmSync(dataDir, { recursive: true, force: true }); }
});
