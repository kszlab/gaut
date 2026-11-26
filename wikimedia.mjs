// Wikimedia Commons import for the reference photo store.
// A link to a Commons file page or category is resolved through the Commons API; each image is downloaded in website size from
// upload.wikimedia.org, with its author, licence and source, which fill the photo's fields (the public credit line included).
// Only commons.wikimedia.org and upload.wikimedia.org are ever contacted, so a pasted link cannot make the server fetch anything else.
const API = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'GAUT-munkater/1.6 (https://gaut.hu; gaut@gaut.hu)'; // Wikimedia asks every client to name itself
export const THUMB_WIDTH = 1920; // one of the standard thumbnail widths; smaller originals come as they are
const MAX_BYTES = 20 * 1024 * 1024;
const IMAGE = /\.(jpe?g|png|webp)$/i;
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
// Commons gives the author and the description as HTML: keep the words only.
export const plainText = html => String(html ?? '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITIES[e.toLowerCase()] ?? m)
  .replace(/\s+/g, ' ').trim();

// A Commons file or category from what people paste: the file or category page, a Wikipedia page's #/media/ link, or the bare title.
export function parseCommonsLink(input) {
  let text = String(input ?? '').trim();
  if (!text || text.length > 1000) fail(400, 'Adj meg egy Wikimedia Commons linket.');
  if (/^https?:\/\//i.test(text)) {
    let url; try { url = new URL(text); } catch { fail(400, 'Érvénytelen link.'); }
    const media = /\/media\/(.+)$/.exec(url.hash);
    if (media) text = media[1];
    else if (/(^|\.)wikimedia\.org$/i.test(url.hostname) && url.searchParams.get('title')) text = url.searchParams.get('title');
    else if (/^commons(\.m)?\.wikimedia\.org$/i.test(url.hostname) && url.pathname.startsWith('/wiki/')) text = url.pathname.slice(6);
    else fail(400, 'Csak Wikimedia Commons kép- vagy kategórialink adható meg.');
  }
  try { text = decodeURIComponent(text); } catch { /* already plain */ }
  text = text.replace(/_/g, ' ').trim();
  const m = /^(File|Image|Fájl|Kép|Category|Kategória):\s*(.+)$/i.exec(text);
  if (!m) fail(400, 'A link nem Commons-képre vagy -kategóriára mutat.');
  const kind = /^(category|kategória)$/i.test(m[1]) ? 'category' : 'file';
  return { kind, title: `${kind === 'category' ? 'Category' : 'File'}:${m[2]}` };
}

// The photo fields of one image, from its Commons page data. The public credit names the author, the source and the licence,
// which is what the free licences ask for; it stays editable on the reference sheet like any other field.
export function photoFields(page) {
  const info = page.imageinfo?.[0] ?? {}, meta = info.extmetadata ?? {};
  const v = key => plainText(meta[key]?.value);
  const author = v('Artist').slice(0, 120);
  const licence = v('LicenseShortName').slice(0, 60) || 'Licenc a forrásoldalon';
  const restrictions = v('Restrictions');
  const name = page.title.replace(/^File:/, '');
  return {
    filename: name.slice(0, 200),
    caption: (v('ImageDescription') || name.replace(IMAGE, '')).slice(0, 300),
    credit: author,
    source_url: info.descriptionurl || '',
    license_url: /^https?:\/\//i.test(v('LicenseUrl')) ? v('LicenseUrl') : '',
    reuse_status: `Szabad licenc (Wikimedia Commons): ${licence}${restrictions ? `; korlátozás: ${restrictions}` : ''}`,
    public_credit: `Fotó: ${author ? `${author} / ` : ''}Wikimedia Commons, ${licence}`.slice(0, 300)
  };
}

export function commonsClient(fetchImpl = globalThis.fetch) {
  const headers = { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT };
  async function api(params) {
    let r;
    try { r = await fetchImpl(`${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`, { headers, signal: AbortSignal.timeout(20000) }); }
    catch { fail(502, 'A Wikimedia Commons nem érhető el. Próbáld újra később.'); }
    if (!r.ok) fail(502, `A Wikimedia Commons hibát adott (${r.status}).`);
    return r.json();
  }
  return {
    // The file titles a link stands for: the file itself, or the images of a category in the category's own order.
    async titles(link, limit) {
      if (link.kind === 'file') return [link.title];
      const j = await api({ action: 'query', list: 'categorymembers', cmtitle: link.title, cmtype: 'file', cmlimit: String(Math.min(50, limit * 4)) });
      return (j.query?.categorymembers ?? []).map(p => p.title).filter(t => IMAGE.test(t)).slice(0, limit * 2);
    },
    // Page data of up to 50 files, with the website-size image address and the author and licence.
    async pages(titles) {
      if (!titles.length) return [];
      const j = await api({ action: 'query', prop: 'imageinfo', titles: titles.join('|'), iiprop: 'url|mime|size|extmetadata', iiurlwidth: String(THUMB_WIDTH), iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl|ImageDescription|NonFree|Restrictions' });
      const byTitle = new Map((j.query?.pages ?? []).map(p => [p.title, p]));
      const renamed = new Map((j.query?.normalized ?? []).map(n => [n.from, n.to]));
      return titles.map(t => byTitle.get(renamed.get(t) ?? t)).filter(Boolean);
    },
    async download(url) {
      let u; try { u = new URL(url); } catch { fail(502, 'Érvénytelen képcím a Wikimedia Commonsból.'); }
      if (u.protocol !== 'https:' || u.hostname !== 'upload.wikimedia.org') fail(502, 'A kép nem a Wikimedia Commons tárhelyéről jönne.');
      let r;
      try { r = await fetchImpl(u.href, { headers, signal: AbortSignal.timeout(30000) }); } catch { fail(502, 'A kép letöltése nem sikerült.'); }
      if (!r.ok) fail(502, `A kép letöltése nem sikerült (${r.status}).`);
      if (Number(r.headers.get('content-length') || 0) > MAX_BYTES) fail(413, 'A kép nagyobb 20 MB-nál.');
      const bytes = Buffer.from(await r.arrayBuffer());
      if (bytes.length > MAX_BYTES) fail(413, 'A kép nagyobb 20 MB-nál.');
      return bytes;
    }
  };
}

// Imports up to `max` Commons images for one reference from a list of links (files first, as given, then categories).
// A reference never gets the same Commons image twice, also not after it was put in the trash, and the images already
// imported count towards `max`, so running the same list again adds nothing.
export async function importCommons({ client, photos, referenceId, links, max = 5 }) {
  if (!Array.isArray(links) || !links.length || links.length > 10) fail(400, 'Adj meg 1–10 Wikimedia Commons linket.');
  const limit = Math.max(1, Math.min(10, Number.parseInt(max, 10) || 5));
  const prefix = `wm-${referenceId}-`;
  let room = limit - photos.seedKeyCount(prefix);
  const result = { added: [], skipped: 0, errors: [] };
  if (room <= 0) { result.skipped = limit; return result; }
  const parsed = links.map(parseCommonsLink).sort((a, b) => (a.kind === 'file' ? 0 : 1) - (b.kind === 'file' ? 0 : 1));
  const seen = new Set();
  for (const link of parsed) {
    if (room <= 0) break;
    let pages;
    try { pages = await client.pages((await client.titles(link, limit)).filter(t => !seen.has(t))); }
    catch (e) { result.errors.push({ link: link.title, error: e.status ? e.message : 'A Commons-adatok nem olvashatók.' }); continue; }
    for (const page of pages) {
      if (room <= 0) break;
      seen.add(page.title);
      const info = page.imageinfo?.[0];
      const key = `${prefix}${page.pageid}`;
      if (page.missing || !info) { result.errors.push({ link: page.title, error: 'A kép nem található a Commonsban.' }); continue; }
      if (photos.hasSeedKey(key)) { result.skipped++; continue; }
      if (info.extmetadata?.NonFree?.value) { result.errors.push({ link: page.title, error: 'Nem szabad licencű kép.' }); continue; }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(info.mime)) { result.errors.push({ link: page.title, error: 'Csak JPG, PNG vagy WebP kép tölthető be.' }); continue; }
      try {
        const bytes = await client.download(info.thumburl || info.url);
        const saved = photos.add(referenceId, { ...photoFields(page), content: bytes.toString('base64') }, key);
        if (saved) { result.added.push(saved); room--; } else result.skipped++;
      } catch (e) { result.errors.push({ link: page.title, error: e.status ? e.message : 'A kép nem menthető.' }); }
    }
  }
  return result;
}
