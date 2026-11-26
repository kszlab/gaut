import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeServer } from '../server.mjs';
import { parseCommonsLink, photoFields, plainText } from '../wikimedia.mjs';
import { toPublicReference, renderSite } from '../site/site.mjs';

// Bytes that start like a JPEG: the photo store checks the file signature, nothing decodes them here.
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
const JSON_IMG = JPEG.toString('base64');

test('Commons links: file pages, categories, Wikipedia media links and bare titles', () => {
  assert.deepEqual(parseCommonsLink('https://commons.wikimedia.org/wiki/File:Telenor1.jpg'), { kind: 'file', title: 'File:Telenor1.jpg' });
  assert.deepEqual(parseCommonsLink('https://commons.wikimedia.org/wiki/Category:Telenor_HQ_in_T%C3%B6r%C3%B6kb%C3%A1lint'), { kind: 'category', title: 'Category:Telenor HQ in Törökbálint' });
  assert.deepEqual(parseCommonsLink('https://hu.wikipedia.org/wiki/Yettel#/media/F%C3%A1jl:Telenor1.jpg'), { kind: 'file', title: 'File:Telenor1.jpg' });
  assert.deepEqual(parseCommonsLink('https://commons.wikimedia.org/w/index.php?title=File:A_b.png&oldid=1'), { kind: 'file', title: 'File:A b.png' });
  assert.deepEqual(parseCommonsLink('Kategória:Budai Vigadó'), { kind: 'category', title: 'Category:Budai Vigadó' });
  for (const bad of ['', 'https://example.com/wiki/File:X.jpg', 'https://commons.wikimedia.org/wiki/Main_Page', 'javascript:alert(1)'])
    assert.throws(() => parseCommonsLink(bad), e => e.status === 400, bad);
});

