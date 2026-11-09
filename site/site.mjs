import { readFileSync } from 'node:fs';
import { buildingSvg, LOGOS } from './art.mjs';

export const THEMES = ['rendszer', 'struktura', 'szinkron'];
export const LANGS = ['hu', 'en'];
const THEME_LABELS = { rendszer: '01 Rendszer', struktura: '02 Struktúra', szinkron: '03 Szinkron' };
const THEME_ALIASES = { 1: 'rendszer', 2: 'struktura', 3: 'szinkron' };

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const parseTheme = value => THEMES.includes(value) ? value : THEME_ALIASES[value] || 'rendszer';

// Where the public references come from. Today: a file of invented sample projects.
// Later: the same shape produced from the reference store by toPublicReference() below.
const SAMPLE = JSON.parse(readFileSync(new URL('./sample-references.json', import.meta.url), 'utf8'));
export const sampleReferences = () => SAMPLE.references.map(r => ({ ...r, sample: true }));

// Whitelist mapping from an internal reference record to the public shape.
// Only fields listed here can ever reach the public site. Not wired up yet.
export function toPublicReference(record) {
  const ok = record && record.website_publishable === true && !record.deleted_at && !record.archived && !record.merged_into;
  if (!ok) return null;
  const hu = { title: String(record.website_title_hu || record.name || ''), summary: String(record.website_copy_hu || record.website_copy_draft || '') };
  const en = { title: String(record.website_title_en || ''), summary: String(record.website_copy_en || '') };
  if (!hu.title || !hu.summary) return null;
  return {
    id: String(record.id), kind: 'tower', category: String(record.category || ''), year: String(record.design_year || ''),
    place: { hu: String(record.city || ''), en: String(record.city || '') },
    title: { hu: hu.title, en: en.title || hu.title }, summary: { hu: hu.summary, en: en.summary || hu.summary },
    tags: { hu: [], en: [] }
  };
}

const CATEGORIES = {
  hu: { office: 'Iroda', industry: 'Ipar és logisztika', education: 'Oktatás', hotel: 'Szálloda', health: 'Egészségügy', community: 'Közösségi épület' },
  en: { office: 'Office', industry: 'Industry & logistics', education: 'Education', hotel: 'Hotel', health: 'Healthcare', community: 'Community building' }
};

