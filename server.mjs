import http from 'node:http';
import { referenceStore } from './references.mjs';
import { renderSite, parseTheme, defaultText, toPublicReference, publicReferences } from './site/site.mjs';
import { websiteWarnings } from './public/site-readiness.js';
import { contentStore, defaultsFor, FIELDS, HERO_SLOTS } from './site/content.mjs';
import { mediaStore } from './site/media.mjs';
import { photoStore } from './photos.mjs';
import { streamBackup, backupFileName } from './backup.mjs';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, createReadStream } from 'node:fs';
import { join, resolve, dirname, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes, randomUUID, createHash, scryptSync, timingSafeEqual } from 'node:crypto';


const ROOT = dirname(fileURLToPath(import.meta.url));
// Public pages of the site: the home page and the "Tervezési fázisok" subpage, in both languages.
const SITE_PAGES = { '/': { lang: 'hu', page: 'home' }, '/hu': { lang: 'hu', page: 'home' }, '/en': { lang: 'en', page: 'home' }, '/tervezesi-fazisok': { lang: 'hu', page: 'phases' }, '/en/design-phases': { lang: 'en', page: 'phases' }, '/referenciak': { lang: 'hu', page: 'references' }, '/en/references': { lang: 'en', page: 'references' }, '/impresszum': { lang: 'hu', page: 'imprint' }, '/en/imprint': { lang: 'en', page: 'imprint' }, '/adatkezeles': { lang: 'hu', page: 'privacy' }, '/en/privacy': { lang: 'en', page: 'privacy' } };
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

