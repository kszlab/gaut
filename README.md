# GAUT · Anyaggyűjtő

Magyar nyelvű, sötétkék–türkiz anyaggyűjtő a GAUT weboldalához. Egyetlen közös jelszóval nyitható meg, felhasználónév és regisztráció nélkül.

## Funkciók

- Öt gyűjtőrész: Közös, Misi, Nándi, Attila, Krisztián.
- Több fájl feltöltése tallózással vagy behúzással; megnevezés, kategória, projekt és megjegyzés.
- Adatok szerkesztése, keresés, kategóriaszűrés, kézi frissítés.
- Új fájlverzió hozzáadása, minden korábbi verzió külön letölthető.
- Közös kuka, minden verziót megőrző visszaállítással; nincs végleges törlés.

A részek rendezést szolgálnak, nem jogosultsági határok. A közös jelszóval mindenki mindegyik részt kezelheti. Nincs személyhez köthető naplózás, a feltöltések közös belépést jelölnek.

## Render beállításai

| Mező | Érték |
| --- | --- |
| Source | `kszlab/gaut` |
| Language | Docker |
| Branch | `main` |
| Region | Frankfurt |
| Root Directory | üres |
| Dockerfile Path | `./Dockerfile` |
| Docker Build Context Directory | `.` vagy alapértelmezett |
| Docker Command | üres |
| Compute | Starter, 512 MB |
| Health Check Path | `/api/health` |
| Persistent Disk mount path | `/app/data` |
| Persistent Disk méret | 5 GB |

Environment Variables:

| Key | Value |
| --- | --- |
| `HOST` | `0.0.0.0` |
| `DATA_DIR` | `/app/data` |
| `COOKIE_SECURE` | `true` |
| `GAUT_PASSWORD` | Saját közös jelszó, legalább 12 karakterrel |

**A jelszót kizárólag a Render titkos környezeti változójába írd. Ne tedd a repóba és ne küldd el chatben.** A Render `PORT` változóját a program automatikusan használja, külön nem kell megadni.

Ezután indítható a Deploy web service. Nincs szükség setup parancsra: az alkalmazás első indításkor létrehozza az adatbázist a tartós lemezen. Hiányzó vagy rövid jelszó esetén leáll; nincs beépített alapértelmezett jelszó. A `/api/health` jelszó nélkül csak a működést jelzi, az anyaglistához és a letöltésekhez belépés kell.

Jelszóváltás: módosítsd a Renderen a `GAUT_PASSWORD` értékét, majd telepítsd újra a szolgáltatást. A régi belépések érvénytelenné válnak. A webes felületen nincs jelszóváltoztatás.

## Helyi indítás

Node.js 24 vagy újabb szükséges. Nincs külső függőség. PowerShell 7-ben, a projekt mappájából:

```powershell
$env:GAUT_PASSWORD = Read-Host 'Közös próba jelszó (legalább 12 karakter)' -MaskInput
npm start
```

Nyisd meg: http://127.0.0.1:3000 . Helyben a `COOKIE_SECURE` legyen üres vagy `false`. A helyi adatok a `data/` mappába kerülnek. Leállítás: Ctrl+C. PowerShell 5.1 alatt a környezeti változót a rendszerbeállításokban add meg, vagy használj PowerShell 7-et.

Docker Compose esetén előbb állítsd be a gép környezetében a `GAUT_PASSWORD` változót, majd futtasd:

```sh
docker compose up --build -d
```

A Compose csak helyi elérést ad, a 3000-es porton. A `gaut-data` kötet megőrzi az anyagokat. A `docker compose down -v` ezt a kötetet is törli, megőrzendő adatokkal ne használd.

## Adatok és mentés

A GitHub a program kódját tárolja. Az adatbázis és a feltöltött fájlok a Render tartós lemezén vannak; a GitHub-repó nem helyettesíti az adatmentést.

```text
/app/data/
  gaut.sqlite
  gaut.sqlite-wal  # futás közben létezhet
  gaut.sqlite-shm  # futás közben létezhet
  files/          # minden feltöltött fájlverzió
```

Konzisztens kézi mentéshez állítsd le az írást végző alkalmazást, és másold el a teljes adatmappát. A projekt lezárása előtt készüljön teljes mentés; a Render-lemez törlésével az anyagok elvesznek. A korábbi verziók és a kukában lévő anyagok is tárhelyet foglalnak.

