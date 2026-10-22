import http from 'node:http';
import { referenceStore } from './references.mjs';
import { photoStore } from './photos.mjs';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, createReadStream } from 'node:fs';
import { join, resolve, dirname, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes, randomUUID, createHash, scryptSync, timingSafeEqual } from 'node:crypto';


const ROOT = dirname(fileURLToPath(import.meta.url));
const SECTIONS = { common: 'Közös', misi: 'Misi', nandi: 'Nándi', attila: 'Attila', krisztian: 'Krisztián' };
const CATEGORIES = ['Referencia', 'Fénykép', 'Leírás', 'Cégbemutatás', 'Arculat', 'Egyéb'];
const MAX_FILE = 20 * 1024 * 1024;
const ALLOWED = new Set('.xlsx .xls .csv .docx .doc .pdf .jpg .jpeg .png .webp .gif .heic .txt .pptx .ppt .zip .dwg .dxf'.split(' '));
const hash = text => createHash('sha256').update(text).digest('hex');
const now = () => new Date().toISOString();
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const textField = (value, max, required = false) => {
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) fail(400, 'Hiányzó vagy túl hosszú adat.');
  return value.trim();
};

export function makeServer({ dataDir = resolve(process.env.DATA_DIR || 'data'), secureCookies = process.env.COOKIE_SECURE === 'true', password = process.env.GAUT_PASSWORD } = {}) {
  mkdirSync(join(dataDir, 'files'), { recursive: true });
  if (typeof password !== 'string' || password.length < 12 || password.length > 1024) throw new Error('Állítsd be a GAUT_PASSWORD változót egy legalább 12, legfeljebb 1024 karakteres közös jelszóra.');
  const passwordSalt = 'gaut-shared-access-v1';
  const passwordHash = scryptSync(password, passwordSalt, 64);
  const accessId = hash(passwordHash);
  const user = { id: 'shared', name: 'Közös belépés' };
  const db = new DatabaseSync(join(dataDir, 'gaut.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, title TEXT NOT NULL, section TEXT NOT NULL,
      category TEXT NOT NULL, project TEXT NOT NULL, note TEXT NOT NULL, author TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT);
    CREATE TABLE IF NOT EXISTS versions (id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES items(id),
      number INTEGER NOT NULL, filename TEXT NOT NULL, size INTEGER NOT NULL, author TEXT NOT NULL,
      created_at TEXT NOT NULL, UNIQUE(item_id, number));
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS versions_item ON versions(item_id, number);
  `);
  const references = referenceStore(db);
  const photos = photoStore(db, dataDir);
  const attempts = new Map();
  const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
  const cleanUser = user => ({ id: user.id, name: user.name });
  function session(req) {
    const token = /(?:^|;\s*)gaut_session=([a-zA-Z0-9_-]+)/.exec(req.headers.cookie || '')?.[1];
    if (!token) return null;
    const row = db.prepare('SELECT user_id FROM sessions WHERE token=? AND expires>?').get(hash(token), Date.now());
    return row?.user_id === accessId ? user : null;
  }
  async function body(req, max = 30 * 1024 * 1024) {
    if (!(req.headers['content-type'] || '').startsWith('application/json')) fail(415, 'JSON kérés szükséges.');
    let length = 0; const chunks = [];
    for await (const chunk of req) { length += chunk.length; if (length > max) fail(413, 'Túl nagy feltöltés. A határ fájlonként 20 MB.'); chunks.push(chunk); }
    try { const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail(400, 'Hibás kérés.'); return parsed; } catch { fail(400, 'Hibás kérés.'); }
  }
  function metadata(b) {
    if (!SECTIONS[b.section] || !CATEGORIES.includes(b.category)) fail(400, 'Érvénytelen gyűjtőrész vagy kategória.');
    return [textField(b.title, 160, true), b.section, b.category, textField(b.project || '', 160), textField(b.note || '', 4000)];
  }
  function fileData(b) {
    const filename = textField(b.filename, 240, true).replace(/[\\/\x00-\x1f\x7f]/g, '_');
    if (!ALLOWED.has(extname(filename).toLowerCase())) fail(400, 'Ez a fájltípus nem támogatott.');
    if (typeof b.content !== 'string' || b.content.length > Math.ceil(MAX_FILE / 3) * 4 || b.content.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(b.content)) fail(400, 'Érvénytelen fájltartalom.');
    const bytes = Buffer.from(b.content, 'base64');
    if (!bytes.length) fail(400, 'Üres fájl nem tölthető fel.');
    if (bytes.length > MAX_FILE) fail(413, 'A fájl legfeljebb 20 MB lehet.');
    return { filename, bytes };
  }
  function item(id) { const row = db.prepare('SELECT * FROM items WHERE id=?').get(id); if (!row) fail(404, 'Az anyag nem található.'); return row; }
  function versions(id) { return db.prepare('SELECT * FROM versions WHERE item_id=? ORDER BY number DESC').all(id); }
  const insertVersion = db.prepare('INSERT INTO versions (id,item_id,number,filename,size,author,created_at) VALUES (?,?,?,?,?,?,?)');
  function saveVersion(id, file, author, insertItem) {
    const vid = randomUUID(), created = now(), path = join(dataDir, 'files', vid);
    writeFileSync(path, file.bytes, { flag: 'wx', mode: 0o600 });
    try {
      db.exec('BEGIN IMMEDIATE');
      if (insertItem) insertItem(created);
      const num = db.prepare('SELECT COALESCE(MAX(number),0)+1 AS n FROM versions WHERE item_id=?').get(id).n;
      insertVersion.run(vid, id, num, file.filename, file.bytes.length, author, created);
      db.prepare('UPDATE items SET updated_at=? WHERE id=?').run(created, id);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); unlinkSync(path); throw error; }
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    try {
      const url = new URL(req.url, 'http://localhost'); const path = url.pathname;
      if (!['GET', 'HEAD'].includes(req.method)) {
        if (req.headers['x-gaut-request'] !== '1') fail(403, 'Érvénytelen kérés.');
        if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) fail(403, 'Idegen eredetű kérés.');
      }
      if (path === '/api/login' && req.method === 'POST') {
        const ip = req.socket.remoteAddress;
        const timestamp = Date.now();
        for (const [key, val] of attempts) if (val.until < timestamp) attempts.delete(key);
        const entry = attempts.get(ip) || { count: 0, until: timestamp + 15 * 60 * 1000 };
        if (entry.count >= 10) fail(429, 'Túl sok próbálkozás. Próbáld újra 15 perc múlva.');
        entry.count++; attempts.set(ip, entry);
        const b = await body(req, 4096);
        const input = typeof b.password === 'string' && b.password.length <= 1024 ? b.password : '';
        const candidate = scryptSync(input, passwordSalt, 64);
        if (!timingSafeEqual(candidate, passwordHash)) fail(401, 'Hibás jelszó.');
        attempts.delete(ip);
        const token = randomBytes(32).toString('base64url');
        db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
        db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(hash(token), accessId, Date.now() + 7 * 86400000);
        res.setHeader('Set-Cookie', `gaut_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${secureCookies ? '; Secure' : ''}`);
        return json(res, 200, { user: cleanUser(user) });
      }
      if (path === '/api/health' && req.method === 'GET') return json(res, 200, { ok: true, version: '1.4.0' });
      if (path.startsWith('/api/')) {
        const user = session(req); if (!user) fail(401, 'A folytatáshoz jelentkezz be.');
        if (path === '/api/reference-photos/import' && req.method === 'POST') return json(res,200,photos.import(await body(req)));
        if (path === '/api/references' && req.method === 'GET') return json(res, 200, { references: references.list().map(r=>{const active=photos.list(r.id).filter(p=>!p.deleted_at);return {...r,photo_count:active.length,photo_cover_id:active[0]?.id||null,photo_research:photos.research(r.id)};}) });
        if (path === '/api/references' && req.method === 'POST') return json(res, 201, { reference: references.create(await body(req, 1024*1024)) });
        if (path === '/api/references/export' && req.method === 'GET') return json(res, 200, {...references.bundle(),photos:photos.all(),photo_export_note:'A JSON a képek metaadatait tartalmazza. A képfájlok külön tölthetők le az adatlapokról; teljes mentéshez a DATA_DIR könyvtár is szükséges.'});
        const photoUpload = /^\/api\/references\/([a-zA-Z0-9_-]{1,100})\/photos$/.exec(path);
        if (photoUpload && req.method === 'GET') return json(res, 200, {photos:photos.list(photoUpload[1])});
        if (photoUpload && req.method === 'POST') return json(res, 201, {photo:photos.add(photoUpload[1],await body(req))});
        const photoAction = /^\/api\/reference-photos\/([a-f0-9-]{36})(?:\/(trash|restore))?$/.exec(path);
        if (photoAction) {
          const [,id,action]=photoAction;
          if (!action && req.method==='PATCH') return json(res,200,{photo:photos.update(id,await body(req,16384))});
          if (action && req.method==='POST') return json(res,200,{photo:photos.trash(id,action==='restore')});
          if (!action && req.method==='GET') { const p=photos.file(id);res.setHeader('Content-Type',p.mime);res.setHeader('Content-Disposition',`inline; filename="photo.${p.mime.split('/')[1]}"`);return createReadStream(p.path).pipe(res); }
        }
        if (path === '/api/references/import' && req.method === 'POST') return json(res, 200, references.import(await body(req, 5*1024*1024)));
        const referenceRestore = /^\/api\/references\/([a-zA-Z0-9_-]{1,100})\/restore$/.exec(path);
        if(referenceRestore && req.method==='POST') {const data=await body(req,1024);return json(res,200,{reference:references.trash(referenceRestore[1],data.revision,true)});}
        const referenceMatch = /^\/api\/references\/([a-zA-Z0-9_-]{1,100})$/.exec(path);
        if(referenceMatch && req.method==='DELETE') {const data=await body(req,1024);return json(res,200,{reference:references.trash(referenceMatch[1],data.revision)});}
        if (referenceMatch && req.method === 'PUT') return json(res, 200, { reference: references.update(referenceMatch[1], await body(req, 1024*1024)) });
        if (path === '/api/me' && req.method === 'GET') return json(res, 200, { user: cleanUser(user), sections: SECTIONS, categories: CATEGORIES, maxFileSize: MAX_FILE });
        if (path === '/api/logout' && req.method === 'POST') {
          const token = /(?:^|;\s*)gaut_session=([a-zA-Z0-9_-]+)/.exec(req.headers.cookie || '')?.[1];
          if (token) db.prepare('DELETE FROM sessions WHERE token=?').run(hash(token));
          res.setHeader('Set-Cookie', 'gaut_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
          return json(res, 200, { ok: true });
        }
        if (path === '/api/items' && req.method === 'GET') {
          const rows = db.prepare(`SELECT i.*, v.filename, v.size, v.number, v.id AS version_id,
            (SELECT count(*) FROM versions WHERE item_id=i.id) AS version_count
            FROM items i JOIN versions v ON v.item_id=i.id AND v.number=(SELECT MAX(number) FROM versions WHERE item_id=i.id)
            ORDER BY i.updated_at DESC`).all();
          return json(res, 200, { items: rows });
        }
        if (path === '/api/items' && req.method === 'POST') {
          const b = await body(req), meta = metadata(b), file = fileData(b), id = randomUUID();
          saveVersion(id, file, user.name, created => db.prepare('INSERT INTO items VALUES (?,?,?,?,?,?,?,?,?,NULL)').run(id, ...meta, user.name, created, created));
          return json(res, 201, { item: item(id), versions: versions(id) });
        }
        const match = /^\/api\/items\/([a-f0-9-]{36})(?:\/(versions|trash|restore))?$/.exec(path);
        if (match) {
          const [, id, action] = match, row = item(id);
          if (!action && req.method === 'GET') return json(res, 200, { item: row, versions: versions(id) });
          if (!action && req.method === 'PATCH') {
            if (row.deleted_at) fail(409, 'Előbb állítsd vissza az anyagot a kukából.');
            const meta = metadata(await body(req, 16384));
            db.prepare('UPDATE items SET title=?,section=?,category=?,project=?,note=?,updated_at=? WHERE id=?').run(...meta, now(), id);
            return json(res, 200, { item: item(id) });
          }
          if (action === 'versions' && req.method === 'POST') {
            if (row.deleted_at) fail(409, 'Előbb állítsd vissza az anyagot a kukából.');
            saveVersion(id, fileData(await body(req)), user.name);
            return json(res, 201, { versions: versions(id) });
          }
          if (['trash', 'restore'].includes(action) && req.method === 'POST') {
            db.prepare('UPDATE items SET deleted_at=?,updated_at=? WHERE id=?').run(action === 'trash' ? now() : null, now(), id);
            return json(res, 200, { item: item(id) });
          }
        }
        const download = /^\/api\/files\/([a-f0-9-]{36})$/.exec(path);
        if (download && req.method === 'GET') {
          const v = db.prepare('SELECT * FROM versions WHERE id=?').get(download[1]);
          if (!v) fail(404, 'A fájl nem található.');
          const file = join(dataDir, 'files', v.id); if (!existsSync(file)) fail(404, 'A fájl hiányzik a tárhelyről.');
          res.setHeader('Content-Type', 'application/octet-stream');
          res.setHeader('Content-Disposition', `attachment; filename="download${extname(v.filename).replace(/[^.a-zA-Z0-9]/g, '')}"; filename*=UTF-8''${encodeURIComponent(v.filename).replace(/'/g, '%27')}`);
          res.setHeader('Content-Length', v.size);
          return createReadStream(file).pipe(res);
        }
        fail(404, 'Ismeretlen művelet.');
      }
      const assets = { '/reference-photos.js': ['reference-photos.js', 'text/javascript'], '/referenciak': ['references.html', 'text/html'], '/references.js': ['references.js', 'text/javascript'], '/references.css': ['references.css', 'text/css'], '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'], '/favicon.svg': ['favicon.svg', 'image/svg+xml'] };
      if (!assets[path] || !['GET', 'HEAD'].includes(req.method)) fail(404, 'Az oldal nem található.');
      const [name, type] = assets[path];
      res.setHeader('Content-Type', `${type}; charset=utf-8`);
      return res.end(req.method === 'HEAD' ? undefined : readFileSync(join(ROOT, 'public', name)));
    } catch (error) {
      if (!error.status) console.error(error);
      if (!res.headersSent) json(res, error.status || 500, { error: error.status ? error.message : 'Szerverhiba történt. Próbáld újra.' });
      else res.end();
    }
  });
  server.requestTimeout = 120000;
  server.on('close', () => db.close());
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const server = makeServer();
    const port = Number(process.env.PORT || 3000), host = process.env.HOST || '127.0.0.1';
    server.listen(port, host, () => console.log(`GAUT anyaggyűjtő: http://${host}:${port}`));
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
