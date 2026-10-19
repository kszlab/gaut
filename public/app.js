const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const state = { user: null, sections: {}, categories: [], items: [], section: 'common', trash: false, detail: null, busy: false };
const descriptions = {
  common: 'A weboldal közös alapjai: bemutatkozás, arculat és minden, ami összeköt.',
  misi: 'Misi gyűjtőrésze: referenciák, projektfotók, leírások és ötletek.',
  nandi: 'Nándi gyűjtőrésze: referenciák, projektfotók, leírások és ötletek.',
  attila: 'Attila gyűjtőrésze: referenciák, projektfotók, leírások és ötletek.',
  krisztian: 'Krisztián gyűjtőrésze: referenciák, projektfotók, leírások és ötletek.'
};
const date = value => new Intl.DateTimeFormat('hu-HU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const size = bytes => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').classList.remove('visible'), 5000); }
function showLogin() {
  state.user = null;
  document.querySelectorAll('dialog[open]').forEach(d => d.close());
  $('#workspace').hidden = true; $('#login-screen').hidden = false;
}
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', 'X-Gaut-Request': '1', ...options.headers } });
  const data = await response.json();
  if (!response.ok) { if (response.status === 401 && !path.endsWith('/login')) showLogin(); throw new Error(data.error || 'A művelet nem sikerült.'); }
  return data;
}
const send = (path, method, body) => api(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
function fillSelects() {
  document.querySelectorAll('.section-select').forEach(select => { select.innerHTML = Object.entries(state.sections).map(([id, name]) => `<option value="${id}">${escape(name)}</option>`).join(''); });
  document.querySelectorAll('.category-select').forEach(select => { select.innerHTML = state.categories.map(name => `<option>${escape(name)}</option>`).join(''); });
  $('#category-filter').innerHTML = '<option value="">Minden kategória</option>' + state.categories.map(name => `<option>${escape(name)}</option>`).join('');
}
async function enter() {
  const info = await api('/api/me'); Object.assign(state, info);
  $('#user-name').textContent = 'GAUT'; $('#avatar').textContent = 'G';
  fillSelects(); await reload();
  $('#login-screen').hidden = true; $('#workspace').hidden = false;
}
async function reload() { const data = await api('/api/items'); state.items = data.items; render(); }
function render() {
  const active = state.items.filter(i => !i.deleted_at), removed = state.items.filter(i => i.deleted_at);
  $('#sections').innerHTML = Object.entries(state.sections).map(([id, name]) => `<button class="nav-item ${!state.trash && state.section === id ? 'active' : ''}" data-section="${id}" ${!state.trash && state.section === id ? 'aria-current="page"' : ''}><span>${id === 'common' ? '▦' : '○'}</span>${escape(name)}<b>${active.filter(i => i.section === id).length}</b></button>`).join('');
  $('#trash-nav').classList.toggle('active', state.trash); $('#trash-count').textContent = removed.length;
  $('#page-title').innerHTML = `${state.trash ? 'Kuka' : state.section === 'common' ? 'Közös anyagok' : `${escape(state.sections[state.section])} anyagai`}<span>.</span>`;
  $('#section-eyebrow').textContent = state.trash ? 'MEGŐRIZVE, VISSZAÁLLÍTHATÓAN' : 'KÖZÖS MUNKA, RENDEZETTEN';
  $('#page-description').textContent = state.trash ? 'A kukába helyezett anyagok minden korábbi verziójukkal együtt visszaállíthatók.' : descriptions[state.section];
  $('#upload-button').hidden = state.trash;
  $('#collection-title').firstChild.textContent = state.trash ? 'Kukába helyezett anyagok ' : 'Feltöltött anyagok ';
  $('#stat-files').textContent = active.length;
  $('#stat-versions').textContent = active.reduce((sum, i) => sum + i.version_count, 0);
  const search = $('#search').value.toLocaleLowerCase('hu').trim(), category = $('#category-filter').value;
  const items = (state.trash ? removed : active.filter(i => i.section === state.section)).filter(i => (!category || i.category === category) && [i.title, i.project, i.note, i.filename, i.author].join(' ').toLocaleLowerCase('hu').includes(search));
  $('#visible-count').textContent = items.length;
  $('#items').innerHTML = items.length ? items.map(i => {
    const ext = i.filename.split('.').pop().toUpperCase();
    const kind = ['XLSX', 'XLS', 'CSV'].includes(ext) ? 'excel' : ['PNG', 'JPG', 'JPEG', 'HEIC', 'WEBP', 'GIF'].includes(ext) ? 'image' : '';
    return `<button class="item-card" data-id="${i.id}" aria-label="${escape(i.title)} részletei"><div class="card-top"><span class="file-icon ${kind}">${escape(ext)}</span><span class="category-badge">${escape(i.category)}</span></div><h3>${escape(i.title)}</h3><p class="note">${escape(i.project ? `${i.project} · ${i.note || i.filename}` : i.note || i.filename)}</p><div class="card-bottom"><span>${escape(i.author)} · ${escape(date(i.updated_at))}</span><span class="version-pill">v${i.number} · ${size(i.size)}</span></div>${state.trash ? `<p class="field-hint">${escape(state.sections[i.section])} · Kukában: ${date(i.deleted_at)}</p>` : ''}</button>`;
  }).join('') : `<div class="empty"><span class="empty-symbol">${state.trash ? '↶' : '▧'}</span><h3>${search || category ? 'Nincs ilyen találat' : state.trash ? 'A kuka üres' : 'Itt kap helyet a következő jó anyag.'}</h3><p>${search || category ? 'Módosítsd a keresést vagy a kategóriaszűrőt.' : state.trash ? 'A törölt anyagokat itt tudod majd visszaállítani.' : 'Kezdd egy referencialistával, projektfotóval vagy rövid bemutatással.'}</p>${!state.trash && !search && !category ? '<button class="primary" id="empty-upload">＋ Első anyag feltöltése</button>' : ''}</div>`;
  $('#empty-upload')?.addEventListener('click', openUpload);
}
function changeSection(section, trash = false) { state.section = section; state.trash = trash; $('#search').value = ''; $('#category-filter').value = ''; render(); }
function openUpload() {
  $('#upload-form').reset(); $('#upload-form').elements.section.value = state.section;
  $('#upload-error').textContent = ''; $('#upload-progress').textContent = ''; $('#selected-files').textContent = '';
  $('#upload-dialog').showModal();
}
async function encoded(file) {
  if (file.size > 20 * 1024 * 1024) throw new Error(`${file.name}: a fájl nagyobb 20 MB-nál.`);
  if (!file.size) throw new Error(`${file.name}: üres fájl.`);
  const content = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = () => reject(new Error('Nem sikerült beolvasni a fájlt.')); reader.readAsDataURL(file); });
  return { filename: file.name, content };
}
function showSelected() { const files = [...$('#upload-files').files]; $('#selected-files').textContent = files.map(f => `${f.name} (${size(f.size)})`).join(' · '); if (files.length === 1 && !$('#upload-form').elements.title.value) $('#upload-form').elements.title.value = files[0].name.replace(/\.[^.]+$/, '').slice(0, 160); }
async function showDetail(id) {
  const data = await api(`/api/items/${id}`); state.detail = data;
  const i = data.item;
  $('#detail-content').innerHTML = `<div class="dialog-head"><div><p class="eyebrow">ANYAG RÉSZLETEI</p><h2 class="detail-title">${escape(i.title)}</h2></div><button type="button" class="icon-button" data-action="close" aria-label="Bezárás">×</button></div><div class="detail-meta"><span class="category-badge">${escape(state.sections[i.section])}</span><span class="category-badge">${escape(i.category)}</span>${i.project ? `<span class="category-badge">${escape(i.project)}</span>` : ''}</div>${i.deleted_at ? '<p class="notice">Ez az anyag a kukában van. Szerkesztés előtt állítsd vissza.</p>' : ''}${i.note ? `<p class="detail-note">${escape(i.note)}</p>` : '<p class="muted">Még nincs megjegyzés ehhez az anyaghoz.</p>'}<p class="detail-info">Hozzáadva közös belépéssel · ${date(i.created_at)}<br>Legutóbbi módosítás: ${date(i.updated_at)}</p><h3 class="versions-title">Fájlverziók <span class="muted">/ ${data.versions.length} megőrzött változat</span></h3>${data.versions.map((v, index) => `<div class="version-row"><span class="version-number">v${v.number}</span><div><strong>${escape(v.filename)}${index === 0 ? ' · aktuális' : ''}</strong><small>${size(v.size)} · ${escape(v.author)} · ${date(v.created_at)}</small></div><a href="/api/files/${v.id}" download>Letöltés ↓</a></div>`).join('')}${!i.deleted_at ? '<form id="version-form"><label class="version-input">Új fájlverzió feltöltése<input type="file" id="version-file" required><small class="field-hint">A régi változatok megmaradnak. Legfeljebb 20 MB.</small></label><p id="version-error" class="error" role="alert"></p><div class="dialog-actions"><button class="primary" type="submit">Új verzió mentése</button></div></form>' : ''}<div id="edit-area"></div><div class="detail-footer">${i.deleted_at ? '<button class="primary" data-action="restore">↶ Visszaállítás</button>' : '<button class="secondary" data-action="edit">Adatok szerkesztése</button><button class="danger" data-action="trash">Kukába helyezés</button>'}</div><p id="detail-error" class="error" role="alert"></p>`;
  if (!$('#detail-dialog').open) $('#detail-dialog').showModal();
  $('#version-form')?.addEventListener('submit', async event => {
    event.preventDefault(); if (state.busy) return;
    const button = event.currentTarget.querySelector('button'); button.disabled = true; state.busy = true;
    try { const file = $('#version-file').files[0]; await send(`/api/items/${id}/versions`, 'POST', await encoded(file)); await reload(); await showDetail(id); toast('Az új verzió elmentve. A korábbiak is megmaradtak.'); }
    catch (error) { $('#version-error') && ($('#version-error').textContent = error.message); }
    finally { state.busy = false; button.disabled = false; }
  });
}
function editDetails() {
  const i = state.detail.item;
  $('#edit-area').innerHTML = `<form id="edit-form" class="edit-form"><label>Megnevezés<input name="title" required maxlength="160" value="${escape(i.title)}"></label><div class="form-grid"><label>Gyűjtőrész<select name="section">${Object.entries(state.sections).map(([id, name]) => `<option value="${id}" ${id === i.section ? 'selected' : ''}>${escape(name)}</option>`).join('')}</select></label><label>Kategória<select name="category">${state.categories.map(c => `<option ${c === i.category ? 'selected' : ''}>${escape(c)}</option>`).join('')}</select></label></div><label>Projekt<input name="project" maxlength="160" value="${escape(i.project)}"></label><label>Megjegyzés<textarea name="note" maxlength="4000" rows="3">${escape(i.note)}</textarea></label><p id="edit-error" class="error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary" data-action="cancel-edit">Mégse</button><button type="submit" class="primary">Adatok mentése</button></div></form>`;
  $('#edit-form').elements.title.focus();
  $('#edit-form').addEventListener('submit', async event => {
    event.preventDefault(); const button = event.currentTarget.querySelector('[type="submit"]'); button.disabled = true;
    try { await send(`/api/items/${i.id}`, 'PATCH', Object.fromEntries(new FormData(event.currentTarget))); await reload(); await showDetail(i.id); toast('Az adatok frissültek.'); }
    catch (error) { $('#edit-error') && ($('#edit-error').textContent = error.message); }
    finally { button.disabled = false; }
  });
}
$('#login-form').addEventListener('submit', async event => {
  event.preventDefault(); const form = event.currentTarget, button = form.querySelector('button'); button.disabled = true; $('#login-error').textContent = '';
  try { await send('/api/login', 'POST', Object.fromEntries(new FormData(form))); form.reset(); await enter(); }
  catch (error) { $('#login-error').textContent = error.message; }
  finally { button.disabled = false; }
});
$('#sections').addEventListener('click', event => { const button = event.target.closest('[data-section]'); if (button) changeSection(button.dataset.section); });
$('#trash-nav').addEventListener('click', () => changeSection(state.section, true));
$('#search').addEventListener('input', render); $('#category-filter').addEventListener('change', render);
$('#refresh').addEventListener('click', async event => { const button = event.currentTarget; button.disabled = true; try { await reload(); toast('A gyűjtő frissült.'); } catch (error) { toast(error.message); } finally { button.disabled = false; } });
$('#upload-button').addEventListener('click', openUpload);
document.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => { if (!state.busy) button.closest('dialog').close(); }));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('cancel', event => { if (state.busy) event.preventDefault(); }));
$('#upload-files').addEventListener('change', showSelected);
for (const name of ['dragenter', 'dragover']) $('#dropzone').addEventListener(name, event => { event.preventDefault(); $('#dropzone').classList.add('dragging'); });
for (const name of ['dragleave', 'drop']) $('#dropzone').addEventListener(name, event => { event.preventDefault(); $('#dropzone').classList.remove('dragging'); });
$('#dropzone').addEventListener('drop', event => { if (state.busy) return; $('#upload-files').files = event.dataTransfer.files; showSelected(); });
$('#upload-form').addEventListener('submit', async event => {
  event.preventDefault(); if (state.busy) return;
  const form = event.currentTarget, files = [...$('#upload-files').files];
  const meta = Object.fromEntries(new FormData(form));
  $('#upload-error').textContent = '';
  let completed = 0;
  state.busy = true; $('#upload-submit').disabled = true;
  try {
    if (!files.length) throw new Error('Válassz legalább egy fájlt.');
    for (const file of files) {
      $('#upload-progress').textContent = `Feltöltés: ${completed + 1} / ${files.length} — ${file.name}`;
      const title = files.length === 1 ? meta.title : `${meta.title} · ${file.name}`.slice(0, 160);
      await send('/api/items', 'POST', { ...meta, title, ...await encoded(file) }); completed++;
    }
    state.section = meta.section; state.trash = false;
    $('#search').value = ''; $('#category-filter').value = '';
    await reload(); $('#upload-dialog').close(); toast(`${completed} anyag sikeresen feltöltve.`);
  } catch (error) {
    $('#upload-error').textContent = `${error.message}${completed ? ` ${completed} fájl már elmentve. A folytatáshoz csak a fennmaradó fájlokat válaszd ki.` : ''}`;
    if (completed) { $('#upload-files').value = ''; $('#selected-files').textContent = ''; await reload().catch(() => {}); }
  } finally { state.busy = false; $('#upload-submit').disabled = false; $('#upload-progress').textContent = ''; }
});
$('#items').addEventListener('click', event => { const card = event.target.closest('[data-id]'); if (card) showDetail(card.dataset.id).catch(error => toast(error.message)); });
$('#detail-content').addEventListener('click', async event => {
  const button = event.target.closest('[data-action]'); if (!button || state.busy) return;
  const action = button.dataset.action, id = state.detail.item.id;
  if (action === 'close') return $('#detail-dialog').close();
  if (action === 'edit') return editDetails();
  if (action === 'cancel-edit') return $('#edit-area').replaceChildren();
  if (action === 'trash') {
    const confirm = $('#confirm-dialog'); confirm.returnValue = 'cancel'; confirm.showModal();
    const result = await new Promise(resolve => confirm.addEventListener('close', () => resolve(confirm.returnValue), { once: true }));
    if (result !== 'confirm') return;
  }
  if (action === 'trash' || action === 'restore') {
    button.disabled = true;
    try { await send(`/api/items/${id}/${action}`, 'POST'); $('#detail-dialog').close(); await reload(); toast(action === 'trash' ? 'Az anyag a kukába került.' : 'Az anyag visszaállítva az eredeti gyűjtőrészbe.'); }
    catch (error) { $('#detail-error') && ($('#detail-error').textContent = error.message); }
    finally { button.disabled = false; }
  }
});
$('#logout').addEventListener('click', async () => { try { await send('/api/logout', 'POST'); showLogin(); } catch (error) { toast(error.message); } });
enter().catch(error => { showLogin(); if (!error.message.includes('jelentkezz be')) $('#login-error').textContent = error.message; });