Egyetlen alkalmazáspéldányra és helyi tartós lemezre készült. Nem kell külön Postgres vagy Redis. Az 5 GB-on az adatbázis, a fájlok és minden verzió közösen osztozik.

## Korlátok és ellenőrzés

Fájlonként 20 MiB tölthető fel. Engedélyezett: XLSX, XLS, CSV, DOCX, DOC, PDF, JPG/JPEG, PNG, WebP, GIF, HEIC, TXT, PPTX, PPT, ZIP, DWG, DXF. Több fájl külön anyagként mentődik. A rendszer fájllistát és letöltést ad, nincs dokumentumszerkesztő vagy fotógaléria. Kiterjesztést ellenőriz, vírusellenőrzést nem végez.

```sh
npm run check
npm test
```

A tesztek ideiglenes mappában ellenőrzik a közös belépést, több munkamenetet, feltöltést, adatszerkesztést, verzióletöltést, kukát, visszaállítást, újraindítás utáni adatmegőrzést, jelszócsere utáni belépésérvénytelenítést, eredetellenőrzést és belépési próbálkozáskorlátot. Az éles adatokat nem érintik.
# Közös referencia-kezelő

## Projektfotók és képernyőkivágások

Az adatlap „Feltöltött képek és képernyőkivágások” részébe fájlválasztással, behúzással vagy Ctrl+V-vel lehet képet tenni. PNG, JPG, WEBP és GIF támogatott, képenként legfeljebb 20 MB. Új, még nem mentett referenciához is előkészíthetők képek. A feltöltés, képfeliratok, szerző, forrás, licenc és a kukaműveletek a „Referencia mentése” gombbal mentődnek. A képre kattintva a teljes kép külön lapon nyitható meg.

A képek projektfüggő kukába kerülnek, a „Kukába helyezett képek mutatása” jelölővel visszaállíthatók. A képfájlok csak belépéssel érhetők el, és a `DATA_DIR/reference-photos` könyvtárban maradnak meg; metaadataik ugyanabban az SQLite adatbázisban vannak. A JSON mentés a fotómetaadatokat tartalmazza, a képfájlokat nem: teljes biztonsági mentéshez a teljes DATA_DIR mentése szükséges.

Az adatgyűjtés eredményeit a belépés után elérhető referencia-JSON importtal és „Képcsomag feltöltése” gombbal lehet a szerverre tölteni. A képcsomag JSON `photos` tömbje referenciánként képmetaadatokat, `reference_id`, `import_key`, `filename` és base64 `content` mezőket tartalmaz; opcionális `research` tömbje a képgyűjtés állapotait. A csomag legfeljebb 28 MB. Az importkulcs megakadályozza a duplázást, a kukába tett képek újbóli importáláskor is kukában maradnak. A személyes referencialistákat és fotócsomagokat a nyilvános kódtártól elkülönítve, a hitelesített API-n kell tárolni.


Mind az öt gyűjtőrész „Referencia-kezelő megnyitása” hivatkozása a `/munkater/referenciak` oldalra vezet. A közös jelszavas belépés itt is szükséges. Az első induláskor 43 projekt és 50 helyszín kerül az adatbázisba; későbbi indulások és telepítések nem írják felül a szerkesztéseket.

A kereső mellett kategória-, azonosítási állapot-, tervév- és fotólinkszűrő használható. A projektek adatlapján szerkeszthetők a leírások, forrás- és fotólinkek, címkék, helyszínek és koordináták. Új projektek és helyszínek felvehetők. Az archiválás visszafordítható: az „Archiváltak” szűrővel megnyitva törölhető az archiválás jelölése. Az egyidejű módosításokat verzióellenőrzés védi.

A JSON biztonsági mentés az aktuális teljes listát tartalmazza. A JSON import csak új projektazonosítókat vesz fel, a meglévő adatokat nem cseréli le. A helyszínazonosítók stabilak; a koordináták kezdetben hiányoznak, ellenőrzött WGS84 értékekkel egészíthetők ki. A kutatási lista személyes szakmai munkákból készült; a GAUT szerepe, bizonytalan adatok és fotóengedélyek publikálás előtt ellenőrizendők.

