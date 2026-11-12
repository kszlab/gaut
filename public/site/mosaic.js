// Reference mosaic behaviour: category filter, a detail dialog with previous/next and keyboard support, and the
// "all references" list that opens in place on the home page. The tiles are plain buttons in the HTML, so the page
// content and links stay readable without scripts; without scripts the "all references" button is a link to the subpage.
const dialog = document.querySelector('.mosaic-dialog');
if (dialog) {
  const content = dialog.querySelector('.md-content');
  let current = null, opener = null;
  const live = document.querySelector('.refs-live');
  const short = live?.querySelector('.refs-short'), full = live?.querySelector('.refs-full');
  const OPEN = '#osszes';
  let fragment = null; // the loaded list (HTML text), kept so closing and re-opening does not fetch again

  // ---- category filter: one row of chips (link chips on the subpage navigate on their own). Delegated, because the
  // list on the home page is inserted after load.
  document.addEventListener('click', e => {
    const chip = e.target.closest('button.chip[data-filter]'); if (!chip) return;
    const bar = chip.closest('.filters'), box = bar.nextElementSibling; // the mosaic that follows the filter row
    bar.querySelectorAll('button.chip[data-filter]').forEach(c => c.classList.toggle('on', c === chip));
    const f = chip.dataset.filter;
    box.querySelectorAll('.mt').forEach(t => { t.hidden = f !== '*' && t.dataset.cat !== f; });
  });

  // ---- detail dialog: previous/next walk through the tiles of the list the opened tile belongs to
  const visible = () => [...(current?.closest('.mosaic') ?? document).querySelectorAll('.mt')].filter(t => !t.hidden);
  function show(tile) {
    current = tile;
    content.replaceChildren(tile.querySelector('.mt-detail').content.cloneNode(true));
    const list = visible(), i = list.indexOf(tile);
    dialog.querySelector('[data-md="prev"]').disabled = i <= 0;
    dialog.querySelector('[data-md="next"]').disabled = i >= list.length - 1;
    content.scrollTop = 0;
  }
  function step(delta) {
    const list = visible(), i = list.indexOf(current) + delta;
    if (i >= 0 && i < list.length) { show(list[i]); opener = list[i].querySelector('.mt-open'); }
  }
  document.addEventListener('click', e => {
    const open = e.target.closest('.mosaic .mt-open'); if (!open) return;
    opener = open; show(open.closest('.mt')); dialog.showModal();
  });
  // Gallery inside the detail (a reference with two or more images): arrows, dots, swipe and the arrow keys move between its images.
  // The two buttons at the top of the dialog (and the arrow keys when there is no gallery) move between references.
  const gallery = () => content.querySelector('[data-gallery]');
  function slide(delta, to) {
    const g = gallery(); if (!g) return false;
    const slides = [...g.querySelectorAll('.mg-slide')], at = slides.findIndex(s => !s.hidden);
    const i = to ?? (at + delta + slides.length) % slides.length;
    slides.forEach((s, k) => { s.hidden = k !== i; });
    g.querySelectorAll('.mg-dot').forEach((d, k) => { if (k === i) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
    g.querySelector('.mg-count').textContent = `${i + 1} / ${slides.length}`;
    return true;
  }
  dialog.addEventListener('click', e => {
    const action = e.target.closest('[data-md]')?.dataset.md, mg = e.target.closest('[data-mg]')?.dataset.mg, dot = e.target.closest('[data-mg-dot]');
    if (action === 'close' || e.target === dialog) dialog.close();
    else if (action === 'prev') step(-1);
    else if (action === 'next') step(1);
    else if (mg) slide(mg === 'prev' ? -1 : 1);
    else if (dot) slide(0, Number(dot.dataset.mgDot));
  });
  dialog.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const delta = e.key === 'ArrowLeft' ? -1 : 1;
    if (!slide(delta)) step(delta);
  });
  let swipeFrom = null;
  content.addEventListener('touchstart', e => { swipeFrom = e.target.closest('.mg-stage') && e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
  content.addEventListener('touchend', e => { if (swipeFrom === null) return; const dx = e.changedTouches[0].clientX - swipeFrom; swipeFrom = null; if (Math.abs(dx) > 40) slide(dx < 0 ? 1 : -1); }, { passive: true });
  dialog.addEventListener('close', () => { opener?.focus({ preventScroll: true }); content.replaceChildren(); });

  // ---- home page: "all references" opens in place and scrolls to the start of the section, so the filter buttons show.
  // When the list has been scrolled past (the next section reaches the top of the screen) it closes by itself in the
  // background, and the next section keeps its place on the screen. #osszes in the address makes it a link that opens the list.
  if (live && short && full) {
    const section = live.closest('section'), after = section.nextElementSibling;
    const isOpen = () => live.classList.contains('is-open');
    const setOpen = on => {
      if (on) full.innerHTML = fragment; else full.replaceChildren(); // closing drops the list, so it reopens unfiltered
      full.hidden = !on; live.classList.toggle('is-open', on);
    };
    // Close the list. Scrolled past: the page above the next section shrinks, so scroll by the same amount, without animation.
    function collapse() {
      if (!isOpen()) return;
      const passed = full.getBoundingClientRect().bottom < 0, before = after?.getBoundingClientRect().top ?? 0;
      setOpen(false);
      if (location.hash === OPEN) history.replaceState(null, '', location.pathname + location.search);
      if (passed && after) scrollTo({ top: scrollY + after.getBoundingClientRect().top - before, behavior: 'instant' });
      else section.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
    async function openList(push) {
      if (isOpen()) return;
      try {
        if (fragment === null) {
          const res = await fetch(live.dataset.refsAll, { headers: { Accept: 'text/html' } });
          if (!res.ok) throw new Error(String(res.status));
          fragment = await res.text();
        }
      } catch { location.href = short.querySelector('[data-refs-open]')?.href || location.href; return; } // fall back to the subpage
      setOpen(true);
      if (push) history.pushState(null, '', OPEN);
      section.scrollIntoView({ block: 'start' });
    }
    document.addEventListener('click', e => {
      if (e.target.closest('[data-refs-open]')) { e.preventDefault(); openList(true); }
    });
    addEventListener('scroll', () => { if (isOpen() && full.getBoundingClientRect().bottom < 0) collapse(); }, { passive: true });
    addEventListener('popstate', () => {
      if (location.hash === OPEN) openList(false);
      else if (isOpen()) collapse();
    });
    if (location.hash === OPEN) openList(false);
  }
}
