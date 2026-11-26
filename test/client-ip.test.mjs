import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeServer } from '../server.mjs';

const password = 'proba-jelszo-12345';

async function start(trustProxy) {
  const dataDir = mkdtempSync(join(tmpdir(), 'gaut-ip-'));
  const server = makeServer({ dataDir, password, trustProxy });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: async () => { await new Promise(resolve => server.close(resolve)); rmSync(dataDir, { recursive: true, force: true }); } };
}

const login = (base, forwardedFor) => fetch(`${base}/api/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-gaut-request': '1', ...(forwardedFor ? { 'x-forwarded-for': forwardedFor } : {}) },
  body: JSON.stringify({ password: 'rossz-jelszo' })
});

test('without TRUST_PROXY a forged X-Forwarded-For does not reset the login limit', async () => {
  const app = await start(undefined);
  try {
    for (let i = 0; i < 10; i++) assert.equal((await login(app.base, `10.0.0.${i}`)).status, 401);
    assert.equal((await login(app.base, '10.0.0.99')).status, 429);
  } finally { await app.close(); }
});

test('with TRUST_PROXY=1 the proxy-appended address is used, client-supplied entries are ignored', async () => {
  const app = await start('1');
  try {
    // Same real visitor (last entry), different forged prefixes: still one bucket.
    for (let i = 0; i < 10; i++) assert.equal((await login(app.base, `1.2.3.${i}, 203.0.113.7`)).status, 401);
    assert.equal((await login(app.base, '9.9.9.9, 203.0.113.7')).status, 429);
    // Another real visitor is not locked out by the first one.
    assert.equal((await login(app.base, '198.51.100.4')).status, 401);
  } finally { await app.close(); }
});

test('team contact limit cannot be bypassed by rotating X-Forwarded-For', async () => {
  const app = await start(undefined);
  try {
    const statuses = [];
    for (let i = 0; i < 13; i++) {
      const response = await fetch(`${app.base}/api/public/team-contact`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-gaut-request': '1', 'x-forwarded-for': `10.1.0.${i}` }, body: JSON.stringify({ id: 'anna' }) });
      statuses.push(response.status); await response.text();
    }
    assert.equal(statuses.at(-1), 429);
  } finally { await app.close(); }
});