A referenciaadatok a meglévő `DATA_DIR/gaut.sqlite` adatbázisban tárolódnak. Az adatbázis és a feltöltött fájlok rendszeres külső biztonsági mentése továbbra is ajánlott.

Minden referencia több gyűjtőrészhez is rendelhető (Misi, Nándi, Attila, Krisztián). A Közös ettől független jelölés, nevekkel együtt is kiválasztható. A névszűrő minden hozzárendelt résztvevő listájában megjeleníti ugyanazt a rekordot. A `sections` tömb az irányadó, a `section` mező a régi formátummal való kompatibilitást szolgálja. Mindenki minden referenciát láthat és szerkeszthet a közös belépéssel. A meglévő rekordok egyszeri migrációval Krisztián jelölést kapnak, az összes korábbi módosításuk megőrzésével. Régebbi, gyűjtőrész nélküli JSON importnál az új rekordok a Közös részbe kerülnek.

A cím melletti „Honlapon megjeleníthető referencia” jelölés külön jóváhagyási adat (`website_publishable`, boolean). Alapból minden referencia jelöletlen. Mentéssel rögzül, szűrhető, a JSON export/import megőrzi. A későbbi honlapreferencia-gyűjtés a megjelölt, nem archivált rekordokra épül.

Referencia törlése: a kártya Törlés gombja vagy az adatlap Referencia törlése gombja külön kukába helyezi a tételt. A Törölt referenciák (kuka) szűrőben visszaállítható. A képek, lokációk és az archiválás állapota megmaradnak. A JSON mentés a kukát is megőrzi; azonosító szerinti újraimportálás nem állítja vissza véletlenül a törölt tételt. Honlapgyűjtéskor a deleted_at értékkel rendelkező tételeket is ki kell hagyni.

Összevonás: az ellenőrzött JSON lista `groups` tömbjének elemei `name`, `records: [{id, revision}, ...]` mezőket tartalmaznak; az első rekord marad meg. Az opcionális `additional_sections` ismert résztvevőket adhat hozzá. Az egész lista egy tranzakcióban fut, ütközés esetén semmit nem módosít. Az eltérő munkaleírásokat névvel, tervévvel és eredeti azonosítóval megőrzi, a fotófájlokat áthelyezés nélkül hozzárendeli a közös tételhez, a helyszínazonosítókat megtartja. Az eredeti rekordokat és hozzárendeléseket a privát `reference_merges` előzmény és a JSON export `merge_history` mezője őrzi. A felületen visszavonható; későbbi adatlapszerkesztés esetén az ütközésvédelem megakadályozza az új adatok felülírását. Az összevont forrásrekordokat a normál listából és a kukából kizárjuk (`merged_into`), honlapexportnál is ki kell hagyni őket. Az összevont referencia honlapjelölése csak akkor marad jóváhagyott, ha minden egyes eredeti tétel az volt.

## Nyilvános honlap (előnézet)

A gyökércímen (`/`, magyarul) és az `/en` címen (angolul) elérhető, belépés nélkül, kétnyelvű egyoldalas bemutatkozó oldal; a `/hu` a gyökér másik neve. Jelenleg **nem éles**: a keresők elől rejtett (`noindex`), és a témaváltó is bent van. **A belső munkatér a `/munkater` címen van** (közös jelszavas belépéssel), a referencia-kezelő a `/munkater/referenciak`, a honlap-szerkesztő a `/munkater/honlap`. A régi `/referenciak` és `/honlap` címek átirányítanak. Az API (`/api/...`) címei nem változtak. A három arculati vázlat (Rendszer, Struktúra, Szinkron) az oldalon váltható, vagy a `?tema=1|2|3` paraméterrel linkelhető. A választás után a váltót és a két többi témát el kell távolítani.

**Aloldal: Tervezési fázisok.** A `/tervezesi-fazisok` (angolul `/en/design-phases`) címen érhető el, a főmenüből és a főoldal Szemlélet szakaszából. Ugyanazt a fejlécet, láblécet és arculatokat használja, mint a főoldal. A szövege a honlap-szerkesztő „Tervezési fázisok" csoportjában szerkeszthető (vázlat, `?elonezet=1` előnézet, közzététel); a hat fázis száma rögzített, a listamezőkben egy sor egy listaelem. Az alapszöveg és a megjelenítő a `site/phases.mjs` fájlban van; a kiemelt fázisok (tender-, kiviteli és gyártmányterv) ott vannak megadva.