const TEXT = {
  hu: {
    htmlLang: 'hu', title: 'GAUT Mérnökiroda | Gépészeti automatika és épületfelügyelet',
    description: 'A GAUT gépészeti automatika- és épületfelügyeleti rendszereket tervező mérnökiroda.',
    nav: [['szakteruletek', 'Szakterületek'], ['szemlelet', 'Szemlélet'], ['referenciak', 'Referenciák'], ['kapcsolat', 'Kapcsolat']],
    skip: 'Ugrás a tartalomra', descriptor: 'Mérnökiroda', other: 'EN', otherName: 'English',
    hero: { rendszer: 'Összehangolt rendszerek.', struktura: 'Átgondolt tervezés. Biztos működés.', szinkron: 'Intelligens épületek. Összhangban.' },
    sub: 'Gépészeti automatika és épületfelügyelet', cta: 'Kapcsolat', cta2: 'Referenciák',
    lead: 'Az épületgépészet és a villamos szakágak találkozásánál dolgozunk: egy tervben hangoljuk össze a rendszereket, hogy az épület biztonságosan, gazdaságosan és jól üzemeltethetően működjön.',
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
      ['Hosszú távú üzemeltethetőség', 'Biztonságos, előírásszerű működés, energiapazarlást és hibákat megelőző tervezés.']
    ],
    vendorsLabel: 'Dolgozunk többek között a következő gyártók megoldásaival',
    vendors: ['Honeywell', 'Siemens', 'CIMON', 'ELCON', 'Schneider Electric', 'Johnson Controls', 'WAGO'],
    sectorsLabel: 'Tapasztalatunk területei',
    sectors: ['Ipari létesítmények', 'Kereskedelmi létesítmények', 'Szállodák', 'Közösségi épületek', 'Oktatási intézmények', 'Egészségügyi beruházások'],
    refsKicker: 'Referenciák', refsTitle: 'Válogatás a munkáinkból',
    refsNote: 'Bemutató mintaprojektek. A látható projektek kitaláltak, a végleges oldalon valós referenciák szerepelnek majd.',
    all: 'Mind', sample: 'Minta', designYear: 'Tervév',
    contactKicker: 'Kapcsolat', contactTitle: 'Beszéljük meg a projektet',
    contactText: 'Írjon vagy hívjon minket, és közösen megnézzük, milyen rendszer illik az épületéhez.',
    contactPending: 'Az elérhetőségek a végleges adatok megérkezése után kerülnek ide.',
    contactLabels: ['Cím', 'E-mail', 'Telefon'], pending: 'hamarosan',
    footer: 'GAUT Kft. Gépészeti automatika és épületfelügyelet tervezése.', preview: 'Előnézet. Az oldal még nem végleges, és a keresők elől rejtve van.',
    themeLabel: 'Arculat'
  },
  en: {
    htmlLang: 'en', title: 'GAUT Engineering | Building automation and building management design',
    description: 'GAUT is an engineering consultancy designing mechanical automation and building management systems.',
    nav: [['szakteruletek', 'Services'], ['szemlelet', 'Approach'], ['referenciak', 'Projects'], ['kapcsolat', 'Contact']],
    skip: 'Skip to content', descriptor: 'Engineering', other: 'HU', otherName: 'Magyar',
    hero: { rendszer: 'Coordinated systems.', struktura: 'Considered design. Reliable operation.', szinkron: 'Intelligent buildings. In harmony.' },
    sub: 'Building automation and building management', cta: 'Contact', cta2: 'Projects',
    lead: 'We work where building services and electrical disciplines meet: one design that brings the systems together so a building runs safely, economically and is easy to operate.',
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
      ['Long-term operability', 'Safe, compliant operation, designed to prevent faults and wasted energy.']
    ],
    vendorsLabel: 'We work with solutions from manufacturers including',
    vendors: ['Honeywell', 'Siemens', 'CIMON', 'ELCON', 'Schneider Electric', 'Johnson Controls', 'WAGO'],
    sectorsLabel: 'Where we have experience',
    sectors: ['Industrial facilities', 'Commercial facilities', 'Hotels', 'Community buildings', 'Educational institutions', 'Healthcare projects'],
    refsKicker: 'Projects', refsTitle: 'Selected work',
    refsNote: 'Illustrative sample projects. The projects shown are invented; the final site will list real references.',
    all: 'All', sample: 'Sample', designYear: 'Design year',
    contactKicker: 'Contact', contactTitle: 'Let\'s talk about your project',
    contactText: 'Write or call us and we will look together at which system suits your building.',
    contactPending: 'Contact details will be added when the final information arrives.',
    contactLabels: ['Address', 'Email', 'Phone'], pending: 'coming soon',
    footer: 'GAUT Ltd. Design of building automation and building management systems.', preview: 'Preview. This page is not final and is hidden from search engines.',
    themeLabel: 'Identity'
  }
};

const arrow = '<svg class="arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';

function card(ref, lang, t) {
  const tags = (ref.tags?.[lang] || []).map(x => `<li>${esc(x)}</li>`).join('');
  return `<article class="ref" data-cat="${esc(ref.category)}">
  <div class="ref-art">${buildingSvg(ref.kind)}${ref.sample ? `<span class="badge">${esc(t.sample)}</span>` : ''}</div>
  <div class="ref-body">
    <p class="ref-meta">${esc(CATEGORIES[lang][ref.category] || ref.category)} · ${esc(ref.place[lang])} · ${esc(ref.year)}</p>
    <h3>${esc(ref.title[lang])}</h3>
    <p>${esc(ref.summary[lang])}</p>
    ${tags ? `<ul class="tags">${tags}</ul>` : ''}
  </div>
</article>`;
}

