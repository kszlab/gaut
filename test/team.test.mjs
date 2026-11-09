import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { makeServer } from '../server.mjs';
import { cleanTeam, cleanOverrides } from '../site/content.mjs';
import { renderSite } from '../site/site.mjs';

const member = (id, name = 'Kiss Anna', extra = {}) => ({ id, name: { hu: name, en: '' }, role: { hu: 'Villamos tervező', en: 'Electrical designer' }, bio: { hu: 'Rövid bemutatkozás.', en: '' }, focus: { hu: ['PLC', 'DDC'], en: [] }, ...extra });

test('team list validation', () => {
  const [a] = cleanTeam([member('anna', '  Kiss   Anna ')]);
  assert.equal(a.name.hu, 'Kiss Anna'); assert.deepEqual(a.focus, { hu: ['PLC', 'DDC'], en: [] });
  assert.deepEqual(cleanTeam([]), []);
  assert.throws(() => cleanTeam([member('x', '')]), /Hiányzik/);
  assert.throws(() => cleanTeam([member('Nagy Betu')]), /azonosító/);
  assert.throws(() => cleanTeam([member('a'), member('a')]), /azonosító/);
  assert.throws(() => cleanTeam(Array.from({ length: 13 }, (_, i) => member(`m${i}`))), /legfeljebb 12/);
  assert.throws(() => cleanTeam([member('a', 'x', { focus: { hu: ['1', '2', '3', '4', '5'], en: [] } })]), /4 szakterület/);
  assert.throws(() => cleanTeam([member('a', 'x', { bio: { hu: 'y'.repeat(800), en: '' } })]), /túl hosszú/);
  assert.throws(() => cleanTeam([member('a', 'x\u0000y')]), /Érvénytelen/);
  assert.throws(() => cleanTeam('nem lista'), /csapatlista/);
  assert.equal(cleanOverrides({ team: null }).team, undefined, 'null means: back to the placeholder team');
  assert.deepEqual(cleanOverrides({ team: [] }).team, []);
});

