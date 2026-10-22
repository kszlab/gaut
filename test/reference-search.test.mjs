import test from 'node:test';import assert from 'node:assert/strict';import {matchesReference} from '../public/reference-search.js';
test('Szabadszavas keresés és több név együttes szűrése',()=>{
 const r={name:'ING Bank – Dózsa György úti székház',sections:['attila','nandi']};
 assert.ok(matchesReference(r,'ING Székház',['attila','nandi']));
 assert.ok(matchesReference(r,'szekhaz ING',['nandi']));
 assert.ok(matchesReference(r,'  ING   SZÉKHÁZ  '));
 assert.ok(matchesReference(r,'ING',['misi','attila']));
 assert.equal(matchesReference(r,'ING',['misi','krisztian']),false);
 assert.equal(matchesReference(r,'ING kórház'),false);
 assert.equal(matchesReference(r,'ING',['common']),false);
 assert.ok(matchesReference({name:'Közös projekt',sections:['common','misi']},'kozos',['common']));
});
