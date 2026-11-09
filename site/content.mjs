import { randomUUID } from 'node:crypto';

// Editable text of the public site. Only the paths listed here can be changed from the workspace;
// layout, navigation and interface strings stay in code. Values are plain text (never HTML).
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

const line = (path, group, label, max = 200) => ({ path, group, label, type: 'line', max });
const text = (path, group, label, max = 1200, hideable = false) => ({ path, group, label, type: 'text', max, ...(hideable ? { hideable: true } : {}) });

export const FIELDS = [
  line('hero.rendszer', 'Nyitóoldal', 'Főcím · 01 Rendszer', 120),
  line('hero.struktura', 'Nyitóoldal', 'Főcím · 02 Struktúra', 120),
  line('hero.szinkron', 'Nyitóoldal', 'Főcím · 03 Szinkron', 120),
  line('sub', 'Nyitóoldal', 'Alcím', 160),
  text('lead', 'Nyitóoldal', 'Bevezető szöveg', 500),
  line('cta', 'Nyitóoldal', 'Gomb: kapcsolat', 40),
  line('cta2', 'Nyitóoldal', 'Gomb: referenciák', 40),
  line('areasTitle', 'Szakterületek', 'Szekció címe', 120),
  ...[0, 1, 2].flatMap(i => [line(`areas.${i}.title`, 'Szakterületek', `${i + 1}. szakterület címe`, 100), text(`areas.${i}.text`, 'Szakterületek', `${i + 1}. szakterület leírása`, 600)]),
  line('sectorsLabel', 'Szakterületek', 'Területek felirata', 120),
  ...[0, 1, 2, 3, 4, 5].map(i => line(`sectors.${i}`, 'Szakterületek', `${i + 1}. terület`, 80)),
  line('approachTitle', 'Szemlélet', 'Szekció címe', 120),
  text('approachText', 'Szemlélet', 'Szemlélet leírása', 900),
  ...[0, 1, 2].flatMap(i => [line(`principles.${i}.title`, 'Szemlélet', `${i + 1}. alapelv címe`, 100), text(`principles.${i}.text`, 'Szemlélet', `${i + 1}. alapelv leírása`, 400)]),
  line('vendorsLabel', 'Szemlélet', 'Gyártók felirata', 160),
  line('refsTitle', 'Referenciák', 'Szekció címe', 120),
  text('refsNote', 'Referenciák', 'Megjegyzés a szekció alatt', 400, true),
  line('teamTitle', 'Csapat', 'Szekció címe', 120),
  text('teamNote', 'Csapat', 'Megjegyzés a szekció alatt', 400, true),
  line('contactTitle', 'Kapcsolat és lábléc', 'Szekció címe', 120),
  text('contactText', 'Kapcsolat és lábléc', 'Bevezető szöveg', 500),
  line('contact.address', 'Kapcsolat és lábléc', 'Cím', 200),
  line('contact.email', 'Kapcsolat és lábléc', 'E-mail', 120),
  line('contact.phone', 'Kapcsolat és lábléc', 'Telefon', 40),
  line('footer', 'Kapcsolat és lábléc', 'Lábléc szövege', 200)
];
const BY_PATH = new Map(FIELDS.map(f => [f.path, f]));
// Fields marked hideable may be saved empty on purpose: an empty override hides the text instead of using the default.
const MAY_BE_EMPTY = new Set(FIELDS.filter(f => f.hideable).map(f => f.path));

// Resolves a field path against the default text structure of one language.
function locate(root, path) {
  const parts = path.split('.');
  if ((parts[0] === 'areas' || parts[0] === 'principles') && parts.length === 3) {
    const entry = root[parts[0]]?.[Number(parts[1])];
    return entry ? { holder: entry, key: parts[2] === 'title' ? 0 : 1 } : null;
  }
  if (parts[0] === 'sectors' && parts.length === 2) return root.sectors && Number(parts[1]) < root.sectors.length ? { holder: root.sectors, key: Number(parts[1]) } : null;
  if (parts.length === 2) return root[parts[0]] ? { holder: root[parts[0]], key: parts[1] } : null;
  return parts.length === 1 ? { holder: root, key: parts[0] } : null;
}
export function getField(root, path) { const at = locate(root, path); return at ? at.holder[at.key] ?? '' : ''; }
export function setField(root, path, value) { const at = locate(root, path); if (at) at.holder[at.key] = value; }

export function defaultsFor(root) { return Object.fromEntries(FIELDS.map(f => [f.path, String(getField(root, f.path))])); }

export function applyContent(root, overrides = {}) {
  const copy = structuredClone(root);
  for (const [path, value] of Object.entries(overrides || {})) if (BY_PATH.has(path)) setField(copy, path, value);
  return copy;
}