export function renderSite({ lang = 'hu', theme = 'rendszer', references = sampleReferences() } = {}) {
  lang = LANGS.includes(lang) ? lang : 'hu';
  theme = parseTheme(theme);
  const t = TEXT[lang];
  const cats = [...new Set(references.map(r => r.category))];
  const home = `/${lang}`;
  const otherLang = lang === 'hu' ? 'en' : 'hu';
  return `<!doctype html>
<html lang="${t.htmlLang}" data-theme="${theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(t.title)}</title>
<meta name="description" content="${esc(t.description)}">
<link rel="alternate" hreflang="hu" href="/hu"><link rel="alternate" hreflang="en" href="/en">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/site/site.css">
<script type="module" src="/site/site.js"></script>
</head>
<body>
<a class="skip" href="#tartalom">${esc(t.skip)}</a>
<div class="preview-bar">${esc(t.preview)}</div>
<header class="top">
  <a class="brand" href="${home}" aria-label="GAUT ${esc(t.descriptor)}">
    <span class="mark-wrap">${Object.entries(LOGOS).map(([k, svg]) => `<span class="mark-${k}">${svg}</span>`).join('')}</span>
    <span class="brand-text"><span class="wordmark">GAUT</span><span class="descriptor">${esc(t.descriptor.toUpperCase())}</span></span>
  </a>
  <button class="menu-btn" type="button" aria-expanded="false" aria-controls="nav" aria-label="Menu"><span></span><span></span></button>
  <nav id="nav" class="nav" aria-label="${lang === 'hu' ? 'Főmenü' : 'Main'}">
    ${t.nav.map(([id, label]) => `<a href="#${id}">${esc(label)}</a>`).join('')}
    <a class="lang" href="/${otherLang}" data-keep-theme hreflang="${otherLang}" lang="${otherLang}" title="${esc(t.otherName)}">${esc(t.other)}</a>
  </nav>
</header>
<main id="tartalom">
<section class="hero">
  <div class="wrap hero-grid">
    <div class="hero-copy">
      ${Object.entries(t.hero).map(([k, v]) => `<h1 class="hero-title t-${k}">${esc(v)}</h1>`).join('')}
      <p class="sub">${esc(t.sub)}</p>
      <p class="lead">${esc(t.lead)}</p>
      <div class="actions"><a class="btn" href="#kapcsolat">${esc(t.cta)} ${arrow}</a><a class="btn ghost" href="#referenciak">${esc(t.cta2)}</a></div>
    </div>
    <div class="hero-art">${buildingSvg('hero', { ground: true })}</div>
  </div>
</section>

<section id="szakteruletek" class="block">
  <div class="wrap">
    <p class="kicker">${esc(t.areasKicker)}</p><h2>${esc(t.areasTitle)}</h2>
    <div class="areas">${t.areas.map(([h, p], i) => `<article class="area"><span class="num">0${i + 1}</span><h3>${esc(h)}</h3><p>${esc(p)}</p></article>`).join('')}</div>
    <p class="sectors-label">${esc(t.sectorsLabel)}</p>
    <ul class="chips">${t.sectors.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
  </div>
</section>

<section id="szemlelet" class="block alt">
  <div class="wrap split">
    <div><p class="kicker">${esc(t.approachKicker)}</p><h2>${esc(t.approachTitle)}</h2><p class="body">${esc(t.approachText)}</p>
      <p class="sectors-label">${esc(t.vendorsLabel)}</p><ul class="vendors">${t.vendors.map(v => `<li>${esc(v)}</li>`).join('')}</ul></div>
    <ol class="principles">${t.principles.map(([h, p]) => `<li><h3>${esc(h)}</h3><p>${esc(p)}</p></li>`).join('')}</ol>
  </div>
</section>

<section id="referenciak" class="block">
  <div class="wrap">
    <p class="kicker">${esc(t.refsKicker)}</p><h2>${esc(t.refsTitle)}</h2>
    <p class="note">${esc(t.refsNote)}</p>
    <div class="filters" role="group" aria-label="${esc(t.refsKicker)}">
      <button type="button" class="chip on" data-filter="*">${esc(t.all)}</button>
      ${cats.map(c => `<button type="button" class="chip" data-filter="${esc(c)}">${esc(CATEGORIES[lang][c] || c)}</button>`).join('')}
    </div>
    <div class="refs">${references.map(r => card(r, lang, t)).join('')}</div>
  </div>
</section>

<section id="kapcsolat" class="block contact">
  <div class="wrap split">
    <div><p class="kicker">${esc(t.contactKicker)}</p><h2>${esc(t.contactTitle)}</h2><p class="body">${esc(t.contactText)}</p></div>
    <div class="contact-card">
      <dl>${t.contactLabels.map(l => `<div><dt>${esc(l)}</dt><dd class="pending">${esc(t.pending)}</dd></div>`).join('')}</dl>
      <p class="note">${esc(t.contactPending)}</p>
    </div>
  </div>
</section>
</main>
<footer class="foot"><div class="wrap"><span>${esc(t.footer)}</span></div></footer>

<aside class="theme-switch" aria-label="${esc(t.themeLabel)}">
  <span>${esc(t.themeLabel)}</span>
  ${THEMES.map(k => `<button type="button" data-theme-choice="${k}" aria-pressed="${k === theme}">${esc(THEME_LABELS[k])}</button>`).join('')}
</aside>
</body>
</html>`;
}
