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

// Image slots: a slot holds the id of an uploaded image. Hero slots exist per identity draft; team slots (team.<member id>) follow with the team editor.
export const HERO_SLOTS = [['hero.rendszer', 'Nyitókép · 01 Rendszer', '/site/img/hero-1.webp'], ['hero.struktura', 'Nyitókép · 02 Struktúra', '/site/img/hero-2.webp'], ['hero.szinkron', 'Nyitókép · 03 Szinkron', '/site/img/hero-3.webp']];
export const isSlot = slot => HERO_SLOTS.some(([s]) => s === slot) || /^team\.[a-z0-9-]{1,40}$/.test(slot);
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

// Team list: absent = the placeholder team of the preview; [] = the team section is hidden; otherwise the list shown on the site.
export const TEAM_MAX = 12;
const oneLine = (value, max, label, required = false) => {
  if (typeof value !== 'string') fail(400, `A(z) ${label} szöveg legyen.`);
  const v = value.replace(/\s+/g, ' ').trim();
  if (/[\u0000-\u001f\u007f]/.test(v) || v.length > max) fail(400, `Érvénytelen vagy túl hosszú: ${label} (legfeljebb ${max} karakter).`);
  if (required && !v) fail(400, `Hiányzik: ${label}.`);
  return v;
};
// A team member can link to the public register of the Hungarian Chamber of Engineers. Only https links to the
// chamber's own sites are accepted, so the public page never links to arbitrary addresses.
const CHAMBER_HOSTS = ['mernokvagyok.hu', 'mmk.hu'];
export const isChamberUrl = value => {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && CHAMBER_HOSTS.some(h => u.hostname === h || u.hostname.endsWith(`.${h}`)); } catch { return false; }
};
function chamberUrl(value, i) {
  const v = oneLine(value, 300, `${i + 1}. tag kamarai linkje`);
  if (v && !isChamberUrl(v)) fail(400, `A kamarai link https:// címmel kezdődjön, és a ${CHAMBER_HOSTS.join(' vagy ')} oldalra mutasson.`);
  return v ? new URL(v).href : '';
}
export function cleanTeam(list) {
  if (!Array.isArray(list) || list.length > TEAM_MAX) fail(400, `A csapatlista legfeljebb ${TEAM_MAX} tagot tartalmazhat.`);
  const ids = new Set();
  return list.map((m, i) => {
    if (!m || typeof m !== 'object' || Array.isArray(m)) fail(400, 'Hibás csapattag.');
    if (typeof m.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(m.id) || ids.has(m.id)) fail(400, 'Hibás vagy ismétlődő csapattag-azonosító.');
    ids.add(m.id);
    const pair = (obj, key, max, label, required = false) => {
      const hu = oneLine(obj?.hu ?? '', max, `${label} (HU)`, required), en = oneLine(obj?.en ?? '', max, `${label} (EN)`);
      return { hu, en };
    };
    const bio = {};
    for (const lang of ['hu', 'en']) {
      const raw = m.bio?.[lang] ?? '';
      if (typeof raw !== 'string') fail(400, 'A bemutatkozás szöveg legyen.');
      const v = raw.replace(/\r\n/g, '\n').trim();
      if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v) || v.length > 700) fail(400, `Érvénytelen vagy túl hosszú bemutatkozás (${lang.toUpperCase()}, legfeljebb 700 karakter).`);
      bio[lang] = v;
    }
    const focus = {};
    for (const lang of ['hu', 'en']) {
      const tags = m.focus?.[lang] ?? [];
      if (!Array.isArray(tags) || tags.length > 4) fail(400, 'Legfeljebb 4 szakterület-címke adható meg.');
      focus[lang] = tags.map(t => oneLine(t, 40, `címke (${lang.toUpperCase()})`)).filter(Boolean);
    }
    const chamberNo = oneLine(m.chamber_no ?? '', 40, `${i + 1}. tag kamarai azonosítója`);
    if (!/^[\p{L}\p{N} ./\-]*$/u.test(chamberNo)) fail(400, 'A kamarai azonosító csak betűt, számot, szóközt, pontot, kötőjelet és perjelet tartalmazhat.');
    return { id: m.id, name: pair(m.name, 'name', 80, `${i + 1}. tag neve`, true), role: pair(m.role, 'role', 80, `${i + 1}. tag szerepköre`), bio, focus, chamber_no: chamberNo, chamber_url: chamberUrl(m.chamber_url ?? '', i) };
  });
}

