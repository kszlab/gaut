import { buildingSvg } from './art.mjs';

// Reference mosaic: a grid of image tiles of different sizes (featured references are double-size tiles), a category
// filter and a detail dialog. The behaviour is in public/site/mosaic.js.
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pick = (pair, lang) => (pair?.[lang] || pair?.hu || '');

const imgTag = (m, alt, sizes, eager = false) =>
  `<img src="/media/${m.id}/${m.widths.includes(800) ? 800 : m.widths[0]}.webp" srcset="${m.widths.map(w => `/media/${m.id}/${w}.webp ${w}w`).join(', ')}" sizes="${sizes}" width="${m.width}" height="${m.height}" alt="${esc(alt)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async">`;

// labels: { all, close, prev, next, sample, designYear, open }
// helpers: { categoryLabel(reference) }; categories: the flat category list, in display order
// filter: false leaves the category chips out (home page selection). chipHref(id): the chips become links to an address that
// carries the category (references subpage); then `all` is the unfiltered list the chips are built from and `active` the chosen id.
export function renderMosaic(references, { lang = 'hu', labels, categoryLabel, categories = [], filter = true, chipHref = null, all = references, active = '' }) {
  const tiles = references.map((r, i) => {
    const title = pick(r.title, lang), summary = pick(r.summary, lang), place = pick(r.place, lang);
    const meta = [categoryLabel(r), place, r.year ? `${labels.designYear} ${r.year}` : ''].filter(Boolean).map(esc).join(' · ');
    const cm = r.coverMedia;
    const face = cm
      ? imgTag(cm, title, '(max-width: 640px) 100vw, (max-width: 1040px) 50vw, 400px')
      : r.sample ? `<span class="mt-art">${buildingSvg(r.kind)}</span>` : `<span class="mt-type"><span>${esc(title)}</span></span>`;
    const detailImg = cm ? imgTag(cm, title, '(max-width: 900px) 100vw, 900px') : r.sample ? `<span class="mt-art">${buildingSvg(r.kind)}</span>` : '';
    return `<article class="mt${cm ? '' : ' nophoto'}" data-cat="${esc(r.categoryId || r.category || '')}" data-index="${i}">
  <button class="mt-open" type="button" aria-haspopup="dialog" aria-label="${esc(labels.open)}: ${esc(title)}">
    <span class="mt-face">${face}${r.sample ? `<span class="badge">${esc(labels.sample)}</span>` : ''}</span>
    <span class="mt-cap"><strong>${esc(title)}</strong><small>${meta}</small></span>
  </button>
  <template class="mt-detail">${detailImg ? `<figure class="md-fig">${detailImg}</figure>` : ''}<div class="md-body"><p class="md-meta">${meta}</p><h3>${esc(title)}</h3>${summary ? `<p>${esc(summary)}</p>` : ''}</div></template>
</article>`;
  }).join('');
  // One chip per category that has at least one reference on the page, in the order of the category list.
  // References without a category from the list (older data, samples) are grouped by their own label after those.
  const used = new Set(all.map(r => r.categoryId || r.category).filter(Boolean));
  const listed = categories.filter(c => used.has(c.id)).map(c => ({ key: c.id, label: categoryLabel({ categoryId: c.id }) }));
  const known = new Set(categories.map(c => c.id));
  const other = chipHref ? [] : [...new Set(all.filter(r => !known.has(r.categoryId) && r.category).map(r => r.category))].map(c => ({ key: c, label: categoryLabel({ category: c }) }));
  const cats = [...listed, ...other];
  const link = (key, label) => `<a class="chip${key === active ? ' on' : ''}" href="${esc(chipHref(key))}"${key === active ? ' aria-current="true"' : ''}>${esc(label)}</a>`;
  const chips = !filter || cats.length < 2 ? '' : chipHref
    ? `<nav class="filters" aria-label="${esc(labels.filter)}">${link('', labels.all)}${cats.map(c => link(c.key, c.label)).join('')}</nav>`
    : cats.length > 1
    ? `<div class="filters" role="group" aria-label="${esc(labels.filter)}"><button type="button" class="chip on" data-filter="*">${esc(labels.all)}</button>${cats.map(c => `<button type="button" class="chip" data-filter="${esc(c.key)}">${esc(c.label)}</button>`).join('')}</div>`
    : '';
  return `${chips}
<div class="mosaic" data-total="${references.length}">${tiles}</div>
<dialog class="mosaic-dialog" aria-label="${esc(labels.detail)}"><div class="md-nav"><button type="button" data-md="prev" aria-label="${esc(labels.prev)}">←</button><button type="button" data-md="next" aria-label="${esc(labels.next)}">→</button><button type="button" data-md="close" aria-label="${esc(labels.close)}">×</button></div><div class="md-content"></div></dialog>`;
}
