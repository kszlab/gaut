import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const OWNERS = ['common', 'misi', 'nandi', 'attila', 'krisztian'];
export function referenceStore(db) {
  const seed = JSON.parse(readFileSync(new URL('./seed/references.json', import.meta.url), 'utf8'));
  db.exec('CREATE TABLE IF NOT EXISTS reference_records(id TEXT PRIMARY KEY,payload TEXT NOT NULL,revision INTEGER NOT NULL,updated_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS reference_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL)');
  const insert = db.prepare('INSERT INTO reference_records VALUES(?,?,1,?)');
  const get = id => { const r = db.prepare('SELECT * FROM reference_records WHERE id=?').get(id); if (!r) fail(404,'A referencia nem található.'); return { website_publishable:false, ...JSON.parse(r.payload), revision:r.revision, updated_at:r.updated_at }; };
  function validate(p) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) fail(400,'Hibás referencia.');
    const r = structuredClone(p); delete r.revision; delete r.updated_at; delete r.photo_count; delete r.photo_cover_id; delete r.photo_research;
    if (r.website_publishable === undefined) r.website_publishable = false;
    if (typeof r.website_publishable !== 'boolean') fail(400,'Invalid website publication flag.');
    if (r.section === undefined) r.section = 'common';
    if (!OWNERS.includes(r.section)) fail(400,'Válassz érvényes referencia-gyűjtőrészt.');
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
    create(p) { const r=validate({...p,id:`GAUT-REF-${randomUUID()}`}); uniqueLocations(r); insert.run(r.id,JSON.stringify(r),new Date().toISOString()); return get(r.id); },
    update(id,p) { const old=get(id); if(p.revision!==old.revision) fail(409,'Közben valaki módosította ezt a referenciát. Nyisd meg újra a friss adatokat; a mentés nem írta felül őket.'); const r=validate({...p,id}); uniqueLocations(r); db.prepare('UPDATE reference_records SET payload=?,revision=revision+1,updated_at=? WHERE id=?').run(JSON.stringify(r),new Date().toISOString(),id); return get(id); },
    import(bundle) {
      if (!Array.isArray(bundle.projects)||bundle.projects.length>1000||!Array.isArray(bundle.locations)) fail(400,'GAUT referencia JSON fájlt válassz.');
      const entries=bundle.projects.map(p=>validate({...p,locations:bundle.locations.filter(l=>l.project_id===p.id)}));
      let added=0,skipped=0; db.exec('BEGIN IMMEDIATE');
      try { for(const r of entries) { if(db.prepare('SELECT 1 FROM reference_records WHERE id=?').get(r.id)) { skipped++;continue; } uniqueLocations(r); insert.run(r.id,JSON.stringify(r),new Date().toISOString()); added++; } db.exec('COMMIT'); } catch(e) {db.exec('ROLLBACK');throw e;}
      return {added,skipped};
    },
    bundle() { const records=this.list(); return {...seed,exported_at:new Date().toISOString(),projects:records.map(p=>{const {locations,...rest}=p;return rest;}),locations:records.flatMap(p=>p.locations)}; }
  };
  return store;
}
