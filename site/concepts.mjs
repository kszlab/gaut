import { LOGOS } from './art.mjs';
import { defaultText, sampleReferences, sampleTeam, categoryLabel } from './site.mjs';
import { applyContent, isChamberUrl } from './content.mjs';

// Three genuinely different layout concepts for the public site. They are design previews (hidden from search engines),
// but they show the same content as the live site: the texts, team, references and images saved in the site editor
// (the published version, or the saved draft for a signed-in user). Where nothing has been saved yet, the real company
// description and labelled sample content are used.
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pick = (pair, lang = 'hu') => (pair?.[lang] || pair?.hu || '');

export const CONCEPTS = {
  a: { name: 'A · Szerkesztőségi tipográfia', short: 'Szöveg és tipográfia vezeti az oldalt, kép nélkül is működik. Meleg, világos, szerkesztőségi rács.', css: 'concept-a.css', logo: 'struktura', hero: 'struktura' },
  b: { name: 'B · Fotóvezérelt, modern vállalati', short: 'Teljes szélességű fotó a nyitóképen, dobozok nélküli szakaszok, nagy képfelületek a referenciáknak.', css: 'concept-b.css', logo: 'rendszer', hero: 'rendszer' },
  c: { name: 'C · Műszaki precizitás', short: 'Sötét, mérnöki hangvétel: pontos architektúra-ábra, specifikációs sorok, táblázatos referencialista.', css: 'concept-c.css', logo: 'szinkron', hero: 'szinkron' }
};

const logo = key => `<span class="logo">${LOGOS[key]}</span>`;

// Everything a concept needs, taken from the saved site content or from the samples.
function dataFor(view = {}) {
  const t = applyContent(defaultText('hu'), view.content?.hu);
  const team = view.team ?? sampleTeam();
  const references = view.references ?? sampleReferences();
  return { t, team, references, sampleRefs: references.some(r => r.sample), media: view.media ?? {}, draft: Boolean(view.draft), hasLive: Boolean(view.hasLive) };
}
const nav = (t, d) => t.nav.filter(([id]) => id !== 'csapat' || d.team.length).map(([id, label]) => `<a href="#${id}">${esc(label)}</a>`).join('');
// "A. B." into lines: sentences become separate lines; the last one can be wrapped (concept C accents it).
const headline = (text, wrapLast = s => s) => text.split(/(?<=\.)\s+/).map((s, i, all) => (i === all.length - 1 ? wrapLast(esc(s)) : esc(s))).join('<br>');
const srcset = m => m.widths.map(w => `/media/${m.id}/${w}.webp ${w}w`).join(', ');
const small = m => `/media/${m.id}/${m.widths.includes(800) ? 800 : m.widths[0]}.webp`;
function chamber(m) {
  if (!m.chamber_no && !m.chamber_url) return '';
  const link = m.chamber_url && isChamberUrl(m.chamber_url) ? m.chamber_url : '';
  return `<p class="chamber">Mérnöki kamarai névjegyzék: ${link ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(m.chamber_no || 'megnyitás')}</a>` : esc(m.chamber_no)}</p>`;
}
const portrait = (m, cls) => m.photoMedia
  ? `<img class="${cls}" src="${small(m.photoMedia)}" srcset="${srcset(m.photoMedia)}" sizes="(max-width: 960px) 50vw, 300px" width="${m.photoMedia.width}" height="${m.photoMedia.height}" alt="${esc(pick(m.name))}" loading="lazy" decoding="async">` : '';
const initial = m => esc(pick(m.name).slice(0, 1));
const refMeta = r => [categoryLabel(r.category, 'hu'), pick(r.place), r.year ? `Tervév ${r.year}` : ''].filter(Boolean).map(esc).join(' · ');
const contactValues = t => t.contactLabels.map((label, i) => {
  const key = ['address', 'email', 'phone'][i], value = t.contact[key];
  if (!value) return `<div><dt>${esc(label)}</dt><dd class="pending">${esc(t.pending)}</dd></div>`;
  const shown = key === 'email' ? `<a href="mailto:${esc(value)}">${esc(value)}</a>` : key === 'phone' ? `<a href="tel:${esc(value.replace(/[^0-9+]/g, ''))}">${esc(value)}</a>` : esc(value);
  return `<div><dt>${esc(label)}</dt><dd>${shown}</dd></div>`;
}).join('');
const sampleNote = (d, text) => (d.sampleRefs ? `<p class="note">${esc(text)}</p>` : '');

function shell(key, body, title, d) {
  const c = CONCEPTS[key];
  const source = d.draft ? 'a mentett vázlat tartalmával' : d.hasLive ? 'a közzétett tartalommal' : 'mintatartalommal';
  return `<!doctype html>
