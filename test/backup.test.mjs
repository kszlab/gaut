import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import sharp from 'sharp';
import { makeServer } from '../server.mjs';

const PASSWORD = 'teszt-jelszo-123456';
const TOKEN = 'mentesi-token-'.padEnd(48, 'x');

// Minimal ustar reader, enough to verify the archive independently of the code that wrote it.
function untar(buffer) {
  const entries = new Map();
  for (let offset = 0; offset + 512 <= buffer.length;) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every(b => b === 0)) break;
    const name = header.toString('utf8', 0, 100).replace(/\0.*$/, '');
    const size = parseInt(header.toString('ascii', 124, 136).replace(/\0.*$/, ''), 8);
    const stored = header.toString('ascii', 148, 156), expected = header.reduce((a, b, i) => a + (i >= 148 && i < 156 ? 32 : b), 0);
    assert.equal(parseInt(stored, 8), expected, `checksum of ${name}`);
    entries.set(name, buffer.subarray(offset + 512, offset + 512 + size));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return entries;
}

async function withServer(fn, options = {}) {
  const dataDir = mkdtempSync(join(tmpdir(), 'gaut-backup-'));
  const server = makeServer({ dataDir, password: PASSWORD, ...options });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base, dataDir); } finally { await new Promise(r => server.close(r)); rmSync(dataDir, { recursive: true, force: true }); }
}
async function login(base) {
  const r = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-gaut-request': '1' }, body: JSON.stringify({ password: PASSWORD }) });
  return r.headers.get('set-cookie').split(';')[0];
}

test('the backup needs a login or the backup token, and failed token attempts are limited', async () => {
  await withServer(async base => {
    assert.equal((await fetch(`${base}/api/backup`)).status, 401);
    assert.equal((await fetch(`${base}/api/backup`, { headers: { authorization: 'Bearer nem-jo-token' } })).status, 401);
    const ok = await fetch(`${base}/api/backup`, { headers: { authorization: `Bearer ${TOKEN}` } });
    assert.equal(ok.status, 200); assert.equal(ok.headers.get('content-type'), 'application/gzip');
    assert.match(ok.headers.get('content-disposition'), /^attachment; filename="gaut-backup-\d{8}-\d{4}\.tar\.gz"$/);
    await ok.arrayBuffer();
    assert.equal((await fetch(`${base}/api/backup`, { headers: { authorization: `Basic ${TOKEN}` } })).status, 401, 'only Bearer is accepted');
    for (let i = 0; i < 10; i++) await fetch(`${base}/api/backup`, { headers: { authorization: 'Bearer rossz' } });
    assert.equal((await fetch(`${base}/api/backup`, { headers: { authorization: 'Bearer rossz' } })).status, 429);
  }, { backupToken: TOKEN });
});

test('a missing or too short backup token disables token access; the session still works', async () => {
  for (const backupToken of [undefined, 'rovid']) {
    await withServer(async base => {
      assert.equal((await fetch(`${base}/api/backup`, { headers: { authorization: `Bearer ${backupToken ?? TOKEN}` } })).status, 401);
      const cookie = await login(base);
      assert.equal((await fetch(`${base}/api/backup`, { headers: { cookie } })).status, 200);
    }, { backupToken });
  }
});

test('the backup is a consistent archive that restores: database snapshot, files, manifest with checksums', async () => {
  await withServer(async (base, dataDir) => {
    const cookie = await login(base);
    const call = (path, method = 'GET', body) => fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', 'x-gaut-request': '1', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
    const png = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: '#445566' } }).png().toBuffer();
    // data in every storage area: a site image, a reference photo and a workspace file
    const media = (await (await call('/api/site/media', 'POST', { filename: 'kep.png', content: png.toString('base64'), alt_hu: 'Teszt kép' })).json()).media;
    const refs = (await (await call('/api/references')).json()).references;
    const photo = (await (await call(`/api/references/${refs[0].id}/photos`, 'POST', { filename: 'foto.png', content: png.toString('base64'), caption: 'Fotó' })).json()).photo;
    const item = await call('/api/items', 'POST', { title: 'Teszt fájl', section: 'common', category: 'Egyéb', filename: 'jegyzet.txt', content: Buffer.from('mentendő tartalom').toString('base64') });
    assert.equal(item.status, 201);
    const state = await (await call('/api/site/content')).json();
    await call('/api/site/content', 'PUT', { revision: state.draft.revision, overrides: { hu: { sub: 'Mentett alcím' }, en: {}, media: { 'hero.rendszer': media.id } } });

    const response = await fetch(`${base}/api/backup`, { headers: { cookie } });
    assert.equal(response.status, 200);
    const archive = Buffer.from(await response.arrayBuffer());
    const entries = untar(gunzipSync(archive));

    // manifest lists every file with a correct size and SHA-256
    const manifest = JSON.parse(entries.get('manifest.json').toString());
    assert.equal(manifest.format, 'gaut-backup-v1'); assert.ok(Date.parse(manifest.created_at));
    assert.equal(manifest.files.length, entries.size - 1, 'every file except the manifest itself is listed');
    for (const f of manifest.files) {
      const data = entries.get(f.name); assert.ok(data, f.name);
      assert.equal(data.length, f.size); assert.equal(createHash('sha256').update(data).digest('hex'), f.sha256, f.name);
    }
    // every area is present
    for (const name of [`site-media/${media.id}-800.webp`, `reference-photos/${photo.id}`]) assert.ok(entries.has(name), name);
    assert.ok([...entries.keys()].some(n => n.startsWith('files/')), 'workspace file versions are included');
    assert.ok(![...entries.keys()].some(n => n.startsWith('.backup-')), 'no temporary snapshot leaks into the archive');
    assert.deepEqual(readdirSync(dataDir).filter(n => n.startsWith('.backup-')), [], 'the temporary snapshot is removed afterwards');

    // the database snapshot opens on its own and contains the data
    const restored = join(mkdtempSync(join(tmpdir(), 'gaut-restore-')), 'gaut.sqlite');
    writeFileSync(restored, entries.get('gaut.sqlite'));
    const db = new DatabaseSync(restored);
    try {
      assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
      assert.equal(db.prepare('SELECT count(*) AS n FROM reference_records').get().n, 43);
      assert.equal(db.prepare('SELECT alt_hu FROM site_media WHERE id=?').get(media.id).alt_hu, 'Teszt kép');
      assert.equal(db.prepare('SELECT count(*) AS n FROM items').get().n, 1);
      assert.ok(JSON.parse(db.prepare('SELECT payload FROM site_draft').get().payload).hu.sub === 'Mentett alcím');
    } finally { db.close(); rmSync(join(restored, '..'), { recursive: true, force: true }); }

    // a standard tar tool can read it too (skipped where tar is not installed)
    const file = join(mkdtempSync(join(tmpdir(), 'gaut-tar-')), 'backup.tar.gz');
    writeFileSync(file, archive);
    const listed = spawnSync('tar', ['-tzf', 'backup.tar.gz'], { encoding: 'utf8', cwd: join(file, '..') });
    if (!listed.error) { assert.equal(listed.status, 0, listed.stderr); assert.ok(listed.stdout.includes('gaut.sqlite') && listed.stdout.includes('manifest.json')); }
    rmSync(join(file, '..'), { recursive: true, force: true });
  });
});

