import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { makeServer } from '../server.mjs';
import { cleanOverrides } from '../site/content.mjs';

const PASSWORD = 'teszt-jelszo-123456';
async function withServer(fn) {
  const dataDir = mkdtempSync(join(tmpdir(), 'gaut-media-'));
  const server = makeServer({ dataDir, password: PASSWORD });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base); } finally { await new Promise(r => server.close(r)); rmSync(dataDir, { recursive: true, force: true }); }
}
async function login(base) {
  const r = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-gaut-request': '1' }, body: JSON.stringify({ password: PASSWORD }) });
  return r.headers.get('set-cookie').split(';')[0];
}
const call = (base, cookie, path, method = 'GET', body) => fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', 'x-gaut-request': '1', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
const upload = (base, cookie, filename, buffer, extra = {}) => call(base, cookie, '/api/site/media', 'POST', { filename, content: buffer.toString('base64'), ...extra });
const png = (width, height, color = '#3366aa') => sharp({ create: { width, height, channels: 3, background: color } }).png().toBuffer();

test('image slots are validated', () => {
  const id = '11111111-2222-3333-4444-555555555555';
  assert.deepEqual(cleanOverrides({ media: { 'hero.rendszer': id, 'hero.szinkron': null } }).media, { 'hero.rendszer': id });
  assert.equal(cleanOverrides({ media: { 'team.misi': id } }).media['team.misi'], id);
  assert.throws(() => cleanOverrides({ media: { 'hero.nincs': id } }), /Ismeretlen képhely/);
  assert.throws(() => cleanOverrides({ media: { 'hero.rendszer': 'nem-uuid' } }), /képazonosító/);
  assert.throws(() => cleanOverrides({ media: [] }), /képhozzárendelés/);
});

test('upload resizes to WebP, rejects bad files, and strips metadata', async () => {
  await withServer(async base => {
    assert.equal((await upload(base, '', 'a.png', await png(1200, 800))).status, 401);
    const cookie = await login(base);
    const ok = await upload(base, cookie, 'kep.png', await png(2600, 1400), { alt_hu: 'Épület', alt_en: 'Building' });
    assert.equal(ok.status, 201);
    const { media } = await ok.json();
    assert.deepEqual(media.widths, [800, 1600, 2400]); assert.equal(media.width, 2600); assert.deepEqual(media.alt, { hu: 'Épület', en: 'Building' });
    const small = await (await upload(base, cookie, 'kicsi.png', await png(1000, 600))).json();
    assert.deepEqual(small.media.widths, [800]);
    const variant = await call(base, cookie, `/media/${media.id}/1600.webp`);
    assert.equal(variant.status, 200); assert.equal(variant.headers.get('content-type'), 'image/webp');
    const meta = await sharp(Buffer.from(await variant.arrayBuffer())).metadata();
    assert.equal(meta.format, 'webp'); assert.equal(meta.width, 1600);
    assert.equal((await call(base, cookie, `/media/${media.id}/999.webp`)).status, 404, 'only stored widths exist');
    // too narrow, not an image, wrong type
    assert.equal((await upload(base, cookie, 'tul-kicsi.png', await png(300, 300))).status, 400);
    assert.equal((await upload(base, cookie, 'szoveg.png', Buffer.from('ez nem kep'))).status, 400);
    assert.equal((await upload(base, cookie, 'rajz.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).status, 400);
    assert.equal((await upload(base, cookie, 'kep.png', await png(1200, 800), { alt_hu: 'x'.repeat(300) })).status, 400);
    // metadata (EXIF) does not survive
    const withExif = await sharp(await png(1200, 800)).jpeg().withExif({ IFD0: { Copyright: 'titkos szerzo' } }).toBuffer();
    assert.ok((await sharp(withExif).metadata()).exif, 'test input has EXIF');
    const stored = await (await upload(base, cookie, 'exif.jpg', withExif)).json();
    const out = Buffer.from(await (await call(base, cookie, `/media/${stored.media.id}/800.webp`)).arrayBuffer());
    assert.ok(!(await sharp(out).metadata()).exif, 'stored image has no EXIF');
    assert.ok(!out.includes(Buffer.from('titkos szerzo')));
  });
});

test('an image is public only after a published version uses it; drafts need a session', async () => {
  await withServer(async base => {
    const cookie = await login(base);
    const { media } = await (await upload(base, cookie, 'hero.png', await png(1800, 1200, '#aa3366'), { alt_hu: 'Nyitókép', alt_en: 'Hero' })).json();
    const other = (await (await upload(base, cookie, 'masik.png', await png(1800, 1200, '#33aa66'))).json()).media;
    const url = `/media/${media.id}/800.webp`;
    assert.equal((await fetch(`${base}${url}`)).status, 404, 'unpublished: hidden from visitors');
    assert.equal((await call(base, cookie, url)).status, 200, 'unpublished: visible to the workspace');
    // assign to a slot in the draft
    let state = await (await call(base, cookie, '/api/site/content')).json();
    assert.equal(state.media.length, 2); assert.equal(state.slots.length, 3);
    const put = await call(base, cookie, '/api/site/content', 'PUT', { revision: state.draft.revision, overrides: { hu: {}, en: {}, media: { 'hero.rendszer': media.id } } });
    assert.equal(put.status, 200); state = await put.json();
    assert.equal((await call(base, cookie, '/api/site/content', 'PUT', { revision: state.draft.revision, overrides: { hu: {}, en: {}, media: { 'hero.nincs': media.id } } })).status, 400);
    const preview = await (await fetch(`${base}/hu?elonezet=1`, { headers: { cookie } })).text();
    assert.match(preview, new RegExp(`class="hero-img hero-rendszer" src="/media/${media.id}/1600.webp" srcset="[^"]*${media.id}/800.webp 800w[^"]*" sizes=`));
    assert.ok(preview.includes('alt="Nyitókép"'));
    const live = await (await fetch(`${base}/hu`)).text();
    assert.ok(!live.includes(media.id) && live.includes('/site/img/hero-1.webp'), 'live page still uses the default image');
    // publish
    const pub = await call(base, cookie, '/api/site/publish', 'POST', { revision: state.draft.revision, note: 'kep' });
    assert.equal(pub.status, 200);
    const pubUrl = await fetch(`${base}${url}`);
    assert.equal(pubUrl.status, 200); assert.match(pubUrl.headers.get('cache-control'), /immutable/);
    assert.equal((await fetch(`${base}/media/${other.id}/800.webp`)).status, 404, 'unused uploads stay private');
    assert.ok((await (await fetch(`${base}/en`)).text()).includes('alt="Hero"'));
    assert.ok((await (await fetch(`${base}/hu`)).text()).includes(`/media/${media.id}/1600.webp`));
    // alt text edit
    const patched = await call(base, cookie, `/api/site/media/${media.id}`, 'PATCH', { alt_hu: 'Új leírás', alt_en: 'New text' });
    assert.equal(patched.status, 200);
    assert.ok((await (await fetch(`${base}/hu`)).text()).includes('alt="Új leírás"'));
    assert.equal((await call(base, cookie, '/api/site/media/00000000-0000-0000-0000-000000000000', 'PATCH', { alt_hu: '' })).status, 404);
    // path tricks
    assert.equal((await fetch(`${base}/media/..%2F..%2Fserver/800.webp`)).status, 404);
    assert.equal((await fetch(`${base}/media/${media.id}/800.webp.map`)).status, 404);
  });
});