<html lang="hu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)} | GAUT koncepció ${key.toUpperCase()}</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/site/concept-base.css">
<link rel="stylesheet" href="/site/${c.css}">
</head>
<body class="c${key}">
<div class="pv"><span>Tervezési koncepció ${key.toUpperCase()}. Előnézet ${source}, még nem a végleges oldal.</span>
  <nav aria-label="Koncepciók">${Object.keys(CONCEPTS).map(k => `<a href="/koncepcio/${k}"${k === key ? ' aria-current="page"' : ''}>${k.toUpperCase()}</a>`).join('')}<a href="/koncepcio">Összehasonlítás</a><a href="/">Jelenlegi oldal</a></nav></div>
${body}
</body></html>`;
}

// ---------------------------------------------------------------- A: editorial typography
function conceptA(view) {
  const d = dataFor(view), t = d.t;
  const rows = d.references.map(r => `<li class="row"><span class="yr">${esc(r.year)}</span><span class="nm">${esc(pick(r.title))}</span><span class="ct">${esc(categoryLabel(r.category, 'hu'))}</span><span class="pl">${esc(pick(r.place))}</span></li>`).join('');
  const people = d.team.map(m => `<li>${m.photoMedia ? portrait(m, 'photo') : `<span class="mono">${initial(m)}</span>`}<div><h3>${esc(pick(m.name))}</h3><p class="role">${esc(pick(m.role))}</p><p>${esc(pick(m.bio))}</p>${chamber(m)}</div></li>`).join('');
  let n = 0;
  const num = () => String(++n).padStart(2, '0');
  return shell('a', `
<header class="top"><a class="brand" href="/koncepcio/a" aria-label="GAUT Mérnökiroda">${logo('struktura')}</a><nav class="nav">${nav(t, d)}</nav></header>
<main>
<section class="hero wrap">
  <p class="meta">Mérnökiroda <span>·</span> ${esc(t.sub)}</p>
  <h1>${headline(t.hero.struktura)}</h1>
  <div class="hero-foot"><p class="lead">${esc(t.lead)}</p><a class="cta" href="#kapcsolat">${esc(t.cta)} <span aria-hidden="true">→</span></a></div>
</section>

<section class="sec" id="szakteruletek"><div class="wrap grid">
  <h2 class="label"><span>${num()}</span>${esc(t.areasTitle)}</h2>
  <ol class="services">${t.areas.map(([h, p], i) => `<li><span class="num">0${i + 1}</span><h3>${esc(h)}</h3><p>${esc(p)}</p></li>`).join('')}</ol>
</div></section>

<section class="sec alt" id="szemlelet"><div class="wrap grid">
  <h2 class="label"><span>${num()}</span>${esc(t.approachKicker)}</h2>
  <div><p class="statement">${esc(t.approachText)}</p>
    <ul class="principles">${t.principles.map(([h, p]) => `<li><h3>${esc(h)}</h3><p>${esc(p)}</p></li>`).join('')}</ul>
    <p class="vendors"><span>${esc(t.vendorsLabel)}</span> ${t.vendors.map(esc).join(' · ')}</p></div>
</div></section>

<section class="sec" id="referenciak"><div class="wrap grid">
  <h2 class="label"><span>${num()}</span>${esc(t.refsKicker)}</h2>
  <div><ul class="index">${rows}</ul>${sampleNote(d, 'Mintaprojektek a megjelenés bemutatására. A végleges listát a referenciatár adja, tervévvel, mert a tervév nem átadási év.')}</div>
</div></section>
${d.team.length ? `
<section class="sec alt" id="csapat"><div class="wrap grid">
  <h2 class="label"><span>${num()}</span>${esc(t.teamKicker)}</h2>
  <ul class="people">${people}</ul>
</div></section>` : ''}

<section class="sec contact" id="kapcsolat"><div class="wrap grid">
  <h2 class="label"><span>${num()}</span>${esc(t.contactKicker)}</h2>
  <div><p class="big">${esc(t.contactTitle)}.</p><p class="lead">${esc(t.contactText)}</p>
    <dl class="facts">${contactValues(t)}</dl></div>