test('the site renders the edited team, falls back to Hungarian, and can hide the section', () => {
  const team = cleanTeam([member('anna'), member('bela', 'Nagy <b>Béla</b>', { bio: { hu: 'Magyar szöveg.', en: 'English text.' } })]).map(m => ({ ...m, sample: false }));
  const hu = renderSite({ lang: 'hu', team }), en = renderSite({ lang: 'en', team });
  assert.ok(hu.includes('<h3>Kiss Anna</h3>') && en.includes('<h3>Kiss Anna</h3>'), 'empty English name falls back to the Hungarian one');
  assert.ok(en.includes('Electrical designer') && hu.includes('Villamos tervező'));
  assert.ok(en.includes('English text.') && en.includes('Rövid bemutatkozás.'), 'English bio, else Hungarian fallback');
  assert.ok(!hu.includes('<b>Béla</b>') && hu.includes('Nagy &lt;b&gt;Béla&lt;/b&gt;'), 'names are escaped');
  assert.ok(!/class="badge">Minta<\/span><\/div>\s*<h3>Kiss/.test(hu), 'edited team members carry no sample badge');
  assert.equal((hu.match(/class="member"/g) || []).length, 2);
  assert.ok(!hu.includes('Helyőrző bemutatkozások'), 'the placeholder note disappears once real members are shown');
  assert.ok(renderSite({ lang: 'hu' }).includes('Helyőrző bemutatkozások'), 'but stays with the placeholder team');
  assert.ok(renderSite({ lang: 'hu', team, content: { hu: { teamNote: 'Saját megjegyzés.' }, en: {} } }).includes('Saját megjegyzés.'), 'an explicit note is shown');
  const none = renderSite({ lang: 'hu', team: [] });
  assert.ok(!none.includes('id="csapat"') && !none.includes('href="#csapat"'), 'an empty team hides the section and its menu item');
  const withPhoto = renderSite({ lang: 'hu', team: [{ ...team[0], photoMedia: { id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', widths: [800, 1600], width: 1600, height: 2000 } }] });
  assert.match(withPhoto, /<img src="\/media\/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee\/800\.webp" srcset="[^"]*1600w" sizes="[^"]+" width="1600" height="2000" alt="Kiss Anna"/);
  assert.ok(!withPhoto.includes('portrait-empty'));
});

const PASSWORD = 'teszt-jelszo-123456';
test('team editing end to end: draft, preview, publish, portrait upload', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'gaut-team-'));
  const server = makeServer({ dataDir, password: PASSWORD });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const login = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-gaut-request': '1' }, body: JSON.stringify({ password: PASSWORD }) });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const call = (path, method = 'GET', body) => fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', 'x-gaut-request': '1', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
    // portrait
    const png = await sharp({ create: { width: 1200, height: 1500, channels: 3, background: '#445566' } }).png().toBuffer();
    const up = await (await call('/api/site/media', 'POST', { filename: 'anna.png', content: png.toString('base64') })).json();
    let state = await (await call('/api/site/content')).json();
    assert.ok((await (await fetch(`${base}/hu`)).text()).includes('class="badge">Minta'), 'live site starts with the placeholder team');
    const put = await call('/api/site/content', 'PUT', { revision: state.draft.revision, overrides: { hu: {}, en: {}, media: { 'team.anna': up.media.id }, team: [member('anna')] } });
    assert.equal(put.status, 200); state = await put.json();
    assert.equal(state.draft.overrides.team[0].name.hu, 'Kiss Anna');
    assert.equal((await call('/api/site/content', 'PUT', { revision: state.draft.revision, overrides: { hu: {}, en: {}, team: [member('anna', '')] } })).status, 400);
    const live0 = await (await fetch(`${base}/hu`)).text();
    assert.ok(!live0.includes('Kiss Anna'), 'a draft does not leak to visitors');
    const preview = await (await fetch(`${base}/hu?elonezet=1`, { headers: { cookie } })).text();
    assert.ok(preview.includes('<h3>Kiss Anna</h3>') && preview.includes(`/media/${up.media.id}/800.webp`));
    assert.ok(!/class="badge">Minta<\/span><\/div>\s*<h3>Kiss/.test(preview), 'edited team members carry no sample badge');
    assert.equal((await fetch(`${base}/media/${up.media.id}/800.webp`)).status, 404, 'portrait is private until published');
    assert.equal((await call('/api/site/publish', 'POST', { revision: state.draft.revision, note: 'csapat' })).status, 200);
    const live = await (await fetch(`${base}/en`)).text();
    assert.ok(live.includes('<h3>Kiss Anna</h3>') && live.includes('Electrical designer') && live.includes('alt="Kiss Anna"'));
    assert.equal((await fetch(`${base}/media/${up.media.id}/800.webp`)).status, 200, 'portrait is public once published');
    // hide the section
    state = await (await call('/api/site/content')).json();
    await call('/api/site/content', 'PUT', { revision: state.draft.revision, overrides: { hu: {}, en: {}, media: {}, team: [] } });
    state = await (await call('/api/site/content')).json();
    await call('/api/site/publish', 'POST', { revision: state.draft.revision, note: 'rejtve' });
    const hidden = await (await fetch(`${base}/hu`)).text();
    assert.ok(!hidden.includes('id="csapat"') && !hidden.includes('Kiss Anna'));
  } finally { await new Promise(r => server.close(r)); rmSync(dataDir, { recursive: true, force: true }); }
});

test('chamber register number and link: validated, normalised and rendered safely', () => {
  const ok = cleanTeam([member('anna', 'Kiss Anna', { chamber_no: ' 01-15009 ', chamber_url: 'https://mernokvagyok.hu/nevjegyzek/?id=15009' })])[0];
  assert.equal(ok.chamber_no, '01-15009'); assert.equal(ok.chamber_url, 'https://mernokvagyok.hu/nevjegyzek/?id=15009');
  assert.equal(cleanTeam([member('b')])[0].chamber_no, '', 'the chamber data is optional');
  assert.equal(cleanTeam([member('b')])[0].chamber_url, '');
  assert.equal(cleanTeam([member('b', 'B', { chamber_url: 'https://www.mmk.hu/nevjegyzek?x=1' })])[0].chamber_url, 'https://www.mmk.hu/nevjegyzek?x=1', 'subdomains of an allowed site are accepted');
  for (const bad of ['http://mernokvagyok.hu/x', 'https://evil.example/mernokvagyok.hu', 'https://mernokvagyok.hu.evil.example/x', 'https://user:pw@mernokvagyok.hu/x', 'javascript:alert(1)', 'mernokvagyok.hu/nevjegyzek', 'https://notmernokvagyok.hu/']) {
    assert.throws(() => cleanTeam([member('b', 'B', { chamber_url: bad })]), /kamarai link/, bad);
  }
  assert.throws(() => cleanTeam([member('b', 'B', { chamber_no: '<script>' })]), /kamarai azonosító/);
  for (const fine of ['01-15009 (É1)', 'MMK 01-15009', 'É/01:15009', '15009']) assert.equal(cleanTeam([member('c', 'C', { chamber_no: fine })])[0].chamber_no, fine, fine);
  assert.throws(() => cleanTeam([member('b', 'B', { chamber_no: 'x'.repeat(50) })]), /túl hosszú/i);

  const team = cleanTeam([member('anna', 'Kiss Anna', { chamber_no: '01-15009', chamber_url: 'https://mernokvagyok.hu/nevjegyzek/?id=15009' }), member('bela', 'Nagy Béla', { chamber_no: '02-777' }), member('cili', 'Tóth Cili', { chamber_url: 'https://mernokvagyok.hu/nevjegyzek/?id=1' }), member('dani', 'Szabó Dani')]).map(m => ({ ...m, sample: false }));
  const hu = renderSite({ lang: 'hu', team }), en = renderSite({ lang: 'en', team });
  assert.ok(hu.includes('<p class="chamber">Mérnöki kamarai névjegyzék: <a href="https://mernokvagyok.hu/nevjegyzek/?id=15009" target="_blank" rel="noopener noreferrer">01-15009</a></p>'));
  assert.ok(en.includes('Chamber of Engineers register: <a href="https://mernokvagyok.hu/nevjegyzek/?id=15009"'));
  assert.ok(hu.includes('<p class="chamber">Mérnöki kamarai névjegyzék: 02-777</p>'), 'a number without a link is plain text');
  assert.ok(hu.includes('>megnyitás</a>'), 'a link without a number gets a generic label');
  assert.equal((hu.match(/class="chamber"/g) || []).length, 3, 'members without chamber data show no line');
  // defence in depth: a stored address that is not on the allow list is never linked
  const tampered = renderSite({ lang: 'hu', team: [{ ...team[0], chamber_url: 'https://evil.example/x' }] });
  assert.ok(!tampered.includes('evil.example') && tampered.includes('01-15009'));
});
