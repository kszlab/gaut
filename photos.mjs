import {mkdirSync,writeFileSync,readFileSync,unlinkSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const field=(v,max=2000)=>{if(v==null)return '';if(typeof v!=='string'||v.length>max)fail(400,'Hibás vagy túl hosszú képadat.');return v.trim();};
export function photoStore(db,dataDir){
 const directory=join(dataDir,'reference-photos');mkdirSync(directory,{recursive:true});
 db.exec(`CREATE TABLE IF NOT EXISTS reference_photos(id TEXT PRIMARY KEY,reference_id TEXT NOT NULL REFERENCES reference_records(id),filename TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,metadata TEXT NOT NULL,created_at TEXT NOT NULL,deleted_at TEXT,seed_key TEXT UNIQUE);CREATE INDEX IF NOT EXISTS reference_photos_reference ON reference_photos(reference_id);CREATE TABLE IF NOT EXISTS reference_photo_research(reference_id TEXT PRIMARY KEY REFERENCES reference_records(id),payload TEXT NOT NULL)`);
 // One-time fill (run once per database, kept in photo_migrations): photos that came earlier from Wikimedia Commons or Wikipedia with
 // their author and licence already noted get the website credit line those licences ask for. Later edits or a cleared field stay as they are.
 db.exec('CREATE TABLE IF NOT EXISTS photo_migrations(name TEXT PRIMARY KEY,done_at TEXT NOT NULL)');
 if(!db.prepare('SELECT 1 FROM photo_migrations WHERE name=?').get('wikimedia-public-credit')){
  const licenceOf=m=>{const named=/^((?:CC|Public domain|PD)[^–]*?)\s+–/i.exec(m.reuse_status||'')?.[1];if(named)return named.trim();const u=/creativecommons\.org\/(licenses|publicdomain)\/([a-z-]+)\/([\d.]+)/i.exec(m.license_url||'');return u?(u[1]==='publicdomain'?'CC0':`CC ${u[2].toUpperCase()} ${u[3]}`):'';};
  db.exec('BEGIN IMMEDIATE');
  try{for(const r of db.prepare('SELECT id,metadata FROM reference_photos').all()){const m=JSON.parse(r.metadata);let host='';try{host=new URL(m.source_url).hostname;}catch{}
   const site=/(^|\.)wikimedia\.org$/i.test(host)?'Wikimedia Commons':/(^|\.)wikipedia\.org$/i.test(host)?'Wikipédia':'';const licence=licenceOf(m);
   if(!site||m.public_credit||!m.credit||!licence)continue;
   db.prepare('UPDATE reference_photos SET metadata=? WHERE id=?').run(JSON.stringify({...m,public_credit:`Fotó: ${m.credit.slice(0,120)} / ${site}, ${licence}`.slice(0,300)}),r.id);}
   db.prepare('INSERT INTO photo_migrations VALUES(?,?)').run('wikimedia-public-credit',new Date().toISOString());db.exec('COMMIT');}
  catch(e){db.exec('ROLLBACK');throw e;}
 }
 function reference(id){if(!db.prepare('SELECT 1 FROM reference_records WHERE id=?').get(id))fail(404,'A referencia nem található.');}
 function get(id){const r=db.prepare('SELECT * FROM reference_photos WHERE id=?').get(id);if(!r)fail(404,'A kép nem található.');const {metadata,...rest}=r;return {...rest,...JSON.parse(metadata)};}
 function meta(b){const r={caption:field(b.caption),source_url:field(b.source_url),credit:field(b.credit),reuse_status:field(b.reuse_status)||'Felhasználási engedély pontosítandó',license_url:field(b.license_url),public_credit:field(b.public_credit,300)};for(const key of ['source_url','license_url'])if(r[key]){try{if(!['https:','http:'].includes(new URL(r[key]).protocol))throw Error();}catch{fail(400,'A forrás és licenc csak http vagy https link lehet.');}}return r;}
 const store={
 // Imported photos carry a key (a photo pack's import_key, or wm-<reference>-<Commons page id>), so nothing comes in twice, not even after the trash.
 hasSeedKey(key){return Boolean(db.prepare('SELECT 1 FROM reference_photos WHERE seed_key=?').get(key));},
 seedKeyCount(prefix){return db.prepare("SELECT COUNT(*) AS n FROM reference_photos WHERE substr(seed_key,1,?)=?").get(prefix.length,prefix).n;},
 research(id){const r=db.prepare('SELECT payload FROM reference_photo_research WHERE reference_id=?').get(id);return r?JSON.parse(r.payload):null;},
 list(id){reference(id);return db.prepare('SELECT id FROM reference_photos WHERE reference_id=? ORDER BY created_at').all(id).map(r=>get(r.id));},
 all(){return db.prepare('SELECT id FROM reference_photos ORDER BY created_at').all().map(r=>get(r.id));},
 import(bundle){
  if(!Array.isArray(bundle.photos)||bundle.photos.length>200||!Array.isArray(bundle.research||[])||(bundle.research||[]).length>1000)fail(400,'Érvénytelen GAUT képcsomag.');
  let added=0,skipped=0;const errors=[];
  for(const p of bundle.photos){try{const key=field(p.import_key,200);if(!/^[A-Za-z0-9_-]{1,200}$/.test(key))fail(400,'Érvénytelen képimport-azonosító.');const result=this.add(p.reference_id,p,key);if(result)added++;else skipped++;}catch(e){errors.push({reference_id:field(p.reference_id,100),error:e.status?e.message:'A kép nem menthető.'});}}
  for(const r of bundle.research||[]){if(!db.prepare('SELECT 1 FROM reference_records WHERE id=?').get(r.reference_id))continue;const data={reference_id:r.reference_id,status:field(r.status,200),note:field(r.note,3000),checked_on:field(r.checked_on,100)};db.prepare('INSERT INTO reference_photo_research VALUES(?,?) ON CONFLICT(reference_id) DO UPDATE SET payload=excluded.payload').run(r.reference_id,JSON.stringify(data));}
  return {added,skipped,errors};
 },
 add(referenceId,b,seedKey=null){reference(referenceId);if(seedKey&&db.prepare('SELECT 1 FROM reference_photos WHERE seed_key=?').get(seedKey))return null;
  if(typeof b.content!=='string'||b.content.length>28*1024*1024||!b.content.length||b.content.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(b.content))fail(400,'Érvénytelen képfájl.');
  const bytes=Buffer.from(b.content,'base64');if(bytes.length>20*1024*1024)fail(413,'A kép legfeljebb 20 MB lehet.');
  let mime;if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))mime='image/png';else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)mime='image/jpeg';else if(['GIF87a','GIF89a'].includes(bytes.subarray(0,6).toString()))mime='image/gif';else if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')mime='image/webp';else fail(400,'JPG, PNG, WEBP vagy GIF képet tölts fel.');
  const metadata=meta(b),filename=field(b.filename,240).replace(/[\\/\x00-\x1f\x7f]/g,'_')||'kep',id=randomUUID(),file=join(directory,id);writeFileSync(file,bytes,{flag:'wx',mode:0o600});
  try{db.prepare('INSERT INTO reference_photos VALUES(?,?,?,?,?,?,?,NULL,?)').run(id,referenceId,filename,mime,bytes.length,JSON.stringify(metadata),new Date().toISOString(),seedKey);}catch(e){unlinkSync(file);throw e;}return get(id);
 },
 update(id,b){get(id);db.prepare('UPDATE reference_photos SET metadata=? WHERE id=?').run(JSON.stringify(meta(b)),id);return get(id);},
 trash(id,restore=false){get(id);db.prepare('UPDATE reference_photos SET deleted_at=? WHERE id=?').run(restore?null:new Date().toISOString(),id);return get(id);},
 file(id){const p=get(id),path=join(directory,id);if(!existsSync(path))fail(404,'A képfájl hiányzik.');return {...p,path};}
 };
 return store;
}
