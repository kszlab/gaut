const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const date = v => new Intl.DateTimeFormat('hu-HU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v));
const state = { fields: [], slots: [], media: {}, altEdits: {}, defaults: { hu: {}, en: {} }, values: { hu: {}, en: {}, media: {} }, revision: 0, live: null, versions: [], dirty: false, busy: false };
const MAX_UPLOAD = 20 * 1024 * 1024;

async function api(path, method = 'GET', data) {
  const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json', 'X-Gaut-Request': '1' }, body: data === undefined ? undefined : JSON.stringify(data) });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(r.status === 401 ? 'A szerkesztéshez jelentkezz be az anyaggyűjtőben, majd frissítsd ezt az oldalt.' : b.error || 'A művelet nem sikerült.'); e.status = r.status; throw e; }
  return b;
}
const message = (text, bad = false) => { const el = $('#message'); el.textContent = text; el.className = bad ? 'error' : 'muted'; };

function load(s) {
  state.fields = s.fields; state.slots = s.slots; state.defaults = s.defaults; state.revision = s.draft.revision;
  state.values = structuredClone(s.draft.overrides); state.values.media ??= {};
  for (const m of s.media) state.media[m.id] = m;
  state.altEdits = {}; state.live = s.live; state.versions = s.versions; state.dirty = false;
}

// ---- Images: one card per slot (hero image of each identity draft) ----
function renderImages() {
  $('#images').innerHTML = `<section class="group"><h2>Képek</h2><p class="field-hint">A feltöltött kép automatikusan WebP-vé alakul, több méretben. JPG, PNG vagy WebP, legalább 600 px széles, legfeljebb 20 MB. A kép eredeti fájlja nem marad meg, a rejtett helyadatok (pl. GPS) is törlődnek. A változás a vázlat mentése és a Közzététel után látszik a látogatóknak.</p><div class="image-grid">${state.slots.map(slotHtml).join('')}</div></section>`;
}
function slotHtml(s) {
  const id = state.values.media[s.slot], m = id && state.media[id], edit = state.altEdits[id] || {};
  const src = m ? `/media/${id}/${m.widths.includes(800) ? 800 : m.widths[0]}.webp` : s.fallback;
  const alt = lang => edit[lang] ?? m?.alt[lang] ?? '';
  return `<div class="slot" data-slot="${esc(s.slot)}"><img class="slot-preview" src="${esc(src)}" alt="">
    <div class="slot-body"><strong>${esc(s.label)}</strong><small>${m ? esc(m.filename) + ` · ${m.width}×${m.height}` : 'Alapkép (a kódba épített)'}</small>
      <div class="slot-actions"><label class="secondary file-btn">Kép cseréje<input type="file" accept="image/jpeg,image/png,image/webp" data-upload="${esc(s.slot)}" hidden></label>${m ? `<button type="button" class="secondary" data-reset-slot="${esc(s.slot)}">Alapkép visszaállítása</button>` : ''}</div>
      ${m ? `<label>Képleírás (HU)<input data-alt="hu" data-media="${esc(id)}" maxlength="200" value="${esc(alt('hu'))}" placeholder="Rövid leírás a képről"></label><label>Képleírás (EN)<input data-alt="en" data-media="${esc(id)}" maxlength="200" value="${esc(alt('en'))}" placeholder="Short description of the image"></label>` : '<small>Az alapkép dekoratív, külön leírás nélkül.</small>'}</div></div>`;
}
const readBase64 = file => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1] || ''); r.onerror = () => reject(new Error('A fájl nem olvasható.')); r.readAsDataURL(file); });
$('#images').addEventListener('change', async e => {
  const input = e.target.closest('[data-upload]'); if (!input) return;
  const file = input.files[0]; input.value = '';
  if (!file) return;
  if (file.size > MAX_UPLOAD) { message('A kép legfeljebb 20 MB lehet.', true); return; }
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { message('Csak JPG, PNG és WebP kép tölthető fel.', true); return; }
  const slot = input.dataset.upload;
  await run(async () => {
    message('Feltöltés és átméretezés folyamatban…');
    const r = await api('/api/site/media', 'POST', { filename: file.name, content: await readBase64(file) });
    state.media[r.media.id] = r.media; state.values.media[slot] = r.media.id; state.dirty = true; renderImages();
  }, 'A kép feltöltve. Add meg a képleírást, majd mentsd a vázlatot.');
});
$('#images').addEventListener('click', e => {
  const b = e.target.closest('[data-reset-slot]'); if (!b) return;
  delete state.values.media[b.dataset.resetSlot]; state.dirty = true; renderImages(); renderStatus();
});
$('#images').addEventListener('input', e => {
  const t = e.target; if (!t.dataset.alt) return;
  const id = t.dataset.media, m = state.media[id], edit = state.altEdits[id] ??= { hu: m.alt.hu, en: m.alt.en };
  edit[t.dataset.alt] = t.value; state.dirty = true; renderStatus();
});

