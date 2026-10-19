import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeServer } from '../server.mjs';
const password = 'shared-test-password';

test('Teljes közös munkafolyamat, jogosultság és tartós tárolás', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'gaut-test-'));
  let server = makeServer({ dataDir, password });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  const req = async (path, method = 'GET', data, extra = {}) => {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-Gaut-Request': '1', Cookie: cookie, ...extra }, body: data === undefined ? undefined : JSON.stringify(data) });
    const raw = await response.text();
    return { status: response.status, headers: response.headers, data: response.headers.get('content-type')?.includes('json') ? JSON.parse(raw) : raw };
  };
  const login = async () => { const r = await req('/api/login', 'POST', { password }); assert.equal(r.status, 200); cookie = r.headers.get('set-cookie').split(';')[0]; return r; };
  try {
    assert.equal((await req('/api/items')).status, 401);
    assert.equal((await req('/api/health')).status, 200);
    assert.equal((await req('/')).status, 200);
    assert.equal((await req('/api/login', 'POST', { user: 'misi', password: 'wrong' })).status, 401);
    const session = await login();
    assert.match(session.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
    const me = await req('/api/me'); assert.equal(Object.keys(me.data.sections).length, 5);
    const payload = { title: 'Referencialista', section: 'nandi', category: 'Referencia', project: 'Iskola', note: 'Ellenőrizendő <szöveg>', filename: 'referenciák.csv', content: Buffer.from('épület;év\nIskola;2020').toString('base64') };
    const created = await req('/api/items', 'POST', payload); assert.equal(created.status, 201);
    const id = created.data.item.id, firstVersion = created.data.versions[0].id;
    assert.equal(created.data.item.author, 'Közös belépés');
    assert.equal((await req('/api/items', 'POST', { ...payload, section: 'bad' })).status, 400);
    assert.equal((await req('/api/items', 'POST', { ...payload, filename: 'script.html' })).status, 400);
    assert.equal((await req('/api/items', 'POST', { ...payload, content: '' })).status, 400);
    assert.equal((await req(`/api/items/${id}/trash`, 'POST', undefined, { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await req(`/api/items/${id}/trash`, 'POST', undefined, { 'X-Gaut-Request': '0' })).status, 403);
    await login();
    assert.equal((await req('/api/items')).data.items.length, 1);
    const v2 = await req(`/api/items/${id}/versions`, 'POST', { filename: 'lista-v2.xlsx', content: Buffer.from('second-version').toString('base64') });
    assert.equal(v2.status, 201); assert.equal(v2.data.versions[0].number, 2); assert.equal(v2.data.versions[0].author, 'Közös belépés');
    const downloaded = await req(`/api/files/${firstVersion}`); assert.equal(downloaded.data, 'épület;év\nIskola;2020'); assert.match(downloaded.headers.get('content-disposition'), /attachment/);
    assert.equal((await req(`/api/items/${id}`, 'PATCH', { ...payload, title: 'Javított lista', section: 'common' })).status, 200);
    assert.equal((await req(`/api/items/${id}/trash`, 'POST')).status, 200);
    assert.ok((await req(`/api/items/${id}`)).data.item.deleted_at);
    assert.equal((await req(`/api/items/${id}/versions`, 'POST', { filename: 'x.txt', content: 'eA==' })).status, 409);
    assert.equal((await req(`/api/items/${id}/restore`, 'POST')).status, 200);
    assert.equal((await req(`/api/items/${id}`)).data.versions.length, 2);
    await new Promise(resolve => server.close(resolve));
    server = makeServer({ dataDir, password }); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await req('/api/items')).data.items[0].title, 'Javított lista');
    assert.equal((await req(`/api/files/${firstVersion}`)).data, 'épület;év\nIskola;2020');
    await new Promise(resolve => server.close(resolve));
    server = makeServer({ dataDir, password: 'rotated-shared-password' });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await req('/api/me')).status, 401);
    const rotated = await req('/api/login', 'POST', { password: 'rotated-shared-password' });
    assert.equal(rotated.status, 200); cookie = rotated.headers.get('set-cookie').split(';')[0];
    assert.equal((await req('/api/logout', 'POST')).status, 200);
    assert.equal((await req('/api/me')).status, 401);
    const oversized = await req('/api/login', 'POST', { user: 'misi', password: 'a'.repeat(5000) }); assert.equal(oversized.status, 413);
  } finally { await new Promise(resolve => server.close(resolve)); rmSync(dataDir, { recursive: true, force: true }); }
});

test('A belépési próbálkozások korlátozottak', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'gaut-limit-'));
  const server = makeServer({ dataDir, password, secureCookies: true }); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/login`;
    for (let i = 0; i < 11; i++) {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Gaut-Request': '1' }, body: JSON.stringify({ user: 'misi', password: 'wrong' }) });
      assert.equal(response.status, i < 10 ? 401 : 429); await response.text();
    }
  } finally { await new Promise(resolve => server.close(resolve)); rmSync(dataDir, { recursive: true, force: true }); }
});

test('Nincs alapértelmezett jelszó; a konfiguráció kötelező', () => {
 const dataDir = mkdtempSync(join(tmpdir(), 'gaut-config-'));
 try { assert.throws(() => makeServer({dataDir, password:''}), /GAUT_PASSWORD/); assert.throws(() => makeServer({dataDir, password:'short'}), /GAUT_PASSWORD/); }
 finally {rmSync(dataDir,{recursive:true,force:true});}
});