</div></section>
</main>
<footer class="foot wrap"><span>GAUT Kft.</span><span>${esc(t.sub)}</span></footer>`, 'Szerkesztőségi tipográfia', d);
}

// ---------------------------------------------------------------- B: photo-led modern corporate
function conceptB(view) {
  const d = dataFor(view), t = d.t;
  const hero = d.media['hero.rendszer'];
  const heroImg = hero
    ? `<img src="/media/${hero.id}/${hero.widths.includes(1600) ? 1600 : hero.widths.at(-1)}.webp" srcset="${srcset(hero)}" sizes="100vw" alt="${esc(hero.alt?.hu || '')}" width="${hero.width}" height="${hero.height}" fetchpriority="high">`
    : '<img src="/site/img/hero-2.webp" alt="" width="2400" height="1600" fetchpriority="high">';
  const tiles = d.references.slice(0, 9).map(r => {
    const cm = r.coverMedia;
    const art = cm ? `<img src="${small(cm)}" srcset="${srcset(cm)}" sizes="(max-width: 960px) 100vw, 380px" width="${cm.width}" height="${cm.height}" alt="${esc(pick(r.title))}" loading="lazy" decoding="async">` : '<div class="ph" role="img" aria-label="Fotó helye"><span>Fotó helye</span></div>';
    const summary = pick(r.summary);
    return `<article class="tile">${art}<p class="m">${refMeta(r)}</p><h3>${esc(pick(r.title))}</h3>${summary ? `<p>${esc(summary)}</p>` : ''}</article>`;
  }).join('');
  const people = d.team.map(m => `<article class="person">${m.photoMedia ? portrait(m, 'photo') : '<div class="ph sq" role="img" aria-label="Fotó helye"><span>Fotó helye</span></div>'}<h3>${esc(pick(m.name))}</h3><p class="role">${esc(pick(m.role))}</p>${chamber(m)}</article>`).join('');
  return shell('b', `
<main>
<section class="hero">
  <header class="top"><a class="brand" href="/koncepcio/b" aria-label="GAUT Mérnökiroda">${logo('rendszer')}</a><nav class="nav">${nav(t, d)}</nav></header>
  ${heroImg}
  <div class="veil"></div>
  <div class="hero-copy wrap"><p class="kick">GAUT Mérnökiroda</p><h1>${headline(t.hero.rendszer)}</h1><p class="sub">${esc(t.sub)}</p><a class="btn" href="#kapcsolat">${esc(t.cta)} <span aria-hidden="true">→</span></a></div>
  ${hero ? '' : '<p class="credit">A kép illusztráció, valódi projektfotóra cserélendő.</p>'}
</section>

<section class="intro wrap"><p class="big">${esc(t.lead)}</p></section>

<section class="services wrap" id="szakteruletek">
  <h2 class="kick">${esc(t.areasTitle)}</h2>
  <div class="cols">${t.areas.map(([h, p], i) => `<article><span class="n">0${i + 1}</span><h3>${esc(h)}</h3><p>${esc(p)}</p></article>`).join('')}</div>
  <p class="sectors">${esc(t.sectorsLabel)}: ${t.sectors.map(esc).join(', ')}.</p>
</section>

<section class="split" id="szemlelet">
  <div class="ph tall" role="img" aria-label="Fotó helye"><span>Fotó helye · vezérlőszekrény</span></div>
  <div class="split-copy"><h2 class="kick">${esc(t.approachKicker)}</h2><p class="big sm">${esc(t.approachTitle)}</p><p>${esc(t.approachText)}</p>
    <ul class="principles">${t.principles.map(([h, p]) => `<li><h3>${esc(h)}</h3><p>${esc(p)}</p></li>`).join('')}</ul></div>
</section>

<section class="refs wrap" id="referenciak">
  <h2 class="kick">${esc(t.refsKicker)}</h2><p class="big sm">${esc(t.refsTitle)}</p>
  <div class="grid">${tiles}</div>
  ${sampleNote(d, 'Mintaprojektek a megjelenés bemutatására; a végleges oldalon valódi referenciák és projektfotók szerepelnek.')}
</section>
${d.team.length ? `
<section class="team wrap" id="csapat"><h2 class="kick">${esc(t.teamKicker)}</h2><p class="big sm">${esc(t.teamTitle)}</p><div class="people">${people}</div></section>` : ''}

