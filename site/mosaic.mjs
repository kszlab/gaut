import { buildingSvg } from './art.mjs';

// Reference mosaic: a grid of image tiles of different sizes (featured references are double-size tiles), a category
// filter and a detail dialog. Used by the public site and by design concept B; the behaviour is in public/site/mosaic.js.
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pick = (pair, lang) => (pair?.[lang] || pair?.hu || '');

const imgTag = (m, alt, sizes, eager = false) =>
  `<img src="/media/${m.id}/${m.widths.includes(800) ? 800 : m.widths[0]}.webp" srcset="${m.widths.map(w => `/media/${m.id}/${w}.webp ${w}w`).join(', ')}" sizes="${sizes}" width="${m.width}" height="${m.height}" alt="${esc(alt)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async">`;

// labels: { all, close, prev, next, sample, designYear, open }
// helpers: { categoryLabel(category) }
export function renderMosaic(references, { lang = 'hu', labels, categoryLabel, categories = [] }) {
  const cats = [...new Set(references.map(r => r.category))].filter(Boolean);
  const tiles = references.map((r, i) => {
    const title = pick(r.title, lang), summary = pick(r.summary, lang), place = pick(r.place, lang);
    const meta = [categoryLabel(r.category), place, r.year ? `${labels.designYear} ${r.year}` : ''].filter(Boolean).map(esc).join(' · ');
    const cm = r.coverMedia, big = r.featured === true;
    const face = cm
      ? imgTag(cm, title, big ? '(max-width: 640px) 100vw, (max-width: 1040px) 100vw, 800px' : '(max-width: 640px) 100vw, (max-width: 1040px) 50vw, 400px')
      : r.sample ? `<span class="mt-art">${buildingSvg(r.kind)}</span>` : `<span class="mt-type"><span>${esc(title)}</span></span>`;
    const detailImg = cm ? imgTag(cm, title, '(max-width: 900px) 100vw, 900px') : r.sample ? `<span class="mt-art">${buildingSvg(r.kind)}</span>` : '';
    return `<article class="mt${big ? ' big' : ''}${cm ? '' : ' nophoto'}" data-cat="${esc(r.category)}" data-main="${esc(r.categoryApproved ? r.categoryMainId : '')}" data-sub="${esc(r.categoryApproved ? r.categorySubId : '')}" data-index="${i}">
  <button class="mt-open" type="button" aria-haspopup="dialog" aria-label="${esc(labels.open)}: ${esc(title)}">
    <span class="mt-face">${face}${r.sample ? `<span class="badge">${esc(labels.sample)}</span>` : ''}</span>
    <span class="mt-cap"><strong>${esc(title)}</strong><small>${meta}</small></span>
  </button>
  <template class="mt-detail">${detailImg ? `<figure class="md-fig">${detailImg}</figure>` : ''}<div class="md-body"><p class="md-meta">${meta}</p><h3>${esc(title)}</h3>${summary ? `<p>${esc(summary)}</p>` : ''}</div></template>
</article>`;
  }).join('');
  // Only expose taxonomy nodes that have at least one publicly approved reference.
  const approvedCounts = new Map();
  for (const r of references) {
    if (!r.categoryApproved || !r.categoryMainId || !r.categorySubId) continue;
    const key = r.categoryMainId + ':' + r.categorySubId;
    approvedCounts.set(key, (approvedCounts.get(key) || 0) + 1);
  }
  const visibleCategories = categories.map(g => ({
    ...g,
    categories: (g.categories || []).filter(sub => approvedCounts.has(g.id + ':' + sub.id))
  })).filter(g => g.categories.length > 0);
  const hasTree = visibleCategories.length > 0;
  const chips = hasTree
    ? `<div class="category-filter" data-category-filter>
      <div class="filters main-filters" role="group" aria-label="${esc(labels.filter)}">
        <button type="button" class="chip on" data-main-filter="*">${esc(labels.all)}</button>
        ${visibleCategories.map(g => `<button type="button" class="chip" data-main-filter="${esc(g.id)}">${esc(g.name)}</button>`).join('')}
      </div>
      <div class="filters sub-filters" role="group" aria-label="${esc(labels.subcategories)}" hidden></div>
    </div>`
    : cats.length > 1
      ? `<div class="filters" role="group" aria-label="${esc(labels.filter)}"><button type="button" class="chip on" data-filter="*">${esc(labels.all)}</button>${cats.map(c => `<button type="button" class="chip" data-filter="${esc(c)}">${esc(categoryLabel(c))}</button>`).join('')}</div>`
      : '';
  const categoryData = hasTree ? `<script type="application/json" class="category-tree-data">${JSON.stringify(visibleCategories.map(g=>({id:g.id,name:g.name,categories:(g.categories||[]).map(c=>({id:c.id,name:c.name}))}))).replace(/</g,'\\u003c')}</script>` : '';
  return `${categoryData}${chips}
<div class="mosaic" data-total="${references.length}">${tiles}</div>
<dialog class="mosaic-dialog" aria-label="${esc(labels.detail)}"><div class="md-nav"><button type="button" data-md="prev" aria-label="${esc(labels.prev)}">←</button><button type="button" data-md="next" aria-label="${esc(labels.next)}">→</button><button type="button" data-md="close" aria-label="${esc(labels.close)}">×</button></div><div class="md-content"></div></dialog>`;
}
