const box=document.querySelector('.mosaic');
if(box){
 const dialog=document.querySelector('.mosaic-dialog'),content=dialog.querySelector('.md-content'),tiles=[...box.querySelectorAll('.mt')],chips=[...document.querySelectorAll('.filters .chip')];
 let current=null,opener=null,selected=null;
 const visible=()=>tiles.filter(t=>!t.hidden);
 function apply(){const legacy=chips.find(c=>c.classList.contains('on'))?.dataset.filter||'*';tiles.forEach(t=>{const ids=(t.dataset.cats||'').split(',').filter(Boolean);t.hidden=!((!selected||ids.some(id=>selected.has(id)))&&(legacy==='*'||t.dataset.cat===legacy));});}
 chips.forEach(chip=>chip.addEventListener('click',()=>{chips.forEach(c=>c.classList.toggle('on',c===chip));selected=null;apply();}));
 document.querySelectorAll('[data-category-card]').forEach(card=>card.addEventListener('click',e=>{e.preventDefault();selected=new Set((card.dataset.categories||'').split(',').filter(Boolean));chips.forEach(c=>c.classList.toggle('on',c.dataset.filter==='*'));apply();document.querySelector('#referenciak')?.scrollIntoView({behavior:'smooth'});}));
 function show(tile){current=tile;content.replaceChildren(tile.querySelector('.mt-detail').content.cloneNode(true));const list=visible(),i=list.indexOf(tile);dialog.querySelector('[data-md="prev"]').disabled=i<=0;dialog.querySelector('[data-md="next"]').disabled=i>=list.length-1;content.scrollTop=0;}
 function step(d){const list=visible(),i=list.indexOf(current)+d;if(i>=0&&i<list.length){show(list[i]);opener=list[i].querySelector('.mt-open');}}
 box.addEventListener('click',e=>{const b=e.target.closest('.mt-open');if(!b)return;opener=b;show(b.closest('.mt'));dialog.showModal();});
 dialog.addEventListener('click',e=>{const a=e.target.closest('[data-md]')?.dataset.md;if(a==='close'||e.target===dialog)dialog.close();else if(a==='prev')step(-1);else if(a==='next')step(1);});
 dialog.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();step(-1);}if(e.key==='ArrowRight'){e.preventDefault();step(1);}});
 dialog.addEventListener('close',()=>{opener?.focus({preventScroll:true});content.replaceChildren();});
}
