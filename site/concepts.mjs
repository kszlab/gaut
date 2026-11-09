import { LOGOS } from './art.mjs';
import { defaultText, sampleReferences, sampleTeam } from './site.mjs';

// Three genuinely different layout concepts for the public site, rendered with the real company copy and the
// sample references and team. They are design previews (hidden from search engines), not the live site.
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CATEGORY = { office: 'Iroda', industry: 'Ipar és logisztika', education: 'Oktatás', hotel: 'Szálloda', health: 'Egészségügy', community: 'Közösségi épület' };

export const CONCEPTS = {
  a: { name: 'A · Szerkesztőségi tipográfia', short: 'Szöveg és tipográfia vezeti az oldalt, kép nélkül is működik. Meleg, világos, szerkesztőségi rács.', css: 'concept-a.css', logo: 'struktura' },
  b: { name: 'B · Fotóvezérelt, modern vállalati', short: 'Teljes szélességű fotó a nyitóképen, dobozok nélküli szakaszok, nagy képfelületek a referenciáknak.', css: 'concept-b.css', logo: 'rendszer' },
  c: { name: 'C · Műszaki precizitás', short: 'Sötét, mérnöki hangvétel: pontos architektúra-ábra, specifikációs sorok, táblázatos referencialista.', css: 'concept-c.css', logo: 'szinkron' }
};

const logo = key => `<span class="logo">${LOGOS[key]}</span>`;
const nav = t => t.nav.map(([id, label]) => `<a href="#${id}">${esc(label)}</a>`).join('');
const refs = () => sampleReferences();
const team = () => sampleTeam();

