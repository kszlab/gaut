import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

// Uploaded images are re-encoded to WebP at a few widths. The original file is not kept, which also drops
// camera metadata such as GPS location. The sharp module is loaded on first use, so a problem with the
// native library only disables image upload and never prevents the workspace from starting.
const WIDTHS = [800, 1600, 2400];
const MIN_WIDTH = 200; // enough for a small portrait; the editor warns about low resolution
const FORMATS = new Set(['jpeg', 'png', 'webp']);
let sharpModule;
async function loadSharp() {
  if (!sharpModule) {
    try { sharpModule = (await import('sharp')).default; } catch (error) { console.error(error); fail(503, 'A képfeldolgozó jelenleg nem érhető el. Próbáld később, vagy szólj a fejlesztőnek.'); }
  }
  return sharpModule;
}

const altText = (value, label) => {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.length > 200 || /[\u0000-\u001f\u007f]/.test(value)) fail(400, `Érvénytelen ${label}.`);
  return value.trim();
};

export function mediaStore(db, dataDir) {
  const dir = join(dataDir, 'site-media');
  mkdirSync(dir, { recursive: true });
  db.exec('CREATE TABLE IF NOT EXISTS site_media(id TEXT PRIMARY KEY, filename TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, widths TEXT NOT NULL, alt_hu TEXT NOT NULL DEFAULT \'\', alt_en TEXT NOT NULL DEFAULT \'\', created_at TEXT NOT NULL)');
  const view = row => row && ({ id: row.id, filename: row.filename, width: row.width, height: row.height, widths: JSON.parse(row.widths), alt: { hu: row.alt_hu, en: row.alt_en }, created_at: row.created_at });
  return {
    get: id => view(db.prepare('SELECT * FROM site_media WHERE id=?').get(id)),
    list: () => db.prepare('SELECT * FROM site_media ORDER BY created_at DESC LIMIT 60').all().map(view),
    // path of one stored variant, or null
    file(id, width) {
      const row = db.prepare('SELECT widths FROM site_media WHERE id=?').get(id);
      if (!row || !JSON.parse(row.widths).includes(width)) return null;
      const path = join(dir, `${id}-${width}.webp`);
      return existsSync(path) ? path : null;
    },
    async add({ filename, bytes, alt_hu, alt_en }) {
      const hu = altText(alt_hu, 'magyar képleírás'), en = altText(alt_en, 'angol képleírás');
      const name = String(filename || 'kep').replace(/[\\/\u0000-\u001f\u007f]/g, '_').slice(0, 120);
      const sharp = await loadSharp();
      let meta;
      try { meta = await sharp(bytes, { limitInputPixels: 80_000_000 }).metadata(); } catch { fail(400, 'A fájl nem olvasható képként. JPG, PNG vagy WebP kell.'); }
      if (!FORMATS.has(meta.format)) fail(400, 'Csak JPG, PNG és WebP kép tölthető fel.');
      const swap = (meta.orientation ?? 1) >= 5;
      const width = swap ? meta.height : meta.width, height = swap ? meta.width : meta.height;
      if (!width || !height) fail(400, 'A kép mérete nem állapítható meg.');
      if (width < MIN_WIDTH) fail(400, `A kép túl kicsi (${width} px széles). Legalább ${MIN_WIDTH} px szélesre van szükség, a nyitóképhez ajánlott legalább 1600 px.`);
      let widths = WIDTHS.filter(w => w <= width);
      if (!widths.length) widths = [width]; // narrower than the smallest preset: keep the original width
      const id = randomUUID();
      try {
        for (const w of widths) {
          const out = await sharp(bytes, { limitInputPixels: 80_000_000 }).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
          writeFileSync(join(dir, `${id}-${w}.webp`), out, { flag: 'wx', mode: 0o600 });
        }
      } catch (error) { if (error.status) throw error; console.error(error); fail(400, 'A képet nem sikerült feldolgozni.'); }
      db.prepare('INSERT INTO site_media(id,filename,width,height,widths,alt_hu,alt_en,created_at) VALUES(?,?,?,?,?,?,?,?)').run(id, name, width, height, JSON.stringify(widths), hu, en, new Date().toISOString());
      return view(db.prepare('SELECT * FROM site_media WHERE id=?').get(id));
    },
    setAlt(id, alt_hu, alt_en) {
      if (!db.prepare('SELECT 1 FROM site_media WHERE id=?').get(id)) fail(404, 'A kép nem található.');
      db.prepare('UPDATE site_media SET alt_hu=?, alt_en=? WHERE id=?').run(altText(alt_hu, 'magyar képleírás'), altText(alt_en, 'angol képleírás'), id);
      return view(db.prepare('SELECT * FROM site_media WHERE id=?').get(id));
    }
  };
}
