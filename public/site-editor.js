const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const date = v => new Intl.DateTimeFormat('hu-HU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v));
const state = { fields: [], defaults: { hu: {}, en: {} }, values: { hu: {}, en: {} }, revision: 0, live: null, versions: [], dirty: false, busy: false };

async function api(path, method = 'GET', data) {
  const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json', 'X-Gaut-Request': '1' }, body: data === undefined ? undefined : JSON.stringify(data) });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(r.status === 401 ? 'A szerkesztéshez jelentkezz be az anyaggyűjtőben, majd frissítsd ezt az oldalt.' : b.error || 'A művelet nem sikerült.'); e.status = r.status; throw e; }
  return b;
}
const message = (text, bad = false) => { const el = $('#message'); el.textContent = text; el.className = bad ? 'error' : 'muted'; };

function load(s) {
  state.fields = s.fields; state.defaults = s.defaults; state.revision = s.draft.revision;
  state.values = structuredClone(s.draft.overrides); state.live = s.live; state.versions = s.versions; state.dirty = false;
}

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

function changedCount() { return ['hu', 'en'].reduce((n, l) => n + Object.keys(state.values[l]).length, 0); }
function renderStatus() {
  const live = state.live ? `Élő verzió: <strong>${esc(date(state.live.created_at))}</strong>${state.live.note ? ` (${esc(state.live.note)})` : ''}` : 'Még nincs közzétett verzió, az oldal az alapszövegeket mutatja.';
  $('#status').innerHTML = `Vázlat: <strong>${changedCount()}</strong> módosított mező${state.dirty ? ' <span class="dirty">· mentetlen változtatások</span>' : ''}<br>${live}`;
  $('#save').disabled = state.busy || !state.dirty;
  $('#publish').disabled = state.busy;
}
function renderVersions() {
  $('#versions').innerHTML = state.versions.length ? state.versions.map((v, i) => `<div class="version-row"><span class="version-number">${state.versions.length - i}</span><div><strong>${esc(date(v.created_at))}${i === 0 ? '<span class="current-tag">ÉLŐ</span>' : ''}</strong><small>${esc(v.note || 'Nincs megjegyzés')} · ${v.changes} módosított mező</small></div><button class="secondary" type="button" data-restore="${esc(v.id)}">Vázlatba töltés</button></div>`).join('') : '<p class="muted">Még nincs közzétett verzió.</p>';
}
function renderAll() { renderGroups(); renderStatus(); renderVersions(); }

async function run(fn, done) {
  if (state.busy) return; state.busy = true; renderStatus();
  try { await fn(); if (done) message(done); else message(''); } catch (e) { message(e.message, true); if (e.status === 409) { try { load(await api('/api/site/content')); renderAll(); } catch { /* keep message */ } } } finally { state.busy = false; renderStatus(); }
}
const save = async () => { const s = await api('/api/site/content', 'PUT', { revision: state.revision, overrides: state.values }); load(s); renderAll(); };

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