test('the Dockerfile copies every top-level module the server imports', () => {
  const dockerfile = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
  const copied = dockerfile.split('\n').filter(l => l.startsWith('COPY') && l.includes('server.mjs')).join(' ');
  const imports = [...readFileSync(new URL('../server.mjs', import.meta.url), 'utf8').matchAll(/from '\.\/([\w-]+\.mjs)'/g)].map(m => m[1]);
  assert.ok(imports.length >= 3);
  for (const file of imports) assert.ok(copied.includes(file), `${file} is imported by server.mjs but not copied into the image`);
});

test('verify and restore tools: intact archive, detected corruption, and a working restored server', async () => {
  const { verifyArchive, restoreArchive } = await import('../tools/backup-tools.mjs');
  const { gzipSync } = await import('node:zlib');
  await withServer(async base => {
    const cookie = await login(base);
    const call = (path, method = 'GET', body) => fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', 'x-gaut-request': '1', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
    const png = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: '#778899' } }).png().toBuffer();
    const media = (await (await call('/api/site/media', 'POST', { filename: 'kep.png', content: png.toString('base64') })).json()).media;
    const state = await (await call('/api/site/content')).json();
    await call('/api/site/content', 'PUT', { revision: state.draft.revision, overrides: { hu: { sub: 'Visszaállított alcím' }, en: {}, media: { 'hero.szinkron': media.id } } });
    const after = await (await call('/api/site/content')).json();
    await call('/api/site/publish', 'POST', { revision: after.draft.revision, note: 'mentés előtt' });

    const work = mkdtempSync(join(tmpdir(), 'gaut-tools-'));
    try {
      const file = join(work, 'backup.tar.gz');
      writeFileSync(file, Buffer.from(await (await fetch(`${base}/api/backup`, { headers: { cookie } })).arrayBuffer()));
      const ok = verifyArchive(file);
      assert.deepEqual(ok.problems, []); assert.ok(ok.manifest.files.length >= 3);

      // a flipped byte inside a stored file is detected by the checksum
      const raw = gunzipSync(readFileSync(file));
      const at = raw.indexOf(Buffer.from('RIFF'), 1024); // inside a WebP of the site images
      assert.ok(at > 0, 'a WebP is stored in the archive');
      raw[at + 20] ^= 0xff;
      const broken = join(work, 'broken.tar.gz'); writeFileSync(broken, gzipSync(raw));
      assert.ok(verifyArchive(broken).problems.some(p => /ellenőrzőösszeg/.test(p)));
      assert.throws(() => restoreArchive(broken, join(work, 'x')), /hibás/);
      // a truncated archive is refused as well
      const cut = join(work, 'cut.tar.gz'); writeFileSync(cut, gzipSync(raw.subarray(0, 3000)));
      assert.ok(verifyArchive(cut).problems.length > 0);

      // restore into a fresh directory and run the application on it
      const target = join(work, 'restored');
      assert.equal(restoreArchive(file, target).files, ok.manifest.files.length);
      assert.throws(() => restoreArchive(file, target), /nem üres/, 'an existing data directory is not overwritten by accident');
      assert.equal(restoreArchive(file, target, { force: true }).files, ok.manifest.files.length);
      const second = makeServer({ dataDir: target, password: PASSWORD });
      await new Promise(r => second.listen(0, '127.0.0.1', r));
      try {
        const base2 = `http://127.0.0.1:${second.address().port}`;
        const cookie2 = await login(base2);
        const refs = await (await fetch(`${base2}/api/references`, { headers: { cookie: cookie2 } })).json();
        assert.equal(refs.references.length, 43);
        assert.ok((await (await fetch(`${base2}/hu`)).text()).includes('Visszaállított alcím'), 'the published text survived the restore');
        assert.equal((await fetch(`${base2}/media/${media.id}/800.webp`)).status, 200, 'the published image survived the restore');
      } finally { await new Promise(r => second.close(r)); }
    } finally { rmSync(work, { recursive: true, force: true }); }
  });
});
