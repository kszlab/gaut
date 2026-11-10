import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeServer } from '../server.mjs';
import { titleEnStale } from '../public/site-readiness.js';

const read = name => readFileSync(new URL(`../public/${name}`, import.meta.url), 'utf8');

test('the form: no role and photo-rights switches, the publishable switch stays, the sign-in link leads to the workspace', () => {
  const html = read('references.html'), js = read('references.js');
  assert.ok(!html.includes('website_role_confirmed') && !html.includes('website_photo_rights'));
  assert.ok(!js.includes('website_role_confirmed') && !js.includes('website_photo_rights'));
  assert.ok(html.includes('name="website_publishable"') && html.includes('name="website_featured"'));
  assert.ok(html.includes('id="title-en-stale"') && js.includes("classList.toggle('stale'"));
  assert.ok(js.includes('href="/munkater?next=references"') && !js.includes('href="/?next=references"'));
});

test('website titles: one-step fill, project name as the Hungarian title, a stale English title is kept and flagged', async () => {
  const password = 'teszt-jelszo-123456';
  const dataDir = mkdtempSync(join(tmpdir(), 'gaut-titles-'));
  const server = makeServer({ dataDir, password });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(`${base}/api/references/website-titles`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-gaut-request': '1' }, body: '{"titles":{}}' })).status, 401, 'needs a signed-in user');
    const login = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-gaut-request': '1' }, body: JSON.stringify({ password }) });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const call = (path, method = 'GET', body) => fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', 'x-gaut-request': '1', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
    const list = async () => (await (await call('/api/references')).json()).references;
    let refs = await list();
    const [a, b, c] = refs;
    assert.ok(refs.every(r => r.website_title_hu === '' && r.website_title_en === ''), 'the seed has no website titles');

    // b already has its own titles: the fill must not touch them
    let own = (await (await call(`/api/references/${b.id}`, 'PUT', { ...b, website_title_hu: 'Saját magyar cím', website_title_en: 'Own English title' })).json()).reference;
    assert.equal(own.website_title_en_source, 'Saját magyar cím', 'the English title remembers the Hungarian one it was written for');
    // c is in the trash: it is filled as well, so a restored reference is complete
    await call(`/api/references/${c.id}`, 'DELETE', { revision: c.revision });

    assert.equal((await call('/api/references/website-titles', 'POST', { titles: [] })).status, 400);
    assert.equal((await call('/api/references/website-titles', 'POST', { titles: { [a.id]: 'x'.repeat(161) } })).status, 400);
    assert.equal((await list()).find(r => r.id === a.id).website_title_hu, '', 'a refused request changes nothing');

    const fill = await call('/api/references/website-titles', 'POST', { titles: { [a.id]: '  English A  ', [b.id]: 'Ignored', 'NINCS-ILYEN': 'x' } });
    assert.equal(fill.status, 200);
    const result = await fill.json();
    assert.equal(result.hu_filled, refs.length - 1); assert.equal(result.en_filled, 1); assert.equal(result.unchanged, 1); assert.deepEqual(result.unknown_ids, ['NINCS-ILYEN']);
    refs = await list();
    const a2 = refs.find(r => r.id === a.id), b2 = refs.find(r => r.id === b.id);
    assert.equal(a2.website_title_hu, a.name); assert.equal(a2.website_title_en, 'English A'); assert.equal(a2.website_title_en_source, a.name);
    assert.equal(a2.revision, a.revision + 1, 'an open, older form cannot silently overwrite the filled titles');
    assert.equal(b2.website_title_hu, 'Saját magyar cím'); assert.equal(b2.website_title_en, 'Own English title'); assert.equal(b2.revision, own.revision);
    assert.ok(refs.every(r => r.website_title_hu !== ''), 'every reference has a Hungarian website title, trashed ones included');
    assert.ok(refs.every(r => r.website_publishable === false), 'the publishable switch is untouched');
    assert.equal((await (await call('/api/references/website-titles', 'POST', { titles: { [a.id]: 'Other' } })).json()).en_filled, 0, 'running it again changes nothing');

    // changing the Hungarian title keeps the English text and marks it stale
    let saved = (await (await call(`/api/references/${a.id}`, 'PUT', { ...a2, website_title_hu: 'Átírt magyar cím' })).json()).reference;
    assert.equal(saved.website_title_en, 'English A'); assert.equal(saved.website_title_en_source, a.name); assert.equal(titleEnStale(saved), true);
    // a client cannot clear the mark by sending a source of its own
    saved = (await (await call(`/api/references/${a.id}`, 'PUT', { ...saved, website_title_en_source: 'Átírt magyar cím' })).json()).reference;
    assert.equal(titleEnStale(saved), true);
    // editing the English title clears it
    saved = (await (await call(`/api/references/${a.id}`, 'PUT', { ...saved, website_title_en: 'Rewritten title' })).json()).reference;
    assert.equal(saved.website_title_en_source, 'Átírt magyar cím'); assert.equal(titleEnStale(saved), false);
    // an emptied Hungarian title takes the project name again; an emptied English one has no source
    saved = (await (await call(`/api/references/${a.id}`, 'PUT', { ...saved, website_title_hu: '  ', website_title_en: '' })).json()).reference;
    assert.equal(saved.website_title_hu, a.name); assert.equal(saved.website_title_en_source, '');
    // a new reference gets its name as the Hungarian title
    const created = (await (await call('/api/references', 'POST', { name: 'Új próba referencia', sources: [], photo_sources: [], tags: [], locations: [] })).json()).reference;
    assert.equal(created.website_title_hu, 'Új próba referencia');
    // the old switches are still accepted in stored data, so earlier records keep saving
    assert.equal((await call(`/api/references/${created.id}`, 'PUT', { ...created, website_role_confirmed: true, website_photo_rights: true })).status, 200);
  } finally { await new Promise(r => server.close(r)); rmSync(dataDir, { recursive: true, force: true }); }
});
