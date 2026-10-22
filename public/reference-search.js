export const normalizeSearch=value=>String(value??'').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('hu');
export function matchesReference(record,query,selected=[]){
 const owners=record.sections||[record.section||'common'];
 if(selected.length&&!selected.some(owner=>owners.includes(owner)))return false;
 const text=normalizeSearch(JSON.stringify(record));
 return normalizeSearch(query).trim().split(/\s+/).filter(Boolean).every(word=>text.includes(word));
}
