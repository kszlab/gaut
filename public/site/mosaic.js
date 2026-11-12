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
  dialog.addEventListener('click', e => {
    const action = e.target.closest('[data-md]')?.dataset.md;
    if (action === 'close' || e.target === dialog) dialog.close();
    else if (action === 'prev') step(-1);
    else if (action === 'next') step(1);
  });
  dialog.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
  });
  dialog.addEventListener('close', () => { opener?.focus({ preventScroll: true }); content.replaceChildren(); });

  // ---- home page: all references open in place (#osszes in the address, so the back button and shared links work)
  if (live && short && full) {
    const isOpen = () => live.classList.contains('is-open');
    function setOpen(on) {
      if (on) full.innerHTML = fragment; else full.replaceChildren(); // closing drops the list, so it reopens unfiltered
      full.hidden = !on; live.classList.toggle('is-open', on);
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
    }
    function closeList() {
      if (!isOpen()) return;
      setOpen(false);
      if (location.hash === OPEN) history.replaceState(null, '', location.pathname + location.search);
      live.closest('section')?.scrollIntoView({ block: 'start' });
    }
    document.addEventListener('click', e => {
      if (e.target.closest('[data-refs-open]')) { e.preventDefault(); openList(true); }
      else if (e.target.closest('[data-refs-close]')) closeList();
    });
    window.addEventListener('popstate', () => {
      if (location.hash === OPEN) openList(false);
      else if (isOpen()) { setOpen(false); }
    });
    if (location.hash === OPEN) openList(false);
  }
}
