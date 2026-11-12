export const normalizeSearch=value=>String(value??'').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('hu');
// Only the values of a record are searched, never the field names ("city", "name", "false" would match every record) and not the technical fields (revision, timestamps, photo and media ids).
const SKIP=new Set(['revision','updated_at','deleted_at','created_at','photo_cover_id','photo_count','website_photos','website_photos_media','website_cover_photo','website_cover_media','merge_history']);
export function searchableValues(value,out=[]){
 if(typeof value==='string')out.push(value);
 else if(typeof value==='number'&&Number.isFinite(value))out.push(String(value));
 else if(Array.isArray(value))value.forEach(item=>searchableValues(item,out));
 else if(value&&typeof value==='object')for(const [key,item] of Object.entries(value))if(!SKIP.has(key))searchableValues(item,out);
 return out;
}
export function matchesReference(record,query,selected=[]){
 const owners=record.sections||[record.section||'common'];
 if(selected.length&&!selected.some(owner=>owners.includes(owner)))return false;
 const text=normalizeSearch(searchableValues(record).join(String.fromCharCode(10)));
 return normalizeSearch(query).trim().split(/\s+/).filter(Boolean).every(word=>text.includes(word));
}
