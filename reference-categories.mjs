// Canonical reference taxonomy. Stored values remain stable Hungarian labels for backwards compatibility.
export const CATEGORY_GROUPS = [
  { id: 'industry', label_hu: 'Ipari és infrastruktúra', label_en: 'Industry & infrastructure' },
  { id: 'commercial', label_hu: 'Kereskedelmi és szolgáltató épületek', label_en: 'Commercial & hospitality' },
  { id: 'public', label_hu: 'Középületek és közösségi funkciók', label_en: 'Public & community buildings' },
  { id: 'residential', label_hu: 'Lakóépületek', label_en: 'Residential' },
  { id: 'other', label_hu: 'Egyéb', label_en: 'Other' }
];
export const REFERENCE_CATEGORIES = [
  { value: 'Ipar és logisztika', label_hu: 'Ipar és logisztika', label_en: 'Industry & logistics', group: 'industry' },
  { value: 'Energia és infrastruktúra', label_hu: 'Energia és infrastruktúra', label_en: 'Energy & infrastructure', group: 'industry' },
  { value: 'Iroda és kereskedelem', label_hu: 'Iroda és kereskedelem', label_en: 'Office & retail', group: 'commercial' },
  { value: 'Szálloda és turizmus', label_hu: 'Szálloda és turizmus', label_en: 'Hotels & tourism', group: 'commercial' },
  { value: 'Oktatás és középület', label_hu: 'Oktatás és középület', label_en: 'Education & public buildings', group: 'public' },
  { value: 'Egészségügy', label_hu: 'Egészségügy', label_en: 'Healthcare', group: 'public' },
  { value: 'Sport és fürdő', label_hu: 'Sport és fürdő', label_en: 'Sport & spa', group: 'public' },
  { value: 'Műemlék és kultúra', label_hu: 'Műemlék és kultúra', label_en: 'Heritage & culture', group: 'public' },
  { value: 'Lakóépület', label_hu: 'Lakóépület', label_en: 'Residential', group: 'residential' },
  { value: 'Egyéb', label_hu: 'Egyéb', label_en: 'Other', group: 'other' }
];
const BY_VALUE = new Map(REFERENCE_CATEGORIES.map(c => [c.value, c]));
const ALIASES = new Map([['Iroda', 'Iroda és kereskedelem'], ['Oktatás', 'Oktatás és középület'], ['Szálloda', 'Szálloda és turizmus'], ['Közösségi épület', 'Oktatás és középület']]);
export const isReferenceCategory = value => BY_VALUE.has(value);
export const normalizeReferenceCategory = value => ALIASES.get(String(value || '').trim()) || (isReferenceCategory(value) ? value : 'Egyéb');
export const referenceCategoryLabel = (value, lang = 'hu') => BY_VALUE.get(value)?.[lang === 'en' ? 'label_en' : 'label_hu'] || value || '';
export function referenceCategoryOptions(lang = 'hu') {
  return CATEGORY_GROUPS.map(group => ({ ...group, label: group[lang === 'en' ? 'label_en' : 'label_hu'], options: REFERENCE_CATEGORIES.filter(c => c.group === group.id).map(c => ({ value: c.value, label: c[lang === 'en' ? 'label_en' : 'label_hu'] })) }));
}
