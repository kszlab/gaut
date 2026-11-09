import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { makeServer } from '../server.mjs';

test('the concepts show the content saved in the site editor: published for visitors, the draft only for a signed-in preview', async () => {
  const password = 'teszt-jelszo-123456';
  const dataDir = mkdtempSync(join(tmpdir(), 'gaut-concepts-live-'));
  const server = makeServer({ dataDir, password });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const login = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-gaut-request': '1' }, body: JSON.stringify({ password }) });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const call = (path, method = 'GET', body) => fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', 'x-gaut-request': '1', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
    const png = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: '#556677' } }).png().toBuffer();
    const portrait = (await (await call('/api/site/media', 'POST', { filename: 'p.png', content: png.toString('base64') })).json()).media;
    const hero = (await (await call('/api/site/media', 'POST', { filename: 'h.png', content: png.toString('base64'), alt_hu: 'Saját nyitókép' })).json()).media;
    const member = { id: 'anna', name: { hu: 'Kiss Anna', en: '' }, role: { hu: 'Villamos tervező', en: '' }, bio: { hu: 'Szerkesztett bemutatkozás.', en: '' }, focus: { hu: [], en: [] }, chamber_no: '15009', chamber_url: 'https://mernokvagyok.hu/nevjegyzek/?id=15009' };
    const state = await (await call('/api/site/content')).json();
    const put = await call('/api/site/content', 'PUT', { revision: state.draft.revision, overrides: { hu: { sub: 'Szerkesztett alcím', 'hero.struktura': 'Saját főcím A. Második sor.', 'hero.szinkron': 'Saját főcím C. Kiemelt sor.', 'contact.email': 'info@pelda.hu', 'contact.phone': '+36 1 234 5678' }, en: {}, media: { 'team.anna': portrait.id, 'hero.rendszer': hero.id }, team: [member] } });
    assert.equal(put.status, 200);
    const concept = async (key, headers = {}, query = '') => (await fetch(`${base}/koncepcio/${key}${query}`, { headers })).text();

    // before any publication visitors see samples; a signed-in preview of the draft sees the editor content
    for (const key of ['a', 'b', 'c']) {
      const visitor = await concept(key);
      assert.ok(!visitor.includes('Szerkesztett alcím') && !visitor.includes('Kiss Anna'), `${key}: the draft is not public`);
      assert.ok(visitor.includes('mintatartalommal'), `${key}: says it shows sample content`);
      const draft = await concept(key, { cookie }, '?elonezet=1');
      assert.ok(draft.includes('a mentett vázlat tartalmával'), `${key}: says it shows the draft`);
      assert.ok(draft.includes('Kiss Anna') && draft.includes('Szerkesztett alcím') && draft.includes('info@pelda.hu'), `${key}: editor content`);
      assert.ok(draft.includes(`/media/${portrait.id}/`), `${key}: the uploaded portrait`);
      assert.ok(draft.includes('<p class="chamber">Mérnöki kamarai névjegyzék: <a href="https://mernokvagyok.hu/nevjegyzek/?id=15009" target="_blank" rel="noopener noreferrer">15009</a></p>'), `${key}: chamber line`);
      assert.ok(draft.includes('href="mailto:info@pelda.hu"') && draft.includes('href="tel:+3612345678"'), `${key}: contact links`);
    }
    assert.ok((await concept('a', { cookie }, '?elonezet=1')).includes('Saját főcím A.<br>Második sor.'), 'concept A headline comes from the editor (Struktúra field)');
    assert.ok((await concept('c', { cookie }, '?elonezet=1')).includes('Saját főcím C.<br><em>Kiemelt sor.</em>'), 'concept C accents the last sentence of the editor headline');
    const draftB = await concept('b', { cookie }, '?elonezet=1');
    assert.ok(draftB.includes(`/media/${hero.id}/`) && draftB.includes('alt="Saját nyitókép"') && !draftB.includes('/site/img/hero-2.webp'), 'concept B uses the hero image uploaded in the editor');

    // after publication visitors see it too, and the label changes
    const draftState = await (await call('/api/site/content')).json();
    assert.equal((await call('/api/site/publish', 'POST', { revision: draftState.draft.revision, note: 'koncepció' })).status, 200);
    for (const key of ['a', 'b', 'c']) {
      const visitor = await concept(key);
      assert.ok(visitor.includes('Kiss Anna') && visitor.includes('Szerkesztett alcím') && visitor.includes('a közzétett tartalommal'), `${key}: published content for visitors`);
      assert.ok(!visitor.includes('mintatartalommal'), `${key}: no longer announces sample content`);
      assert.ok(visitor.includes('Mintaprojektek'), `${key}: the references are still samples (none is marked publishable), and are labelled as such`);
    }
    // an empty team hides the team section in every concept
    const s2 = await (await call('/api/site/content')).json();
    await call('/api/site/content', 'PUT', { revision: s2.draft.revision, overrides: { hu: {}, en: {}, media: {}, team: [] } });
    for (const key of ['a', 'b', 'c']) {
      const html = await concept(key, { cookie }, '?elonezet=1');
      assert.ok(!html.includes('id="csapat"') && !html.includes('href="#csapat"'), `${key}: the team section is hidden`);
    }
  } finally { await new Promise(r => server.close(r)); rmSync(dataDir, { recursive: true, force: true }); }
});
