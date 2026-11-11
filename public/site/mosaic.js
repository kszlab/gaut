// Reference mosaic behaviour: category filter and a detail dialog with previous/next and keyboard support.
// The tiles are plain buttons in the HTML, so the page content and links stay readable without scripts.
const box = document.querySelector('.mosaic');
if (box) {
  const dialog = document.querySelector('.mosaic-dialog');
  const content = dialog.querySelector('.md-content');
  const tiles = [...box.querySelectorAll('.mt')];
  let current = null, opener = null;

  // ---- hierarchical filter: main category first, then its subcategories
  const treeNode = document.querySelector('.category-tree-data');
  const tree = treeNode ? JSON.parse(treeNode.textContent) : [];
  const mainButtons = [...document.querySelectorAll('[data-main-filter]')];
  const subBox = document.querySelector('.sub-filters');
  let activeMain = '*', activeSub = '*';
  function applyFilters() {
    tiles.forEach(t => {
      const mainMatch = activeMain === '*' || t.dataset.main === activeMain;
      const subMatch = activeSub === '*' || t.dataset.sub === activeSub;
      t.hidden = !(mainMatch && subMatch);
    });
  }
  if (mainButtons.length) {
    mainButtons.forEach(chip => chip.addEventListener('click', () => {
      activeMain = chip.dataset.mainFilter; activeSub = '*';
      mainButtons.forEach(c => c.classList.toggle('on', c === chip));
      const group = tree.find(g => g.id === activeMain);
      if (group?.categories?.length) {
        subBox.hidden = false;
        subBox.innerHTML = '<button type="button" class="chip on" data-sub-filter="*">' + (document.documentElement.lang === 'hu' ? 'Minden alkategória' : 'All subcategories') + '</button>' +
          group.categories.map(c => '<button type="button" class="chip" data-sub-filter="' + c.id.replace(/[&<>]/g, '') + '">' + c.name.replace(/[&<>]/g, '') + '</button>').join('');
        subBox.querySelectorAll('[data-sub-filter]').forEach(sub => sub.addEventListener('click', () => {
          activeSub = sub.dataset.subFilter;
          subBox.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === sub));
          applyFilters();
        }));
      } else { subBox.hidden = true; subBox.replaceChildren(); }
      applyFilters();
    }));
  } else {
    document.querySelectorAll('.filters .chip').forEach(chip => chip.addEventListener('click', () => {
      document.querySelectorAll('.filters .chip').forEach(c => c.classList.toggle('on', c === chip));
      const f = chip.dataset.filter;
      tiles.forEach(t => { t.hidden = f !== '*' && t.dataset.cat !== f; });
    }));
  }

  // ---- detail dialog
  const visible = () => tiles.filter(t => !t.hidden);
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
  box.addEventListener('click', e => {
    const open = e.target.closest('.mt-open'); if (!open) return;
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
}
