import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {referenceStore} from '../references.mjs';
import {photoStore} from '../photos.mjs';
test('Több résztvevő, veszteségmentes összevonás és visszavonás',()=>{
 const dir=mkdtempSync(join(tmpdir(),'gaut-merge-')),db=new DatabaseSync(':memory:');
 try{
 const store=referenceStore(db),photos=photoStore(db,dir),base=store.list()[0];
 const a=store.create({...base,sections:['attila','common'],section:'attila',locations:[],scope_from_pdf:'Attila munkarésze',website_publishable:true});
 const b=store.create({...base,sections:['nandi'],section:'nandi',locations:[{...base.locations[0],location_id:'LOC-MERGE-TEST'}],scope_from_pdf:'Nándi munkarésze'});
 assert.deepEqual(a.sections,['common','attila']);assert.deepEqual(b.sections,['nandi']);
 assert.throws(()=>store.create({...base,locations:[],sections:[]}),e=>e.status===400);
 assert.throws(()=>store.create({...base,locations:[],sections:['unknown']}),e=>e.status===400);
 assert.throws(()=>store.update(a.id,{...a,sections:undefined}),e=>e.status===409);
 const image=photos.add(b.id,{content:Buffer.from([137,80,78,71,13,10,26,10]).toString('base64'),filename:'test.png',caption:'Nándi képe'});
 const group={name:'Közös projekt',records:[{id:a.id,revision:a.revision},{id:b.id,revision:b.revision}]};
 assert.throws(()=>store.merge({groups:[group,{name:'Ütközés',records:group.records}]}),e=>e.status===400);
 assert.equal(store.list().find(r=>r.id===b.id).merged_into,undefined);
 assert.deepEqual(store.merge({groups:[group]}),{merged:1,removed:1});
 const merged=store.list().find(r=>r.id===a.id),source=store.list().find(r=>r.id===b.id);
 assert.deepEqual(merged.sections,['common','nandi','attila']);assert.ok(merged.scope_from_pdf.includes('Attila munkarésze'));assert.ok(merged.scope_from_pdf.includes('Nándi munkarésze'));
 assert.equal(merged.website_publishable,false);assert.equal(merged.locations[0].location_id,'LOC-MERGE-TEST');assert.equal(merged.locations[0].project_id,a.id);assert.equal(source.merged_into,a.id);assert.equal(source.locations.length,0);
 assert.equal(photos.list(a.id)[0].id,image.id);assert.equal(photos.list(a.id)[0].caption,'Nándi képe');
 assert.throws(()=>store.trash(b.id,source.revision,true),e=>e.status===409);
 assert.throws(()=>store.update(b.id,source),e=>e.status===409);
 assert.equal(store.bundle().merge_history[0].records[1].locations[0].location_id,'LOC-MERGE-TEST');
 const history=store.merges()[0];store.undoMerge(history.id);
 assert.equal(photos.list(b.id)[0].id,image.id);assert.deepEqual(store.list().find(r=>r.id===b.id).sections,['nandi']);assert.equal(store.list().find(r=>r.id===b.id).deleted_at,null);assert.equal(store.list().find(r=>r.id===a.id).name,a.name);
 assert.throws(()=>store.undoMerge(history.id),e=>e.status===404);
 const current=store.list(),again={...group,records:[a,b].map(r=>({id:r.id,revision:current.find(x=>x.id===r.id).revision}))};store.merge({groups:[again]});const latest=store.merges().find(m=>!m.undone_at);const updated=store.list().find(r=>r.id===a.id);store.update(a.id,{...updated,name:'Későbbi szerkesztés'});assert.throws(()=>store.undoMerge(latest.id),e=>e.status===409);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