- `site/site.mjs`: szerveroldali HTML-render (szövegek HU/EN, szekciók, referenciakártyák).
- `site/art.mjs`: generált SVG-k (három ideiglenes logóváltozat és az izometrikus épületillusztrációk, CSS-változókkal színezve).
- `site/sample-references.json`: **kitalált** mintaprojektek, az oldalon „Minta" jelzéssel. Nem valós referenciák.
- `site/sample-team.json`: helyőrző csapattagok (név, szerepkör, mintaszöveg), „Minta" jelzéssel. Fotó nélkül monogramos helyőrző jelenik meg. Később szerkeszthető csapatlista lesz a munkatérben, portréfotókkal, a referenciafotókhoz hasonló privát feltöltéssel és külön jóváhagyott nyilvános képútvonallal.
- `public/site/site.css`, `public/site/site.js`: stílus és kis kliensoldali viselkedés (témaváltó, szűrő, mobilmenü).

### Terv a valódi referenciatárral való összekötéshez

A honlap egyetlen forrásból kapja a referenciákat (`sampleReferences()`). Összekötéskor ezt a függvényt kell lecserélni a `referenceStore.list()` eredményére, a `toPublicReference()` fehérlistás leképezésen át. Az csak a `website_publishable` jelölésű, nem törölt, nem archivált, nem összevont tételeket engedi át, és csak a cím, leírás, kategória, város és tervév mezőket adja tovább. A belső mezők (forrás, szerepjegyzet, kérdések, tervezők, fotólinkek) nem kerülhetnek ki. A képek külön, jóváhagyott nyilvános útvonalon jönnek majd.

Szükséges bővítések a referenciaadatlapon: honlapos cím és leírás magyarul és angolul (`website_title_hu/en`, `website_copy_hu/en`), valamint egy „kiadásra kész" feltétel (szerep megerősítve, képhasználati engedély). A kapcsoló csak ennek teljesülésekor legyen bekapcsolható.

A gyökércím átállítása megtörtént. A végleges élesítésből még hátravan: az egyéni domain (gaut.hu) bekötése a Render szolgáltatáshoz, az `noindex` és a témaváltó kivétele az arculat kiválasztása után, a statikus fájlok hosszú gyorsítótárazása.

### Honlap-szerkesztő (`/munkater/honlap`)

A munkatérből (közös jelszóval) szerkeszthetők a nyilvános honlap szövegei magyarul és angolul. A szerkeszthető mezők listája a `site/content.mjs`-ben van (`FIELDS`); az elrendezés, a menü és a felületi szövegek kódban maradnak. Üres mező esetén az alapszöveg jelenik meg.

- **Vázlat és közzététel:** a mentés csak a vázlatot módosítja. A „Közzététel" gomb a vázlatról verziót készít, és csak az látszik a látogatóknak (`site_versions` tábla, a legújabb az élő). A korábbi verziók „Vázlatba töltéssel" visszahozhatók, utána újra közzé kell tenni.
- **Előnézet:** `/?elonezet=1` (vagy `/hu?elonezet=1`) és `/en?elonezet=1` a mentett vázlatot mutatja, de csak belépett munkatérfelhasználónak. Mindenki más az élő változatot kapja.
- **Ütközés:** a vázlatnak revíziószáma van, egyidejű szerkesztésnél a második mentés 409-et kap, és nem írja felül a másikét.
- **Biztonság:** minden érték egyszerű szöveg, a megjelenítés mindenhol escape-elt. Az e-mail és a telefonszám formátumát a szerver ellenőrzi.
- **API:** `GET/PUT /api/site/content`, `POST /api/site/publish`, `POST /api/site/versions/:id/restore` (belépés kell hozzá).

Következő lépések: képkezelés (nyitóképek, portrék, automatikus átméretezéssel), csapatszerkesztő, a referenciatár bekötése, majd az élesítés.

### Képek a honlap-szerkesztőben

