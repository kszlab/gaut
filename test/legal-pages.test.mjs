import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeServer } from '../server.mjs';
import { renderSite, LEGAL_PATH } from '../site/site.mjs';
import { cleanOverrides, FIELDS } from '../site/content.mjs';

const content = (hu = {}, en = {}) => ({ hu, en });
const IMPRINT = '## Szolgáltató\n\nGAUT Kft.\n\n- **Székhely:** Budapest\n\n<script>alert(1)</script>';

test('the imprint and the privacy notice are editable markdown fields, empty by default', () => {
  for (const path of ['imprint', 'privacy']) {
    const f = FIELDS.find(x => x.path === path);
    assert.ok(f && f.type === 'markdown' && f.optional, path);
  }
  const cleaned = cleanOverrides({ hu: { imprint: IMPRINT, privacy: '# Adatkezelés' }, en: {} });
  assert.equal(cleaned.hu.imprint, IMPRINT);
  assert.throws(() => cleanOverrides({ hu: { privacy: 'x'.repeat(20001) }, en: {} }), /Túl hosszú/);
});

test('footer links show only for texts that exist; the dialog comes with them', () => {
  const none = renderSite({ lang: 'hu' });
  assert.ok(!none.includes('legal-links') && !none.includes('legal-dialog'), 'nothing written, nothing shown');
  const one = renderSite({ lang: 'hu', content: content({ imprint: IMPRINT }) });
  assert.ok(one.includes('<a href="/impresszum" data-legal>Impresszum</a>') && !one.includes('/adatkezeles'));
  assert.ok(one.includes('<dialog class="legal-dialog"'));
  assert.ok(!/<nav id="nav"[\s\S]*?<\/nav>/.exec(one)[0].includes('mpresszum'), 'not in the main menu');
  const both = renderSite({ lang: 'hu', content: content({ imprint: IMPRINT, privacy: 'Szöveg' }) });
  assert.ok(both.includes('>Adatkezelési tájékoztató</a>'));
  // English: own text, or the Hungarian one as a fallback
  const en = renderSite({ lang: 'en', content: content({ imprint: IMPRINT }) });
  assert.ok(en.includes('<a href="/en/imprint" data-legal>Legal notice</a>'), 'the Hungarian text is the fallback');
  assert.ok(!renderSite({ lang: 'en', content: content({}, { imprint: 'English text' }) }).includes('/en/privacy'));
  // the draft preview keeps itself in the links
  assert.ok(renderSite({ lang: 'hu', draft: true, content: content({ imprint: IMPRINT }) }).includes('href="/impresszum?elonezet=1"'));
});

test('legal page, dialog fragment and escaping', () => {
  const opts = { lang: 'hu', page: 'imprint', content: content({ imprint: IMPRINT }) };
  const page = renderSite(opts);
  assert.ok(page.includes('<h1 class="kicker">Impresszum</h1>') && page.includes('<title>Impresszum | GAUT Mérnökiroda</title>'));
  assert.ok(page.includes('<h3>Szolgáltató</h3>') && page.includes('<strong>Székhely:</strong>'));
  assert.ok(!page.includes('<script>alert(1)') && page.includes('&lt;script&gt;'), 'raw HTML is escaped');
  assert.ok(page.includes('<link rel="alternate" hreflang="hu" href="/impresszum"><link rel="alternate" hreflang="en" href="/en/imprint">'));
  const frag = renderSite({ ...opts, fragment: true });
  assert.ok(frag.startsWith('<h2 class="legal-title">Impresszum</h2><div class="rich-text legal-text">') && !frag.includes('<html'));
  assert.equal(renderSite({ lang: 'hu', page: 'privacy', content: content({ imprint: IMPRINT }) }), null, 'no text, no page');
  assert.deepEqual(Object.keys(LEGAL_PATH), ['imprint', 'privacy']);
});

test('rich text links render as links (only http/https) and open safely', () => {
  const html = renderSite({ lang: 'hu', page: 'privacy', content: content({ privacy: 'Panasz: [NAIH](https://naih.hu/panaszugyintezes) vagy [rossz](javascript:alert(1)).' }) });
  assert.ok(html.includes('<a href="https://naih.hu/panaszugyintezes" target="_blank" rel="noopener noreferrer">NAIH</a>'));
  assert.ok(!html.includes('href="javascript:') && html.includes('[rossz](javascript:alert(1))'), 'other schemes stay plain text');
});

test('the legal pages are served only once the text is published', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'gaut-legal-'));
  const server = makeServer({ dataDir, password: 'teszt-jelszo-123456' });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const path of ['/impresszum', '/en/imprint', '/adatkezeles', '/en/privacy', '/impresszum?reszlet=1']) assert.equal((await fetch(base + path)).status, 404, path);
    const login = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-gaut-request': '1' }, body: JSON.stringify({ user: 'misi', password: 'teszt-jelszo-123456' }) });
    const cookie = (login.headers.getSetCookie?.() ?? []).map(c => c.split(';')[0]).join('; ');
    const call = (path, method = 'GET', body) => fetch(base + path, { method, headers: { 'content-type': 'application/json', 'x-gaut-request': '1', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
    const draft = await (await call('/api/site/content')).json();
    const saved = await call('/api/site/content', 'PUT', { revision: draft.draft.revision, overrides: { hu: { imprint: IMPRINT }, en: {}, media: {} } });
    assert.equal(saved.status, 200);
    assert.equal((await fetch(`${base}/impresszum`)).status, 404, 'a draft is not public');
    const now = await (await call('/api/site/content')).json();
    assert.equal((await call('/api/site/publish', 'POST', { revision: now.draft.revision, note: 'teszt' })).status, 200);
    const page = await fetch(`${base}/impresszum`);
    assert.equal(page.status, 200); assert.ok((await page.text()).includes('<h1 class="kicker">Impresszum</h1>'));
    const frag = await (await fetch(`${base}/impresszum?reszlet=1`)).text();
    assert.ok(frag.startsWith('<h2 class="legal-title">') && !frag.includes('<html'));
    assert.ok((await (await fetch(`${base}/`)).text()).includes('data-legal'), 'the home page footer links to it');
    assert.equal((await fetch(`${base}/adatkezeles`)).status, 404, 'the privacy notice is still empty');
  } finally { await new Promise(r => server.close(r)); rmSync(dataDir, { recursive: true, force: true }); }
});
