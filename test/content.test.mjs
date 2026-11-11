import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { makeServer } from '../server.mjs';
import { FIELDS, cleanOverrides, applyContent, contentStore, defaultsFor } from '../site/content.mjs';
import { renderSite, defaultText, richTextHtml, withoutRepeatedTitle } from '../site/site.mjs';

const PASSWORD = 'teszt-jelszo-123456';
async function withServer(fn) {
  const dataDir = mkdtempSync(join(tmpdir(), 'gaut-content-'));
  const server = makeServer({ dataDir, password: PASSWORD });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base); } finally { await new Promise(r => server.close(r)); rmSync(dataDir, { recursive: true, force: true }); }
}
async function login(base) {
  const r = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-gaut-request': '1' }, body: JSON.stringify({ password: PASSWORD }) });
  assert.equal(r.status, 200);
  return r.headers.get('set-cookie').split(';')[0];
}
const call = (base, cookie, path, method = 'GET', body) => fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', 'x-gaut-request': '1', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });

test('every editable field has a default in both languages', () => {
  for (const lang of ['hu', 'en']) {
    const d = defaultsFor(defaultText(lang));
    for (const f of FIELDS) assert.ok(f.path in d, `${lang} ${f.path}`);
    for (const f of FIELDS) if (!f.path.startsWith('contact.') && !f.hideable && !f.optional) assert.ok(d[f.path].length > 0, `${lang} ${f.path} default is empty`);
  }
});


test('repeated introduction title is removed from the first body line only when identical', () => {
  const title = 'Automatika tervezés a gépészeti rendszerek összehangolt működéséért';
  const body = '[[20|sans]]**' + title + '**[[/]]\\n\\n**Épületgépészeti erősáram és automatika**\\nLeírás';
  assert.equal(withoutRepeatedTitle(title, body), '**Épületgépészeti erősáram és automatika**\\nLeírás');
  assert.equal(withoutRepeatedTitle(title, '**Másik bevezető**\\nLeírás'), '**Másik bevezető**\\nLeírás');
});

