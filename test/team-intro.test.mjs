import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeServer } from '../server.mjs';
import { FIELDS, cleanOverrides } from '../site/content.mjs';
import { renderSite, paragraphsHtml } from '../site/site.mjs';
import { renderConcept } from '../site/concepts.mjs';

test('the team introduction is an editable, optional text field of the Csapat group', () => {
  const field = FIELDS.find(f => f.path === 'teamIntro');
  assert.ok(field && field.group === 'Csapat' && field.type === 'text' && field.optional === true && field.max === 2000);
  const ok = cleanOverrides({ hu: { teamIntro: 'Első bekezdés.\r\n\r\nMásodik bekezdés.\nÚj sor.' }, en: {} });
  assert.equal(ok.hu.teamIntro, 'Első bekezdés.\n\nMásodik bekezdés.\nÚj sor.');
  assert.equal(cleanOverrides({ hu: { teamIntro: '   ' }, en: {} }).hu.teamIntro, undefined, 'an empty value falls back to the default (nothing)');
  assert.throws(() => cleanOverrides({ hu: { teamIntro: 'x'.repeat(2001) }, en: {} }), /Túl hosszú/);
  assert.throws(() => cleanOverrides({ hu: { teamIntro: 'a\u0000b' }, en: {} }), /karakter/);
});

test('paragraphs are split on empty lines, line breaks are kept, and everything is escaped', () => {
  assert.equal(paragraphsHtml('A\n\nB\nC'), '<p>A</p><p>B<br>C</p>');
  assert.equal(paragraphsHtml('  \n\n  '), '');
  assert.equal(paragraphsHtml(undefined), '');
  assert.equal(paragraphsHtml('<b>x</b> & "y"'), '<p>&lt;b&gt;x&lt;/b&gt; &amp; &quot;y&quot;</p>');
});

test('the site shows the introduction full width under the team heading; English falls back to Hungarian; empty shows nothing', () => {
  const team = [{ id: 'a', name: { hu: 'Kiss Anna', en: '' }, role: { hu: '', en: '' }, bio: { hu: '', en: '' }, focus: { hu: [], en: [] }, sample: false }];
  const content = { hu: { teamIntro: 'Magyar bemutatkozás.\n\nMásik bekezdés <i>.' }, en: {} };
  const hu = renderSite({ lang: 'hu', team, content }), en = renderSite({ lang: 'en', team, content });
  const block = html => html.slice(html.indexOf('id="csapat"'), html.indexOf('id="kapcsolat"'));
  assert.ok(block(hu).includes('<div class="team-intro"><p>Magyar bemutatkozás.</p><p>Másik bekezdés &lt;i&gt;.</p></div>'));
  assert.ok(block(en).includes('<div class="team-intro"><p>Magyar bemutatkozás.</p>'), 'the English page falls back to the Hungarian text');
  const own = renderSite({ lang: 'en', team, content: { hu: content.hu, en: { teamIntro: 'English intro.' } } });
  assert.ok(block(own).includes('<div class="team-intro"><p>English intro.</p></div>') && !block(own).includes('Magyar bemutatkozás'));
  // the order: heading, introduction, people
  const b = block(hu);
  assert.ok(b.indexOf('<h2>') < b.indexOf('class="team-intro"') && b.indexOf('class="team-intro"') < b.indexOf('<div class="team">'));
  assert.ok(!block(renderSite({ lang: 'hu', team })).includes('team-intro'), 'nothing is rendered when the field is empty');
  assert.ok(!renderSite({ lang: 'hu', team: [], content }).includes('team-intro'), 'a hidden team section takes the introduction with it');
  const css = readCss();
  assert.match(css, /\.team-intro \{ max-width: none;/, 'full content width, not the narrow reading width');
});
import { readFileSync } from 'node:fs';
const readCss = () => readFileSync(new URL('../public/site/site.css', import.meta.url), 'utf8');

test('every concept shows the introduction between the heading and the people', () => {
  const view = { content: { hu: { teamIntro: 'Csapatbemutató szöveg.\n\nMásodik rész.' }, en: {} } };
  for (const key of ['a', 'b', 'c']) {
    const html = renderConcept(key, view);
    assert.ok(html.includes('<div class="team-intro"><p>Csapatbemutató szöveg.</p><p>Második rész.</p></div>'), key);
    const at = html.indexOf('class="team-intro"');
    assert.ok(at > html.indexOf('id="csapat"') && at < html.indexOf('class="people"'), `${key}: introduction before the people`);
    assert.ok(!renderConcept(key).includes('team-intro'), `${key}: nothing without text`);
  }
});

test('edit, draft preview and publish of the introduction end to end', async () => {
  const password = 'teszt-jelszo-123456';
  const dataDir = mkdtempSync(join(tmpdir(), 'gaut-teamintro-'));
  const server = makeServer({ dataDir, password });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const login = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-gaut-request': '1' }, body: JSON.stringify({ password }) });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const call = (path, method = 'GET', body) => fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', 'x-gaut-request': '1', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
    let state = await (await call('/api/site/content')).json();
    const field = state.fields.find(f => f.path === 'teamIntro');
    assert.ok(field, 'the editor receives the field'); assert.equal(state.defaults.hu.teamIntro, ''); assert.equal(state.defaults.en.teamIntro, '');
    const member = { id: 'anna', name: { hu: 'Kiss Anna', en: '' }, role: { hu: 'Tervező', en: '' }, bio: { hu: '', en: '' }, focus: { hu: [], en: [] } };
    const put = await call('/api/site/content', 'PUT', { revision: state.draft.revision, overrides: { hu: { teamIntro: 'Közös csapatbemutató.\n\nMásodik bekezdés.' }, en: {}, media: {}, team: [member] } });
    assert.equal(put.status, 200); state = await put.json();
    assert.ok(!(await (await fetch(`${base}/`)).text()).includes('Közös csapatbemutató'), 'a draft is not public');
    assert.ok((await (await fetch(`${base}/?elonezet=1`, { headers: { cookie } })).text()).includes('<div class="team-intro"><p>Közös csapatbemutató.</p><p>Második bekezdés.</p></div>'));
    assert.equal((await call('/api/site/publish', 'POST', { revision: state.draft.revision, note: 'bemutató' })).status, 200);
    assert.ok((await (await fetch(`${base}/`)).text()).includes('Közös csapatbemutató.'));
    assert.ok((await (await fetch(`${base}/en`)).text()).includes('Közös csapatbemutató.'), 'English falls back to Hungarian');
    assert.ok((await (await fetch(`${base}/koncepcio/c`)).text()).includes('Közös csapatbemutató.'), 'the concepts show it as well');
    assert.equal((await call('/api/site/content', 'PUT', { revision: (await (await call('/api/site/content')).json()).draft.revision, overrides: { hu: { teamIntro: 'x'.repeat(2500) }, en: {}, media: {} } })).status, 400);
  } finally { await new Promise(r => server.close(r)); rmSync(dataDir, { recursive: true, force: true }); }
});