function shell(key, body, title) {
  const c = CONCEPTS[key];
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
<div class="pv"><span>Tervezési koncepció ${key.toUpperCase()}. Előnézet mintatartalommal, még nem a végleges oldal.</span>
  <nav aria-label="Koncepciók">${Object.entries(CONCEPTS).map(([k, v]) => `<a href="/koncepcio/${k}"${k === key ? ' aria-current="page"' : ''}>${k.toUpperCase()}</a>`).join('')}<a href="/koncepcio">Összehasonlítás</a><a href="/">Jelenlegi oldal</a></nav></div>
${body}
</body></html>`;
}

// ---------------------------------------------------------------- A: editorial typography
function conceptA() {
  const t = defaultText('hu');
  const rows = refs().map(r => `<li class="row"><span class="yr">${esc(r.year)}</span><span class="nm">${esc(r.title.hu)}</span><span class="ct">${esc(CATEGORY[r.category] || r.category)}</span><span class="pl">${esc(r.place.hu)}</span></li>`).join('');
  const people = team().map(m => `<li><span class="mono">${esc(m.name.hu.slice(0, 1))}</span><div><h3>${esc(m.name.hu)}</h3><p class="role">${esc(m.role.hu)}</p><p>${esc(m.bio.hu)}</p></div></li>`).join('');
  return shell('a', `
<header class="top"><a class="brand" href="/koncepcio/a" aria-label="GAUT Mérnökiroda">${logo('struktura')}</a><nav class="nav">${nav(t)}</nav></header>
<main>
<section class="hero wrap">
  <p class="meta">Mérnökiroda <span>·</span> ${esc(t.sub)}</p>
  <h1>Átgondolt tervezés.<br>Biztos működés.</h1>
  <div class="hero-foot"><p class="lead">${esc(t.lead)}</p><a class="cta" href="#kapcsolat">Beszéljük meg a projektet <span aria-hidden="true">→</span></a></div>
</section>

<section class="sec" id="szakteruletek"><div class="wrap grid">
  <h2 class="label"><span>01</span>${esc(t.areasTitle)}</h2>
  <ol class="services">${t.areas.map(([h, p], i) => `<li><span class="num">0${i + 1}</span><h3>${esc(h)}</h3><p>${esc(p)}</p></li>`).join('')}</ol>
</div></section>

<section class="sec alt" id="szemlelet"><div class="wrap grid">
  <h2 class="label"><span>02</span>${esc(t.approachKicker)}</h2>
  <div><p class="statement">${esc(t.approachText)}</p>
    <ul class="principles">${t.principles.map(([h, p]) => `<li><h3>${esc(h)}</h3><p>${esc(p)}</p></li>`).join('')}</ul>
    <p class="vendors"><span>${esc(t.vendorsLabel)}</span> ${t.vendors.map(esc).join(' · ')}</p></div>
</div></section>

<section class="sec" id="referenciak"><div class="wrap grid">
  <h2 class="label"><span>03</span>${esc(t.refsKicker)}</h2>
  <div><ul class="index">${rows}</ul><p class="note">Mintaprojektek a megjelenés bemutatására. A végleges listát a referenciatár adja, tervévvel, mert a tervév nem átadási év.</p></div>
</div></section>

<section class="sec alt" id="csapat"><div class="wrap grid">
  <h2 class="label"><span>04</span>${esc(t.teamKicker)}</h2>
  <ul class="people">${people}</ul>
</div></section>

<section class="sec contact" id="kapcsolat"><div class="wrap grid">
  <h2 class="label"><span>05</span>${esc(t.contactKicker)}</h2>
  <div><p class="big">${esc(t.contactTitle)}.</p><p class="lead">${esc(t.contactText)}</p>
    <dl class="facts">${t.contactLabels.map(l => `<div><dt>${esc(l)}</dt><dd>${esc(t.pending)}</dd></div>`).join('')}</dl></div>
</div></section>
</main>
<footer class="foot wrap"><span>GAUT Kft.</span><span>${esc(t.sub)}</span></footer>`, 'Szerkesztőségi tipográfia');
}

// ---------------------------------------------------------------- B: photo-led modern corporate
function conceptB() {
  const t = defaultText('hu');
  const tiles = refs().slice(0, 6).map(r => `<article class="tile"><div class="ph" role="img" aria-label="Fotó helye"><span>Fotó helye</span></div><p class="m">${esc(CATEGORY[r.category] || r.category)} · ${esc(r.place.hu)} · Tervév ${esc(r.year)}</p><h3>${esc(r.title.hu)}</h3><p>${esc(r.summary.hu)}</p></article>`).join('');
  const people = team().map(m => `<article class="person"><div class="ph sq" role="img" aria-label="Fotó helye"><span>Fotó helye</span></div><h3>${esc(m.name.hu)}</h3><p class="role">${esc(m.role.hu)}</p></article>`).join('');
  return shell('b', `
<main>
<section class="hero">
  <header class="top"><a class="brand" href="/koncepcio/b" aria-label="GAUT Mérnökiroda">${logo('rendszer')}</a><nav class="nav">${nav(t)}</nav></header>
  <img src="/site/img/hero-2.webp" alt="" width="2400" height="1600" fetchpriority="high">
  <div class="veil"></div>
  <div class="hero-copy wrap"><p class="kick">GAUT Mérnökiroda</p><h1>Összehangolt<br>rendszerek.</h1><p class="sub">${esc(t.sub)}</p><a class="btn" href="#kapcsolat">Kapcsolat <span aria-hidden="true">→</span></a></div>
  <p class="credit">A kép illusztráció, valódi projektfotóra cserélendő.</p>
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
  <p class="note">Mintaprojektek a megjelenés bemutatására; a végleges oldalon valódi referenciák és projektfotók szerepelnek.</p>
</section>

<section class="team wrap" id="csapat"><h2 class="kick">${esc(t.teamKicker)}</h2><p class="big sm">${esc(t.teamTitle)}</p><div class="people">${people}</div></section>

<section class="contact" id="kapcsolat"><div class="wrap">
  <h2 class="kick">${esc(t.contactKicker)}</h2><p class="big">${esc(t.contactTitle)}</p><p class="sub">${esc(t.contactText)}</p>
  <dl>${t.contactLabels.map(l => `<div><dt>${esc(l)}</dt><dd>${esc(t.pending)}</dd></div>`).join('')}</dl></div></section>
</main>
<footer class="foot wrap"><span>GAUT Kft.</span><span>${esc(t.sub)}</span></footer>`, 'Fotóvezérelt, modern vállalati');
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
function conceptC() {
  const t = defaultText('hu');
  const rows = refs().map((r, i) => `<tr><td class="id">R-${String(i + 1).padStart(2, '0')}</td><td class="nm">${esc(r.title.hu)}</td><td>${esc(CATEGORY[r.category] || r.category)}</td><td>${esc(r.place.hu)}</td><td class="yr">${esc(r.year)}</td></tr>`).join('');
  const people = team().map(m => `<article><span class="mono">${esc(m.name.hu.slice(0, 1))}</span><h3>${esc(m.name.hu)}</h3><p class="role">${esc(m.role.hu)}</p></article>`).join('');
  return shell('c', `
<header class="top"><a class="brand" href="/koncepcio/c" aria-label="GAUT Mérnökiroda">${logo('szinkron')}</a><nav class="nav">${t.nav.map(([id, label], i) => `<a href="#${id}"><span>0${i + 1}</span> ${esc(label)}</a>`).join('')}</nav></header>
<main>
<section class="hero wrap">
  <div class="hero-copy"><p class="tag">${esc(t.sub)}</p><h1>Intelligens épületek.<br><em>Összhangban.</em></h1><p class="lead">${esc(t.lead)}</p><a class="btn" href="#kapcsolat">Kapcsolat <span aria-hidden="true">→</span></a></div>
  <div class="hero-fig">${diagram()}<p class="figcap">Ábra: az épületautomatika három szintje</p></div>
</section>

<section class="sec wrap" id="szakteruletek"><h2 class="tag">01 · ${esc(t.areasTitle)}</h2>
  <ul class="spec">${t.areas.map(([h, p], i) => `<li><span class="code">A-0${i + 1}</span><h3>${esc(h)}</h3><p>${esc(p)}</p></li>`).join('')}</ul>
  <p class="sectors"><span class="tag">${esc(t.sectorsLabel)}</span> ${t.sectors.map(esc).join(' / ')}</p>
</section>

<section class="sec wrap two" id="szemlelet"><div><h2 class="tag">02 · ${esc(t.approachKicker)}</h2><p class="big">${esc(t.approachTitle)}</p><p>${esc(t.approachText)}</p>
    <p class="vendors"><span class="tag">${esc(t.vendorsLabel)}</span> ${t.vendors.map(esc).join(' · ')}</p></div>
  <ol class="principles">${t.principles.map(([h, p], i) => `<li><span class="code">P-0${i + 1}</span><h3>${esc(h)}</h3><p>${esc(p)}</p></li>`).join('')}</ol></section>

<section class="sec wrap" id="referenciak"><h2 class="tag">03 · ${esc(t.refsKicker)}</h2>
  <div class="table-wrap"><table><caption class="sr">Mintaprojektek</caption><thead><tr><th scope="col">Azonosító</th><th scope="col">Projekt</th><th scope="col">Terület</th><th scope="col">Hely</th><th scope="col">Tervév</th></tr></thead><tbody>${rows}</tbody></table></div>
  <p class="note">Mintaprojektek a megjelenés bemutatására. A végleges lista a referenciatárból készül; a tervév nem átadási év.</p></section>

<section class="sec wrap" id="csapat"><h2 class="tag">04 · ${esc(t.teamKicker)}</h2><div class="people">${people}</div></section>

<section class="sec wrap contact" id="kapcsolat"><h2 class="tag">05 · ${esc(t.contactKicker)}</h2><p class="big">${esc(t.contactTitle)}</p><p class="lead">${esc(t.contactText)}</p>
  <dl>${t.contactLabels.map(l => `<div><dt class="tag">${esc(l)}</dt><dd>${esc(t.pending)}</dd></div>`).join('')}</dl></section>
</main>
<footer class="foot wrap"><span>GAUT Kft.</span><span>${esc(t.sub)}</span></footer>`, 'Műszaki precizitás');
}

export const renderConcept = key => ({ a: conceptA, b: conceptB, c: conceptC })[key]?.() ?? null;

export function renderConceptIndex() {
  return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>GAUT tervezési koncepciók</title><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/site/concept-base.css"><link rel="stylesheet" href="/site/concept-index.css"></head>
<body class="cindex"><main class="wrap"><p class="kick">GAUT Mérnökiroda · tervezési koncepciók</p><h1>Három elrendezés, három hangvétel.</h1>
<p class="lead">Ugyanaz a valódi cégleírás és ugyanazok a mintaadatok, de háromféle szerkezet. Nem színváltozatok: a rács, a képhasználat és a tartalom megjelenítése is különbözik. Válassz irányt, vagy jelöld meg, mit vennél át az egyikből.</p>
<div class="cards">${Object.entries(CONCEPTS).map(([k, c]) => `<a class="card" href="/koncepcio/${k}"><span class="k">${k.toUpperCase()}</span><h2>${esc(c.name.slice(4))}</h2><p>${esc(c.short)}</p><span class="go">Megnyitás →</span></a>`).join('')}</div>
<p class="foot">A koncepciók előnézetek, mintatartalommal, a keresők elől rejtve. A jelenlegi oldal: <a href="/">gyökércím</a>.</p></main></body></html>`;
}
