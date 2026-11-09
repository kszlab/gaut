import { createReadStream, readdirSync, statSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createGzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

// Full backup of the workspace as a streamed .tar.gz:
//   gaut.sqlite          consistent snapshot of the database (VACUUM INTO, safe while the app is running)
//   files/               uploaded workspace files
//   reference-photos/    reference photos
//   site-media/          images of the public site
//   manifest.json        creation time, and size + SHA-256 of every file, so a restore can be verified
// Files in the three directories are written once under a random name and never modified, so copying them
// after the database snapshot is consistent: the snapshot can only reference files that already exist.
const DIRECTORIES = ['files', 'reference-photos', 'site-media'];

function octal(value, length) { return value.toString(8).padStart(length - 1, '0') + '\0'; }
function tarHeader(name, size, mtime) {
  if (Buffer.byteLength(name) > 100) throw new Error(`File name too long for the backup: ${name}`);
  const header = Buffer.alloc(512);
  header.write(name, 0, 'utf8');
  header.write(octal(0o644, 8), 100); header.write(octal(0, 8), 108); header.write(octal(0, 8), 116);
  header.write(octal(size, 12), 124); header.write(octal(Math.floor(mtime / 1000), 12), 136);
  header.write('        ', 148); // checksum placeholder: eight spaces
  header.write('0', 156); header.write('ustar\0', 257); header.write('00', 263);
  const sum = header.reduce((a, b) => a + b, 0);
  header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
  return header;
}
const padding = size => Buffer.alloc((512 - (size % 512)) % 512);

export function backupFileName(date = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `gaut-backup-${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}-${p(date.getUTCHours())}${p(date.getUTCMinutes())}.tar.gz`;
}

async function* chunks(db, dataDir, version) {
  const tmp = join(dataDir, `.backup-${randomUUID()}.sqlite`);
  const manifest = { format: 'gaut-backup-v1', created_at: new Date().toISOString(), app_version: version, files: [] };
  db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
  async function* entry(name, path) {
    const stat = statSync(path), hash = createHash('sha256');
    let bytes = 0;
    yield tarHeader(name, stat.size, stat.mtimeMs);
    for await (const chunk of createReadStream(path)) { hash.update(chunk); bytes += chunk.length; yield chunk; }
    if (bytes !== stat.size) throw new Error(`File changed while it was being backed up: ${name}`);
    yield padding(bytes);
    manifest.files.push({ name, size: bytes, sha256: hash.digest('hex') });
  }
  try {
    yield* entry('gaut.sqlite', tmp);
    for (const dir of DIRECTORIES) {
      const full = join(dataDir, dir);
      if (!existsSync(full)) continue;
      for (const name of readdirSync(full).sort()) { const path = join(full, name); if (statSync(path).isFile()) yield* entry(`${dir}/${name}`, path); }
    }
    const json = Buffer.from(JSON.stringify(manifest, null, 2));
    yield tarHeader('manifest.json', json.length, Date.now()); yield json; yield padding(json.length);
    yield Buffer.alloc(1024); // end-of-archive marker
  } finally { rmSync(tmp, { force: true }); }
}

// Streams the backup into `res` (an HTTP response or any writable stream).
export function streamBackup(db, dataDir, res, version = '') {
  return pipeline(Readable.from(chunks(db, dataDir, version)), createGzip({ level: 6 }), res);
}
