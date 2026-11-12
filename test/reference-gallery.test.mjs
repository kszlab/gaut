import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { makeServer } from '../server.mjs';
import { renderSite, toPublicReference } from '../site/site.mjs';
import { normalizePhotoList, WEBSITE_PHOTOS_MAX } from '../references.mjs';

const PASSWORD = 'teszt-jelszo-123456';
const media = n => ({ id: `aaaaaaaa-bbbb-cccc-dddd-${String(n).padStart(12, '0')}`, widths: [800, 1600], width: 1600, height: 1067 });
const ref = (id, extra = {}) => ({ id, kind: 'tower', category: 'Szállodák', categoryId: 'szallodak', year: '2020', place: { hu: 'Budapest', en: 'Budapest' }, title: { hu: `Projekt ${id}`, en: '' }, summary: { hu: 'Rövid.', en: '' }, tags: { hu: [], en: [] }, featured: true, cover: null, ...extra });

test('the photo list: the first is the cover, older records carry only the cover, the media list runs parallel', () => {
  assert.equal(WEBSITE_PHOTOS_MAX, 8);
  const legacy = normalizePhotoList({ website_cover_photo: 'p1', website_cover_media: 'm1' });
  assert.deepEqual([legacy.website_photos, legacy.website_photos_media], [['p1'], ['m1']]);
  const noCopy = normalizePhotoList({ website_cover_photo: 'p1' });
  assert.deepEqual(noCopy.website_photos_media, [''], 'a photo without a copy in the site image store is padded');
  const list = normalizePhotoList({ website_photos: ['p2', 'p1'], website_photos_media: ['m2', 'm1'], website_cover_photo: 'p1', website_cover_media: 'm1' });
  assert.equal(list.website_cover_photo, 'p2'); assert.equal(list.website_cover_media, 'm2');
  assert.deepEqual(normalizePhotoList({}).website_photos, []);
});

test('public reference: the gallery lists the copies in order, cover first', () => {
  const rec = { id: 'x', name: 'X', website_publishable: true, website_photos: ['p1', 'p2', 'p3'], website_photos_media: [media(1).id, '', media(3).id], website_cover_media: media(1).id };
  const pub = toPublicReference(rec);
  assert.deepEqual(pub.gallery, [media(1).id, media(3).id], 'photos without a copy are skipped');
  assert.equal(pub.cover, media(1).id);
  const legacy = toPublicReference({ id: 'y', name: 'Y', website_publishable: true, website_cover_media: media(9).id });
  assert.deepEqual(legacy.gallery, [media(9).id]); assert.equal(legacy.cover, media(9).id);
  assert.deepEqual(toPublicReference({ id: 'z', name: 'Z', website_publishable: true }).gallery, []);
});

test('detail dialog: a gallery only where two or more images exist', () => {
  const three = [media(1), media(2), media(3)];
  const html = renderSite({ lang: 'hu', page: 'references', references: [ref('a', { coverMedia: three[0], galleryMedia: three }), ref('b', { coverMedia: media(4), galleryMedia: [media(4)] }), ref('c')] });
  const [a, b, c] = html.split('<article class="mt').slice(1);
  assert.ok(a.includes('data-gallery') && a.includes('aria-label="Képtár"'));
  assert.equal((a.match(/class="mg-slide"/g) || []).length, 3, 'one slide per image');
  assert.equal((a.match(/class="mg-slide" hidden/g) || []).length, 2, 'only the first image is shown');
  assert.equal((a.match(/loading="eager"/g) || []).length, 1, 'only the first image loads at once');
  assert.equal((a.match(/data-mg-dot=/g) || []).length, 3);
  assert.ok(a.includes('<span class="mg-count" aria-live="polite">1 / 3</span>') && a.includes('aria-label="Előző kép"') && a.includes('aria-label="Következő kép"'));
  assert.ok(!b.includes('data-gallery') && !b.includes('mg-slide') && b.includes('<figure class="md-fig"><img'), 'one image: the dialog looks as before');
  assert.ok(!c.includes('data-gallery') && !c.includes('<figure'), 'no image: nothing empty');
  assert.ok(!a.slice(0, a.indexOf('<template')).includes('mg-'), 'the small tile never shows the gallery');
  assert.ok(renderSite({ lang: 'en', page: 'references', references: [ref('a', { coverMedia: three[0], galleryMedia: three })] }).includes('aria-label="Next image"'));
});

