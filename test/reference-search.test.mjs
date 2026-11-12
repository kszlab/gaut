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

test('a keresés csak az értékekben keres, a mezőnevekben és a technikai mezőkben nem',()=>{
 const r={id:'ref-7',name:'ING Bank székház',city:'Budapest',archived:false,revision:3,updated_at:'2026-11-12T10:00:00Z',website_photos:['foto-azonosito'],locations:[{name:'Iroda',latitude:47.5}],tags:['automatika'],sections:['common']};
 for(const word of ['city','name','false','archived','locations','latitude','tags','revision','updated_at','2026','foto-azonosito'])assert.equal(matchesReference(r,word),false,word);
 for(const word of ['budapest','szekhaz','iroda','47.5','automatika','ref-7'])assert.ok(matchesReference(r,word),word);
 assert.ok(matchesReference(r,'automatika iroda'));
 assert.equal(matchesReference(r,'city budapest'),false,'a field name is not a word of the record');
});
