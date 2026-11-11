import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderSite, toPublicReference } from '../site/site.mjs';
import { INITIAL_CATEGORY_LIST } from '../reference-categories.mjs';

const read = name => readFileSync(new URL(`../public/${name}`, import.meta.url), 'utf8');
const ref = (id, categoryId, category, extra = {}) => ({ id, kind: 'tower', category, categoryId, year: '2020', place: { hu: 'Budapest', en: 'Budapest' }, title: { hu: `Projekt ${id}`, en: '' }, summary: { hu: '', en: '' }, tags: { hu: [], en: [] }, featured: false, cover: null, ...extra });

test('the seeded list has ten one-level categories with Hungarian and English names', () => {
  assert.equal(INITIAL_CATEGORY_LIST.length, 10);
  assert.equal(new Set(INITIAL_CATEGORY_LIST.map(c => c.id)).size, 10);
  assert.ok(INITIAL_CATEGORY_LIST.every(c => /^[a-z-]+$/.test(c.id) && c.name && c.name_en && Number.isInteger(c.sort_order)));
});

test('a record reaches the public shape with its category id and name only', () => {
  const pub = toPublicReference({ id: 'R1', name: 'Minta', website_publishable: true, category: 'Szállodák', category_id: 'szallodak', category_main_id: 'x', category_sub_id: 'y', category_review_status: 'Jóváhagyott', design_year: '2021', city: 'Hévíz' });
  assert.equal(pub.categoryId, 'szallodak'); assert.equal(pub.category, 'Szállodák');
  assert.ok(!('categoryMainId' in pub) && !('categorySubId' in pub) && !('categoryApproved' in pub), 'the two-level fields are gone from the public shape');
});

test('the public filter is one row of chips, in list order, only for categories that have a reference', () => {
  const categories = INITIAL_CATEGORY_LIST;
  const references = [ref('a', 'szallodak', 'Szállodák'), ref('b', 'irodahazak', 'Irodaházak'), ref('c', 'irodahazak', 'Irodaházak'), ref('d', '', '')];
  const hu = renderSite({ lang: 'hu', references, categories }), en = renderSite({ lang: 'en', references, categories });
  const chips = html => [...html.matchAll(/<button type="button" class="chip[^"]*" data-filter="([^"]*)">([^<]*)<\/button>/g)].map(m => `${m[1]}=${m[2]}`);
  assert.deepEqual(chips(hu), ['*=Mind', 'irodahazak=Irodaházak', 'szallodak=Szállodák'], 'list order, not the order of the references');
  assert.deepEqual(chips(en), ['*=All', 'irodahazak=Office buildings', 'szallodak=Hotels']);
  assert.ok(!hu.includes('data-main-filter') && !hu.includes('sub-filters') && !hu.includes('category-tree-data'));
  assert.equal((hu.match(/class="mt[^"]*" data-cat="irodahazak"/g) || []).length, 2);
  assert.ok(hu.includes('data-cat="" data-index="3"'), 'a reference without a category stays on the page, under "Mind"');
  assert.ok(hu.includes('<small>Szállodák · Budapest · Tervév 2020</small>') && en.includes('<small>Hotels · Budapest · Design year 2020</small>'), 'the tile shows the category name in the page language');
  assert.ok(hu.includes('<small>Budapest · Tervév 2020</small>'), 'no category, no label');
  // a single category needs no filter row
  assert.equal(chips(renderSite({ lang: 'hu', references: references.slice(1, 3), categories })).length, 0);
  // an English name left empty falls back to the Hungarian one
  const noEn = categories.map(c => c.id === 'szallodak' ? { ...c, name_en: '' } : c);
  assert.ok(chips(renderSite({ lang: 'en', references, categories: noEn })).includes('szallodak=Szállodák'));
});

test('the workshop offers one category select, the manager can add and edit but not delete', () => {
  const html = read('references.html'), js = read('references.js'), manager = read('category-manager.js'), managerHtml = read('category-manager.html');
  assert.ok(js.includes('name="category_id"') && !js.includes('category_main_id') && !js.includes('category_sub_id') && !js.includes('category_review_status'));
  assert.ok(!html.includes('category-review'));
  assert.ok(html.includes('href="/munkater/kategoriak"'), 'the list is reachable from the reference workshop');
  assert.ok(manager.includes("'POST'") && manager.includes("'PUT'") && !manager.includes('DELETE') && !manager.includes('data-delete'));
  assert.ok(managerHtml.includes('id="add-category"') && managerHtml.includes('name="name_en"'));
  assert.ok(!read('site/mosaic.js').includes('main-filter'));
});