function renderGroups() {
  const groups = [...new Set(state.fields.map(f => f.group))];
  $('#groups').innerHTML = groups.map(g => `<section class="group"><h2>${esc(g)}</h2>${state.fields.filter(f => f.group === g).map(rowHtml).join('')}</section>`).join('');
}
function cellHtml(f, lang) {
  const value = state.values[lang][f.path], hidden = f.hideable && value === '';
  const shown = value === undefined || hidden ? '' : value;
  const control = f.type === 'text'
    ? `<textarea data-lang="${lang}" data-path="${esc(f.path)}" maxlength="${f.max}" placeholder="${esc(state.defaults[lang][f.path])}" ${hidden ? 'disabled' : ''}>${esc(shown)}</textarea>`
    : `<input data-lang="${lang}" data-path="${esc(f.path)}" maxlength="${f.max}" placeholder="${esc(state.defaults[lang][f.path])}" value="${esc(shown)}">`;
  const toggle = f.hideable ? `<label class="hide-toggle"><input type="checkbox" data-hide="${lang}" data-path="${esc(f.path)}" ${hidden ? 'checked' : ''}> Szöveg elrejtése</label>` : '';
  return `<div class="cell${value !== undefined ? ' changed' : ''}"><span>${lang.toUpperCase()}</span>${control}${toggle}</div>`;
}
const rowHtml = f => `<div class="row"><div class="row-label">${esc(f.label)}<small>legfeljebb ${f.max} karakter</small></div>${cellHtml(f, 'hu')}${cellHtml(f, 'en')}</div>`;

function changedCount() { return ['hu', 'en', 'media'].reduce((n, l) => n + Object.keys(state.values[l]).length, 0); }
function renderStatus() {
  const live = state.live ? `Élő verzió: <strong>${esc(date(state.live.created_at))}</strong>${state.live.note ? ` (${esc(state.live.note)})` : ''}` : 'Még nincs közzétett verzió, az oldal az alapszövegeket mutatja.';
  $('#status').innerHTML = `Vázlat: <strong>${changedCount()}</strong> módosított mező${state.dirty ? ' <span class="dirty">· mentetlen változtatások</span>' : ''}<br>${live}`;
  $('#save').disabled = state.busy || !state.dirty;
  $('#publish').disabled = state.busy;
}
function renderVersions() {
  $('#versions').innerHTML = state.versions.length ? state.versions.map((v, i) => `<div class="version-row"><span class="version-number">${state.versions.length - i}</span><div><strong>${esc(date(v.created_at))}${i === 0 ? '<span class="current-tag">ÉLŐ</span>' : ''}</strong><small>${esc(v.note || 'Nincs megjegyzés')} · ${v.changes} módosított mező</small></div><button class="secondary" type="button" data-restore="${esc(v.id)}">Vázlatba töltés</button></div>`).join('') : '<p class="muted">Még nincs közzétett verzió.</p>';
}
function renderAll() { renderImages(); renderGroups(); renderStatus(); renderVersions(); }

async function run(fn, done) {
  if (state.busy) return; state.busy = true; renderStatus();
  try { await fn(); if (done) message(done); else message(''); } catch (e) { message(e.message, true); if (e.status === 409) { try { load(await api('/api/site/content')); renderAll(); } catch { /* keep message */ } } } finally { state.busy = false; renderStatus(); }
}
const save = async () => {
  for (const [id, alt] of Object.entries(state.altEdits)) { const r = await api(`/api/site/media/${encodeURIComponent(id)}`, 'PATCH', { alt_hu: alt.hu, alt_en: alt.en }); state.media[id] = r.media; }
  const s = await api('/api/site/content', 'PUT', { revision: state.revision, overrides: state.values }); load(s); renderAll();
};

$('#groups').addEventListener('input', e => {
  const t = e.target; if (!t.dataset.path || t.dataset.hide) return;
  const { lang, path } = t.dataset, value = t.value;
  if (value.trim() === '') delete state.values[lang][path]; else state.values[lang][path] = value;
  t.closest('.cell').classList.toggle('changed', value.trim() !== '');
  state.dirty = true; renderStatus();
});
$('#groups').addEventListener('change', e => {
  const t = e.target; if (!t.dataset.hide) return;
  const { hide: lang, path } = t.dataset, field = $(`[data-lang="${lang}"][data-path="${CSS.escape(path)}"]`);
  if (t.checked) { state.values[lang][path] = ''; field.value = ''; field.disabled = true; } else { delete state.values[lang][path]; field.disabled = false; }
  t.closest('.cell').classList.toggle('changed', t.checked);
  state.dirty = true; renderStatus();
});

$('#save').onclick = () => run(save, 'A vázlat mentve. Az élő oldal még nem változott.');
$('#publish').onclick = () => {
  if (!confirm('Közzéteszed a vázlatot? A látogatók ezután az új szövegeket látják, magyarul és angolul is.')) return;
  run(async () => {
    if (state.dirty) await save();
    load(await api('/api/site/publish', 'POST', { revision: state.revision, note: $('#note').value.trim() }));
    $('#note').value = ''; renderAll();
  }, 'Közzétéve. Az élő oldal frissült.');
};
$('#versions').addEventListener('click', e => {
  const b = e.target.closest('[data-restore]'); if (!b) return;
  if (state.dirty && !confirm('A mentetlen változtatások elvesznek. Folytatod?')) return;
  run(async () => { load(await api(`/api/site/versions/${encodeURIComponent(b.dataset.restore)}/restore`, 'POST', { revision: state.revision })); renderAll(); }, 'A verzió a vázlatba került. Az élő oldal nem változott; a Közzététellel élesítheted.');
});
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (state.dirty && !state.busy) $('#save').click(); } });
window.addEventListener('beforeunload', e => { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });

api('/api/site/content').then(s => { load(s); $('#tools').hidden = false; renderAll(); }).catch(e => message(e.message, true));
