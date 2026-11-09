const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const date = v => new Intl.DateTimeFormat('hu-HU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v));
const state = { references: [], fields: [], slots: [], media: {}, altEdits: {}, defaults: { hu: {}, en: {} }, values: { hu: {}, en: {}, media: {} }, revision: 0, live: null, versions: [], dirty: false, busy: false };
const MAX_UPLOAD = 20 * 1024 * 1024;

async function api(path, method = 'GET', data) {
  const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json', 'X-Gaut-Request': '1' }, body: data === undefined ? undefined : JSON.stringify(data) });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(r.status === 401 ? 'A szerkesztéshez jelentkezz be az anyaggyűjtőben, majd frissítsd ezt az oldalt.' : b.error || 'A művelet nem sikerült.'); e.status = r.status; throw e; }
  return b;
}
// Messages appear next to the page heading and in the sticky bar, which stays in view while scrolling through a long form.
const message = (text, bad = false) => {
  const el = $('#message'); el.textContent = text; el.className = bad ? 'error' : 'muted';
  const bar = $('#bar-message'); bar.textContent = text; bar.className = `bar-message ${bad ? 'error' : text ? 'ok' : ''}`;
};

function load(s) {
  state.fields = s.fields; state.slots = s.slots; state.defaults = s.defaults; state.revision = s.draft.revision;
  state.values = structuredClone(s.draft.overrides); state.values.media ??= {};
  for (const m of s.media) state.media[m.id] = m;
  state.references = s.references; state.altEdits = {}; state.live = s.live; state.versions = s.versions; state.dirty = false;
}

// ---- Images: one card per slot (hero image of each identity draft) ----
function renderImages() {
  $('#images').innerHTML = `<section class="group"><h2>Képek</h2><p class="field-hint">A feltöltött kép automatikusan WebP-vé alakul, több méretben. JPG, PNG vagy WebP, legalább 200 px széles, legfeljebb 20 MB. A kép eredeti fájlja nem marad meg, a rejtett helyadatok (pl. GPS) is törlődnek. A változás a vázlat mentése és a Közzététel után látszik a látogatóknak.</p><div class="image-grid">${state.slots.map(slotHtml).join('')}</div></section>`;
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
const renderMedia = () => { renderImages(); renderTeam(); };
const onUpload = async e => {
  const input = e.target.closest('[data-upload]'); if (!input) return;
  const file = input.files[0]; input.value = '';
  if (!file) return;
  if (file.size > MAX_UPLOAD) { message('A kép legfeljebb 20 MB lehet.', true); return; }
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { message('Csak JPG, PNG és WebP kép tölthető fel.', true); return; }
  const slot = input.dataset.upload;
  let width = 0;
  await run(async () => {
    message('Feltöltés és átméretezés folyamatban…');
    const r = await api('/api/site/media', 'POST', { filename: file.name, content: await readBase64(file) });
    width = r.media.width; state.media[r.media.id] = r.media; state.values.media[slot] = r.media.id; state.dirty = true; renderMedia();
  }, () => {
    const team = slot.startsWith('team.'), recommended = team ? 400 : 1600;
    return `${team ? 'A fénykép feltöltve.' : 'A kép feltöltve. Add meg a képleírást.'} Mentsd a vázlatot, hogy megmaradjon.${width < recommended ? ` Figyelem: a kép kis felbontású (${width} px széles), ezért életlen lehet. Ajánlott legalább ${recommended} px.` : ''}`;
  });
};
const onReset = e => {
  const b = e.target.closest('[data-reset-slot]'); if (!b) return;
  delete state.values.media[b.dataset.resetSlot]; state.dirty = true; renderMedia(); renderStatus();
};
for (const box of [$('#images'), $('#team')]) { box.addEventListener('change', onUpload); box.addEventListener('click', onReset); }

// ---- References that Közzététel will put on the site (read-only; edited in the reference workshop) ----
function renderRefs() {
  const list = state.references, flagged = list.filter(r => r.warnings.length).length;
  $('#refs').innerHTML = `<section class="group"><h2>Referenciák</h2><p class="field-hint">A referenciákat a <a href="/referenciak">Referenciaműhelyben</a> szerkesztheted (honlapos cím, leírás, borítókép, „Honlapon megjeleníthető” jelölés). A lista a Közzététel pillanatában rögzül: a későbbi módosítások csak az újabb közzététel után látszanak. Ha egyetlen referencia sincs megjelölve, a „Minta” jelzésű mintaprojektek maradnak az oldalon.</p>
    ${list.length ? `<p><strong>${list.length}</strong> referencia kerül ki közzétételkor${flagged ? `, ebből <strong>${flagged}</strong> hiányos honlapos adatokkal (figyelmeztetés, nem akadály)` : ''}.</p><ul class="ref-overview">${list.map(r => `<li><strong>${esc(r.name)}</strong>${r.featured ? ' <span class="current-tag">KIEMELT</span>' : ''}${r.warnings.length ? `<ul class="ref-warn">${r.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ' <small>rendben</small>'}</li>`).join('')}</ul>` : '<p class="muted">Jelenleg nincs „Honlapon megjeleníthető” referencia, ezért a mintaprojektek látszanak.</p>'}</section>`;
}

// ---- Team list ----
const TEAM_MAX = 12;
const newMember = () => ({ id: `tag-${Math.random().toString(36).slice(2, 8)}`, name: { hu: '', en: '' }, role: { hu: '', en: '' }, bio: { hu: '', en: '' }, focus: { hu: [], en: [] } });
function renderTeam() {
  const team = state.values.team;
  let body;
  if (team === undefined) {
    body = `<p class="muted">Most a mintacsapat látszik az oldalon („Minta" jelzéssel, helyőrző szöveggel). Indítsd el a saját csapatlistát, vagy rejtsd el a szekciót.</p><div class="slot-actions"><button type="button" class="primary" data-team-action="start">Saját csapatlista indítása</button><button type="button" class="secondary" data-team-action="hide">Csapat szekció elrejtése</button></div>`;
  } else {
    body = `${team.length ? '' : '<p class="muted">A Csapat szekció és menüpontja jelenleg rejtett. Vegyél fel csapattagot, hogy megjelenjen.</p>'}<div class="team-list">${team.map((m, i) => memberHtml(m, i, team.length)).join('')}</div>
      <div class="slot-actions"><button type="button" class="secondary" data-team-action="add" ${team.length >= TEAM_MAX ? 'disabled' : ''}>＋ Új csapattag</button><button type="button" class="secondary" data-team-action="sample">Vissza a mintacsapathoz</button></div>`;
  }
  $('#team').innerHTML = `<section class="group"><h2>Csapat</h2><p class="field-hint">Legfeljebb ${TEAM_MAX} tag. Az angol mezők üresen maradhatnak: ilyenkor a magyar szöveg jelenik meg az angol oldalon. A fénykép ajánlott aránya álló, 4:5.</p>${body}</section>`;
}
function memberHtml(m, i, n) {
  const slot = `team.${m.id}`, id = state.values.media[slot], pm = id && state.media[id];
  const src = pm ? `/media/${id}/${pm.widths.includes(800) ? 800 : pm.widths[0]}.webp` : '';
  const cell = (lang, key, label, tag = 'input', max = 80) => {
    const v = key === 'focus' ? (m.focus[lang] || []).join(', ') : (m[key][lang] || '');
    const attrs = `data-member="${esc(m.id)}" data-mf="${key}.${lang}" maxlength="${key === 'focus' ? 200 : max}"`;
    return `<label>${label} (${lang.toUpperCase()})${tag === 'textarea' ? `<textarea ${attrs} rows="4">${esc(v)}</textarea>` : `<input ${attrs} value="${esc(v)}">`}</label>`;
  };
  return `<div class="member-card" data-card="${esc(m.id)}">
    <div class="member-photo">${src ? `<img src="${esc(src)}" alt="">` : '<span>Nincs fénykép</span>'}
      <div class="slot-actions"><label class="secondary file-btn">${src ? 'Fénykép cseréje' : 'Fénykép feltöltése'}<input type="file" accept="image/jpeg,image/png,image/webp" data-upload="${esc(slot)}" hidden></label>${src ? `<button type="button" class="secondary" data-reset-slot="${esc(slot)}">Törlés</button>` : ''}</div></div>
    <div class="member-fields"><div class="two">${cell('hu', 'name', 'Név')}${cell('en', 'name', 'Név')}</div><div class="two">${cell('hu', 'role', 'Szerepkör')}${cell('en', 'role', 'Szerepkör')}</div>
      <div class="two">${cell('hu', 'bio', 'Bemutatkozás', 'textarea', 700)}${cell('en', 'bio', 'Bemutatkozás', 'textarea', 700)}</div><div class="two">${cell('hu', 'focus', 'Szakterület-címkék (vesszővel, legfeljebb 4)')}${cell('en', 'focus', 'Szakterület-címkék (vesszővel, legfeljebb 4)')}</div>
      <div class="slot-actions"><button type="button" class="secondary" data-team-action="up" data-member-id="${esc(m.id)}" ${i === 0 ? 'disabled' : ''}>↑ Feljebb</button><button type="button" class="secondary" data-team-action="down" data-member-id="${esc(m.id)}" ${i === n - 1 ? 'disabled' : ''}>↓ Lejjebb</button><button type="button" class="danger" data-team-action="remove" data-member-id="${esc(m.id)}">Törlés</button></div></div></div>`;
}
$('#team').addEventListener('input', e => {
  const t = e.target; if (!t.dataset.mf) return;
  const m = state.values.team.find(x => x.id === t.dataset.member); if (!m) return;
  const [key, lang] = t.dataset.mf.split('.');
  if (key === 'focus') m.focus[lang] = t.value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 4); else m[key][lang] = t.value;
  state.dirty = true; renderStatus();
});
$('#team').addEventListener('click', e => {
  const b = e.target.closest('[data-team-action]'); if (!b) return;
  const act = b.dataset.teamAction, team = state.values.team, idx = team?.findIndex(x => x.id === b.dataset.memberId);
  if (act === 'start') state.values.team = [newMember()];
  else if (act === 'hide') state.values.team = [];
  else if (act === 'add' && team.length < TEAM_MAX) team.push(newMember());
  else if (act === 'sample') { if (!confirm('Visszaáll a mintacsapat, a saját csapatlista elveszik a vázlatból. Folytatod?')) return; delete state.values.team; }
  else if (act === 'remove') { if (!confirm('Törlöd ezt a csapattagot?')) return; delete state.values.media[`team.${team[idx].id}`]; team.splice(idx, 1); }
  else if (act === 'up' && idx > 0) [team[idx - 1], team[idx]] = [team[idx], team[idx - 1]];
  else if (act === 'down' && idx < team.length - 1) [team[idx + 1], team[idx]] = [team[idx], team[idx + 1]];
  state.dirty = true; renderTeam(); renderStatus();
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

function changedCount() { return ['hu', 'en', 'media'].reduce((n, l) => n + Object.keys(state.values[l]).length, 0) + (state.values.team ? 1 : 0); }
function renderStatus() {
  const live = state.live ? `Élő verzió: <strong>${esc(date(state.live.created_at))}</strong>${state.live.note ? ` (${esc(state.live.note)})` : ''}` : 'Még nincs közzétett verzió, az oldal az alapszövegeket mutatja.';
  $('#status').innerHTML = `Vázlat: <strong>${changedCount()}</strong> módosított mező${state.dirty ? ' <span class="dirty">· mentetlen változtatások</span>' : ''}<br>${live}`;
  $('#save').disabled = state.busy || !state.dirty;
  $('#publish').disabled = state.busy;
}
function renderVersions() {
  $('#versions').innerHTML = state.versions.length ? state.versions.map((v, i) => `<div class="version-row"><span class="version-number">${state.versions.length - i}</span><div><strong>${esc(date(v.created_at))}${i === 0 ? '<span class="current-tag">ÉLŐ</span>' : ''}</strong><small>${esc(v.note || 'Nincs megjegyzés')} · ${v.changes} módosított mező</small></div><button class="secondary" type="button" data-restore="${esc(v.id)}">Vázlatba töltés</button></div>`).join('') : '<p class="muted">Még nincs közzétett verzió.</p>';
}
function renderAll() { renderImages(); renderTeam(); renderRefs(); renderGroups(); renderStatus(); renderVersions(); }

async function run(fn, done) {
  if (state.busy) return; state.busy = true; renderStatus();
  try { await fn(); const text = typeof done === 'function' ? done() : done; message(text || ''); } catch (e) { message(e.message, true); if (e.status === 409) { try { load(await api('/api/site/content')); renderAll(); } catch { /* keep message */ } } } finally { state.busy = false; renderStatus(); }
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
