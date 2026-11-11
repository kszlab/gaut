// Reference taxonomy. Main categories and subcategories are seeded once, then maintained in the database.
export const INITIAL_CATEGORY_TREE = [
  { id: 'kozintezmenyek', name: 'Közintézmények', sort_order: 10, categories: [
    { id: 'oktatasi-intezmenyek', name: 'Oktatási intézmények', sort_order: 10 },
    { id: 'egeszsegugyi-intezmenyek', name: 'Egészségügyi intézmények', sort_order: 20 },
    { id: 'kulturalis-intezmenyek', name: 'Kulturális intézmények', sort_order: 30 },
    { id: 'igazgatasi-intezmenyek', name: 'Igazgatási intézmények', sort_order: 40 },
    { id: 'sportletesitmenyek', name: 'Sportlétesítmények', sort_order: 50 },
    { id: 'kereskedelmi-szolgaltato', name: 'Kereskedelmi és szolgáltató létesítmények', sort_order: 60 }
  ]},
  { id: 'egyeb-letesitmenyek', name: 'Egyéb létesítmények', sort_order: 20, categories: [
    { id: 'irodahazak', name: 'Irodaházak', sort_order: 10 },
    { id: 'szallodak', name: 'Szállodák', sort_order: 20 },
    { id: 'ipari-letesitmenyek', name: 'Ipari létesítmények', sort_order: 30 },
    { id: 'logisztikai-letesitmenyek', name: 'Logisztikai létesítmények', sort_order: 40 },
    { id: 'lakoeepuletek', name: 'Lakóépületek', sort_order: 50 },
    { id: 'csaladi-hazak', name: 'Családi házak', sort_order: 60 },
    { id: 'bankok', name: 'Bankok', sort_order: 70 },
    { id: 'egy hazi-letesitmenyek'.replace(' ', ''), name: 'Egyházi létesítmények', sort_order: 80 },
    { id: 'energetikai-kozmu', name: 'Energetikai és közműlétesítmények', sort_order: 90 },
    { id: 'kozlekedesi-infrastruktura', name: 'Közlekedési és infrastruktúra-létesítmények', sort_order: 100 },
    { id: 'egyeb', name: 'Egyéb', sort_order: 110 }
  ]}
];

// Historical free-text values retained on each reference for auditability.
export const LEGACY_REFERENCE_CATEGORIES = [
  'Egészségügy','Energia és infrastruktúra','Ipar és logisztika','Iroda és kereskedelem',
  'Lakóépület','Műemlék és kultúra','Oktatás és középület','Sport és fürdő','Szálloda és turizmus'
];
const LEGACY_ALIASES = new Map([
  ['Iroda','Iroda és kereskedelem'],['Oktatás','Oktatás és középület'],
  ['Szálloda','Szálloda és turizmus'],['Közösségi épület','Oktatás és középület']
]);
export const isReferenceCategory = value => LEGACY_REFERENCE_CATEGORIES.includes(value);
export const normalizeReferenceCategory = value => LEGACY_ALIASES.get(String(value || '').trim()) || (isReferenceCategory(value) ? value : 'Egyéb');
export const referenceCategoryLabel = (value, lang = 'hu') => value || '';
export const CATEGORY_REVIEW_STATUSES = ['Jóváhagyott', 'Ellenőrzendő', 'Besorolatlan'];

