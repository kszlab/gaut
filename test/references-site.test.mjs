import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { makeServer } from '../server.mjs';
import { websiteWarnings } from '../public/site-readiness.js';
import { renderSite, publicReferences, toPublicReference } from '../site/site.mjs';

test('readiness warnings are advisory and cover each missing item', () => {
  assert.equal(websiteWarnings({ website_title_hu: 'A', website_copy_hu: 'B', website_title_en: 'C', website_copy_en: 'D', website_cover_photo: 'p' }).length, 0);
  const all = websiteWarnings({});
  assert.equal(all.length, 4);
  assert.ok(all.some(w => /magyar honlapos cím/.test(w)) && all.some(w => /magyar honlapos leírás/.test(w)) && all.some(w => /angol/.test(w)) && all.some(w => /borítókép/.test(w)));
  assert.ok(!all.some(w => /szerepe|képhasználati/.test(w)), 'the role and photo-rights switches are gone');
  assert.ok(!websiteWarnings({ website_cover_photo: 'p' }).some(w => /képhasználati|Nincs borítókép/.test(w)));
  assert.ok(websiteWarnings({ website_title_hu: 'Új cím', website_title_en: 'Old title', website_title_en_source: 'Régi cím' }).some(w => /angol címet nézd át/.test(w)), 'a stale English title is flagged');
  assert.ok(!websiteWarnings({ website_title_hu: 'Cím', website_title_en: 'Title', website_title_en_source: 'Cím' }).some(w => /nézd át/.test(w)));
});

