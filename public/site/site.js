import './mosaic.js'; // reference mosaic: filter and detail dialog
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

const btn = document.querySelector('.menu-btn'), nav = document.getElementById('nav');
btn?.addEventListener('click', () => { const open = nav.classList.toggle('open'); btn.setAttribute('aria-expanded', String(open)); });
nav?.addEventListener('click', e => { if (e.target.closest('a')) { nav.classList.remove('open'); btn?.setAttribute('aria-expanded', 'false'); } });

// Marks the menu item of the section in view (the themes decide how it shows).
const links = new Map([...(nav?.querySelectorAll('a[href^="#"]') ?? [])].map(a => [a.hash.slice(1), a]));
if (links.size && 'IntersectionObserver' in window) {
  const seen = new Set();
  const spy = new IntersectionObserver(entries => {
    for (const e of entries) e.isIntersecting ? seen.add(e.target.id) : seen.delete(e.target.id);
    const current = [...links.keys()].find(id => seen.has(id));
    for (const [id, a] of links) id === current ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current');
  }, { rootMargin: '-45% 0px -45% 0px' });
  for (const id of links.keys()) { const el = document.getElementById(id); if (el) spy.observe(el); }
}
