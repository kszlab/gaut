// Theme switcher, reference filter and mobile menu for the public site preview.
const THEMES = ['rendszer', 'struktura', 'szinkron'];
const root = document.documentElement;
const fromQuery = new URLSearchParams(location.search).get('tema');
const alias = { 1: 'rendszer', 2: 'struktura', 3: 'szinkron' };
let saved = null;
try { saved = localStorage.getItem('gaut-theme'); } catch { /* storage may be blocked */ }
const initial = THEMES.includes(fromQuery) ? fromQuery : alias[fromQuery] || (THEMES.includes(saved) ? saved : root.dataset.theme);

function setTheme(name, persist) {
  root.dataset.theme = name;
  document.querySelectorAll('[data-theme-choice]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.themeChoice === name)));
  document.querySelectorAll('a[data-keep-theme]').forEach(a => { a.href = `${a.pathname}?tema=${name}`; });
  if (persist) {
    try { localStorage.setItem('gaut-theme', name); } catch { /* ignore */ }
    const url = new URL(location.href); url.searchParams.set('tema', name); history.replaceState(null, '', url);
  }
}
setTheme(initial, false);
document.querySelectorAll('[data-theme-choice]').forEach(b => b.addEventListener('click', () => setTheme(b.dataset.themeChoice, true)));

// Reference filter and "more" paging: shows the first N matching cards, N grows by one page per click.
const refsBox = document.querySelector('.refs'), moreBtn = document.querySelector('.more-btn');
const page = Number(refsBox?.dataset.page) || 8;
let filter = '*', limit = page;
function applyRefs() {
  let shown = 0, matching = 0;
  document.querySelectorAll('.ref').forEach(r => {
    const match = filter === '*' || r.dataset.cat === filter;
    if (match) matching++;
    const visible = match && shown < limit;
    if (visible) shown++;
    r.hidden = !visible;
  });
  if (moreBtn) moreBtn.hidden = matching <= limit;
}
document.querySelectorAll('.filters .chip').forEach(chip => chip.addEventListener('click', () => {
  document.querySelectorAll('.filters .chip').forEach(c => c.classList.toggle('on', c === chip));
  filter = chip.dataset.filter; limit = page; applyRefs();
}));
moreBtn?.addEventListener('click', () => { limit += page; applyRefs(); });
if (refsBox) applyRefs();

const btn = document.querySelector('.menu-btn'), nav = document.getElementById('nav');
btn?.addEventListener('click', () => { const open = nav.classList.toggle('open'); btn.setAttribute('aria-expanded', String(open)); });
nav?.addEventListener('click', e => { if (e.target.closest('a')) { nav.classList.remove('open'); btn?.setAttribute('aria-expanded', 'false'); } });