test('public references are sorted by year and rendered as a mosaic with fallbacks', () => {
  const rec = (id, extra) => ({ id, name: `Projekt ${id}`, category: 'Egészségügy', city: 'Pécs', design_year: '2015', website_publishable: true, ...extra });
  const list = publicReferences([rec('a', { design_year: '2012', category: 'Iroda és kereskedelem' }), rec('b', { design_year: '2020' }), rec('c', { design_year: '2001', website_featured: true }), rec('d', { website_publishable: false })]);
  assert.deepEqual(list.map(r => r.id), ['b', 'a', 'c'], 'newest design year first; a featured reference keeps its place in time; unapproved ones are dropped');
  const cover = { id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', widths: [800, 1600], width: 1600, height: 1067 };
  const html = renderSite({ lang: 'en', references: list.map(r => ({ ...r, coverMedia: r.id === 'b' ? cover : undefined })) });
  const mosaic = html.slice(html.indexOf('class="mosaic"'), html.indexOf('</dialog>'));
  assert.equal((mosaic.match(/<article class="mt/g) || []).length, 3, 'one tile per reference, no upper limit');
  assert.equal((mosaic.match(/<article class="mt big/g) || []).length, 1, 'only the featured reference is a double-size tile');
  assert.ok(mosaic.includes('Healthcare · Pécs · Design year 2020'), 'English category name and design year label');
  assert.ok(mosaic.includes('<strong>Projekt b</strong>'), 'English title falls back to the Hungarian one');
  assert.match(mosaic, /<img src="\/media\/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee\/800\.webp" srcset="[^"]*1600w"/);
  assert.equal((mosaic.match(/class="mt-type"/g) || []).length, 2, 'a reference without a cover photo gets a typographic tile, not a grey box or a generated picture');
  assert.ok(!mosaic.includes('class="badge"') && !mosaic.includes('mt-art'), 'real references carry no sample badge and no generated art');
  assert.ok(html.includes('class="mosaic-dialog"') && html.includes('data-filter="*"'), 'detail dialog and filter are present');
  assert.ok(!html.includes('Illustrative sample projects'), 'the sample note disappears with real references');
  const samples = renderSite({ lang: 'en' });
  assert.ok(samples.includes('Illustrative sample projects') && samples.includes('class="mt-art"') && samples.includes('class="badge">Sample'), 'sample projects are labelled and use illustrations');
  assert.ok(toPublicReference({ id: 'x', name: '<b>Név</b>', website_publishable: true }).title.hu.includes('<b>'), 'raw text is kept; escaping happens at render time');
  const escaped = renderSite({ lang: 'hu', references: [toPublicReference({ id: 'x', name: '<b>Név</b>', website_publishable: true, website_copy_hu: '<i>leírás</i>' })] });
  assert.ok(escaped.includes('&lt;b&gt;Név&lt;/b&gt;') && escaped.includes('&lt;i&gt;leírás&lt;/i&gt;') && !escaped.includes('<b>Név</b>'), 'titles and summaries are escaped in the tile and in the detail template');
});
const PASSWORD = 'teszt-jelszo-123456';
test('references on the site end to end: cover import, warnings, frozen publication', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'gaut-refsite-'));
  const server = makeServer({ dataDir, password: PASSWORD });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const login = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-gaut-request': '1' }, body: JSON.stringify({ password: PASSWORD }) });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const call = (path, method = 'GET', body) => fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', 'x-gaut-request': '1', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
    const page = async (path, withCookie = false) => (await fetch(`${base}${path}`, { headers: withCookie ? { cookie } : {} })).text();
    const refs = (await (await call('/api/references')).json()).references;
    const [one, two] = [refs[0], refs[1]];
    assert.equal((await (await call('/api/site/content')).json()).references.length, 0, 'nothing is marked yet');

    // a photo for the first reference
    const png = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: '#335577' } }).png().toBuffer();
    const photo = (await (await call(`/api/references/${one.id}/photos`, 'POST', { filename: 'borito.png', content: png.toString('base64'), caption: 'Borító' })).json()).photo;
    const otherPhoto = (await (await call(`/api/references/${two.id}/photos`, 'POST', { filename: 'masik.png', content: png.toString('base64'), caption: 'Másik' })).json()).photo;

    // mark it publishable with almost nothing filled in: warnings, but no blocking
    let saved = await call(`/api/references/${one.id}`, 'PUT', { ...one, website_publishable: true, website_title_hu: 'Honlapos cím', website_copy_hu: 'Nyilvános leírás.', website_cover_photo: photo.id, website_cover_media: 'hamisitott-azonosito' });
    assert.equal(saved.status, 200); saved = (await saved.json()).reference;
    assert.match(saved.website_cover_media, /^[a-f0-9-]{36}$/, 'the cover is imported by the server, a client-sent media id is ignored');
    assert.equal((await call(`/api/references/${saved.id}`, 'PUT', { ...saved, website_cover_photo: otherPhoto.id })).status, 400, 'a cover must belong to the same reference');
    assert.equal((await call(`/api/references/${saved.id}`, 'PUT', { ...saved, website_title_hu: 'x'.repeat(200) })).status, 400);
    assert.equal((await call(`/api/references/${saved.id}`, 'PUT', { ...saved, website_featured: 'igen' })).status, 400);
    const state = await (await call('/api/site/content')).json();
    assert.equal(state.references.length, 1);
    assert.ok(state.references[0].warnings.some(w => /angol/.test(w)) && !state.references[0].warnings.some(w => /szerepe|képhasználati/.test(w)), 'advisory warnings are listed');

    // not visible to visitors before publication; visible in the draft preview; cover private
    assert.ok(!(await page('/hu')).includes('Honlapos cím'));
    const preview = await page('/hu?elonezet=1', true);
    assert.ok(preview.includes('<h3>Honlapos cím</h3>') && preview.includes('Nyilvános leírás.') && preview.includes(`/media/${saved.website_cover_media}/`));
    assert.equal((await fetch(`${base}/media/${saved.website_cover_media}/800.webp`)).status, 404);

    // publish: the reference, its cover and nothing internal reach visitors
    assert.equal((await call('/api/site/publish', 'POST', { revision: state.draft.revision, note: 'referencia' })).status, 200);
    const live = await page('/hu');
    assert.ok(live.includes('<h3>Honlapos cím</h3>') && live.includes('Nyilvános leírás.'));
    assert.ok(!live.includes('class="badge">Minta</span></div>\n  <div class="ref-body"'), 'sample projects are gone');
    assert.ok(!live.includes('Bemutató mintaprojektek'));
    for (const secret of [one.attribution, one.questions, one.background, one.scope_from_pdf].filter(s => s && s.length > 12)) assert.ok(!live.includes(secret.slice(0, 40)), 'internal text must not appear');
    assert.ok(!live.includes(one.website_copy_draft?.slice(0, 40) || '\u0000'), 'the general description draft is never published');
    assert.equal((await fetch(`${base}/media/${saved.website_cover_media}/800.webp`)).status, 200, 'the cover is public once published');

    // later edits stay in the store until the next publication
    const edited = await call(`/api/references/${saved.id}`, 'PUT', { ...saved, website_title_hu: 'Új honlapos cím' });
    assert.equal(edited.status, 200);
    assert.ok((await page('/hu')).includes('<h3>Honlapos cím</h3>') && !(await page('/hu')).includes('Új honlapos cím'), 'live site shows the frozen list');
    assert.ok((await page('/hu?elonezet=1', true)).includes('Új honlapos cím'), 'preview shows the current state');
    let now = await (await call('/api/site/content')).json();
    assert.equal((await call('/api/site/publish', 'POST', { revision: now.draft.revision, note: 'frissítés' })).status, 200);
    assert.ok((await page('/hu')).includes('Új honlapos cím'));

    // restoring an old version never puts frozen references into the draft
    now = await (await call('/api/site/content')).json();
    const restored = await (await call(`/api/site/versions/${now.versions[1].id}/restore`, 'POST', { revision: now.draft.revision })).json();
    assert.equal(restored.draft.overrides.references, undefined);

    // no publishable reference left: the sample projects return on the next publication
    const latest = (await (await call('/api/references')).json()).references.find(r => r.id === saved.id);
    await call(`/api/references/${saved.id}`, 'PUT', { ...latest, website_publishable: false });
    now = await (await call('/api/site/content')).json();
    assert.equal(now.references.length, 0);
    await call('/api/site/publish', 'POST', { revision: now.draft.revision, note: 'vissza' });
    assert.ok((await page('/hu')).includes('Bemutató mintaprojektek'));
  } finally { await new Promise(r => server.close(r)); rmSync(dataDir, { recursive: true, force: true }); }
});
