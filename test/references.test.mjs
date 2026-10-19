import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeServer } from '../server.mjs';
import { DatabaseSync } from 'node:sqlite';
test('Referenciák: belépés, import, módosítás, ütközés és újraindítás',async()=>{
 const dataDir=mkdtempSync(join(tmpdir(),'gaut-ref-')),password='reference-test-password';let server,base,cookie='';
 async function start(){server=makeServer({dataDir,password});await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;}
 async function request(path,method='GET',data){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json','X-Gaut-Request':'1',Cookie:cookie},body:data===undefined?undefined:JSON.stringify(data)});const b=await r.json();return {status:r.status,data:b,headers:r.headers};}
 try{await start();assert.equal((await request('/api/references')).status,401);const login=await request('/api/login','POST',{password});cookie=login.headers.get('set-cookie').split(';')[0];let rows=(await request('/api/references')).data.references;assert.equal(rows.length,43);assert.equal(rows.flatMap(r=>r.locations).length,50);
 assert.ok(rows.every(r=>r.section==='krisztian'));
 const old=rows[0],changed={...old,section:'misi',name:'Módosított referencia',locations:old.locations.map(l=>({...l,latitude:47.5,longitude:19.05}))};assert.equal((await request(`/api/references/${old.id}`,'PUT',changed)).status,200);assert.equal((await request(`/api/references/${old.id}`,'PUT',old)).status,409);
 assert.equal((await request('/api/references','POST',{...old,section:'invalid',locations:[]})).status,400);
 assert.equal((await request('/api/references','POST',{...old,sources:[{url:'javascript:alert(1)'}]})).status,400);assert.equal((await request('/api/references','POST',{...old,locations:[{...old.locations[0],latitude:95,longitude:19}]})).status,400);
 const created=await request('/api/references','POST',{...old,name:'Új projekt',locations:[]});assert.equal(created.status,201);assert.notEqual(created.data.reference.id,old.id);
 const bundle=(await request('/api/references/export')).data;assert.equal(bundle.projects.length,44);assert.equal((await request('/api/references/import','POST',bundle)).data.skipped,44);
 const p={...bundle.projects[0],id:'GAUT-REF-IMPORT'};const imported=await request('/api/references/import','POST',{projects:[p],locations:[]});assert.equal(imported.data.added,1);
 await new Promise(r=>server.close(r));
 // Simulate an existing deployment with edited records but no owner migration yet.
 const legacy=new DatabaseSync(join(dataDir,'gaut.sqlite'));
 const legacyId=rows[1].id, legacyRow=legacy.prepare('SELECT payload FROM reference_records WHERE id=?').get(legacyId), legacyData=JSON.parse(legacyRow.payload); delete legacyData.section;legacyData.name='Korábbi szerkesztés megőrizve';legacy.prepare('UPDATE reference_records SET payload=? WHERE id=?').run(JSON.stringify(legacyData),legacyId);legacy.prepare("DELETE FROM reference_meta WHERE key='owners-v1'").run();legacy.close();
 await start();rows=(await request('/api/references')).data.references;assert.equal(rows.length,45);assert.equal(rows.find(r=>r.id===old.id).name,'Módosított referencia');assert.equal(rows.find(r=>r.id===old.id).section,'misi');assert.equal(rows.find(r=>r.id===old.id).locations[0].latitude,47.5);assert.equal(rows.find(r=>r.id===legacyId).section,'krisztian');assert.equal(rows.find(r=>r.id===legacyId).name,'Korábbi szerkesztés megőrizve');
 const html=await fetch(base+'/referenciak');assert.equal(html.status,200);assert.ok((await html.text()).includes('/references.js'));
 }finally{if(server?.listening)await new Promise(r=>server.close(r));rmSync(dataDir,{recursive:true,force:true});}
});
