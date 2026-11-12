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

// "Tervezési fázisok": a link to a phase (#fazis-N) opens that phase.
const openTarget = () => { const el = location.hash.startsWith('#fazis-') && document.getElementById(location.hash.slice(1)); if (el?.tagName === 'DETAILS') el.open = true; };
addEventListener('hashchange', openTarget); openTarget();

document.querySelectorAll('[data-contact-member]').forEach(button => {
  button.addEventListener('click', async () => {
    const card = button.closest('[data-member-contact]'), output = card?.querySelector('[data-contact-details]');
    if (!output || button.disabled) return;
    button.disabled = true;
    const original = button.textContent;
    button.textContent = document.documentElement.lang === 'hu' ? 'Lekérés…' : 'Loading…';
    try {
      const response = await fetch('/api/public/team-contact', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Gaut-Request': '1' }, body: JSON.stringify({ id: button.dataset.contactMember }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Contact details unavailable.');
      const esc = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
      const rows = [];
      if (data.email) rows.push('<p><span>' + (document.documentElement.lang === 'hu' ? 'E-mail' : 'Email') + '</span> <a href="mailto:' + esc(data.email) + '">' + esc(data.email) + '</a></p>');
      if (data.phone) rows.push('<p><span>' + (document.documentElement.lang === 'hu' ? 'Telefon' : 'Phone') + '</span> <a href="tel:' + esc(data.phone.replace(/[^0-9+]/g, '')) + '">' + esc(data.phone) + '</a></p>');
      if (!rows.length) throw new Error('Ehhez a tervezőhöz nincs megadott elérhetőség.');
      output.innerHTML = rows.join(''); output.hidden = false; button.hidden = true;
    } catch (error) { button.disabled = false; button.textContent = error.message || original; }
  });
});

// Legal texts: the footer links open the text in a dialog (the link itself is a real page, which opens without scripts or with a modified click).
const legal = document.querySelector('.legal-dialog');
if (legal) {
  const body = legal.querySelector('.legal-body');
  document.addEventListener('click', async e => {
    const a = e.target.closest('a[data-legal]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    try {
      const url = new URL(a.href); url.searchParams.set('reszlet', '1');
      const res = await fetch(url, { headers: { Accept: 'text/html' } });
      if (!res.ok) throw new Error(String(res.status));
      body.innerHTML = await res.text();
      legal.showModal(); legal.querySelector('.md-content').scrollTop = 0;
    } catch { location.href = a.href; }
  });
  legal.addEventListener('click', e => { if (e.target === legal || e.target.closest('[data-legal-close]')) legal.close(); });
  legal.addEventListener('close', () => { body.replaceChildren(); });
}