test('long-form introduction supports safe Markdown and four principles render', () => {
  const html = richTextHtml('## Mérnöki tervezés\n\n**Pontos** és *átlátható*.\n- Automatika\n- Felügyelet\n\n<script>alert(1)</script>');
  assert.ok(html.includes('<h3>Mérnöki tervezés</h3>'));
  assert.ok(html.includes('<strong>Pontos</strong>'));
  assert.ok(html.includes('<em>átlátható</em>'));
  const styled = richTextHtml('[[36|serif]]Nagy cím[[/]] és ++aláhúzott++');
  assert.ok(styled.includes('<span class="rt-size-36 rt-font-serif">Nagy cím</span>'));
  assert.ok(styled.includes('<u>aláhúzott</u>'));
  assert.ok(html.includes('<ul><li>Automatika</li><li>Felügyelet</li></ul>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  const page = renderSite({ lang: 'hu' });
  assert.match(page, /id="bemutatkozas"/);
  assert.match(page, /Átlátható dokumentáció/);
  assert.equal((page.match(/class="principles"/g) || []).length, 1);
});

test('overrides are validated and normalised', () => {
  const ok = cleanOverrides({ hu: { sub: '  Új   alcím ', 'areas.1.title': 'Cím', 'contact.email': 'info@pelda.hu', lead: '' }, en: { sub: 'New subtitle' } });
  assert.deepEqual(ok.hu, { sub: 'Új alcím', 'areas.1.title': 'Cím', 'contact.email': 'info@pelda.hu' });
  assert.deepEqual(ok.en, { sub: 'New subtitle' });
  assert.throws(() => cleanOverrides({ hu: { 'nincs.ilyen': 'x' } }), /Ismeretlen mező/);
  assert.throws(() => cleanOverrides({ hu: { sub: 'x'.repeat(500) } }), /Túl hosszú/);
  assert.equal(cleanOverrides({ hu: { aboutText: 'x'.repeat(8000) } }).hu.aboutText.length, 8000);
  assert.throws(() => cleanOverrides({ hu: { aboutText: 'x'.repeat(8001) } }), /Túl hosszú/);
  assert.throws(() => cleanOverrides({ hu: { sub: 5 } }), /szöveget/);
  assert.throws(() => cleanOverrides({ hu: { 'contact.email': 'nem email' } }), /e-mail/);
  assert.throws(() => cleanOverrides({ hu: { 'contact.phone': '<script>' } }), /telefon/);
  assert.throws(() => cleanOverrides({ hu: { sub: 'a\u0000b' } }), /karakter/);
  assert.throws(() => cleanOverrides([]), /Hibás/);
  assert.equal(cleanOverrides({ hu: { refsNote: '' } }).hu.refsNote, '', 'hideable fields keep an empty override');
});

test('applyContent overrides text without touching the defaults', () => {
  const base = defaultText('hu');
  const next = applyContent(base, { sub: 'Másik alcím', 'areas.0.title': 'Első', 'principles.2.text': 'Harmadik', 'sectors.5': 'Hatodik', 'hero.szinkron': 'Új főcím.' });
  assert.equal(next.sub, 'Másik alcím'); assert.equal(next.areas[0][0], 'Első'); assert.equal(next.principles[2][1], 'Harmadik');
  assert.equal(next.sectors[5], 'Hatodik'); assert.equal(next.hero.szinkron, 'Új főcím.');
  assert.notEqual(base.sub, 'Másik alcím');
  assert.equal(applyContent(base, { 'nincs.ilyen': 'x' }).sub, base.sub);
});

test('draft, publish, restore and conflicts work on the store', () => {
  const store = contentStore(new DatabaseSync(':memory:'));
  assert.equal(store.live(), null);
  assert.equal(store.draft().revision, 0);
  const saved = store.saveDraft(0, { hu: { sub: 'Vázlat' } });
  assert.equal(saved.revision, 1);
  assert.throws(() => store.saveDraft(0, { hu: { sub: 'Régi' } }), /módosította/);
  assert.equal(store.live(), null, 'saving a draft does not publish');
  assert.throws(() => store.publish(0, ''), /megváltozott/);
  const v1 = store.publish(1, 'Első');
  assert.equal(store.live().overrides.hu.sub, 'Vázlat'); assert.equal(v1.changes, 1);
  store.saveDraft(1, { hu: { sub: 'Második' } });
  assert.equal(store.live().overrides.hu.sub, 'Vázlat', 'editing after publishing leaves the live version alone');
  store.publish(2, 'Második');
  assert.equal(store.versions().length, 2);
  const back = store.restore(v1.id, 2);
  assert.equal(back.overrides.hu.sub, 'Vázlat');
  assert.equal(store.live().overrides.hu.sub, 'Második', 'restoring only changes the draft');
  assert.throws(() => store.restore('00000000-0000-0000-0000-000000000000', 3), /nem található/);
});

test('rendered text is escaped and contact details render as links', () => {
  const html = renderSite({ lang: 'hu', content: { hu: { sub: '<img src=x onerror=alert(1)>', 'contact.email': 'info@pelda.hu', 'contact.phone': '+36 1 234 5678', 'contact.address': 'Példa utca 1.', refsNote: '' }, en: {} } });
  assert.ok(!html.includes('<img src=x'));
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /href="mailto:info@pelda\.hu"/);
  assert.match(html, /href="tel:\+3612345678"/);
  assert.match(html, /Példa utca 1\./);
  assert.ok(!html.includes('Bemutató mintaprojektek'), 'an empty hideable note is hidden');
  assert.ok(!renderSite({ lang: 'hu', content: { hu: { 'contact.email': 'a@b.hu', 'contact.phone': '+36 30 111 2222', 'contact.address': 'X' } } }).includes('class="pending"'));
});

test('workspace API requires login; public pages show only published text; draft preview needs a session', async () => {
  await withServer(async base => {
    assert.equal((await fetch(`${base}/api/site/content`)).status, 401);
    assert.equal((await fetch(`${base}/api/site/publish`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-gaut-request': '1' }, body: '{}' })).status, 401);
    const cookie = await login(base);
    let state = await (await call(base, cookie, '/api/site/content')).json();
    assert.equal(state.live, null); assert.equal(state.draft.revision, 0); assert.ok(state.fields.length > 20);
    // save a draft: the public page must not change
    const put = await call(base, cookie, '/api/site/content', 'PUT', { revision: 0, overrides: { hu: { sub: 'Vázlatos alcím' }, en: {} } });
    assert.equal(put.status, 200); state = await put.json();
    assert.ok(!(await (await fetch(`${base}/hu`)).text()).includes('Vázlatos alcím'));
    // draft preview: only with a session
    assert.ok(!(await (await fetch(`${base}/hu?elonezet=1`)).text()).includes('Vázlatos alcím'));
    const preview = await (await fetch(`${base}/hu?elonezet=1`, { headers: { cookie } })).text();
    assert.ok(preview.includes('Vázlatos alcím')); assert.ok(preview.includes('preview-bar draft'));
    // stale revision is refused
    assert.equal((await call(base, cookie, '/api/site/content', 'PUT', { revision: 0, overrides: { hu: {}, en: {} } })).status, 409);
    // publish
    const pub = await call(base, cookie, '/api/site/publish', 'POST', { revision: state.draft.revision, note: 'teszt' });
    assert.equal(pub.status, 200); state = await pub.json();
    assert.equal(state.live.note, 'teszt');
    assert.ok((await (await fetch(`${base}/hu`)).text()).includes('Vázlatos alcím'));
    assert.ok(!(await (await fetch(`${base}/en`)).text()).includes('Vázlatos alcím'));
    // restore into the draft
    const restore = await call(base, cookie, `/api/site/versions/${state.versions[0].id}/restore`, 'POST', { revision: state.draft.revision });
    assert.equal(restore.status, 200);
    // bad input
    assert.equal((await call(base, cookie, '/api/site/content', 'PUT', { revision: (await restore.json()).draft.revision, overrides: { hu: { 'nincs': 'x' }, en: {} } })).status, 400);
    // the editor page and its assets are served
    assert.equal((await fetch(`${base}/munkater/honlap`)).status, 200);
    assert.equal((await fetch(`${base}/site-editor.js`)).status, 200);
  });
});