// Validates and normalises overrides: {hu: {path: value}, en: {...}, media: {slot: imageId}, team?: [...]}.
export function cleanOverrides(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(400, 'Hibás tartalom.');
  const out = { hu: {}, en: {}, media: {} };
  if (input.team !== undefined && input.team !== null) out.team = cleanTeam(input.team);
  const media = input.media ?? {};
  if (typeof media !== 'object' || Array.isArray(media)) fail(400, 'Hibás képhozzárendelés.');
  for (const [slot, id] of Object.entries(media)) {
    if (!isSlot(slot)) fail(400, `Ismeretlen képhely: ${slot}`);
    if (id === null) continue; // null clears the slot
    if (typeof id !== 'string' || !UUID.test(id)) fail(400, 'Érvénytelen képazonosító.');
    out.media[slot] = id;
  }
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
  const empty = () => ({ hu: {}, en: {}, media: {} });
  const parse = payload => ({ hu: {}, en: {}, media: {}, ...JSON.parse(payload) });
  let liveCache; // undefined = not loaded
  function draftRow() {
    let row = db.prepare('SELECT * FROM site_draft WHERE id=1').get();
    if (!row) { db.prepare('INSERT INTO site_draft VALUES(1,?,0,?)').run(JSON.stringify(empty()), now()); row = db.prepare('SELECT * FROM site_draft WHERE id=1').get(); }
    return row;
  }
  const draftView = row => ({ overrides: parse(row.payload), revision: row.revision, updated_at: row.updated_at });
  const meta = row => ({ id: row.id, created_at: row.created_at, note: row.note, changes: ['hu', 'en', 'media'].reduce((n, l) => n + Object.keys(parse(row.payload)[l]).length, 0) + (parse(row.payload).team ? 1 : 0), references: parse(row.payload).references?.length ?? 0 });
  const store = {
    draft: () => draftView(draftRow()),
    saveDraft(revision, overrides) {
      const row = draftRow();
      if (revision !== row.revision) fail(409, 'Közben valaki más módosította a vázlatot. Töltsd újra az oldalt; a mentés nem írta felül a változást.');
      const clean = cleanOverrides(overrides);
      db.prepare('UPDATE site_draft SET payload=?, revision=revision+1, updated_at=? WHERE id=1').run(JSON.stringify(clean), now());
      return draftView(draftRow());
    },
    // `extra` is data frozen into the version at publication time, e.g. the public references taken from the reference store.
    publish(revision, note = '', extra = {}) {
      const row = draftRow();
      if (revision !== row.revision) fail(409, 'A vázlat közben megváltozott. Töltsd újra az oldalt, nézd át, és közzétételkor az aktuális vázlat kerül ki.');
      if (typeof note !== 'string' || note.length > 200) fail(400, 'A megjegyzés legfeljebb 200 karakter lehet.');
      const id = randomUUID();
      db.prepare('INSERT INTO site_versions(id,payload,note,created_at) VALUES(?,?,?,?)').run(id, JSON.stringify({ ...JSON.parse(row.payload), ...extra }), note.trim(), now());
      liveCache = undefined;
      return meta(db.prepare('SELECT * FROM site_versions WHERE id=?').get(id));
    },
    live() {
      if (liveCache === undefined) {
        const row = db.prepare('SELECT * FROM site_versions ORDER BY seq DESC LIMIT 1').get();
        liveCache = row ? { ...meta(row), overrides: parse(row.payload) } : null;
      }
      return liveCache;
    },
    versions: () => db.prepare('SELECT * FROM site_versions ORDER BY seq DESC LIMIT 50').all().map(meta),
    restore(versionId, revision) {
      const version = db.prepare('SELECT * FROM site_versions WHERE id=?').get(versionId);
      if (!version) fail(404, 'A verzió nem található.');
      const row = draftRow();
      if (revision !== row.revision) fail(409, 'Közben valaki más módosította a vázlatot. Töltsd újra az oldalt.');
      const { references: ignored, ...draftPart } = JSON.parse(version.payload); // frozen references are not part of the editable draft
      db.prepare('UPDATE site_draft SET payload=?, revision=revision+1, updated_at=? WHERE id=1').run(JSON.stringify(draftPart), now());
      return draftView(draftRow());
    }
  };
  return store;
}
