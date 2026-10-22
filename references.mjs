import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const LABELS={common:'Közös',misi:'Misi',nandi:'Nándi',attila:'Attila',krisztian:'Krisztián'};
const OWNERS = ['common', 'misi', 'nandi', 'attila', 'krisztian'];
export function referenceStore(db) {
  const seed = JSON.parse(readFileSync(new URL('./seed/references.json', import.meta.url), 'utf8'));
  db.exec('CREATE TABLE IF NOT EXISTS reference_records(id TEXT PRIMARY KEY,payload TEXT NOT NULL,revision INTEGER NOT NULL,updated_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS reference_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL)');
  db.exec('CREATE TABLE IF NOT EXISTS reference_merges(id TEXT PRIMARY KEY,payload TEXT NOT NULL,created_at TEXT NOT NULL,undone_at TEXT)');
  const insert = db.prepare('INSERT INTO reference_records VALUES(?,?,1,?)');
  const get = id => { const r = db.prepare('SELECT * FROM reference_records WHERE id=?').get(id); if (!r) fail(404,'A referencia nem található.'); const p=JSON.parse(r.payload); return { deleted_at:null, website_publishable:false, ...p, sections:p.sections||[p.section||'common'], revision:r.revision, updated_at:r.updated_at }; };
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
    for (const key of ['design_year','category','city','address','identification_status','scope_from_pdf','background','questions','publication_status','attribution','website_copy_draft','technical_detail']) { if(r[key]===undefined) r[key]=''; if(typeof r[key]!=='string') fail(400,'A szöveges mezőkben szöveget adj meg.'); }
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
  const store = {
    list:()=>db.prepare('SELECT id FROM reference_records ORDER BY id').all().map(r=>get(r.id)),
    create(p) { const r=validate({...p,deleted_at:null,id:`GAUT-REF-${randomUUID()}`}); uniqueLocations(r); insert.run(r.id,JSON.stringify(r),new Date().toISOString()); return get(r.id); },
    update(id,p) { const old=get(id); if(p.revision!==old.revision) fail(409,'Közben valaki módosította ezt a referenciát. Nyisd meg újra a friss adatokat; a mentés nem írta felül őket.'); if(old.merged_into)fail(409,'Ez a tétel már össze lett vonva.'); if(!p.sections&&old.sections.length>1)fail(409,'Frissítsd az oldalt a több résztvevő mentéséhez.'); if(p.section!==old.section&&JSON.stringify(p.sections)===JSON.stringify(old.sections)){if(old.sections.length>1)fail(409,'Frissítsd az oldalt.');p={...p,sections:[p.section]};} const r=validate({...p,id,deleted_at:old.deleted_at,merged_into:old.merged_into}); uniqueLocations(r); db.prepare('UPDATE reference_records SET payload=?,revision=revision+1,updated_at=? WHERE id=?').run(JSON.stringify(r),new Date().toISOString(),id); return get(id); },
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
