import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeServer } from '../server.mjs';
import { renderSite, toPublicReference, sampleReferences, sampleTeam } from '../site/site.mjs';
import { buildingSvg, SCENES } from '../site/art.mjs';

async function withServer(fn) {
  const dataDir = mkdtempSync(join(tmpdir(), 'gaut-site-'));
  const server = makeServer({ dataDir, password: 'teszt-jelszo-123456' });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try { await fn(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(r => server.close(r)); rmSync(dataDir, { recursive: true, force: true }); }
}

test('public site pages need no login and respect language and theme', async () => {
  await withServer(async base => {
    const hu = await fetch(`${base}/hu?tema=3`); const html = await hu.text();
    assert.equal(hu.status, 200);
    assert.match(html, /<html lang="hu" data-theme="szinkron">/);
    assert.match(html, /Összehangolt rendszerek<span class="dot">\.<\/span>/);
    assert.match(html, /name="robots" content="noindex, nofollow"/);
    const en = await (await fetch(`${base}/en?tema=2`)).text();
    assert.match(en, /<html lang="en" data-theme="struktura">/);
    assert.match(en, /Coordinated systems<span class="dot">\.<\/span>/);
    assert.match(await (await fetch(`${base}/hu?tema=nincs`)).text(), /data-theme="rendszer"/);
  });
});

test('site assets are served, the private API stays closed', async () => {
  await withServer(async base => {
    assert.equal((await fetch(`${base}/site/site.css`)).headers.get('content-type'), 'text/css; charset=utf-8');
    assert.equal((await fetch(`${base}/site/site.js`)).status, 200);
    assert.equal((await fetch(`${base}/site/../server.mjs`)).status, 404);
    assert.equal((await fetch(`${base}/api/references`)).status, 401);
    assert.equal((await fetch(`${base}/hu`, { method: 'POST', headers: { 'x-gaut-request': '1' } })).status, 404);
  });
});

test('sample references render and are marked as samples', () => {
  const html = renderSite({ lang: 'hu' });
  for (const r of sampleReferences()) assert.ok(html.includes(r.title.hu), r.id);
  assert.equal((html.match(/class="badge"/g) || []).length, sampleReferences().length + sampleTeam().length);
  assert.ok(!html.includes('<script>'));
});

test('building art exists for every sample kind', () => {
  for (const r of sampleReferences()) assert.ok(SCENES[r.kind], r.kind);
  assert.match(buildingSvg('tower'), /^<svg class="building" viewBox="-?\d+ -?\d+ \d+ \d+"/);
});

test('only approved, active references reach the public shape and internal fields never do', () => {
  const base = { id: 'GAUT-REF-1', name: 'Teszt iroda', category: 'Iroda', city: 'Budapest', design_year: '2022', website_publishable: true, website_copy_hu: 'Nyilvános leírás.', website_copy_draft: 'BELSŐ tervezet: pontosítandó a szerep', background: 'BELSŐ háttér', attribution: 'BELSŐ szerepjegyzet', questions: 'BELSŐ kérdés', sources: [{ url: 'https://pelda.hu' }], photo_sources: [{ url: 'https://foto.hu' }], sections: ['krisztian'], website_cover_media: 'cover-id' };
  const pub = toPublicReference(base);
  assert.equal(pub.title.hu, 'Teszt iroda');
  assert.equal(pub.summary.hu, 'Nyilvános leírás.');
  assert.equal(pub.cover, 'cover-id');
  assert.ok(!JSON.stringify(pub).includes('BELSŐ'), 'no internal text, including the general description draft');
  assert.ok(!JSON.stringify(pub).includes('pelda.hu') && !JSON.stringify(pub).includes('foto.hu'));
  assert.equal(toPublicReference({ ...base, website_publishable: false }), null);
  assert.equal(toPublicReference({ ...base, deleted_at: '2026-01-01' }), null);
  assert.equal(toPublicReference({ ...base, archived: true }), null);
  assert.equal(toPublicReference({ ...base, merged_into: 'X' }), null);
  // missing public texts are only warnings: the reference is still published, the draft text is never used as a fallback
  const bare = toPublicReference({ ...base, website_copy_hu: '' });
  assert.equal(bare.summary.hu, ''); assert.equal(bare.title.hu, 'Teszt iroda');
  assert.equal(toPublicReference({ ...base, website_title_hu: ' Saját cím ', website_title_en: 'Own title' }).title.en, 'Own title');
});

test('team section renders every member in both languages, with a placeholder when there is no photo', () => {
  for (const lang of ['hu', 'en']) {
    const html = renderSite({ lang });
    assert.match(html, /id="csapat"/);
    for (const m of sampleTeam()) assert.ok(html.includes(`<h3>${m.name[lang]}</h3>`), `${lang} ${m.id}`);
    assert.equal((html.match(/class="portrait-empty"/g) || []).length, sampleTeam().length);
  }
  const withPhoto = renderSite({ lang: 'hu', team: [{ ...sampleTeam()[0], photo: '/site/team/misi.jpg' }] });
  assert.match(withPhoto, /<img src="\/site\/team\/misi\.jpg" alt="Misi"/);
  assert.ok(!withPhoto.includes('portrait-empty'));
});

test('traced logos, hero renders and self-hosted fonts are part of the page and served safely', async () => {
  const html = renderSite({ lang: 'hu' });
  for (const k of ['rendszer', 'struktura', 'szinkron']) assert.match(html, new RegExp(String.raw`class="logo logo-${k}"><svg[^>]*viewBox="0 0 \d+ \d+"`));
  assert.match(html, /class="hero-img hero-rendszer" src="\/site\/img\/hero-1\.webp"/);
  assert.equal((html.match(/class="sys-icons"/g) || []).length, 1);
  assert.equal((html.match(/<text class="logo-desc"[^>]*>MÉRNÖKIRODA<\/text>/g) || []).length, 3, 'the small descriptor is live text in every logo, not a traced raster');
  assert.match(html, /<h1 class="hero-title t-szinkron"><span class="line">Intelligens épületek\.<\/span> <span class="line last">Összhangban<span class="dot">\.<\/span><\/span><\/h1>/);
  await withServer(async base => {
    const img = await fetch(`${base}/site/img/hero-1.webp`);
    assert.equal(img.status, 200); assert.equal(img.headers.get('content-type'), 'image/webp');
    const font = await fetch(`${base}/site/fonts/inter-latin-wght-normal.woff2`);
    assert.equal(font.status, 200); assert.equal(font.headers.get('content-type'), 'font/woff2');
    assert.equal((await fetch(`${base}/site/img/nincs.png`)).status, 404);
    assert.equal((await fetch(`${base}/site/img/..%2Fsite.css`)).status, 404);
    assert.equal((await fetch(`${base}/site/fonts/inter-latin-wght-normal.woff2.map`)).status, 404);
  });
});
