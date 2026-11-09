#!/usr/bin/env node
// Verify or restore a GAUT backup (.tar.gz made by GET /api/backup).
//   node tools/backup-tools.mjs verify  <backup.tar.gz>
//   node tools/backup-tools.mjs restore <backup.tar.gz> <target-data-dir> [--force]
// Needs only Node 24; no extra packages. "restore" refuses to write into a directory that already has
// data unless --force is given, and it always verifies the archive first.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, mkdtempSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';

export function readArchive(file) {
  const buffer = gunzipSync(readFileSync(file));
  const entries = new Map();
  for (let offset = 0; offset + 512 <= buffer.length;) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every(b => b === 0)) break;
    const name = header.toString('utf8', 0, 100).replace(/\0.*$/, '');
    const size = parseInt(header.toString('ascii', 124, 136).replace(/\0.*$/, ''), 8);
    const expected = header.reduce((a, b, i) => a + (i >= 148 && i < 156 ? 32 : b), 0);
    if (parseInt(header.toString('ascii', 148, 156), 8) !== expected) throw new Error(`Hibás tar fejléc: ${name}`);
    if (!Number.isFinite(size) || offset + 512 + size > buffer.length) throw new Error(`Csonka archívum: ${name}`);
    entries.set(name, buffer.subarray(offset + 512, offset + 512 + size));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return entries;
}

// Returns { manifest, problems }. An empty problems list means the archive is complete and intact.
export function verifyArchive(file) {
  const problems = [];
  let entries;
  try { entries = readArchive(file); } catch (error) { return { manifest: null, problems: [error.message] }; }
  const raw = entries.get('manifest.json');
  if (!raw) return { manifest: null, problems: ['Hiányzik a manifest.json: a mentés nem teljes.'] };
  const manifest = JSON.parse(raw.toString());
  if (manifest.format !== 'gaut-backup-v1') problems.push(`Ismeretlen mentésformátum: ${manifest.format}`);
  const listed = new Set();
  for (const f of manifest.files) {
    listed.add(f.name);
    const data = entries.get(f.name);
    if (!data) { problems.push(`Hiányzó fájl: ${f.name}`); continue; }
    if (data.length !== f.size) problems.push(`Hibás méret: ${f.name}`);
    else if (createHash('sha256').update(data).digest('hex') !== f.sha256) problems.push(`Hibás ellenőrzőösszeg: ${f.name}`);
  }
  for (const name of entries.keys()) if (name !== 'manifest.json' && !listed.has(name)) problems.push(`Nem szereplő fájl az archívumban: ${name}`);
  if (!entries.has('gaut.sqlite')) problems.push('Hiányzik az adatbázis (gaut.sqlite).');
  else {
    const dir = mkdtempSync(join(tmpdir(), 'gaut-verify-')), path = join(dir, 'gaut.sqlite');
    try {
      writeFileSync(path, entries.get('gaut.sqlite'));
      const db = new DatabaseSync(path);
      try { const result = db.prepare('PRAGMA integrity_check').get().integrity_check; if (result !== 'ok') problems.push(`Az adatbázis sérült: ${result}`); } finally { db.close(); }
    } catch (error) { problems.push(`Az adatbázis nem nyitható meg: ${error.message}`); } finally { rmSync(dir, { recursive: true, force: true }); }
  }
  return { manifest, problems, entries };
}

export function restoreArchive(file, target, { force = false } = {}) {
  const { manifest, problems, entries } = verifyArchive(file);
  if (problems.length) throw new Error(`A mentés hibás, nem állítható vissza:\n- ${problems.join('\n- ')}`);
  const dir = resolve(target);
  if (existsSync(dir) && readdirSync(dir).length && !force) throw new Error(`A célkönyvtár nem üres: ${dir}. Add meg a --force kapcsolót, ha biztosan felül akarod írni.`);
  mkdirSync(dir, { recursive: true });
  for (const stale of ['gaut.sqlite-wal', 'gaut.sqlite-shm']) rmSync(join(dir, stale), { force: true }); // a leftover WAL would be replayed onto the restored database
  for (const [name, data] of entries) {
    if (name === 'manifest.json') continue;
    if (name.includes('..') || name.startsWith('/') || !/^(gaut\.sqlite|(files|reference-photos|site-media)\/[A-Za-z0-9._-]+)$/.test(name)) throw new Error(`Gyanús fájlnév az archívumban: ${name}`);
    const path = join(dir, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, data, { mode: 0o600 });
  }
  return { manifest, files: manifest.files.length, dir };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command, file, target, flag] = process.argv.slice(2);
  try {
    if (command === 'verify' && file) {
      const { manifest, problems } = verifyArchive(file);
      if (problems.length) { console.error(`HIBÁS mentés:\n- ${problems.join('\n- ')}`); process.exitCode = 1; }
      else console.log(`Rendben. Létrehozva: ${manifest.created_at}, ${manifest.files.length} fájl, az adatbázis ép.`);
    } else if (command === 'restore' && file && target) {
      const result = restoreArchive(file, target, { force: flag === '--force' });
      console.log(`Visszaállítva ${result.files} fájl ide: ${result.dir}. Indítsd újra az alkalmazást.`);
    } else { console.error('Használat:\n  node tools/backup-tools.mjs verify <mentés.tar.gz>\n  node tools/backup-tools.mjs restore <mentés.tar.gz> <adatkönyvtár> [--force]'); process.exitCode = 2; }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
