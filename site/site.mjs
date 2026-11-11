import { readFileSync, existsSync } from 'node:fs';
import { LOGOS, ICONS } from './art.mjs';
import { applyContent, isChamberUrl } from './content.mjs';
import { referenceCategoryLabel } from '../reference-categories.mjs';
import { renderMosaic } from './mosaic.mjs';
import { PHASES_TEXT, PHASES_PATH, phasesMain } from './phases.mjs';

// Hero render for concept n: a high-resolution file (hero-N.webp or hero-N.jpg) wins over the interim
// crop from the concept board (heroN.png). See docs/HERO-IMAGES.md.
function heroImage(n) {
  for (const ext of ['webp', 'jpg']) if (existsSync(new URL(`../public/site/img/hero-${n}.${ext}`, import.meta.url))) return `/site/img/hero-${n}.${ext}`;
  return `/site/img/hero${n}.png`;
}

// One hero <img>: an uploaded image (with srcset over its stored widths) or the bundled default for that identity draft.
function heroImg(key, n, active, custom, lang) {
  const loading = active ? 'eager' : 'lazy';
  if (!custom) return `<img class="hero-img hero-${key}" src="${heroImage(n)}" alt="" loading="${loading}" decoding="async">`;
  const widths = custom.widths, best = widths.includes(1600) ? 1600 : widths.at(-1);
  const srcset = widths.map(w => `/media/${custom.id}/${w}.webp ${w}w`).join(', ');
  return `<img class="hero-img hero-${key}" src="/media/${custom.id}/${best}.webp" srcset="${srcset}" sizes="(max-width: 860px) 100vw, 720px" width="${custom.width}" height="${custom.height}" alt="${esc(custom.alt?.[lang] || '')}" loading="${loading}" decoding="async">`;
}

// Splits the headline into sentences so the last one (and its full stop) can be accented by the theme.
function heroTitle(key, text) {
  const sentences = text.split(/(?<=\.)\s+/);
  const html = sentences.map((s, i) => {
    const last = i === sentences.length - 1;
    const body = last && s.endsWith('.') ? `${esc(s.slice(0, -1))}<span class="dot">.</span>` : esc(s);
    return `<span class="line${last ? ' last' : ''}">${body}</span>`;
  }).join(' ');
  return `<h1 class="hero-title t-${key}">${html}</h1>`;
}