// Validates and normalises overrides for both languages: {hu: {path: value}, en: {...}}.
export function cleanOverrides(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(400, 'Hibás tartalom.');
  const out = { hu: {}, en: {} };
  for (const lang of ['hu', 'en']) {
    const values = input[lang] ?? {};
    if (typeof values !== 'object' || Array.isArray(values)) fail(400, 'Hibás tartalom.');
    for (const [path, raw] of Object.entries(values)) {
      const field = BY_PATH.get(path);
      if (!field) fail(400, `Ismeretlen mező: ${path}`);
      if (typeof raw !== 'string') fail(400, 'A mezők szöveget tartalmazzanak.');
      const value = (field.type === 'line' ? raw.replace(/\s+/g, ' ') : raw.replace(/\r\n/g, '\n')).trim();
      if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) fail(400, 'Érvénytelen karakter a szövegben.');
      if (value.length > field.max) fail(400, `Túl hosszú szöveg: ${field.label} (legfeljebb ${field.max} karakter).`);
      if (path === 'contact.email' && value && !/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(value)) fail(400, 'Érvénytelen e-mail cím.');
      if (path === 'contact.phone' && value && !/^[0-9+()\-\s/.]{5,40}$/.test(value)) fail(400, 'Érvénytelen telefonszám.');
      if (value === '' && !MAY_BE_EMPTY.has(path)) continue; // empty means "use the default"
      out[lang][path] = value;
    }
  }
  return out;
}

export function contentStore(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS site_draft(id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL, revision INTEGER NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS site_versions(seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, payload TEXT NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL)`);
  const now = () => new Date().toISOString();
  const empty = () => ({ hu: {}, en: {} });
  let liveCache; // undefined = not loaded
  function draftRow() {
    let row = db.prepare('SELECT * FROM site_draft WHERE id=1').get();
    if (!row) { db.prepare('INSERT INTO site_draft VALUES(1,?,0,?)').run(JSON.stringify(empty()), now()); row = db.prepare('SELECT * FROM site_draft WHERE id=1').get(); }
    return row;
  }
  const draftView = row => ({ overrides: JSON.parse(row.payload), revision: row.revision, updated_at: row.updated_at });
  const meta = row => ({ id: row.id, created_at: row.created_at, note: row.note, changes: ['hu', 'en'].reduce((n, l) => n + Object.keys(JSON.parse(row.payload)[l] || {}).length, 0) });
  const store = {
    draft: () => draftView(draftRow()),
    saveDraft(revision, overrides) {
      const row = draftRow();
      if (revision !== row.revision) fail(409, 'Közben valaki más módosította a vázlatot. Töltsd újra az oldalt; a mentés nem írta felül a változást.');
      const clean = cleanOverrides(overrides);
      db.prepare('UPDATE site_draft SET payload=?, revision=revision+1, updated_at=? WHERE id=1').run(JSON.stringify(clean), now());
      return draftView(draftRow());
    },
    publish(revision, note = '') {
      const row = draftRow();
      if (revision !== row.revision) fail(409, 'A vázlat közben megváltozott. Töltsd újra az oldalt, nézd át, és közzétételkor az aktuális vázlat kerül ki.');
      if (typeof note !== 'string' || note.length > 200) fail(400, 'A megjegyzés legfeljebb 200 karakter lehet.');
      const id = randomUUID();
      db.prepare('INSERT INTO site_versions(id,payload,note,created_at) VALUES(?,?,?,?)').run(id, row.payload, note.trim(), now());
      liveCache = undefined;
      return meta(db.prepare('SELECT * FROM site_versions WHERE id=?').get(id));
    },
    live() {
      if (liveCache === undefined) {
        const row = db.prepare('SELECT * FROM site_versions ORDER BY seq DESC LIMIT 1').get();
        liveCache = row ? { ...meta(row), overrides: JSON.parse(row.payload) } : null;
      }
      return liveCache;
    },
    versions: () => db.prepare('SELECT * FROM site_versions ORDER BY seq DESC LIMIT 50').all().map(meta),
    restore(versionId, revision) {
      const version = db.prepare('SELECT * FROM site_versions WHERE id=?').get(versionId);
      if (!version) fail(404, 'A verzió nem található.');
      const row = draftRow();
      if (revision !== row.revision) fail(409, 'Közben valaki más módosította a vázlatot. Töltsd újra az oldalt.');
      db.prepare('UPDATE site_draft SET payload=?, revision=revision+1, updated_at=? WHERE id=1').run(version.payload, now());
      return draftView(draftRow());
    }
  };
  return store;
}