A `/munkater/honlap` oldal tetején a három nyitókép cserélhető (`HERO_SLOTS` a `site/content.mjs`-ben; a csapatfotók és referenciafotók ugyanezt a mechanizmust használják majd). A feltöltést a `site/media.mjs` dolgozza fel a `sharp` könyvtárral:

- JPG, PNG vagy WebP, legalább 200 px széles (nyitóképhez legalább 1600 px ajánlott), legfeljebb 20 MB. A kép 800, 1600 és 2400 px széles WebP változatokká alakul (amelyik kisebb az eredetinél, kimarad). Az eredeti fájl nem marad meg, ezért az EXIF-adatok (pl. GPS) is törlődnek.
- A fájlok a `DATA_DIR/site-media` könyvtárban vannak, a táblázat a `site_media` (méret, képleírás magyarul és angolul). A teljes mentéshez ezért a teljes `DATA_DIR` kell.
- Egy kép egy képhelyhez a vázlatban rendelődik hozzá, és a Közzététellel válik élessé. A `/media/<id>/<szélesség>.webp` címen **csak akkor érhető el kívülről, ha az élő verzió használja**; a belépett munkatérfelhasználó a vázlat képeit is látja. A közzétett képek hosszú ideig gyorsítótárazhatók (az azonosító soha nem változik).
- A képleírás (alt) a képhez tartozik, nem verziózott: módosítása azonnal látszik az élő oldalon.
- A `sharp` az első használatkor töltődik be. Ha a natív könyvtár nem tölthető be, csak a képfeltöltés áll le (503 hibaüzenettel), a munkatér és az oldal tovább működik.
- A Docker-image mostantól `npm ci --omit=dev` lépést futtat (a `package-lock.json` bekerült a tárba), a CI is `npm ci`-vel indul.

### Csapat a honlap-szerkesztőben

A `/munkater/honlap` oldal „Csapat" szekciója a nyilvános oldal csapatlistáját kezeli (`team` a vázlat és a közzétett verziók tartalmában, `cleanTeam` a `site/content.mjs`-ben):