<section class="contact" id="kapcsolat"><div class="wrap">
  <h2 class="kick">${esc(t.contactKicker)}</h2><p class="big">${esc(t.contactTitle)}</p><p class="sub">${esc(t.contactText)}</p>
  <dl>${contactValues(t)}</dl></div></section>
</main>
<footer class="foot wrap"><span>GAUT Kft.</span><span>${esc(t.sub)}</span></footer>`, 'Fotóvezérelt, modern vállalati', d);
}

// ---------------------------------------------------------------- C: technical precision
// The diagram only uses terms from the company's own description: supervision, automation, field elements, DDC and PLC,
// control cabinets, ventilation, heating, cooling, fire protection, smoke and heat exhaust. It claims no products or numbers.
function diagram() {
  const box = (x, y, w, h, label, cls = 'node') => `<g class="${cls}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/><text x="${x + w / 2}" y="${y + h / 2 + 4}" text-anchor="middle">${esc(label)}</text></g>`;
  const field = ['Légtechnika', 'Fűtés, hűtés', 'Hő- és füstelvezetés', 'Tűzvédelem'];
  const fx = i => 62 + i * 138;
  return `<svg class="diagram" viewBox="0 0 640 540" role="img" aria-labelledby="dg-t dg-d" xmlns="http://www.w3.org/2000/svg">
<title id="dg-t">Épületautomatika három szinten</title>
<desc id="dg-d">A terepi automatikaelemektől a vezérlőszekrényeken és DDC/PLC-készülékeken át az épületfelügyeleti rendszerig.</desc>
<g class="layer"><rect x="24" y="24" width="592" height="130"/><text class="tag" x="40" y="46">03 · FELÜGYELET</text></g>
${box(60, 66, 520, 66, 'Épületfelügyeleti rendszer · központi áttekintés és beavatkozás', 'node strong')}
<g class="layer"><rect x="24" y="206" width="592" height="130"/><text class="tag" x="40" y="228">02 · AUTOMATIKA</text></g>
${box(60, 248, 160, 66, 'DDC / PLC')}${box(240, 248, 160, 66, 'Vezérlőszekrény')}${box(420, 248, 160, 66, 'Szabályozás')}
<g class="layer"><rect x="24" y="388" width="592" height="128"/><text class="tag" x="40" y="508">01 · TEREPI AUTOMATIKAELEMEK</text></g>
${field.map((l, i) => box(fx(i), 430, 126, 62, l)).join('')}
<g class="wire"><path d="M320 132 V206"/><path d="M140 314 V348 H125 V430"/><path d="M320 314 V348 H263 V430"/><path d="M500 314 V348 H401 V430"/><path d="M500 348 H539 V430"/></g>
<g class="wire hot"><path d="M320 132 V206"/><path d="M320 314 V348 H263 V430"/></g>
<g class="pin"><rect x="316" y="166" width="8" height="8"/><rect x="316" y="320" width="8" height="8"/><rect x="259" y="396" width="8" height="8"/></g>
</svg>`;
}
function conceptC(view) {
  const d = dataFor(view), t = d.t;
  const rows = d.references.map((r, i) => `<tr><td class="id">R-${String(i + 1).padStart(2, '0')}</td><td class="nm">${esc(pick(r.title))}</td><td>${esc(categoryLabel(r.category, 'hu'))}</td><td>${esc(pick(r.place))}</td><td class="yr">${esc(r.year)}</td></tr>`).join('');
  const people = d.team.map(m => `<article>${m.photoMedia ? portrait(m, 'photo') : `<span class="mono">${initial(m)}</span>`}<h3>${esc(pick(m.name))}</h3><p class="role">${esc(pick(m.role))}</p>${chamber(m)}</article>`).join('');
  let n = 0;
  const code = () => `0${++n}`;
  return shell('c', `
<header class="top"><a class="brand" href="/koncepcio/c" aria-label="GAUT Mérnökiroda">${logo('szinkron')}</a><nav class="nav">${t.nav.filter(([id]) => id !== 'csapat' || d.team.length).map(([id, label], i) => `<a href="#${id}"><span>0${i + 1}</span> ${esc(label)}</a>`).join('')}</nav></header>
<main>
<section class="hero wrap">
  <div class="hero-copy"><p class="tag">${esc(t.sub)}</p><h1>${headline(t.hero.szinkron, s => `<em>${s}</em>`)}</h1><p class="lead">${esc(t.lead)}</p><a class="btn" href="#kapcsolat">${esc(t.cta)} <span aria-hidden="true">→</span></a></div>
  <div class="hero-fig">${diagram()}<p class="figcap">Ábra: az épületautomatika három szintje</p></div>
</section>

<section class="sec wrap" id="szakteruletek"><h2 class="tag">${code()} · ${esc(t.areasTitle)}</h2>
  <ul class="spec">${t.areas.map(([h, p], i) => `<li><span class="code">A-0${i + 1}</span><h3>${esc(h)}</h3><p>${esc(p)}</p></li>`).join('')}</ul>
  <p class="sectors"><span class="tag">${esc(t.sectorsLabel)}</span> ${t.sectors.map(esc).join(' / ')}</p>
</section>

<section class="sec wrap two" id="szemlelet"><div><h2 class="tag">${code()} · ${esc(t.approachKicker)}</h2><p class="big">${esc(t.approachTitle)}</p><p>${esc(t.approachText)}</p>
    <p class="vendors"><span class="tag">${esc(t.vendorsLabel)}</span> ${t.vendors.map(esc).join(' · ')}</p></div>
  <ol class="principles">${t.principles.map(([h, p], i) => `<li><span class="code">P-0${i + 1}</span><h3>${esc(h)}</h3><p>${esc(p)}</p></li>`).join('')}</ol></section>

<section class="sec wrap" id="referenciak"><h2 class="tag">${code()} · ${esc(t.refsKicker)}</h2>
  <div class="table-wrap"><table><caption class="sr">${d.sampleRefs ? 'Mintaprojektek' : 'Referenciák'}</caption><thead><tr><th scope="col">Azonosító</th><th scope="col">Projekt</th><th scope="col">Terület</th><th scope="col">Hely</th><th scope="col">Tervév</th></tr></thead><tbody>${rows}</tbody></table></div>
  ${sampleNote(d, 'Mintaprojektek a megjelenés bemutatására. A végleges lista a referenciatárból készül; a tervév nem átadási év.')}</section>
${d.team.length ? `
<section class="sec wrap" id="csapat"><h2 class="tag">${code()} · ${esc(t.teamKicker)}</h2><div class="people">${people}</div></section>` : ''}

<section class="sec wrap contact" id="kapcsolat"><h2 class="tag">${code()} · ${esc(t.contactKicker)}</h2><p class="big">${esc(t.contactTitle)}</p><p class="lead">${esc(t.contactText)}</p>
  <dl>${contactValues(t).replace(/<dt>/g, '<dt class="tag">')}</dl></section>
</main>
<footer class="foot wrap"><span>GAUT Kft.</span><span>${esc(t.sub)}</span></footer>`, 'Műszaki precizitás', d);
}

