// Advisory publication checks for a reference. The same file runs in the browser (live hints while editing)
// and on the server (the list in the site editor). It never blocks anything: a reference marked
// "Honlapon megjeleníthető" is published even if some of these are missing.
const has = value => typeof value === 'string' && value.trim() !== '';

export function websiteWarnings(record) {
  const warnings = [];
  if (!has(record.website_title_hu)) warnings.push('Nincs magyar honlapos cím, a projekt neve jelenik meg.');
  if (!has(record.website_copy_hu)) warnings.push('Nincs magyar honlapos leírás, a kártyán csak a cím látszik.');
  if (!has(record.website_title_en) || !has(record.website_copy_en)) warnings.push('Az angol cím vagy leírás hiányzik, az angol oldalon a magyar szöveg jelenik meg.');
  if (record.website_role_confirmed !== true) warnings.push('A GAUT szerepe nincs megerősítve.');
  if (!has(record.website_cover_photo)) warnings.push('Nincs borítókép, helyette illusztráció jelenik meg.');
  else if (record.website_photo_rights !== true) warnings.push('A borítóképhez nincs képhasználati engedély megjelölve.');
  return warnings;
}