- Három állapot: **nincs csapatlista** (a „Minta" jelzésű mintacsapat látszik), **saját lista** (legfeljebb 12 tag), **üres lista** (a Csapat szekció és menüpontja rejtett).
- Tagonként: név, szerepkör, bemutatkozás (700 karakter) és legfeljebb 4 szakterület-címke magyarul és angolul, fénykép, sorrend (↑ ↓), törlés. Az angol mezők üresen maradhatnak, ilyenkor a magyar szöveg jelenik meg.
- A fénykép a `team.<tagazonosító>` képhelyre kerül, ugyanúgy WebP-vé alakul és közzétételig privát, mint a nyitóképek. A kép alt-szövege a tag neve.
- A vázlat, az előnézet, a közzététel és a visszaállítás a szövegekkel együtt, egy verzióként működik.

### Referenciák a nyilvános honlapon

A referenciatár és a honlap össze van kötve. A „Honlapon megjeleníthető referencia" jelölés után a referencia a **Közzététellel** kerül ki; addig az élő oldal a korábban közzétett listát mutatja.

- **Mi kerül ki:** csak a `toPublicReference()` (`site/site.mjs`) fehérlistás mezői: honlapos cím és leírás (HU/EN), kategória, település, tervév, kiemelés és a borítókép. A belső munkaleírás, a háttér, a megjegyzések, a kérdések, a források, a fotólinkek, a tervezők nevei és az **átfogó leírás-tervezet (`website_copy_draft`) sosem**. A tervezet nem tartalék szöveg: a „tervezet másolása" gombbal be lehet másolni a magyar honlapos leírásba, átnézés után.
- **Honlapos címek:** a magyar honlapos cím mindig ki van töltve (üresen mentve a projekt neve kerül bele). Az angol cím megjegyzi, melyik magyar címhez készült (`website_title_en_source`): ha a magyar cím változik, az angol mező piros lesz az adatlapon, a szövege megmarad, és a jelzés az angol cím átírásáig tart. A `POST /api/references/website-titles` (`{ "titles": { "<azonosító>": "<angol cím>" } }`) egy lépésben tölti ki az üres címeket minden referenciánál; kitöltött címet nem ír felül, az összevont tételeket kihagyja. A „szerep megerősítve" és a „képhasználati engedély" kapcsoló megszűnt.
- **Kiadási ellenőrzés:** a `public/site-readiness.js` figyelmeztet, ha hiányzik a magyar cím vagy leírás, az angol szöveg vagy a borítókép, illetve ha a magyar cím megváltozott az angol fordítás óta. A figyelmeztetés **nem akadályozza** a kapcsoló bekapcsolását vagy a közzétételt. A referencia adatlapján élőben látszik, a referencialista kártyáin és a Honlap-szerkesztő „Referenciák" panelján összesítve.
- **Borítókép:** a referencia már mentett, nem törölt képei közül választható. Mentéskor a szerver átméretezett WebP-vé alakítja (rejtett adatok nélkül) a honlap képtárába, a kliens által küldött médiaazonosítót figyelmen kívül hagyja. A kép a közzétételig privát.
- **Közzététel:** a lista a Közzététel pillanatában rögzül a verzióba (`references`). A későbbi szerkesztés a következő közzétételig nem látszik élesben; a vázlat-előnézet a tár aktuális állapotát mutatja. Visszaállításkor a rögzített referenciák nem kerülnek a vázlatba.
- **Sorrend és megjelenítés (mozaik):** a referenciák tervév szerint csökkenő sorrendben, **mind egyetlen görgethető mozaikban** jelennek meg (nincs 8-as korlát), különböző méretű képcsempékkel. A **kiemelt** referencia kétszer akkora (2×2) csempe a saját időrendi helyén, így váltakoznak a nagy és kis csempék. Háromoszlopos rács (tableten kettő, telefonon egy), tömör kitöltéssel. A csempén a borítókép és egy sáv a névvel, kategóriával, településsel és tervvel; kattintásra egy ablakban nagyobb kép, leírás és adatok, nyilakkal és billentyűzettel lapozható (`site/mosaic.mjs` adja a HTML-t, `public/site/mosaic.js` a viselkedést). Kategóriaszűrő gombok szűkítik a listát. Borítókép nélkül tipográfiai csempe jelenik meg (a cím nagy betűkkel), a „Minta" projektek generált illusztrációt kapnak. A koncepciók közül a B használja ugyanezt.
- **Mintaprojektek:** ha egyetlen referencia sincs megjelölve, a „Minta" jelzésű mintaprojektek maradnak (a közzététel ilyenkor nem rögzít referencialistát).

## Mentés és visszaállítás

A teljes adat (adatbázis, fájlok, referenciafotók, honlapképek) egyetlen `.tar.gz` fájlban tölthető le: belépve a munkatér főoldalán, vagy a `/api/backup` címen. Automatikus napi mentéshez a `GAUT_BACKUP_TOKEN` környezeti változó (legalább 32 karakter) és a `tools/backup-gaut.ps1` használható; ellenőrzéshez és visszaállításhoz a `tools/backup-tools.mjs`. Részletek, ütemezés és a visszaállítás lépései: [docs/BACKUP.md](docs/BACKUP.md).

#### Kamarai névjegyzék a csapattagoknál

Tagonként megadható a mérnöki kamarai azonosító szám és egy link a névjegyzékre (mindkettő nem kötelező, nyelvfüggetlen). A kártyán „Mérnöki kamarai névjegyzék: <szám>" sor jelenik meg, a szám a linkre mutat; csak szám esetén sima szöveg, csak link esetén „megnyitás" felirattal. A link biztonsági okból csak `https://` címmel kezdődő `mernokvagyok.hu` vagy `mmk.hu` (és aldomainjeik) oldalra mutathat (`isChamberUrl` a `site/content.mjs`-ben); a megjelenítéskor is ellenőrzi az oldal, így egy tárolt, nem engedélyezett cím sosem lesz link. A link `target="_blank" rel="noopener noreferrer"`.

## Tervezői audit

A [docs/DESIGN-AUDIT.md](docs/DESIGN-AUDIT.md) a korábbi tervezői elemzést, a kontrasztméréseket és a közös megjelenési szabályokat tartalmazza. A hozzá készült három koncepcióoldal (`/koncepcio`, `/koncepcio/a|b|c`) megszűnt, a címeik 404-et adnak; a kódjuk a git előzményekben megtalálható.