export const renderConcept = (key, view = {}) => ({ a: conceptA, b: conceptB, c: conceptC })[key]?.(view) ?? null;

export function renderConceptIndex() {
  return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>GAUT tervezési koncepciók</title><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/site/concept-base.css"><link rel="stylesheet" href="/site/concept-index.css"></head>
<body class="cindex"><main class="wrap"><p class="kick">GAUT Mérnökiroda · tervezési koncepciók</p><h1>Három elrendezés, három hangvétel.</h1>
<p class="lead">Ugyanaz a tartalom, háromféle szerkezet. A szövegek, a csapat, a referenciák és a képek a honlap-szerkesztőből jönnek: a közzétett változatot látod, belépve a mentett vázlatot is megnézheted (<code>?elonezet=1</code>). Nem színváltozatok: a rács, a képhasználat és a tartalom megjelenítése is különbözik. Válassz irányt, vagy jelöld meg, mit vennél át az egyikből.</p>
<div class="cards">${Object.entries(CONCEPTS).map(([k, c]) => `<a class="card" href="/koncepcio/${k}"><span class="k">${k.toUpperCase()}</span><h2>${esc(c.name.slice(4))}</h2><p>${esc(c.short)}</p><span class="go">Megnyitás →</span></a>`).join('')}</div>
<p class="foot">A koncepciók előnézetek, a keresők elől rejtve. A jelenlegi oldal: <a href="/">gyökércím</a>.</p></main></body></html>`;
}