export function makeServer({ dataDir = resolve(process.env.DATA_DIR || 'data'), secureCookies = process.env.COOKIE_SECURE === 'true', password = process.env.GAUT_PASSWORD, backupToken = process.env.GAUT_BACKUP_TOKEN } = {}) {
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
  const siteContent = contentStore(db);
  const siteMedia = mediaStore(db, dataDir);
  const resolveMedia = (map = {}) => Object.fromEntries(Object.entries(map).map(([slot, id]) => [slot, siteMedia.get(id)]).filter(([, m]) => m));
  const isPublishedMedia = id => { const live = siteContent.live()?.overrides; return Object.values(live?.media ?? {}).includes(id) || Boolean(live?.references?.some(r => r.cover === id)); };
  // References that a publication would put on the site, with advisory warnings (never blocking).
  const referenceOverview = () => references.list().filter(r => toPublicReference(r)).map(r => ({ id: r.id, name: r.website_title_hu || r.name, featured: r.website_featured === true, warnings: websiteWarnings(r) }));
  // The cover photo of a reference is copied into the site image store (resized WebP, no metadata) when it is chosen, never taken from the client.
  async function prepareCover(id, data) {
    const old = id ? references.get(id) : null;
    const want = typeof data.website_cover_photo === 'string' ? data.website_cover_photo : '';
    data.website_cover_media = '';
    if (!want) { data.website_cover_photo = ''; return; }
    if (!old) fail(400, 'Új referenciához előbb mentsd el a referenciát, utána választhatsz borítóképet.');
    if (want === old.website_cover_photo && old.website_cover_media) { data.website_cover_media = old.website_cover_media; return; }
    const photo = photos.file(want);
    if (photo.reference_id !== id || photo.deleted_at) fail(400, 'A borítókép ehhez a referenciához tartozó, nem törölt kép legyen.');
    const media = await siteMedia.add({ filename: photo.filename, bytes: readFileSync(photo.path), alt_hu: old.name.slice(0, 190), alt_en: '' });
    data.website_cover_media = media.id;
  }
  // What a visitor sees: the published version, or the saved draft (with the current reference store) for a signed-in preview.
  // References: the live version shows the list frozen at publication; without any publishable reference the sample projects stay.
  function siteView(draft) {
    const shown = draft ? siteContent.draft().overrides : siteContent.live()?.overrides ?? null;
    const media = resolveMedia(shown?.media);
    const team = shown?.team?.map(m => ({ ...m, sample: false, photoMedia: media[`team.${m.id}`] }));
    const currentById = new Map(references.list().map(r => [r.id, r]));
    const frozen = draft ? publicReferences(references.list()) : (siteContent.live()?.overrides.references || []).map(r => { const current = currentById.get(r.id); return { ...r, categoryId: current?.category_id || '', category: current?.category ?? r.category }; }); // the category follows the current record, so re-categorising needs no new publication
    const refs = frozen?.length ? frozen.map(r => ({ ...r, coverMedia: r.cover ? siteMedia.get(r.cover) ?? undefined : undefined })) : undefined;
    return { content: shown, media, team, references: refs, hasLive: Boolean(siteContent.live()) };
  }
  const siteState = () => {
    const live = siteContent.live();
    return { fields: FIELDS, slots: HERO_SLOTS.map(([slot, label, fallback]) => ({ slot, label, fallback })), defaults: { hu: defaultsFor(defaultText('hu')), en: defaultsFor(defaultText('en')) }, draft: siteContent.draft(), live: live && { id: live.id, created_at: live.created_at, note: live.note, changes: live.changes }, versions: siteContent.versions(), media: siteMedia.list(), references: referenceOverview() };
  };
  const photos = photoStore(db, dataDir);
  const attempts = new Map();
  const contactAttempts = new Map();
  // An optional long random token lets an unattended job (e.g. a nightly task on the owner's PC) download the backup without the shared password.
  if (backupToken && backupToken.length < 32) { console.error('GAUT_BACKUP_TOKEN is shorter than 32 characters and is ignored.'); backupToken = undefined; }
  const tokenHash = backupToken ? hash(backupToken) : null;
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
      if (path === '/api/health' && req.method === 'GET') return json(res, 200, { ok: true, version: '1.5.1' });
      if (path === '/api/public/team-contact' && req.method === 'POST') {
        const ip = String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim().slice(0, 100);
        const timestamp = Date.now(), windowMs = 10 * 60 * 1000;
        for (const [key, value] of contactAttempts) if (value.until <= timestamp) contactAttempts.delete(key);
        const attempt = contactAttempts.get(ip) || { count: 0, until: timestamp + windowMs };
        if (attempt.count >= 12) { contactAttempts.set(ip, attempt); res.setHeader('Retry-After', String(Math.ceil((attempt.until - timestamp) / 1000))); return json(res, 429, { error: 'Túl sok lekérés. Próbáld újra néhány perc múlva.' }); }
        attempt.count++; contactAttempts.set(ip, attempt);
        const request = await body(req, 4096);
        if (typeof request.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(request.id)) fail(400, 'Érvénytelen tervezőazonosító.');
        const publishedTeam = siteContent.live()?.overrides?.team || [];
        const member = publishedTeam.find(person => person.id === request.id);
        if (!member || (!member.email && !member.phone)) fail(404, 'Ehhez a tervezőhöz nincs közzétett elérhetőség.');
        return json(res, 200, { ...(member.email ? { email: member.email } : {}), ...(member.phone ? { phone: member.phone } : {}) });
      }
      if (path === '/api/backup' && req.method === 'GET') {
        let allowed = Boolean(session(req));
        const bearer = /^Bearer\s+(\S{1,512})$/.exec(req.headers.authorization || '')?.[1];
        if (!allowed && bearer) {
          const key = `backup:${req.socket.remoteAddress}`, timestamp = Date.now();
          for (const [k, val] of attempts) if (val.until < timestamp) attempts.delete(k);
          const entry = attempts.get(key) || { count: 0, until: timestamp + 15 * 60 * 1000 };
          if (entry.count >= 10) fail(429, 'Túl sok próbálkozás. Próbáld újra 15 perc múlva.');
          if (tokenHash && timingSafeEqual(Buffer.from(hash(bearer)), Buffer.from(tokenHash))) { allowed = true; attempts.delete(key); } else { entry.count++; attempts.set(key, entry); }
        }
        if (!allowed) fail(401, 'A mentés letöltéséhez jelentkezz be.');
        res.writeHead(200, { 'Content-Type': 'application/gzip', 'Content-Disposition': `attachment; filename="${backupFileName()}"`, 'Cache-Control': 'no-store' });
        await streamBackup(db, dataDir, res, '1.5.1');
        return;
      }
      if (path.startsWith('/api/')) {
        const user = session(req); if (!user) fail(401, 'A folytatáshoz jelentkezz be.');
        if (path === '/api/reference-photos/import' && req.method === 'POST') return json(res,200,photos.import(await body(req)));
        if (path === '/api/reference-categories' && req.method === 'GET') return json(res, 200, { categories: references.categories() });
        if (path === '/api/reference-categories' && req.method === 'POST') return json(res, 201, { categories: references.createCategory(await body(req, 8192)) });
        const categoryMatch = /^\/api\/reference-categories\/([a-zA-Z0-9_-]{1,100})$/.exec(path);
        if (categoryMatch && req.method === 'PUT') return json(res, 200, { categories: references.updateCategory(categoryMatch[1], await body(req, 8192)) });
        if (categoryMatch && req.method === 'DELETE') fail(405, 'Kategória nem törölhető, csak átnevezhető.');
        if (path === '/api/references/category-assignments' && req.method === 'POST') { const b = await body(req, 512*1024); return json(res, 200, references.assignCategories(b.assignments, b.overwrite === true)); }
        if (path === '/api/references' && req.method === 'GET') return json(res, 200, { references: references.list().map(r=>{const active=photos.list(r.id).filter(p=>!p.deleted_at);return {...r,photo_count:active.length,photo_cover_id:active[0]?.id||null,photo_research:photos.research(r.id)};}) });
        if (path === '/api/references' && req.method === 'POST') { const data = await body(req, 1024*1024); await prepareCover(null, data); return json(res, 201, { reference: references.create(data) }); }
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
        if (path === '/api/references/website-titles' && req.method === 'POST') return json(res, 200, references.fillWebsiteTitles((await body(req, 512*1024)).titles));
        if (path === '/api/references/import' && req.method === 'POST') return json(res, 200, references.import(await body(req, 5*1024*1024)));
        if(path==='/api/references/merge'&&req.method==='POST')return json(res,200,references.merge(await body(req,1024*1024)));
        if(path==='/api/reference-merges'&&req.method==='GET')return json(res,200,{merges:references.merges().map(m=>({id:m.id,name:m.records[0].name,created_at:m.created_at,undone_at:m.undone_at,records:m.records.map(r=>({id:r.id,name:r.name}))}))});
        const undoMerge=/^\/api\/reference-merges\/([a-f0-9-]{36})\/undo$/.exec(path);
        if(undoMerge&&req.method==='POST')return json(res,200,references.undoMerge(undoMerge[1]));
        const referenceRestore = /^\/api\/references\/([a-zA-Z0-9_-]{1,100})\/restore$/.exec(path);
        if(referenceRestore && req.method==='POST') {const data=await body(req,1024);return json(res,200,{reference:references.trash(referenceRestore[1],data.revision,true)});}
        const referenceMatch = /^\/api\/references\/([a-zA-Z0-9_-]{1,100})$/.exec(path);
        if(referenceMatch && req.method==='DELETE') {const data=await body(req,1024);return json(res,200,{reference:references.trash(referenceMatch[1],data.revision)});}
        if (referenceMatch && req.method === 'PUT') { const data = await body(req, 1024*1024); await prepareCover(referenceMatch[1], data); return json(res, 200, { reference: references.update(referenceMatch[1], data) }); }
        if (path === '/api/site/content' && req.method === 'GET') return json(res, 200, siteState());
        if (path === '/api/site/content' && req.method === 'PUT') { const b = await body(req, 512 * 1024); siteContent.saveDraft(b.revision, b.overrides); return json(res, 200, siteState()); }
        if (path === '/api/site/publish' && req.method === 'POST') { const b = await body(req, 4096); const list = publicReferences(references.list()); siteContent.publish(b.revision, b.note ?? '', list.length ? { references: list } : {}); return json(res, 200, siteState()); }
        if (path === '/api/site/media' && req.method === 'POST') {
          const b = await body(req);
          const f = fileData({ filename: b.filename, content: b.content }); // same size and base64 checks as workspace uploads
          return json(res, 201, { media: await siteMedia.add({ filename: f.filename, bytes: f.bytes, alt_hu: b.alt_hu, alt_en: b.alt_en }) });
        }
        const siteMediaAlt = /^\/api\/site\/media\/([a-f0-9-]{36})$/.exec(path);
        if (siteMediaAlt && req.method === 'PATCH') { const b = await body(req, 4096); return json(res, 200, { media: siteMedia.setAlt(siteMediaAlt[1], b.alt_hu, b.alt_en) }); }
        const siteRestore = /^\/api\/site\/versions\/([a-f0-9-]{36})\/restore$/.exec(path);
        if (siteRestore && req.method === 'POST') { const b = await body(req, 4096); siteContent.restore(siteRestore[1], b.revision); return json(res, 200, siteState()); }
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
      // Public site preview. Pages are rendered from sample data; nothing here reads the private stores.
      const siteAssets = { '/site/site.css': ['site/site.css', 'text/css'], '/site/site.js': ['site/site.js', 'text/javascript'], '/site/mosaic.js': ['site/mosaic.js', 'text/javascript'] };
      // The workspace lives under /munkater; the root is the public site. Old workspace page addresses keep working through redirects.
      const moved = { '/honlap': '/munkater/honlap', '/munkater/': '/munkater', '/munkater/referenciak/': '/munkater/referenciak', '/munkater/honlap/': '/munkater/honlap' };
      if (['GET', 'HEAD'].includes(req.method) && moved[path]) { res.writeHead(302, { Location: moved[path] + url.search }); return res.end(); }
      const sitePage = SITE_PAGES[path];
      if (['GET', 'HEAD'].includes(req.method) && sitePage) {
        // ?elonezet=1 shows the unpublished draft, but only to a signed-in workspace user; everyone else gets the live version.
        const draft = url.searchParams.get('elonezet') === '1' && Boolean(session(req));
        const view = siteView(draft);
        const html = renderSite({ lang: sitePage.lang, page: sitePage.page, category: url.searchParams.get('kategoria') || '', categories: references.categories(), theme: parseTheme(url.searchParams.get('tema')), content: view.content, draft, fragment: sitePage.page !== 'home' && sitePage.page !== 'phases' && url.searchParams.get('reszlet') === '1', media: view.media, ...(view.team ? { team: view.team } : {}), ...(view.references ? { references: view.references } : {}) });
        if (html === null) fail(404, 'Nincs ilyen oldal.'); // a legal text that has not been written yet
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.end(req.method === 'HEAD' ? undefined : html);
      }
      if (siteAssets[path] && ['GET', 'HEAD'].includes(req.method)) {
        const [name, type] = siteAssets[path];
        res.setHeader('Cache-Control', 'no-cache'); // preview phase: always revalidate; switch to a fingerprinted long cache before launch
        res.setHeader('Content-Type', `${type}; charset=utf-8`);
        return res.end(req.method === 'HEAD' ? undefined : readFileSync(join(ROOT, 'public', name)));
      }
      // Uploaded site images: public only once a published version uses them; a signed-in user can also see unpublished ones (draft preview, editor).
      const uploaded = /^\/media\/([a-f0-9-]{36})\/(\d{3,4})\.webp$/.exec(path);
      if (uploaded && ['GET', 'HEAD'].includes(req.method)) {
        const [, id, width] = uploaded, published = isPublishedMedia(id);
        const file = (published || session(req)) ? siteMedia.file(id, Number(width)) : null;
        if (!file) fail(404, 'A kép nem található.');
        res.setHeader('Cache-Control', published ? 'public, max-age=31536000, immutable' : 'private, no-cache');
        res.setHeader('Content-Type', 'image/webp');
        return res.end(req.method === 'HEAD' ? undefined : readFileSync(file));
      }
      const mediaMatch = /^\/site\/(img|fonts)\/([a-z0-9-]+)\.(png|jpg|webp|woff2)$/.exec(path);
      if (mediaMatch && ['GET', 'HEAD'].includes(req.method)) {
        const types = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', woff2: 'font/woff2' };
        const file = join(ROOT, 'public', 'site', mediaMatch[1], `${mediaMatch[2]}.${mediaMatch[3]}`);
        if (!existsSync(file)) fail(404, 'Az oldal nem található.');
        res.setHeader('Cache-Control', mediaMatch[1] === 'fonts' ? 'public, max-age=86400' : 'no-cache');
        res.setHeader('Content-Type', types[mediaMatch[3]]);
        return res.end(req.method === 'HEAD' ? undefined : readFileSync(file));
      }
      const assets = { '/munkater/kategoriak': ['category-manager.html', 'text/html'], '/category-manager.js': ['category-manager.js', 'text/javascript'], '/category-manager.css': ['category-manager.css', 'text/css'], '/munkater/honlap': ['site-editor.html', 'text/html'], '/munkater/referenciak': ['references.html', 'text/html'], '/munkater': ['index.html', 'text/html'], '/site-editor.js': ['site-editor.js', 'text/javascript'], '/site-editor.css': ['site-editor.css', 'text/css'], '/site-readiness.js': ['site-readiness.js', 'text/javascript'], '/reference-search.js': ['reference-search.js', 'text/javascript'], '/reference-photos.js': ['reference-photos.js', 'text/javascript'], '/references.js': ['references.js', 'text/javascript'], '/references.css': ['references.css', 'text/css'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'], '/favicon.svg': ['favicon.svg', 'image/svg+xml'] };
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