test('photo fields: author and licence in plain text, and the credit line for the website', () => {
  assert.equal(plainText('<a href="//commons.wikimedia.org/wiki/User:X">Kiss&nbsp;Tamás</a> &amp; <b>társa</b>'), 'Kiss Tamás & társa');
  const fields = photoFields({ title: 'File:Telenor1.jpg', imageinfo: [{ descriptionurl: 'https://commons.wikimedia.org/wiki/File:Telenor1.jpg', extmetadata: {
    Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:Texaner">Texaner</a>' }, LicenseShortName: { value: 'CC BY-SA 3.0' },
    LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/3.0' }, ImageDescription: { value: '<span>Telenor székház, Törökbálint</span>' } } }] });
  assert.equal(fields.public_credit, 'Fotó: Texaner / Wikimedia Commons, CC BY-SA 3.0');
  assert.equal(fields.credit, 'Texaner');
  assert.equal(fields.caption, 'Telenor székház, Törökbálint');
  assert.equal(fields.source_url, 'https://commons.wikimedia.org/wiki/File:Telenor1.jpg');
  assert.equal(fields.license_url, 'https://creativecommons.org/licenses/by-sa/3.0');
  assert.match(fields.reuse_status, /Wikimedia Commons\): CC BY-SA 3\.0/);
});

test('public credits: only filled credit texts go out, http links only, parallel to the gallery', () => {
  const pub = toPublicReference({ id: 'r', name: 'R', website_publishable: true, website_photos: ['p1', 'p2', 'p3'], website_photos_media: ['m1', '', 'm3'],
    website_photos_credits: [{ text: 'Fotó: X / Wikimedia Commons, CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:X.jpg', license: 'javascript:alert(1)' }, { text: 'skipped' }, null] });
  assert.deepEqual(pub.gallery, ['m1', 'm3']);
  assert.deepEqual(pub.credits, [{ text: 'Fotó: X / Wikimedia Commons, CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:X.jpg', license: '' }, null]);
  const m = n => ({ id: `aaaaaaaa-bbbb-cccc-dddd-${String(n).padStart(12, '0')}`, widths: [800], width: 800, height: 600 });
  const ref = extra => ({ id: 'a', kind: 'tower', category: '', categoryId: '', year: '2020', place: { hu: 'Budapest', en: '' }, title: { hu: 'Projekt <a>', en: '' }, summary: { hu: '', en: '' }, tags: { hu: [], en: [] }, featured: false, sample: false, ...extra });
  const one = renderSite({ lang: 'hu', page: 'references', references: [ref({ coverMedia: m(1), galleryMedia: [m(1)], credits: [{ text: 'Fotó: <Texaner>', source: 'https://commons.wikimedia.org/wiki/File:T.jpg', license: 'https://creativecommons.org/licenses/by-sa/3.0' }] })] });
  assert.ok(one.includes('<span class="mt-credit">Fotó: &lt;Texaner&gt;</span>'), 'the tile shows the credit as text');
  assert.ok(one.includes('<figcaption class="md-credit"><a href="https://commons.wikimedia.org/wiki/File:T.jpg"'), 'the dialog links the source');
  assert.ok(one.includes('>Licenc</a></figcaption>'), 'and the licence');
  const two = renderSite({ lang: 'en', page: 'references', references: [ref({ coverMedia: m(1), galleryMedia: [m(1), m(2)], credits: [null, { text: 'Photo: Y', source: '', license: '' }] })] });
  assert.equal((two.match(/class="md-credit"/g) || []).length, 2, 'a gallery has one credit line per image');
  assert.ok(two.includes('<figcaption class="md-credit" hidden>Photo: Y</figcaption>'));
  assert.ok(!two.includes('mt-credit'), 'no credit on the tile when the cover has none');
  const none = renderSite({ lang: 'hu', page: 'references', references: [ref({ coverMedia: m(1), galleryMedia: [m(1)] })] });
  assert.ok(!none.includes('md-credit') && !none.includes('mt-credit'));
});

test('Wikimedia import end to end: category and file, limit of five, no duplicates, login required, only Commons hosts', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'gaut-wm-')), password = 'wikimedia-test-password';
  const calls = [];
  const page = n => ({ pageid: 1000 + n, title: `File:Kep ${n}.jpg`, imageinfo: [{ mime: 'image/jpeg', url: `https://upload.wikimedia.org/x/Kep_${n}.jpg`, thumburl: `https://upload.wikimedia.org/thumb/Kep_${n}.jpg`, descriptionurl: `https://commons.wikimedia.org/wiki/File:Kep_${n}.jpg`,
    extmetadata: { Artist: { value: `Fotós ${n}` }, LicenseShortName: { value: 'CC BY-SA 4.0' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0' } } }] });
  const fakeFetch = async (url, options) => {
    const u = new URL(url); calls.push(u.hostname);
    assert.match(options.headers['User-Agent'], /^GAUT-munkater\//);
    if (u.hostname === 'upload.wikimedia.org') return new Response(JPEG, { status: 200 });
    const q = u.searchParams;
    if (q.get('list') === 'categorymembers') return Response.json({ query: { categorymembers: [1, 2, 3, 4, 5, 6, 7].map(n => ({ title: `File:Kep ${n}.jpg` })).concat([{ title: 'File:Rajz.svg' }]) } });
    if (q.get('prop') === 'imageinfo') {
      const pages = q.get('titles').split('|').map(t => {
        const n = Number(/Kep (\d+)/.exec(t)?.[1]);
        if (t === 'File:Rossz host.jpg') return { ...page(99), title: t, imageinfo: [{ ...page(99).imageinfo[0], thumburl: 'https://example.com/evil.jpg' }] };
        return n ? page(n) : { title: t, missing: true };
      });
      return Response.json({ query: { pages } });
    }
    return new Response('nope', { status: 400 });
  };
  const server = makeServer({ dataDir, password, commonsFetch: fakeFetch });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  const req = async (path, method = 'GET', data, auth = true) => { const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-Gaut-Request': '1', Cookie: auth ? cookie : '' }, body: data === undefined ? undefined : JSON.stringify(data) }); return { status: r.status, data: await r.json() }; };
  try {
    const url = '/api/references/GAUT-REF-004/photos/wikimedia';
    assert.equal((await req(url, 'POST', { links: ['File:Kep 1.jpg'] }, false)).status, 401);
    const login = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Gaut-Request': '1' }, body: JSON.stringify({ password }) });
    cookie = login.headers.get('set-cookie').split(';')[0];
    assert.equal((await req('/api/references/missing/photos/wikimedia', 'POST', { links: ['File:Kep 1.jpg'] })).status, 404);
    assert.equal((await req(url, 'POST', { links: ['https://example.com/x.jpg'] })).status, 400);

    // The file first, then the category fills up to five; the svg in the category is skipped.
    const first = await req(url, 'POST', { links: ['https://commons.wikimedia.org/wiki/Category:Kepek', 'https://commons.wikimedia.org/wiki/File:Kep_6.jpg'], max: 5 });
    assert.equal(first.status, 200);
    assert.deepEqual(first.data.added.map(p => p.filename), ['Kep 6.jpg', 'Kep 1.jpg', 'Kep 2.jpg', 'Kep 3.jpg', 'Kep 4.jpg']);
    const p6 = first.data.added[0];
    assert.equal(p6.public_credit, 'Fotó: Fotós 6 / Wikimedia Commons, CC BY-SA 4.0');
    assert.equal(p6.source_url, 'https://commons.wikimedia.org/wiki/File:Kep_6.jpg');
    assert.equal(p6.seed_key, 'wm-GAUT-REF-004-1006');

    // Running the same list again adds nothing: five are there already, also after one went to the trash.
    await req(`/api/reference-photos/${p6.id}/trash`, 'POST');
    const again = await req(url, 'POST', { links: ['https://commons.wikimedia.org/wiki/Category:Kepek'], max: 5 });
    assert.deepEqual([again.data.added.length, again.data.skipped], [0, 5]);
    // A higher limit adds only images that are not there yet.
    const more = await req(url, 'POST', { links: ['Category:Kepek', 'File:Kep 1.jpg'], max: 7 });
    assert.deepEqual(more.data.added.map(p => p.filename), ['Kep 5.jpg', 'Kep 7.jpg']);
    // Another reference may get the same image.
    const other = await req('/api/references/GAUT-REF-002/photos/wikimedia', 'POST', { links: ['File:Kep 1.jpg'] });
    assert.equal(other.data.added.length, 1);

    // A missing file and an image address outside upload.wikimedia.org are reported, nothing is fetched from elsewhere.
    const bad = await req('/api/references/GAUT-REF-005/photos/wikimedia', 'POST', { links: ['File:Nincs ilyen.jpg', 'File:Rossz host.jpg'] });
    assert.equal(bad.data.added.length, 0);
    assert.equal(bad.data.errors.length, 2);
    assert.ok(calls.every(h => ['commons.wikimedia.org', 'upload.wikimedia.org'].includes(h)));

    // The credit survives an ordinary save of the photo's fields, and goes out with a published website photo list.
    const list = (await req('/api/references/GAUT-REF-004/photos')).data.photos;
    const kept = list.find(p => p.filename === 'Kep 1.jpg');
    await req(`/api/reference-photos/${kept.id}`, 'PATCH', { caption: kept.caption, credit: kept.credit, source_url: kept.source_url, reuse_status: kept.reuse_status, license_url: kept.license_url, public_credit: kept.public_credit });
    assert.equal((await req('/api/references/GAUT-REF-004/photos')).data.photos.find(p => p.id === kept.id).public_credit, 'Fotó: Fotós 1 / Wikimedia Commons, CC BY-SA 4.0');
  } finally {
    if (server.listening) await new Promise(r => server.close(r));
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('earlier Wikimedia photos get their website credit once, from the author and licence already noted', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const dataDir = mkdtempSync(join(tmpdir(), 'gaut-wm-mig-')), password = 'wikimedia-test-password';
  let server, base, cookie = '';
  const start = async () => { server = makeServer({ dataDir, password }); await new Promise(r => server.listen(0, '127.0.0.1', r)); base = `http://127.0.0.1:${server.address().port}`; };
  const stop = () => new Promise(r => server.close(r));
  const req = async (path, method = 'GET', data) => { const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-Gaut-Request': '1', Cookie: cookie }, body: data === undefined ? undefined : JSON.stringify(data) }); return (await r.json()); };
  try {
    await start();
    const login = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Gaut-Request': '1' }, body: JSON.stringify({ password }) });
    cookie = login.headers.get('set-cookie').split(';')[0];
    const path = '/api/references/GAUT-REF-029/photos', content = JSON_IMG;
    const commons = (await req(path, 'POST', { filename: 'a.jpg', content, credit: 'Yair-haklai', source_url: 'https://commons.wikimedia.org/wiki/File:Szervita_Square_Building.jpg', reuse_status: 'CC BY-SA 4.0 – a licenc feltételeivel, szerző- és forrásmegjelöléssel', license_url: 'https://creativecommons.org/licenses/by-sa/4.0' })).photo;
    const fromUrl = (await req(path, 'POST', { filename: 'b.jpg', content, credit: 'Christo', source_url: 'https://hu.wikipedia.org/wiki/F%C3%A1jl:X.jpg', reuse_status: 'Felhasználási engedély pontosítandó', license_url: 'http://creativecommons.org/publicdomain/zero/1.0/deed.en' })).photo;
    const own = (await req(path, 'POST', { filename: 'c.jpg', content, credit: 'Saját', source_url: 'https://example.com/x', reuse_status: 'CC BY 4.0 – saját' })).photo;
    const noAuthor = (await req(path, 'POST', { filename: 'd.jpg', content, source_url: 'https://commons.wikimedia.org/wiki/File:D.jpg', reuse_status: 'CC BY-SA 3.0 – x' })).photo;
    await stop();
    // Pretend the database is from before the credit field: the one-time fill has not run.
    const db = new DatabaseSync(join(dataDir, 'gaut.sqlite')); db.exec("DELETE FROM photo_migrations WHERE name='wikimedia-public-credit'"); db.close();
    await start();
    const byId = Object.fromEntries((await req(path)).photos.map(p => [p.id, p]));
    assert.equal(byId[commons.id].public_credit, 'Fotó: Yair-haklai / Wikimedia Commons, CC BY-SA 4.0');
    assert.equal(byId[fromUrl.id].public_credit, 'Fotó: Christo / Wikipédia, CC0');
    assert.equal(byId[own.id].public_credit, '', 'not from Wikimedia: left alone');
    assert.equal(byId[noAuthor.id].public_credit, '', 'no author noted: left for a person to fill');
    // A field cleared on purpose stays cleared after a restart.
    await req(`/api/reference-photos/${commons.id}`, 'PATCH', { caption: '', credit: 'Yair-haklai', source_url: commons.source_url, reuse_status: commons.reuse_status, license_url: commons.license_url, public_credit: '' });
    await stop(); await start();
    assert.equal((await req(path)).photos.find(p => p.id === commons.id).public_credit, '');
  } finally {
    if (server?.listening) await stop();
    rmSync(dataDir, { recursive: true, force: true });
  }
});
