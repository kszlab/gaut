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
  const cover = { id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', widths: [800], width: 800, height: 600 };
  const few = many(20, i => ({ featured: i === 7 || i === 15, coverMedia: cover }));
  const picked = homeReferences(few, '2026-11-09').map(r => r.id);
  assert.equal(picked.length, 9); assert.ok(picked.includes('r07') && picked.includes('r15'));
  assert.deepEqual(picked.filter(id => id !== 'r07' && id !== 'r15'), ['r00', 'r01', 'r02', 'r03', 'r04', 'r05', 'r06']);
  assert.deepEqual(homeReferences(many(4, () => ({ coverMedia: cover })), '2026-11-09').map(r => r.id), ['r00', 'r01', 'r02', 'r03'], 'fewer than nine references: all of them');
  // a reference without a cover image is never added as a filler, but a featured one shows even without an image
  const mixed = many(20, i => ({ featured: i === 5, coverMedia: i % 2 ? cover : undefined }));
  const shown = homeReferences(mixed, '2026-11-09').map(r => r.id);
  assert.ok(shown.includes('r05'), 'featured without a cover image still shows');
  assert.ok(shown.filter(id => id !== 'r05').every(id => mixed.find(r => r.id === id).coverMedia), 'fillers all have a cover image');
  assert.equal(shown.length, 9);
  assert.deepEqual(homeReferences(many(20), '2026-11-09'), [], 'no featured and no images: nothing is picked on its own');
  assert.match(dayOf(new Date('2026-11-09T23:30:00Z')), /^2026-11-10$/, 'the day follows Budapest time');
});

test('home page shows nine tiles without a filter and a button that opens the full list in place; all tiles have one size', () => {
  const list = many(30, i => ({ featured: i < 12 }));
  const hu = renderSite({ lang: 'hu', references: list, categories: INITIAL_CATEGORY_LIST, day: '2026-11-09' });
  assert.equal(tiles(section(hu)).length, 9);
  assert.deepEqual(tiles(section(hu)).sort(), homeReferences(list, '2026-11-09').map(r => r.id).sort());
  assert.ok(!section(hu).includes('class="filters"') && !section(hu).includes('data-filter'), 'no category filter over nine tiles');
  assert.match(hu, /<p class="refs-more"><a class="btn" href="\/referenciak" data-refs-open>Összes referencia <svg/, 'no count on the button; without scripts it is a link to the subpage');
  assert.ok(hu.includes('data-refs-all="/referenciak?reszlet=1"') && hu.includes('class="refs-full" hidden') && !hu.includes('(30)'));
  assert.match(renderSite({ lang: 'en', references: list, day: '2026-11-09' }), /<a class="btn" href="\/en\/references" data-refs-open>All projects </);
  assert.ok(!hu.includes('mt big'));
  assert.ok(!renderSite({ lang: 'hu', references: many(5, () => ({ coverMedia: { id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', widths: [800], width: 800, height: 600 } })) }).includes('data-refs-open'), 'nothing more to show, no button');
  const edited = renderSite({ lang: 'hu', references: list, content: { hu: { refsAll: 'Minden munkánk' }, en: {} } });
  assert.ok(edited.includes('>Minden munkánk <'), 'the button label is editable');
  assert.ok(!readFileSync(new URL('../public/site/site.css', import.meta.url), 'utf8').includes('.mt.big'));
  assert.ok(readFileSync(new URL('../public/references.html', import.meta.url), 'utf8').includes('Kiemelt referencia (megjelenhet a főoldali válogatásban)'));
});

test('references subpage: every reference, the category comes from the address, same shell as the home page', () => {
  const list = [...many(12), ...many(3, () => ({ categoryId: 'irodahazak', category: 'Irodaházak' })).map((r, i) => ({ ...r, id: `o${i}`, title: { hu: `Projekt o${i}`, en: '' } }))];
  const opts = { page: 'references', references: list, categories: INITIAL_CATEGORY_LIST };
  const all = renderSite({ lang: 'hu', ...opts });
  assert.equal((all.match(/<h1[ >]/g) || []).length, 1); assert.ok(all.includes('<h1 class="kicker">Referenciák</h1>') && !all.includes('page-title'), 'the small label is the heading; no second big title');
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

test('tiles: year and the first paragraph of the description; the dialog has the whole text and the category', () => {
  const summary = ['Első bekezdés.', 'Második bekezdés <b>.', '', 'Harmadik.'].join(String.fromCharCode(10, 10));
  const html = renderSite({ lang: 'hu', page: 'references', categories: INITIAL_CATEGORY_LIST, references: [ref('a', { year: '2015', summary: { hu: summary, en: '' } }), ref('b', { summary: { hu: '', en: '' } })] });
  const [a, b] = html.split('<article class="mt').slice(1);
  const tile = a.slice(0, a.indexOf('<template'));
  assert.ok(tile.includes('<small>2015</small><span class="mt-sum">Első bekezdés.</span></span>'), 'year, then only the first paragraph');
  assert.ok(!tile.includes('Második') && !tile.includes('Szállodák'), 'the tile shows neither the rest of the text nor the category');
  assert.ok(a.includes('<p>Első bekezdés.</p><p>Második bekezdés &lt;b&gt;.</p><p>Harmadik.</p>'), 'the dialog has every paragraph, escaped');
  assert.ok(a.includes('<p class="md-meta">Szállodák · Budapest · Tervév 2015</p>'));
  assert.ok(!b.includes('mt-sum'), 'no description, nothing under the caption');
});

test('the full list for the home page: filter buttons and every tile, no dialog, no close buttons and no page shell', () => {
  const list = [...many(12), ...many(3, () => ({ categoryId: 'irodahazak', category: 'Irodaházak' })).map((r, i) => ({ ...r, id: `o${i}`, title: { hu: `Projekt o${i}`, en: '' } }))];
  const frag = renderSite({ lang: 'hu', page: 'references', references: list, categories: INITIAL_CATEGORY_LIST, fragment: true });
  assert.equal(tiles(frag).length, 15);
  assert.ok(frag.includes('<button type="button" class="chip on" data-filter="*">Mind</button>') && frag.includes('data-filter="irodahazak"'));
  assert.ok(!frag.includes('data-refs-close') && !/Kevesebb|Fewer/.test(frag), 'the list closes by scrolling past it, not with a button');
  assert.ok(!frag.includes('<dialog') && !frag.includes('<html') && !frag.includes('href="/referenciak?'), 'the dialog already on the page is reused');
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
    const part = await fetch(`${base}/referenciak?reszlet=1`); const partHtml = await part.text();
    assert.ok(part.status === 200 && partHtml.startsWith('<') && !partHtml.includes('<html') && partHtml.includes('class="mosaic"'), 'the list fragment for the home page');
    assert.ok((await (await fetch(`${base}/?reszlet=1`)).text()).includes('<html'), 'the fragment exists only on the references pages');
    assert.equal((await fetch(`${base}/referenciak/`, { redirect: 'manual' })).status, 404);
    assert.ok((await (await fetch(`${base}/munkater/referenciak`)).text()).includes('/references.js'), 'the workspace keeps its own address');
  } finally { await new Promise(r => server.close(r)); rmSync(dataDir, { recursive: true, force: true }); }
});