test('gallery photos end to end: choose, order, limit, publication, access', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'gaut-gallery-'));
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
    const png = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#335577' } }).png().toBuffer();
    const upload = async (ref, name) => (await (await call(`/api/references/${ref.id}/photos`, 'POST', { filename: name, content: png.toString('base64'), caption: name })).json()).photo;
    const photos = []; for (let i = 0; i < 9; i++) photos.push(await upload(one, `kep${i}.png`));
    const foreign = await upload(two, 'masik.png');
    const body = list => ({ website_publishable: true, website_title_hu: 'Képtáras projekt', website_copy_hu: 'Első mondat.', website_photos: list, website_cover_photo: list[0] ?? '', website_photos_media: ['hamis-1', 'hamis-2'] });
    const put = async list => call(`/api/references/${one.id}`, 'PUT', { ...(await (await call('/api/references')).json()).references.find(r => r.id === one.id), ...body(list) });

    // two photos: the server copies them, the media ids sent by the client are ignored
    const [p1, p2, p3] = photos;
    let res = await put([p1.id, p2.id]); assert.equal(res.status, 200); let saved = (await res.json()).reference;
    assert.deepEqual(saved.website_photos, [p1.id, p2.id]);
    assert.equal(saved.website_cover_photo, p1.id);
    assert.ok(saved.website_photos_media.length === 2 && saved.website_photos_media.every(m => /^[a-f0-9-]{36}$/.test(m)), 'copies made by the server');
    assert.equal(saved.website_cover_media, saved.website_photos_media[0]);
    const [m1, m2] = saved.website_photos_media;

    // reordering reuses the copies; the first becomes the cover
    res = await put([p2.id, p1.id]); saved = (await res.json()).reference;
    assert.deepEqual(saved.website_photos_media, [m2, m1]); assert.equal(saved.website_cover_media, m2);
    // a third photo is copied, the others keep theirs
    res = await put([p2.id, p1.id, p3.id]); saved = (await res.json()).reference;
    assert.deepEqual(saved.website_photos_media.slice(0, 2), [m2, m1]); assert.equal(saved.website_photos_media.length, 3);

    // limits and ownership
    assert.equal((await put(photos.map(p => p.id))).status, 400, 'nine photos are too many');
    assert.equal((await put([p1.id, p1.id])).status, 400, 'a photo only once');
    assert.equal((await put([p1.id, foreign.id])).status, 400, 'photos of another reference are refused');
    assert.equal((await put([p1.id, 'nincs-ilyen'])).status >= 400, true);

    // a client that only changes the cover gets a one-photo list; clearing the cover clears the list
    const current = (await (await call('/api/references')).json()).references.find(r => r.id === one.id);
    res = await call(`/api/references/${one.id}`, 'PUT', { ...current, website_cover_photo: p3.id }); saved = (await res.json()).reference;
    assert.deepEqual(saved.website_photos, [p3.id]); assert.equal(saved.website_cover_media, current.website_photos_media[2], 'the copy is reused');
    res = await call(`/api/references/${one.id}`, 'PUT', { ...saved, website_cover_photo: '' }); saved = (await res.json()).reference;
    assert.deepEqual([saved.website_photos, saved.website_cover_photo, saved.website_cover_media], [[], '', '']);

    // publication: private before, gallery in the draft preview, public after
    res = await put([p1.id, p2.id, p3.id]); saved = (await res.json()).reference;
    const gallery = saved.website_photos_media;
    assert.equal((await fetch(`${base}/media/${gallery[1]}/800.webp`)).status, 404, 'private before publication');
    assert.ok(!(await page('/hu')).includes('data-gallery'));
    const preview = await page('/hu?elonezet=1', true);
    assert.ok(preview.includes('data-gallery') && gallery.every(m => preview.includes(`/media/${m}/`)));
    const state = await (await call('/api/site/content')).json();
    assert.equal((await call('/api/site/publish', 'POST', { revision: state.draft.revision, note: 'képtár' })).status, 200);
    for (const m of gallery) assert.equal((await fetch(`${base}/media/${m}/800.webp`)).status, 200, 'every gallery image is public once published');
    const live = await page('/hu');
    assert.ok(live.includes('data-gallery') && (live.match(/class="mg-slide"/g) || []).length === 3);

    // later changes stay in the store until the next publication; one photo means no gallery
    res = await put([p1.id]); assert.equal(res.status, 200);
    assert.ok((await page('/hu')).includes('data-gallery'), 'the live site shows the frozen list');
    const single = await page('/hu?elonezet=1', true);
    assert.ok(!single.includes('data-gallery') && single.includes(`/media/${gallery[0]}/`), 'one photo: the dialog looks as before');
    const now = await (await call('/api/site/content')).json();
    assert.equal((await call('/api/site/publish', 'POST', { revision: now.draft.revision, note: 'egy kép' })).status, 200);
    assert.ok(!(await page('/hu')).includes('data-gallery'));
  } finally { await new Promise(r => server.close(r)); rmSync(dataDir, { recursive: true, force: true }); }
});
