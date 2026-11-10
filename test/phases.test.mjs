import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeServer } from '../server.mjs';
import { FIELDS, cleanOverrides, defaultsFor } from '../site/content.mjs';
import { renderSite, defaultText } from '../site/site.mjs';
import { PHASES_TEXT, PHASES_PATH } from '../site/phases.mjs';

const page = (lang = 'hu', extra = {}) => renderSite({ lang, page: 'phases', ...extra });

test('the phases page has one h1, six phases, a summary table and expandable details in both languages', () => {
  for (const lang of ['hu', 'en']) {
    const html = page(lang), p = PHASES_TEXT[lang];
    assert.equal((html.match(/<h1[ >]/g) || []).length, 1, 'a single h1');
    assert.ok(html.includes(`<title>${p.metaTitle}</title>`));
    assert.ok(html.includes(`<meta name="description" content="${p.metaDescription}">`));
    assert.equal((html.match(/<details class="phase/g) || []).length, 6);
    assert.equal((html.match(/<ol class="flow">.*?<\/ol>/s)[0].match(/<li/g) || []).length, 6);
    assert.equal((html.match(/<tbody>.*?<\/tbody>/s)[0].match(/<tr/g) || []).length, 6);
    for (const it of p.items) assert.ok(html.includes(`<h3>${it.name}</h3>`), it.name);
    assert.equal((html.match(/<details class="phase key"/g) || []).length, 3, 'tender, construction and shop design are emphasised');
    for (const i of [3, 4, 5]) assert.ok(html.includes(`<details class="phase key" id="fazis-${i}">`));
    assert.ok(!html.includes('<details class="phase" open') && !html.includes('key" open'), 'closed by default');
    assert.ok(html.includes('https://mernokvagyok.hu/wp-content/uploads/2024/02/tervdokumentaciok-formai-kovetelmenye.pdf'));
    assert.ok(html.includes('data-theme="rendszer"') && html.includes('class="theme-switch"'), 'same shell as the home page');
  }
});

test('navigation: the menu item, the home page link and the language switch point to the right pages', () => {
  const home = renderSite({ lang: 'hu' }), sub = page('hu'), en = page('en');
  assert.ok(home.includes('<a href="#szakteruletek">Szakterületek</a><a href="/tervezesi-fazisok">Tervezési fázisok</a><a href="#szemlelet">'));
  assert.match(home, /<p class="more"><a href="\/tervezesi-fazisok">Tervezési fázisok a koncepciótól a megvalósításig /);
  assert.ok(sub.includes('<a href="/#szakteruletek">Szakterületek</a><a href="/tervezesi-fazisok" aria-current="page">Tervezési fázisok</a><a href="/#szemlelet">'), 'on the subpage the other items lead back to the home page');
  assert.ok(sub.includes('<a class="lang" href="/en/design-phases"') && en.includes('<a class="lang" href="/tervezesi-fazisok"'));
  assert.ok(en.includes('<a href="/en#kapcsolat">Contact</a>') && en.includes('<a class="brand" href="/en"'));
  assert.ok(sub.includes('<link rel="alternate" hreflang="hu" href="/tervezesi-fazisok"><link rel="alternate" hreflang="en" href="/en/design-phases">'));
  assert.deepEqual(PHASES_PATH, { hu: '/tervezesi-fazisok', en: '/en/design-phases' });
});

test('the wording keeps the professional distinctions of the brief', () => {
  const html = page('hu');
  assert.ok(!/kötelező/i.test(html.slice(html.indexOf('<main'), html.indexOf('</main>'))), 'no phase is presented as mandatory');
  assert.ok(html.includes('nem minden beruházásnál szükségesek önálló dokumentációként'), 'the phases are possible steps, said next to the phase row');
  assert.ok(html.indexOf('class="flow-note"') < html.indexOf('class="ptable"'));
  assert.ok(html.includes('A gyártmányterv a kiviteli terv alapján'), 'shop design builds on the construction design');
  assert.ok(html.includes('A rendszer szakszerű kivitelezéséhez szükséges műszaki dokumentáció.'), 'the construction design is fit for construction');
});

test('every text of the page is an editable field; list fields take one item per line; everything is escaped', () => {
  const fields = FIELDS.filter(f => f.group === 'Tervezési fázisok');
  assert.equal(fields.length, 5 + 6 * 6 + 6);
  for (const lang of ['hu', 'en']) {
    const defaults = defaultsFor(defaultText(lang));
    for (const f of fields) assert.ok(defaults[f.path], `${lang}: ${f.path} has a default`);
    assert.equal(defaults['phases.items.4.name'], PHASES_TEXT[lang].items[4].name);
  }
  const content = { hu: { 'phases.h1': 'Új <főcím>', 'phases.items.0.name': 'Előterv', 'phases.items.0.list': 'Első elem\n\n  Második & elem  \n', 'phases.flowNote': '', 'phases.navLabel': 'Fázisok' }, en: {} };
  const clean = cleanOverrides(content);
  assert.equal(clean.hu['phases.flowNote'], '', 'the note under the phase row can be hidden');
  const html = page('hu', { content: clean });
  assert.ok(html.includes('<h1 class="page-title">Új &lt;főcím&gt;</h1>'));
  assert.ok(html.includes('<h3>Előterv</h3>') && html.includes('<span class="flow-name">Előterv</span>') && html.includes('</span> Előterv</th>'), 'the name shows in the row, the table and the details');
  assert.ok(html.includes('<ul class="ph-list"><li>Első elem</li><li>Második &amp; elem</li></ul>'));
  assert.ok(!html.includes('class="flow-note"'));
  assert.ok(html.includes('>Fázisok</a>') && renderSite({ lang: 'hu', content: clean }).includes('<a href="/tervezesi-fazisok">Fázisok</a>'), 'the menu label changes on every page');
  assert.ok(page('en', { content: clean }).includes('<h3>Concept and approval design</h3>'), 'English keeps its own text');
  assert.throws(() => cleanOverrides({ hu: { 'phases.items.6.name': 'x' }, en: {} }), /Ismeretlen mező/);
  assert.throws(() => cleanOverrides({ hu: { 'phases.items.0.name': 'x'.repeat(81) }, en: {} }), /Túl hosszú/);
});

test('the page is served in both languages, and edits go through draft, preview and publish', async () => {
  const password = 'teszt-jelszo-123456';
  const dataDir = mkdtempSync(join(tmpdir(), 'gaut-phases-'));
  const server = makeServer({ dataDir, password });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const [path, title] of [['/tervezesi-fazisok', 'Tervezési fázisok | GAUT Mérnökiroda'], ['/en/design-phases', 'Design phases | GAUT Engineering']]) {
      const r = await fetch(`${base}${path}?tema=3`);
      assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /text\/html/);
      const html = await r.text();
      assert.ok(html.includes(`<title>${title}</title>`) && html.includes('data-theme="szinkron"') && html.includes('noindex'));
    }
    assert.equal((await fetch(`${base}/tervezesi-fazisok/`)).status, 404);
    const login = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-gaut-request': '1' }, body: JSON.stringify({ password }) });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const call = (path, method = 'GET', body) => fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', 'x-gaut-request': '1', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
    let state = await (await call('/api/site/content')).json();
    assert.ok(state.fields.some(f => f.path === 'phases.items.3.list' && f.group === 'Tervezési fázisok'), 'the editor receives the fields');
    assert.equal(state.defaults.hu['phases.h1'], 'A koncepciótól a megvalósításig');
    const put = await call('/api/site/content', 'PUT', { revision: state.draft.revision, overrides: { hu: { 'phases.h1': 'Szerkesztett főcím', 'phases.items.3.result': 'Szerkesztett eredmény.' }, en: {}, media: {} } });
    assert.equal(put.status, 200); state = await put.json();
    assert.ok(!(await (await fetch(`${base}/tervezesi-fazisok`)).text()).includes('Szerkesztett főcím'), 'a draft is not public');
    const preview = await (await fetch(`${base}/tervezesi-fazisok?elonezet=1`, { headers: { cookie } })).text();
    assert.ok(preview.includes('Szerkesztett főcím') && preview.includes('Szerkesztett eredmény.'));
    assert.equal((await call('/api/site/publish', 'POST', { revision: state.draft.revision, note: 'fázisok' })).status, 200);
    const live = await (await fetch(`${base}/tervezesi-fazisok`)).text();
    assert.ok(live.includes('<h1 class="page-title">Szerkesztett főcím</h1>') && live.includes('Szerkesztett eredmény.'));
    assert.ok((await (await fetch(`${base}/en/design-phases`)).text()).includes('From concept to completion'), 'the English page keeps its text');
  } finally { await new Promise(r => server.close(r)); rmSync(dataDir, { recursive: true, force: true }); }
});
