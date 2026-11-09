import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeServer } from '../server.mjs';

const PASSWORD = 'teszt-jelszo-123456';
async function withServer(fn) {
  const dataDir = mkdtempSync(join(tmpdir(), 'gaut-routes-'));
  const server = makeServer({ dataDir, password: PASSWORD });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try { await fn(`http://127.0.0.1:${server.address().port}`); } finally { await new Promise(r => server.close(r)); rmSync(dataDir, { recursive: true, force: true }); }
}

test('the root is the public site; the workspace and its pages live under /munkater', async () => {
  await withServer(async base => {
    const root = await fetch(`${base}/`);
    const html = await root.text();
    assert.equal(root.status, 200);
    assert.match(html, /<html lang="hu" data-theme="rendszer">/);
    assert.ok(html.includes('hero-title') && html.includes('Összehangolt rendszerek'));
    assert.ok(!html.includes('login-screen') && !html.includes('Anyaggyűjtő'), 'no workspace markup on the public root');
    assert.match(await (await fetch(`${base}/?tema=3`)).text(), /data-theme="szinkron"/);
    assert.match(await (await fetch(`${base}/en`)).text(), /<html lang="en"/);
    assert.equal(await (await fetch(`${base}/hu`)).text(), html, '/hu stays an alias of the root');

    const workspace = await fetch(`${base}/munkater`);
    const workspaceHtml = await workspace.text();
    assert.equal(workspace.status, 200);
    assert.ok(workspaceHtml.includes('login-screen') && workspaceHtml.includes('/app.js'), 'the workspace login page');
    assert.ok((await (await fetch(`${base}/munkater/referenciak`)).text()).includes('/references.js'));
    assert.ok((await (await fetch(`${base}/munkater/honlap`)).text()).includes('/site-editor.js'));
    assert.equal((await fetch(`${base}/api/health`)).status, 200);
    assert.equal((await fetch(`${base}/api/references`)).status, 401, 'the API stays closed without a login');
  });
});

test('old workspace addresses redirect, keeping the query', async () => {
  await withServer(async base => {
    for (const [from, to] of [['/referenciak?section=misi', '/munkater/referenciak?section=misi'], ['/honlap', '/munkater/honlap'], ['/munkater/', '/munkater'], ['/munkater/honlap/', '/munkater/honlap']]) {
      const r = await fetch(`${base}${from}`, { redirect: 'manual' });
      assert.equal(r.status, 302, from); assert.equal(r.headers.get('location'), to, from);
    }
    assert.equal((await fetch(`${base}/referenciak`, { redirect: 'manual', method: 'POST', headers: { 'x-gaut-request': '1' } })).status, 404, 'only GET and HEAD are redirected');
  });
});

test('the draft preview works from the root for a signed-in user only', async () => {
  await withServer(async base => {
    const login = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-gaut-request': '1' }, body: JSON.stringify({ password: PASSWORD }) });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const call = (path, method = 'GET', body) => fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', 'x-gaut-request': '1', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
    const state = await (await call('/api/site/content')).json();
    await call('/api/site/content', 'PUT', { revision: state.draft.revision, overrides: { hu: { sub: 'Gyökér vázlat alcím' }, en: {}, media: {} } });
    assert.ok(!(await (await fetch(`${base}/?elonezet=1`)).text()).includes('Gyökér vázlat alcím'));
    assert.ok((await (await fetch(`${base}/?elonezet=1`, { headers: { cookie } })).text()).includes('Gyökér vázlat alcím'));
  });
});

test('no page or script still links to the old workspace addresses', () => {
  const dir = new URL('../public/', import.meta.url);
  const files = readdirSync(dir).filter(f => /\.(js|html)$/.test(f));
  assert.ok(files.length >= 6);
  for (const file of files) {
    const text = readFileSync(new URL(file, dir), 'utf8');
    assert.ok(!/(href=["'`]|replace\(["'`]|href=`)\/(referenciak|honlap)\b/.test(text), `${file} links to an old workspace address`);
    assert.ok(!/href="\/"/.test(text), `${file} links to the root as if it were the workspace`);
  }
});