// Proposed initial mapping based on the existing reference descriptions. Uncertain cases stay flagged for review.
export const INITIAL_REFERENCE_CLASSIFICATION = {
  'GAUT-REF-001': ['kozintézmenyek','kereskedelmi-szolgaltato','Ellenőrzendő'],
  'GAUT-REF-002': ['egyeb-letesitmenyek','szallodak','Ellenőrzendő'],
  'GAUT-REF-003': ['egyeb-letesitmenyek','bankok','Ellenőrzendő'],
  'GAUT-REF-004': ['kozintezmenyek','kulturalis-intezmenyek','Ellenőrzendő'],
  'GAUT-REF-005': ['egyeb-letesitmenyek','egyeb','Ellenőrzendő'],
  'GAUT-REF-006': ['kozintezmenyek','egeszsegugyi-intezmenyek','Ellenőrzendő'],
  'GAUT-REF-007': ['egyeb-letesitmenyek','ipari-letesitmenyek','Ellenőrzendő'],
  'GAUT-REF-008': ['kozintezmenyek','egeszsegugyi-intezmenyek','Ellenőrzendő'],
  'GAUT-REF-009': ['kozintezmenyek','egeszsegugyi-intezmenyek','Ellenőrzendő'],
  'GAUT-REF-010': ['kozintezmenyek','kereskedelmi-szolgaltato','Ellenőrzendő'],
  'GAUT-REF-011': ['egyeb-letesitmenyek','energetikai-kozmu','Ellenőrzendő'],
  'GAUT-REF-012': ['egyeb-letesitmenyek','ipari-letesitmenyek','Ellenőrzendő'],
  'GAUT-REF-013': ['kozintezmenyek','egeszsegugyi-intezmenyek','Ellenőrzendő'],
  'GAUT-REF-014': ['kozintezmenyek','egeszsegugyi-intezmenyek','Ellenőrzendő'],
  'GAUT-REF-015': ['kozintezmenyek','sportletesitmenyek','Ellenőrzendő'],
  'GAUT-REF-016': ['egyeb-letesitmenyek','ipari-letesitmenyek','Ellenőrzendő'],
  'GAUT-REF-017': ['kozintezmenyek','egeszsegugyi-intezmenyek','Ellenőrzendő'],
  'GAUT-REF-018': ['egyeb-letesitmenyek','logisztikai-letesitmenyek','Ellenőrzendő'],
  'GAUT-REF-019': ['kozintezmenyek','kulturalis-intezmenyek','Ellenőrzendő'],
  'GAUT-REF-020': ['egyeb-letesitmenyek','kozlekedesi-infrastruktura','Ellenőrzendő'],
  'GAUT-REF-021': ['kozintezmenyek','egeszsegugyi-intezmenyek','Ellenőrzendő'],
  'GAUT-REF-022': ['egyeb-letesitmenyek','logisztikai-letesitmenyek','Ellenőrzendő'],
  'GAUT-REF-023': ['egyeb-letesitmenyek','lakoeepuletek','Ellenőrzendő'],
  'GAUT-REF-024': ['kozintezmenyek','kulturalis-intezmenyek','Ellenőrzendő'],
  'GAUT-REF-025': ['egyeb-letesitmenyek','ipari-letesitmenyek','Ellenőrzendő'],
  'GAUT-REF-026': ['egyeb-letesitmenyek','irodahazak','Ellenőrzendő'],
  'GAUT-REF-027': ['kozintezmenyek','kulturalis-intezmenyek','Ellenőrzendő'],
  'GAUT-REF-028': ['kozintezmenyek','sportletesitmenyek','Ellenőrzendő'],
  'GAUT-REF-029': ['egyeb-letesitmenyek','irodahazak','Ellenőrzendő'],
  'GAUT-REF-030': ['egyeb-letesitmenyek','szallodak','Ellenőrzendő'],
  'GAUT-REF-031': ['kozintezmenyek','igazgatasi-intezmenyek','Ellenőrzendő'],
  'GAUT-REF-032': ['egyeb-letesitmenyek','szallodak','Ellenőrzendő'],
  'GAUT-REF-033': ['kozintezmenyek','oktatasi-intezmenyek','Ellenőrzendő'],
  'GAUT-REF-034': ['egyeb-letesitmenyek','ipari-letesitmenyek','Ellenőrzendő'],
  'GAUT-REF-035': ['kozintezmenyek','sportletesitmenyek','Ellenőrzendő'],
  'GAUT-REF-036': ['egyeb-letesitmenyek','irodahazak','Ellenőrzendő'],
  'GAUT-REF-037': ['egyeb-letesitmenyek','lakoeepuletek','Ellenőrzendő'],
  'GAUT-REF-038': ['egyeb-letesitmenyek','ipari-letesitmenyek','Ellenőrzendő'],
  'GAUT-REF-039': ['egyeb-letesitmenyek','irodahazak','Ellenőrzendő'],
  'GAUT-REF-040': ['egyeb-letesitmenyek','ipari-letesitmenyek','Ellenőrzendő'],
  'GAUT-REF-041': ['egyeb-letesitmenyek','lakoeepuletek','Ellenőrzendő'],
  'GAUT-REF-042': ['egyeb-letesitmenyek','szallodak','Ellenőrzendő'],
  'GAUT-REF-043': ['kozintezmenyek','oktatasi-intezmenyek','Ellenőrzendő']
};