export const THEMES = ['rendszer', 'struktura', 'szinkron'];
export const LANGS = ['hu', 'en'];
const THEME_LABELS = { rendszer: '01 Rendszer', struktura: '02 Struktúra', szinkron: '03 Szinkron' };
const THEME_ALIASES = { 1: 'rendszer', 2: 'struktura', 3: 'szinkron' };

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// A free text block: an empty line starts a new paragraph, a single line break stays a line break. Everything is escaped.
// It is used for the general introduction of the team (full width, under the section heading); an empty value renders nothing.
export const paragraphsHtml = text => String(text ?? '').trim().split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
// Limited Markdown renderer: raw HTML is escaped and external links are restricted to http(s).
export function richTextHtml(source) {
  const inline = raw => {
    let out = esc(raw);
    out = out.replace(/\[([^]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + label + '</a>');
    out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    return out;
  };
  const lines = String(source ?? '').replace(/\r\n/g, '\n').split('\n');
  const html = []; let paragraph = [], list = [];
  const flushP = () => { if (paragraph.length) { html.push('<p>' + paragraph.map(inline).join('<br>') + '</p>'); paragraph = []; } };
  const flushL = () => { if (list.length) { html.push('<ul>' + list.map(x => '<li>' + inline(x) + '</li>').join('') + '</ul>'); list = []; } };
  for (const line of lines) {
    const item = /^\s*[-*]\s+(.+)$/.exec(line);
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (!line.trim()) { flushP(); flushL(); continue; }
    if (item) { flushP(); list.push(item[1]); continue; }
    flushL();
    if (heading) { flushP(); const n = heading[1].length + 1; html.push('<h' + n + '>' + inline(heading[2]) + '</h' + n + '>'); continue; }
    paragraph.push(line);
  }
  flushP(); flushL(); return html.join('');
}
const teamIntroHtml = text => { const html = paragraphsHtml(text); return html ? `<div class="team-intro">${html}</div>` : ''; };

export const parseTheme =value => THEMES.includes(value) ? value : THEME_ALIASES[value] || 'rendszer';

// Where the public references come from. Today: a file of invented sample projects.
// Later: the same shape produced from the reference store by toPublicReference() below.
const SAMPLE = JSON.parse(readFileSync(new URL('./sample-references.json', import.meta.url), 'utf8'));
export const sampleReferences = () => SAMPLE.references.map(r => ({ ...r, sample: true }));

// Team members: placeholders for now (names from the workspace sections, sample role and bio text).
// Later the same shape comes from an editable team list in the workspace, with portrait photos.
const TEAM = JSON.parse(readFileSync(new URL('./sample-team.json', import.meta.url), 'utf8'));
export const sampleTeam = () => TEAM.members.map(m => ({ ...m, sample: true }));

// Whitelist mapping from an internal reference record to the public shape. Only the fields listed here can
// ever reach the public site: the internal work description, source notes, questions, designers' names,
// photo links and the general description draft (website_copy_draft) are deliberately NOT used. Readiness
// warnings (see public/site-readiness.js) never block a reference marked as publishable.
const KINDS = ['tower', 'warehouse', 'school', 'hotel', 'clinic', 'hall', 'plant'];
const kindFor = id => KINDS[[...String(id)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % KINDS.length];
const str = (value, max) => String(value ?? '').trim().slice(0, max);
export function toPublicReference(record) {
  const ok = record && record.website_publishable === true && !record.deleted_at && !record.archived && !record.merged_into;
  if (!ok) return null;
  const titleHu = str(record.website_title_hu || record.name, 160);
  if (!titleHu) return null;
  return {
    id: String(record.id), kind: kindFor(record.id), category: str(record.category, 80), categoryIds: [record.category_main_id, record.category_sub_id].filter(Boolean).map(String), year: str(record.design_year, 40),
    place: { hu: str(record.city, 80), en: str(record.city, 80) },
    title: { hu: titleHu, en: str(record.website_title_en, 160) },
    summary: { hu: str(record.website_copy_hu, 900), en: str(record.website_copy_en, 900) },
    tags: { hu: [], en: [] }, featured: record.website_featured === true,
    cover: record.website_cover_media ? String(record.website_cover_media) : null
  };
}
const firstYear = year => Number(/\d{4}/.exec(year)?.[0] ?? 0);
// Public references for a list of records: newest design year first, then title. A featured reference keeps its place in time
// and is shown as a double-size tile in the mosaic, so big and small tiles alternate.
export const publicReferences = records => records.map(toPublicReference).filter(Boolean)
  .sort((a, b) => firstYear(b.year) - firstYear(a.year) || a.title.hu.localeCompare(b.title.hu, 'hu'));

export const categoryLabel = referenceCategoryLabel;

const TEXT = {
  hu: {
    htmlLang: 'hu', title: 'GAUT Mérnökiroda | Gépészeti automatika és épületfelügyelet',
    description: 'A GAUT gépészeti automatika- és épületfelügyeleti rendszereket tervező mérnökiroda.',
    nav: [['bemutatkozas', 'Bemutatkozás'], ['szakteruletek', 'Szakterületek'], ['szemlelet', 'Szemlélet'], ['referenciak', 'Referenciák'], ['csapat', 'Csapat'], ['kapcsolat', 'Kapcsolat']],
    teamKicker: 'Csapat', teamTitle: 'A tervezők, akikkel dolgozhat', teamIntro: '',
    teamNote: 'Helyőrző bemutatkozások. A fotók és a szövegek a kollégáktól érkeznek majd.', photoSoon: 'Fotó hamarosan',
    chamberLabel: 'Mérnöki kamarai névjegyzék', chamberOpen: 'megnyitás',
    skip: 'Ugrás a tartalomra', descriptor: 'Mérnökiroda', other: 'EN', otherName: 'English',
    hero: { rendszer: 'Összehangolt rendszerek.', struktura: 'Átgondolt tervezés. Biztos működés.', szinkron: 'Intelligens épületek. Összhangban.' },
    sub: 'Gépészeti automatika és épületfelügyelet', cta: 'Kapcsolat', cta2: 'Referenciák',
    lead: 'Az épületgépészet és a villamos szakágak találkozásánál dolgozunk: egy tervben hangoljuk össze a rendszereket, hogy az épület biztonságosan, gazdaságosan és jól üzemeltethetően működjön.',
    aboutTitle: 'Mérnöki szemlélet, összehangolt rendszerek',
    aboutText: 'A GAUT Kft. épületgépészeti automatika- és épületfelügyeleti rendszerek tervezésével foglalkozó mérnökiroda. Munkánk középpontjában az épületgépészeti technológia, a villamos vezérlések és a felügyeleti rendszerek összehangolt, következetes megtervezése áll.\n\nA tervezés során a teljes rendszer működéséből indulunk ki: megvizsgáljuk a gépészeti berendezések feladatait, a szabályozási és biztonsági követelményeket, a villamos kapcsolódásokat, valamint az üzemeltetéshez szükséges információkat. Ennek alapján alakítjuk ki az automatika architektúráját, a vezérlési és szabályozási funkciókat, a terepi eszközök és vezérlőberendezések körét, továbbá az épületfelügyeleti kommunikációt.\n\nA feladat jellegéhez igazodva részt veszünk a koncepcióalkotásban, a tender- és kiviteli tervezésben, valamint a részletes gyártmánytervezésben. Célunk, hogy a dokumentáció ne csupán a berendezések felsorolása legyen, hanem egyértelműen meghatározza a rendszer működését, a szakági határfelületeket és a megvalósítás műszaki feltételeit.\n\nA jó terv a kivitelezés és a későbbi üzemeltetés alapja: legyen áttekinthető, ellenőrizhető, bővíthető és a projekt valós igényeihez illeszkedő.',
    areasKicker: 'Szakterületek', areasTitle: 'Amit tervezünk',
    areas: [
      ['Gépészeti automatika', 'Légtechnikai, fűtési, hűtési, valamint speciális tűzvédelmi, hő- és füstelvezető rendszerek vezérlése és szabályozása. DDC- és PLC-készülékek, terepi elemek kiválasztása a projekt igényeihez.'],
      ['Villamos vezérlőszekrények', 'Kapcsolószekrények tervezése, amelyek a gépészeti berendezések biztonságos energiaellátását, megbízható működtetését és felügyeletét adják.'],
      ['Épületfelügyeleti rendszerek', 'Központi áttekintés és hatékony beavatkozási lehetőség: gazdaságos üzemeltetés, energiamegtakarítás, a rendellenes működés korai felismerése.']
    ],
    approachKicker: 'Szemlélet', approachTitle: 'Nem egy technológiában gondolkodunk',
    approachText: 'A terepi automatikaelemek, valamint a DDC- és PLC-készülékek kiválasztásakor figyelembe vesszük a megrendelő műszaki igényeit, meglévő rendszereit, üzemeltetési szempontjait és gyártói preferenciáit. Minden feladathoz a követelményekhez legjobban illeszkedő, hosszú távon is megbízható és támogatott megoldást keressük.',
    principles: [
      ['Szakágak összehangolva', 'Épületgépészet, villamos rendszerek és épületfelügyelet egy közös terv részeként.'],
      ['Gyártófüggetlen választás', 'A feladathoz illő megoldást keressük, nem egyetlen gyártó termékcsaládját.'],
      ['Hosszú távú üzemeltethetőség', 'Biztonságos, előírásszerű működés, energiapazarlást és hibákat megelőző tervezés.'],
      ['Átlátható dokumentáció', 'Követhető működési leírások, egyértelmű szakági határfelületek és a kivitelezést támogató részletes tervanyag.']
    ],
    vendorsLabel: 'Dolgozunk többek között a következő gyártók megoldásaival',
    vendors: ['Honeywell', 'Siemens', 'CIMON', 'ELCON', 'Schneider Electric', 'Johnson Controls', 'WAGO'],
    sectorsLabel: 'Tapasztalatunk területei',
    sectors: ['Ipari létesítmények', 'Kereskedelmi létesítmények', 'Szállodák', 'Közösségi épületek', 'Oktatási intézmények', 'Egészségügyi beruházások'],
    refsKicker: 'Referenciák', refsTitle: 'Válogatás a munkáinkból',
    refsNote: 'Bemutató mintaprojektek. A látható projektek kitaláltak, a végleges oldalon valós referenciák szerepelnek majd.',
    all: 'Mind', sample: 'Minta', designYear: 'Tervév', mosaicOpen: 'Megnyitás', mosaicClose: 'Bezárás', mosaicPrev: 'Előző referencia', mosaicNext: 'Következő referencia', mosaicDetail: 'Referencia részletei',
    contactKicker: 'Kapcsolat', contactTitle: 'Beszéljük meg a projektet',
    contactText: 'Írjon vagy hívjon minket, és közösen megnézzük, milyen rendszer illik az épületéhez.',
    contactPending: 'Az elérhetőségek a végleges adatok megérkezése után kerülnek ide.',
    contactLabels: ['Cím', 'E-mail', 'Telefon'], pending: 'hamarosan',
    footer: 'GAUT Kft. Gépészeti automatika és épületfelügyelet tervezése.', preview: 'Előnézet. Az oldal még nem végleges, és a keresők elől rejtve van.',
    themeLabel: 'Arculat', contact: { address: '', email: '', phone: '' },
    draftPreview: 'Vázlat előnézete. Ezt a változatot a látogatók még nem látják.'
  },
  en: {
    htmlLang: 'en', title: 'GAUT Engineering | Building automation and building management design',
    description: 'GAUT is an engineering consultancy designing mechanical automation and building management systems.',
    nav: [['bemutatkozas', 'About'], ['szakteruletek', 'Services'], ['szemlelet', 'Approach'], ['referenciak', 'Projects'], ['csapat', 'Team'], ['kapcsolat', 'Contact']],
    teamKicker: 'Team', teamTitle: 'The engineers you will work with', teamIntro: '',
    teamNote: 'Placeholder introductions. Photos and texts will come from the colleagues.', photoSoon: 'Photo coming soon',
    chamberLabel: 'Chamber of Engineers register', chamberOpen: 'open',
    skip: 'Skip to content', descriptor: 'Engineering', other: 'HU', otherName: 'Magyar',
    hero: { rendszer: 'Coordinated systems.', struktura: 'Considered design. Reliable operation.', szinkron: 'Intelligent buildings. In harmony.' },
    sub: 'Building automation and building management', cta: 'Contact', cta2: 'Projects',
    lead: 'We work where building services and electrical disciplines meet: one design that brings the systems together so a building runs safely, economically and is easy to operate.',
    aboutTitle: 'Engineering perspective. Coordinated systems.',
    aboutText: 'GAUT Ltd. is an engineering consultancy specialising in building services automation and building management system design. Our work focuses on the coordinated design of mechanical building services, electrical controls and supervisory systems.\n\nWe approach each project as a complete operating system. We consider the functions of the mechanical equipment, control and safety requirements, electrical interfaces and the information needed for effective operation. On this basis, we define the automation architecture, control sequences, field devices and controllers, as well as communication with the building management system.\n\nDepending on the project, our work can cover concept development, tender design, detailed implementation design and shop design. Our aim is to produce documentation that does more than list equipment: it clearly defines system behaviour, discipline interfaces and the technical conditions for implementation.\n\nGood design is the foundation of construction and long-term operation. It should be clear, verifiable, maintainable, expandable and aligned with the actual needs of the project.',
    areasKicker: 'Services', areasTitle: 'What we design',
    areas: [
      ['Mechanical automation', 'Control and regulation of ventilation, heating, cooling and special fire-protection, smoke and heat exhaust systems. Selection of DDC and PLC devices and field elements to suit each project.'],
      ['Electrical control cabinets', 'Design of switchgear and control cabinets that give mechanical equipment safe power supply, reliable operation and supervision.'],
      ['Building management systems', 'A central overview with effective means to intervene: economical operation, energy savings and early detection of abnormal behaviour.']
    ],
    approachKicker: 'Approach', approachTitle: 'We do not think in a single technology',
    approachText: 'When selecting field automation, DDC and PLC devices we take into account the client\'s technical needs, existing systems, operating conditions and vendor preferences. For every task we look for the solution that fits the requirements best and stays reliable and supported over the long term.',
    principles: [
      ['Disciplines coordinated', 'Building services, electrical systems and building management as parts of one design.'],
      ['Vendor-independent selection', 'We look for the solution that fits the task, not one manufacturer\'s product range.'],
      ['Long-term operability', 'Safe, compliant operation, designed to prevent faults and wasted energy.'],
      ['Clear documentation', 'Traceable control descriptions, well-defined discipline interfaces and detailed design information that supports implementation.']
    ],
    vendorsLabel: 'We work with solutions from manufacturers including',
    vendors: ['Honeywell', 'Siemens', 'CIMON', 'ELCON', 'Schneider Electric', 'Johnson Controls', 'WAGO'],
    sectorsLabel: 'Where we have experience',
    sectors: ['Industrial facilities', 'Commercial facilities', 'Hotels', 'Community buildings', 'Educational institutions', 'Healthcare projects'],
    refsKicker: 'Projects', refsTitle: 'Selected work',
    refsNote: 'Illustrative sample projects. The projects shown are invented; the final site will list real references.',
    all: 'All', sample: 'Sample', designYear: 'Design year', mosaicOpen: 'Open', mosaicClose: 'Close', mosaicPrev: 'Previous project', mosaicNext: 'Next project', mosaicDetail: 'Project details',
    contactKicker: 'Contact', contactTitle: 'Let\'s talk about your project',
    contactText: 'Write or call us and we will look together at which system suits your building.',
    contactPending: 'Contact details will be added when the final information arrives.',
    contactLabels: ['Address', 'Email', 'Phone'], pending: 'coming soon',
    footer: 'GAUT Ltd. Design of building automation and building management systems.', preview: 'Preview. This page is not final and is hidden from search engines.',
    themeLabel: 'Identity', contact: { address: '', email: '', phone: '' },
    draftPreview: 'Draft preview. Visitors do not see this version yet.'
  }
};

for (const lang of Object.keys(TEXT)) TEXT[lang].phases = PHASES_TEXT[lang]; // text of the "Tervezési fázisok" subpage

// Default text of one language (used by the editor to show what an empty field falls back to).
export const defaultText = lang => structuredClone(TEXT[lang]);

const arrow = '<svg class="arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';

// English fields fall back to the Hungarian ones when they are empty.
const pick = (pair, lang) => (pair?.[lang] || pair?.hu || '');
function teamCard(m, lang, t) {
  const name = pick(m.name, lang);
  const pm = m.photoMedia; // an uploaded portrait (resolved media record), if any
  const photo = pm
    ? `<img src="/media/${pm.id}/${pm.widths.includes(800) ? 800 : pm.widths[0]}.webp" srcset="${pm.widths.map(w => `/media/${pm.id}/${w}.webp ${w}w`).join(', ')}" sizes="(max-width: 560px) 100vw, (max-width: 1040px) 50vw, 280px" width="${pm.width}" height="${pm.height}" alt="${esc(name)}" loading="lazy" decoding="async">`
    : m.photo
      ? `<img src="${esc(m.photo)}" alt="${esc(name)}" loading="lazy">`
      : `<div class="portrait-empty" role="img" aria-label="${esc(t.photoSoon)}"><span class="initial">${esc(name.slice(0, 1).toUpperCase())}</span><span class="soon">${esc(t.photoSoon)}</span></div>`;
  const tags = m.focus?.[lang]?.length ? m.focus[lang] : (m.focus?.hu || []);
  const focus = tags.map(x => `<li>${esc(x)}</li>`).join('');
  const role = pick(m.role, lang), bio = pick(m.bio, lang);
  // Chamber of Engineers register: the number, linked to the register when a (validated) address is set.
  const link = m.chamber_url && isChamberUrl(m.chamber_url) ? m.chamber_url : '';
  const chamber = m.chamber_no || link
    ? `<p class="chamber">${esc(t.chamberLabel)}: ${link ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(m.chamber_no || t.chamberOpen)}</a>` : esc(m.chamber_no)}</p>` : '';
  return `<article class="member">
  <div class="portrait">${photo}${m.sample ? `<span class="badge">${esc(t.sample)}</span>` : ''}</div>
  <h3>${esc(name)}</h3>
  ${role ? `<p class="role">${esc(role)}</p>` : ''}
  ${bio ? `<p class="bio">${esc(bio)}</p>` : ''}
  ${chamber}
  ${focus ? `<ul class="tags">${focus}</ul>` : ''}
</article>`;
}

function renderCategoryCards(cards, tree, lang){
 const active=(cards||[]).filter(c=>c.enabled);if(!active.length)return '';
 const cats=(tree||[]).flatMap(g=>g.categories||[]);
 return `<div class="activity-cards">${active.map(c=>{const m=c.imageMedia,title=pick(c.title,lang),desc=pick(c.description,lang),names=c.categoryIds.map(id=>cats.find(x=>x.id===id)?.name||(tree||[]).find(g=>g.id===id)?.name).filter(Boolean);const img=m?`<img src="/media/${m.id}/${m.widths.includes(800)?800:m.widths[0]}.webp" alt="" loading="lazy" decoding="async">`:'';return `<a class="activity-card" href="#referenciak" data-category-card data-categories="${esc(c.categoryIds.join(','))}"><span class="activity-card-image">${img}</span><span class="activity-card-copy"><strong>${esc(title)}</strong>${desc?`<span>${esc(desc)}</span>`:''}<small>${esc(names.join(' · '))}</small></span></a>`;}).join('')}</div>`;
}

export function renderSite({ lang = 'hu', theme = 'rendszer', references = sampleReferences(), team = sampleTeam(), content = null, draft = false, media = {}, categoryCards = [], referenceCategories = [], page = 'home' } = {}) {
  lang = LANGS.includes(lang) ? lang : 'hu';
  theme = parseTheme(theme);
  const t = applyContent(TEXT[lang], content?.[lang]);
  const homeOf = l => (l === 'hu' ? '/' : '/en'); // the Hungarian site is the root, English lives at /en
  const sub = page === 'phases'; // the "Tervezési fázisok" subpage shares the header, footer and themes of the home page
  const pathOf = l => (sub ? PHASES_PATH[l] : homeOf(l));
  const home = homeOf(lang), anchor = id => `${sub ? home : ''}#${id}`;
  const navLink = ([id, label]) => `<a href="${anchor(id)}">${esc(label)}</a>${id === 'szakteruletek' ? `<a href="${PHASES_PATH[lang]}"${sub ? ' aria-current="page"' : ''}>${esc(t.phases.navLabel)}</a>` : ''}`;
  const otherLang = lang === 'hu' ? 'en' : 'hu';
  return `<!doctype html>
<html lang="${t.htmlLang}" data-theme="${theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(sub ? t.phases.metaTitle : t.title)}</title>
<meta name="description" content="${esc(sub ? t.phases.metaDescription : t.description)}">
<link rel="alternate" hreflang="hu" href="${pathOf('hu')}"><link rel="alternate" hreflang="en" href="${pathOf('en')}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/site/site.css">
<script type="module" src="/site/site.js"></script>
</head>
<body>
<a class="skip" href="#tartalom">${esc(t.skip)}</a>
<div class="preview-bar${draft ? ' draft' : ''}">${esc(draft ? t.draftPreview : t.preview)}</div>
<header class="top">
  <a class="brand" href="${home}" aria-label="GAUT Mérnökiroda">
    ${Object.entries(LOGOS).map(([k, svg]) => `<span class="logo logo-${k}">${svg}</span>`).join('')}
  </a>
  <button class="menu-btn" type="button" aria-expanded="false" aria-controls="nav" aria-label="Menu"><span></span><span></span></button>
  <nav id="nav" class="nav" aria-label="${lang === 'hu' ? 'Főmenü' : 'Main'}">
    ${t.nav.filter(([id]) => id !== 'csapat' || team.length).map(navLink).join('')}
    <a class="lang" href="${pathOf(otherLang)}" data-keep-theme hreflang="${otherLang}" lang="${otherLang}" title="${esc(t.otherName)}">${esc(t.other)}</a>
  </nav>
</header>
<main id="tartalom">
${sub ? phasesMain(t.phases, { esc, paragraphs: paragraphsHtml }) : `<section class="hero">
  <div class="wrap hero-grid">
    <div class="hero-copy">
      ${Object.entries(t.hero).map(([k, v]) => heroTitle(k, v)).join('')}
      <p class="sub">${esc(t.sub)}</p>
      <p class="lead">${esc(t.lead)}</p>
      <div class="actions"><a class="btn" href="#kapcsolat">${esc(t.cta)} ${arrow}</a><a class="btn ghost" href="#referenciak">${esc(t.cta2)}</a></div>
    </div>
    <div class="hero-art">
      ${[['rendszer', 1], ['struktura', 2], ['szinkron', 3]].map(([k, n]) => heroImg(k, n, k === theme, media[`hero.${k}`], lang)).join('')}
      <ul class="sys-icons" aria-hidden="true">${['fan', 'thermo', 'bulb', 'panel', 'monitor'].map(i => `<li>${ICONS[i]}</li>`).join('')}</ul>
    </div>
  </div>
</section>

<section id="bemutatkozas" class="block about-section">
  <div class="wrap"><p class="kicker">${lang === 'hu' ? 'Bemutatkozás' : 'About'}</p><h2>${esc(t.aboutTitle)}</h2><div class="rich-text">${richTextHtml(t.aboutText)}</div></div>
</section>

<section id="szakteruletek" class="block">
  <div class="wrap">
    <p class="kicker">${esc(t.areasKicker)}</p><h2>${esc(t.areasTitle)}</h2>
    <div class="areas">${t.areas.map(([h, p], i) => `<article class="area"><span class="area-icon">${ICONS[['fan', 'switches', 'monitor'][i]]}</span><span class="num">0${i + 1}</span><h3>${esc(h)}</h3><p>${esc(p)}</p></article>`).join('')}</div>
    <p class="sectors-label">${esc(t.sectorsLabel)}</p>
    <ul class="chips">${t.sectors.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
  </div>
</section>

<section id="szemlelet" class="block alt">
  <div class="wrap split">
    <div><p class="kicker">${esc(t.approachKicker)}</p><h2>${esc(t.approachTitle)}</h2><p class="body">${esc(t.approachText)}</p>
      ${t.phases.homeLink ? `<p class="more"><a href="${PHASES_PATH[lang]}">${esc(t.phases.homeLink)} ${arrow}</a></p>` : ''}
      <p class="sectors-label">${esc(t.vendorsLabel)}</p><ul class="vendors">${t.vendors.map(v => `<li>${esc(v)}</li>`).join('')}</ul></div>
    <ol class="principles">${t.principles.map(([h, p]) => `<li><h3>${esc(h)}</h3><p>${esc(p)}</p></li>`).join('')}</ol>
  </div>
</section>

<section id="referenciak" class="block">
  <div class="wrap">
    <p class="kicker">${esc(t.refsKicker)}</p><h2>${esc(t.refsTitle)}</h2>
    ${t.refsNote && (references.some(r => r.sample) || content?.[lang]?.refsNote !== undefined) ? `<p class="note">${esc(t.refsNote)}</p>` : ''}
    ${renderCategoryCards(categoryCards, referenceCategories, lang)}
    ${renderMosaic(references, { lang, categoryLabel: c => categoryLabel(c, lang), labels: { all: t.all, filter: t.refsKicker, open: t.mosaicOpen, close: t.mosaicClose, prev: t.mosaicPrev, next: t.mosaicNext, detail: t.mosaicDetail, sample: t.sample, designYear: t.designYear } })}
  </div>
</section>

${team.length ? `<section id="csapat" class="block alt">
  <div class="wrap">
    <p class="kicker">${esc(t.teamKicker)}</p><h2>${esc(t.teamTitle)}</h2>
    ${t.teamNote && (team.some(m => m.sample) || content?.[lang]?.teamNote !== undefined) ? `<p class="note">${esc(t.teamNote)}</p>` : ''}
    ${teamIntroHtml(t.teamIntro || content?.hu?.teamIntro)}
    <div class="team">${team.map(m => teamCard(m, lang, t)).join('')}</div>
  </div>
</section>` : ''}

<section id="kapcsolat" class="block contact">
  <div class="wrap split">
    <div><p class="kicker">${esc(t.contactKicker)}</p><h2>${esc(t.contactTitle)}</h2><p class="body">${esc(t.contactText)}</p></div>
    <div class="contact-card">
      <dl>${t.contactLabels.map((l, i) => {
        const key = ['address', 'email', 'phone'][i], value = t.contact[key];
        if (!value) return `<div><dt>${esc(l)}</dt><dd class="pending">${esc(t.pending)}</dd></div>`;
        const shown = key === 'email' ? `<a href="mailto:${esc(value)}">${esc(value)}</a>` : key === 'phone' ? `<a href="tel:${esc(value.replace(/[^0-9+]/g, ''))}">${esc(value)}</a>` : esc(value);
        return `<div><dt>${esc(l)}</dt><dd>${shown}</dd></div>`;
      }).join('')}</dl>
      ${Object.values(t.contact).every(Boolean) ? '' : `<p class="note">${esc(t.contactPending)}</p>`}
    </div>
  </div>
</section>`}
</main>
<footer class="foot"><div class="wrap"><span>${esc(t.footer)}</span></div></footer>

<aside class="theme-switch" aria-label="${esc(t.themeLabel)}">
  <span>${esc(t.themeLabel)}</span>
  ${THEMES.map(k => `<button type="button" data-theme-choice="${k}" aria-pressed="${k === theme}">${esc(THEME_LABELS[k])}</button>`).join('')}
</aside>
</body>
</html>`;
}
