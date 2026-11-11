import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { isReferenceCategory, normalizeReferenceCategory, INITIAL_CATEGORY_TREE, INITIAL_REFERENCE_CLASSIFICATION, INITIAL_REFERENCE_REVIEW_NOTES, CATEGORY_REVIEW_STATUSES } from './reference-categories.mjs';
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const LABELS={common:'Közös',misi:'Misi',nandi:'Nándi',attila:'Attila',krisztian:'Krisztián'};
const OWNERS = ['common', 'misi', 'nandi', 'attila', 'krisztian'];
export function referenceStore(db) {
  const seed = JSON.parse(readFileSync(new URL('./seed/references.json', import.meta.url), 'utf8'));
  db.exec('CREATE TABLE IF NOT EXISTS reference_records(id TEXT PRIMARY KEY,payload TEXT NOT NULL,revision INTEGER NOT NULL,updated_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS reference_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL)');
  db.exec('CREATE TABLE IF NOT EXISTS reference_merges(id TEXT PRIMARY KEY,payload TEXT NOT NULL,created_at TEXT NOT NULL,undone_at TEXT)');
  db.exec('CREATE TABLE IF NOT EXISTS reference_category_groups(id TEXT PRIMARY KEY,name TEXT NOT NULL,sort_order INTEGER NOT NULL,created_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS reference_categories(id TEXT PRIMARY KEY,parent_id TEXT NOT NULL REFERENCES reference_category_groups(id),name TEXT NOT NULL,sort_order INTEGER NOT NULL,created_at TEXT NOT NULL,UNIQUE(parent_id,name))');
  const insert = db.prepare('INSERT INTO reference_records VALUES(?,?,1,?)');
  // Seed the editable hierarchical taxonomy once. Category IDs are stable and references store IDs, not labels.
  if (!db.prepare("SELECT 1 FROM reference_meta WHERE key='category-tree-seed-v1'").get()) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const created = new Date().toISOString();
      for (const group of INITIAL_CATEGORY_TREE) {
        db.prepare('INSERT OR IGNORE INTO reference_category_groups VALUES(?,?,?,?)').run(group.id,group.name,group.sort_order,created);
        for (const sub of group.categories) db.prepare('INSERT OR IGNORE INTO reference_categories VALUES(?,?,?,?,?)').run(sub.id,group.id,sub.name,sub.sort_order,created);
      }
      db.prepare('INSERT INTO reference_meta VALUES(?,?)').run('category-tree-seed-v1','1'); db.exec('COMMIT');
    } catch(e) { db.exec('ROLLBACK'); throw e; }
  }

  const get = id => { const r = db.prepare('SELECT * FROM reference_records WHERE id=?').get(id); if (!r) fail(404,'A referencia nem található.'); const p=JSON.parse(r.payload); return { deleted_at:null, website_publishable:false, website_role_confirmed:false, website_photo_rights:false, website_featured:false, website_title_hu:'', website_title_en:'', website_title_en_source:'', website_copy_hu:'', website_copy_en:'', website_cover_photo:'', website_cover_media:'', category_main_id:null, category_sub_id:null, category_review_status:'Besorolatlan', category_review_note:'', category_legacy:'', ...p, sections:p.sections||[p.section||'common'], revision:r.revision, updated_at:r.updated_at }; };
  function validate(p) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) fail(400,'Hibás referencia.');
    const r = structuredClone(p); delete r.revision; delete r.updated_at; delete r.photo_count; delete r.photo_cover_id; delete r.photo_research;
    if (r.deleted_at === undefined) r.deleted_at=null;
    if (r.deleted_at!==null && (typeof r.deleted_at!=='string'||!Number.isFinite(Date.parse(r.deleted_at)))) fail(400,'Érvénytelen törlési dátum.');
    if (r.website_publishable === undefined) r.website_publishable = false;
    if (typeof r.website_publishable !== 'boolean') fail(400,'Invalid website publication flag.');
    if (r.section === undefined) r.section = 'common';
    if (!OWNERS.includes(r.section)) fail(400,'Válassz érvényes referencia-gyűjtőrészt.');
    if(r.sections===undefined)r.sections=[r.section];
    if(!Array.isArray(r.sections)||!r.sections.length||r.sections.length>5||r.sections.some(x=>!OWNERS.includes(x)))fail(400,'Legalább egy nevet vagy a Közös jelölést válaszd ki.');
    r.sections=OWNERS.filter(x=>r.sections.includes(x));r.section=r.sections[0];
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(r.id || '')) fail(400,'Érvénytelen azonosító.');
    if (typeof r.name !== 'string' || !r.name.trim() || r.name.length>500) fail(400,'A projekt neve kötelező, legfeljebb 500 karakter.');
    for (const key of ['design_year','category','city','address','identification_status','scope_from_pdf','background','questions','publication_status','attribution','website_copy_draft','technical_detail','website_title_hu','website_title_en','website_title_en_source','website_copy_hu','website_copy_en','website_cover_photo','website_cover_media','category_legacy','category_review_note']) { if(r[key]===undefined) r[key]=''; if(typeof r[key]!=='string') fail(400,'A szöveges mezőkben szöveget adj meg.'); }
    if (!isReferenceCategory(r.category)) { r.category_legacy = r.category_legacy || r.category || ''; r.category = normalizeReferenceCategory(r.category); } else r.category = normalizeReferenceCategory(r.category);
    if (r.category_main_id === undefined) r.category_main_id = null;
    if (r.category_sub_id === undefined) r.category_sub_id = null;
    if (r.category_main_id !== null && typeof r.category_main_id !== 'string') fail(400,'Érvénytelen főkategória.');
    if (r.category_sub_id !== null && typeof r.category_sub_id !== 'string') fail(400,'Érvénytelen alkategória.');
    if (r.category_review_note.length > 1200) fail(400,'A kategória-ellenőrzési megjegyzés legfeljebb 1200 karakter lehet.');
    if (!CATEGORY_REVIEW_STATUSES.includes(r.category_review_status || 'Besorolatlan')) fail(400,'Érvénytelen kategória-ellenőrzési állapot.');
    r.category_review_status ||= 'Besorolatlan';
    if (r.category_main_id || r.category_sub_id) {
      const group = r.category_main_id && db.prepare('SELECT id FROM reference_category_groups WHERE id=?').get(r.category_main_id);
      const sub = r.category_sub_id && db.prepare('SELECT parent_id FROM reference_categories WHERE id=?').get(r.category_sub_id);
      if (!group || !sub || sub.parent_id !== group.id) fail(400,'Válassz egymáshoz tartozó főkategóriát és alkategóriát.');
    } else r.category_review_status = 'Besorolatlan';
    for (const [key,max] of [['website_title_hu',160],['website_title_en',160],['website_title_en_source',160],['website_copy_hu',900],['website_copy_en',900]]) if(r[key].length>max) fail(400,'Túl hosszú honlapos szöveg: '+key+' (legfeljebb '+max+' karakter).');
    for (const key of ['website_role_confirmed','website_photo_rights','website_featured']) { if(r[key]===undefined) r[key]=false; if(typeof r[key]!=='boolean') fail(400,'Invalid website flag: '+key); }
    for (const [k,v] of Object.entries(r)) if (typeof v==='string' && v.length>30000) fail(400,`Túl hosszú mező: ${k}`);
    for (const key of ['sources','photo_sources']) {
      if (!Array.isArray(r[key]) || r[key].length>100) fail(400,'Hibás linklista.');
      for (const s of r[key]) { try { if (!['https:','http:'].includes(new URL(s.url).protocol)) throw Error(); } catch { fail(400,'A forrásokhoz teljes http vagy https linket adj meg.'); } }
    }
    if (!Array.isArray(r.tags) || r.tags.some(t=>typeof t!=='string'||t.length>200)) fail(400,'Hibás címkék.');
    if (!Array.isArray(r.locations) || r.locations.length>100) fail(400,'Hibás helyszínlista.');
    const ids = new Set();
    for (const l of r.locations) {
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(l.location_id||'') || ids.has(l.location_id)) fail(400,'A helyszínazonosítók legyenek egyediek.');
      ids.add(l.location_id); l.project_id=r.id;
      for(const key of ['name','city','address','parcel_id','location_precision','coordinate_status']) {if(l[key]==null)l[key]='';if(typeof l[key]!=='string'||l[key].length>3000)fail(400,'Hibás helyszínadat.');}
      for (const [key,max] of [['latitude',90],['longitude',180]]) if (l[key]!==null && (typeof l[key]!=='number'||!Number.isFinite(l[key])||Math.abs(l[key])>max)) fail(400,'Érvénytelen koordináta.');
      if ((l.latitude===null)!==(l.longitude===null)) fail(400,'Mindkét koordinátát add meg, vagy hagyd mindkettőt üresen.');
      l.coordinate_system='EPSG:4326';
    }
    r.location_ids=[...ids];
    if (JSON.stringify(r).length>250000) fail(413,'Túl nagy referencia.');
    return r;
  }
  const initial = seed.projects.map(p=>validate({...p,section:'krisztian',locations:seed.locations.filter(l=>l.project_id===p.id)}));
  function uniqueLocations(r) { const others=db.prepare('SELECT payload FROM reference_records WHERE id<>?').all(r.id).flatMap(row=>JSON.parse(row.payload).locations.map(l=>l.location_id)); if(r.locations.some(l=>others.includes(l.location_id))) fail(400,'Ez a helyszínazonosító már másik projekthez tartozik.'); }
  if (!db.prepare("SELECT 1 FROM reference_meta WHERE key='seed-v1'").get()) {
    db.exec('BEGIN IMMEDIATE');
    try { for (const p of initial) insert.run(p.id,JSON.stringify(p),new Date().toISOString()); db.prepare('INSERT INTO reference_meta VALUES(?,?)').run('seed-v1','1'); db.exec('COMMIT'); } catch(e) { db.exec('ROLLBACK'); throw e; }
  }
  // One-time migration preserves all existing edits and invalidates stale editors.
  if (!db.prepare("SELECT 1 FROM reference_meta WHERE key='owners-v1'").get()) {
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const row of db.prepare('SELECT * FROM reference_records').all()) {
        const p=JSON.parse(row.payload);
        if (p.section===undefined) { p.section='krisztian'; db.prepare('UPDATE reference_records SET payload=?,revision=revision+1 WHERE id=?').run(JSON.stringify(p),row.id); }
      }
      db.prepare('INSERT INTO reference_meta VALUES(?,?)').run('owners-v1','1'); db.exec('COMMIT');
    } catch(e) { db.exec('ROLLBACK'); throw e; }
  }
  // One-time taxonomy migration: keep existing category values where canonical; preserve unknown legacy labels.
  if (!db.prepare("SELECT 1 FROM reference_meta WHERE key='categories-v1'").get()) {
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const row of db.prepare('SELECT * FROM reference_records').all()) {
        const p = JSON.parse(row.payload), old = String(p.category || '');
        if (!isReferenceCategory(old)) {
          p.category_legacy = old;
          p.category = normalizeReferenceCategory(old);
          db.prepare('UPDATE reference_records SET payload=?,revision=revision+1 WHERE id=?').run(JSON.stringify(p), row.id);
        } else {
          const canonical = normalizeReferenceCategory(old);
          if (canonical !== old) { p.category = canonical; db.prepare('UPDATE reference_records SET payload=?,revision=revision+1 WHERE id=?').run(JSON.stringify(p), row.id); }
        }
      }
      db.prepare('INSERT INTO reference_meta VALUES(?,?)').run('categories-v1','1'); db.exec('COMMIT');
    } catch(e) { db.exec('ROLLBACK'); throw e; }
  }
  // Initial proposal for every existing reference. Nothing is silently approved: every imported suggestion is flagged for review.
  if (!db.prepare("SELECT 1 FROM reference_meta WHERE key='category-assignments-v1'").get()) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const timestamp = new Date().toISOString();
      for (const row of db.prepare('SELECT * FROM reference_records ORDER BY id').all()) {
        const p = JSON.parse(row.payload), suggestion = INITIAL_REFERENCE_CLASSIFICATION[row.id];
        if (suggestion) {
          p.category_main_id = suggestion[0].replace('kozintézmenyek','kozintezmenyek');
          p.category_sub_id = suggestion[1];
          p.category_review_status = suggestion[2];
          p.category_review_note = INITIAL_REFERENCE_REVIEW_NOTES[row.id] || '';
        } else {
          p.category_main_id = null; p.category_sub_id = null; p.category_review_status = 'Besorolatlan'; p.category_review_note = '';
        }
        p.category_legacy = p.category_legacy || p.category || '';
        db.prepare('UPDATE reference_records SET payload=?,revision=revision+1,updated_at=? WHERE id=?').run(JSON.stringify(p),timestamp,row.id);
      }
      db.prepare('INSERT INTO reference_meta VALUES(?,?)').run('category-assignments-v1','1'); db.exec('COMMIT');
    } catch(e) { db.exec('ROLLBACK'); throw e; }
  }
  // Website titles. The Hungarian title always holds a value (the project name when left empty). The English title remembers
  // which Hungarian title it was written for (website_title_en_source); when the two differ, the English one needs a review.
  // The source is kept by the server: it moves only when the English title itself is edited.
  const titleOf = r => (r.website_title_hu||'').trim() || String(r.name||'').trim().slice(0,160);
  function siteTitles(r, old) {
    r.website_title_hu = titleOf(r);
    r.website_title_en = r.website_title_en.trim();
    if (!r.website_title_en) r.website_title_en_source = '';
    else if (!old || r.website_title_en !== (old.website_title_en||'').trim()) r.website_title_en_source = r.website_title_hu;
    else r.website_title_en_source = old.website_title_en_source || titleOf(old);
    return r;
  }
  function categoryTree() {
    const groups = db.prepare('SELECT id,name,sort_order,created_at FROM reference_category_groups ORDER BY sort_order,name').all();
    const records = db.prepare('SELECT payload FROM reference_records').all().map(row=>JSON.parse(row.payload));
    return groups.map(g => ({
      ...g,
      categories: db.prepare('SELECT id,parent_id,name,sort_order,created_at FROM reference_categories WHERE parent_id=? ORDER BY sort_order,name').all(g.id).map(c => ({
        ...c, reference_count: records.filter(r=>r.category_sub_id===c.id).length
      })),
      reference_count: records.filter(r=>r.category_main_id===g.id).length
    }));
  }
  const categoryName = value => {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 100 || /[\u0000-\u001f\u007f]/.test(value)) fail(400,'A kategórianév 1–100 karakter legyen.');
    return value.trim();
  };
  function createCategory(data) {
    if (!data || typeof data !== 'object') fail(400,'Hibás kategóriaadat.');
    const name = categoryName(data.name), created = new Date().toISOString(), id = randomUUID();
    if (data.kind === 'group') db.prepare('INSERT INTO reference_category_groups VALUES(?,?,?,?)').run(id,name,Number.isInteger(data.sort_order)?data.sort_order:100,created);
    else if (data.kind === 'subcategory') {
      if (typeof data.parent_id !== 'string' || !db.prepare('SELECT 1 FROM reference_category_groups WHERE id=?').get(data.parent_id)) fail(400,'Válassz létező főkategóriát.');
      db.prepare('INSERT INTO reference_categories VALUES(?,?,?,?,?)').run(id,data.parent_id,name,Number.isInteger(data.sort_order)?data.sort_order:100,created);
    } else fail(400,'A kategória típusa főkategória vagy alkategória lehet.');
    return categoryTree();
  }
  function updateCategory(id,data) {
    const name = categoryName(data?.name);
    if (db.prepare('SELECT 1 FROM reference_category_groups WHERE id=?').get(id)) db.prepare('UPDATE reference_category_groups SET name=?,sort_order=? WHERE id=?').run(name,Number.isInteger(data.sort_order)?data.sort_order:100,id);
    else if (db.prepare('SELECT 1 FROM reference_categories WHERE id=?').get(id)) db.prepare('UPDATE reference_categories SET name=?,sort_order=? WHERE id=?').run(name,Number.isInteger(data.sort_order)?data.sort_order:100,id);
    else fail(404,'A kategória nem található.');
    return categoryTree();
  }
  function deleteCategory(id) {
    const group = db.prepare('SELECT 1 FROM reference_category_groups WHERE id=?').get(id);
    if (group) {
      if (db.prepare('SELECT 1 FROM reference_categories WHERE parent_id=? LIMIT 1').get(id)) fail(409,'A főkategória nem törölhető, amíg alkategóriái vannak.');
      if (db.prepare('SELECT payload FROM reference_records').all().some(row=>JSON.parse(row.payload).category_main_id===id)) fail(409,'A főkategória még referenciákhoz tartozik.');
      db.prepare('DELETE FROM reference_category_groups WHERE id=?').run(id);
    } else if (db.prepare('SELECT 1 FROM reference_categories WHERE id=?').get(id)) {
      if (db.prepare('SELECT payload FROM reference_records').all().some(row=>JSON.parse(row.payload).category_sub_id===id)) fail(409,'Az alkategória még referenciákhoz tartozik. Előbb sorold át a referenciákat.');
      db.prepare('DELETE FROM reference_categories WHERE id=?').run(id);
    } else fail(404,'A kategória nem található.');
    return categoryTree();
  }

  const store = {
    get:id=>get(id),
    categories:categoryTree,
    createCategory,
    updateCategory,
    deleteCategory,
    // One step for every reference: an empty Hungarian website title takes the project name, an empty English one takes the
    // given translation. Filled titles are never overwritten; merged-away records are left alone.
    fillWebsiteTitles(titles) {
      if (!titles || typeof titles !== 'object' || Array.isArray(titles) || Object.keys(titles).length > 2000) fail(400,'Hibás címlista.');
      for (const [id,en] of Object.entries(titles)) if (typeof en !== 'string' || en.trim().length > 160 || /[\u0000-\u001f\u007f]/.test(en)) fail(400,'Hibás vagy túl hosszú angol cím: '+id);
      const result = { hu_filled:0, en_filled:0, unchanged:0, skipped_merged:0, unknown_ids:Object.keys(titles).filter(id=>!db.prepare('SELECT 1 FROM reference_records WHERE id=?').get(id)) };
      db.exec('BEGIN IMMEDIATE');
      try {
        const now = new Date().toISOString();
        for (const row of db.prepare('SELECT * FROM reference_records ORDER BY id').all()) {
          const p = JSON.parse(row.payload);
          if (p.merged_into) { result.skipped_merged++; continue; }
          let changed = false;
          if (!(p.website_title_hu||'').trim()) { p.website_title_hu = titleOf(p); result.hu_filled++; changed = true; }
          const en = (titles[row.id]||'').trim();
          if (!(p.website_title_en||'').trim() && en) { p.website_title_en = en; p.website_title_en_source = p.website_title_hu; result.en_filled++; changed = true; }
          if (!changed) { result.unchanged++; continue; }
          db.prepare('UPDATE reference_records SET payload=?,revision=revision+1,updated_at=? WHERE id=?').run(JSON.stringify(p),now,row.id);
        }
        db.exec('COMMIT');
      } catch(e) { db.exec('ROLLBACK'); throw e; }
      return result;
    },
    list:()=>db.prepare('SELECT id FROM reference_records ORDER BY id').all().map(r=>get(r.id)),
    create(p) { const r=siteTitles(validate({...p,deleted_at:null,id:`GAUT-REF-${randomUUID()}`}),null); uniqueLocations(r); insert.run(r.id,JSON.stringify(r),new Date().toISOString()); return get(r.id); },
    update(id,p) { const old=get(id); if(p.revision!==old.revision) fail(409,'Közben valaki módosította ezt a referenciát. Nyisd meg újra a friss adatokat; a mentés nem írta felül őket.'); if(old.merged_into)fail(409,'Ez a tétel már össze lett vonva.'); if(!p.sections&&old.sections.length>1)fail(409,'Frissítsd az oldalt a több résztvevő mentéséhez.'); if(p.section!==old.section&&JSON.stringify(p.sections)===JSON.stringify(old.sections)){if(old.sections.length>1)fail(409,'Frissítsd az oldalt.');p={...p,sections:[p.section]};} const r=siteTitles(validate({...p,id,deleted_at:old.deleted_at,merged_into:old.merged_into}),old); uniqueLocations(r); db.prepare('UPDATE reference_records SET payload=?,revision=revision+1,updated_at=? WHERE id=?').run(JSON.stringify(r),new Date().toISOString(),id); return get(id); },
    trash(id,revision,restore=false) {
      const old=get(id);
      if(old.merged_into)fail(409,'Az összevonást az Összevonások résznél lehet visszavonni.');
      if(revision!==old.revision) fail(409,'Közben módosult a referencia. Frissítsd a listát, és próbáld újra.');
      const {revision:ignoredRevision,updated_at:ignoredUpdated,...p}=old;
      p.deleted_at=restore?null:new Date().toISOString();
      db.prepare('UPDATE reference_records SET payload=?,revision=revision+1,updated_at=? WHERE id=?').run(JSON.stringify(p),new Date().toISOString(),id);
      return get(id);
    },
    merge(plan) {
      if(!Array.isArray(plan.groups)||!plan.groups.length||plan.groups.length>100)fail(400,'Hibás összevonási lista.');
      const used=new Set();const prepared=plan.groups.map(g=>{
        if(!Array.isArray(g.records)||g.records.length<2||g.records.length>20)fail(400,'Legalább két tétel szükséges.');
        const rows=g.records.map(x=>{if(used.has(x.id))fail(400,'Egy tétel csak egy csoportban szerepelhet.');used.add(x.id);const r=get(x.id);if(r.revision!==x.revision)fail(409,'Közben módosult: '+r.name);if(r.deleted_at||r.archived||r.merged_into)fail(409,'Csak aktív tételek vonhatók össze.');return r;});
        if(typeof g.name!=='string'||!g.name.trim())fail(400,'Az összevont projekt neve kötelező.');
        if(g.additional_sections!==undefined&&(!Array.isArray(g.additional_sections)||g.additional_sections.some(x=>!OWNERS.includes(x))))fail(400,'Hibás résztvevőlista.');
        const target=rows[0],r={...target,name:g.name,sections:[...new Set([...rows.flatMap(x=>x.sections),...(g.additional_sections||[])])],sources:[],photo_sources:[],tags:[],locations:[]};
        for(const key of ['sources','photo_sources'])r[key]=[...new Map(rows.flatMap(x=>x[key]).map(x=>[JSON.stringify(x),x])).values()];
        r.tags=[...new Set(rows.flatMap(x=>x.tags))];r.locations=rows.flatMap(x=>x.locations.map(l=>({...l,project_id:target.id})));
        r.design_year=[...new Set(rows.map(x=>x.design_year).filter(Boolean))].join(' / ');
        for(const key of ['scope_from_pdf','background','technical_detail','questions','attribution','website_copy_draft']){
          const values=[...new Set(rows.map(x=>x[key]||'').filter(Boolean))];
          r[key]=values.length<2?(values[0]||''):rows.filter(x=>x[key]).map(x=>'['+x.sections.map(o=>LABELS[o]).join(', ')+' · '+x.design_year+' · '+x.id+']\n'+x[key]).join('\n\n');
        }
        // Publication remains opt-in after combining multiple work descriptions.
        r.website_publishable=rows.every(x=>x.website_publishable===true);
        r.merged_from=[...new Set(rows.flatMap(x=>[...(x.merged_from||[]),x.id]).filter(id=>id!==target.id))];
        return {rows,record:validate(r)};
      });
      db.exec('BEGIN IMMEDIATE');try{
        for(const {rows,record} of prepared){
          const now=new Date().toISOString(),id=randomUUID(),target=rows[0];
          const photoRows=db.prepare('SELECT id,reference_id FROM reference_photos').all().filter(p=>rows.some(r=>r.id===p.reference_id));
          const research=db.prepare('SELECT * FROM reference_photo_research').all().filter(p=>rows.some(r=>r.id===p.reference_id));
          const history={target_id:target.id,records:rows,photos:photoRows,research,target_revision:target.revision+1};
          for(const source of rows.slice(1)){
            const p={...source,locations:[],location_ids:[],merged_into:target.id,deleted_at:now};delete p.revision;delete p.updated_at;
            db.prepare('UPDATE reference_records SET payload=?,revision=revision+1,updated_at=? WHERE id=?').run(JSON.stringify(p),now,source.id);
            db.prepare('UPDATE reference_photos SET reference_id=? WHERE reference_id=?').run(target.id,source.id);
          }
          uniqueLocations(record);
          db.prepare('UPDATE reference_records SET payload=?,revision=revision+1,updated_at=? WHERE id=?').run(JSON.stringify(record),now,target.id);
          if(research.length){const combined={reference_id:target.id,status:'Összevont kutatási jegyzetek',note:research.map(x=>{const p=JSON.parse(x.payload);return x.reference_id+': '+(p.note||p.status||'');}).join('\n'),checked_on:now.slice(0,10)};db.prepare('INSERT INTO reference_photo_research VALUES(?,?) ON CONFLICT(reference_id) DO UPDATE SET payload=excluded.payload').run(target.id,JSON.stringify(combined));}
          db.prepare('INSERT INTO reference_merges VALUES(?,?,?,NULL)').run(id,JSON.stringify(history),now);
        }db.exec('COMMIT');
      }catch(e){db.exec('ROLLBACK');throw e;}
      return {merged:prepared.length,removed:prepared.reduce((n,g)=>n+g.rows.length-1,0)};
    },
    merges(){return db.prepare('SELECT * FROM reference_merges ORDER BY created_at DESC').all().map(row=>({id:row.id,created_at:row.created_at,undone_at:row.undone_at,...JSON.parse(row.payload)}));},
    undoMerge(id){
      const row=db.prepare('SELECT * FROM reference_merges WHERE id=?').get(id);if(!row||row.undone_at)fail(404,'Az összevonás nem található.');
      const h=JSON.parse(row.payload);for(const p of h.records){const current=get(p.id);if(current.revision!==(p.id===h.target_id?h.target_revision:p.revision+1))fail(409,'Azóta módosult a referencia. A visszavonáshoz előbb egyeztessétek a módosításokat.');}
      db.exec('BEGIN IMMEDIATE');try{const now=new Date().toISOString();for(const p of h.records){const clean={...p};delete clean.revision;delete clean.updated_at;db.prepare('UPDATE reference_records SET payload=?,revision=revision+1,updated_at=? WHERE id=?').run(JSON.stringify(clean),now,p.id);db.prepare('DELETE FROM reference_photo_research WHERE reference_id=?').run(p.id);}for(const p of h.photos)db.prepare('UPDATE reference_photos SET reference_id=? WHERE id=?').run(p.reference_id,p.id);for(const p of h.research)db.prepare('INSERT INTO reference_photo_research VALUES(?,?)').run(p.reference_id,p.payload);db.prepare('UPDATE reference_merges SET undone_at=? WHERE id=?').run(now,id);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return {ok:true};
    },
    import(bundle) {
      if (!Array.isArray(bundle.projects)||bundle.projects.length>1000||!Array.isArray(bundle.locations)) fail(400,'GAUT referencia JSON fájlt válassz.');
      const entries=bundle.projects.map(p=>validate({...p,locations:bundle.locations.filter(l=>l.project_id===p.id)}));
      let added=0,skipped=0; db.exec('BEGIN IMMEDIATE');
      try { for(const r of entries) { if(db.prepare('SELECT 1 FROM reference_records WHERE id=?').get(r.id)) { skipped++;continue; } uniqueLocations(r); insert.run(r.id,JSON.stringify(r),new Date().toISOString()); added++; } db.exec('COMMIT'); } catch(e) {db.exec('ROLLBACK');throw e;}
      return {added,skipped};
    },
    bundle() { const records=this.list(); return {...seed,exported_at:new Date().toISOString(),merge_history:this.merges(),projects:records.map(p=>{const {locations,...rest}=p;return rest;}),locations:records.flatMap(p=>p.locations)}; }
  };
  return store;
}
