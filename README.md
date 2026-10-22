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


Mind az öt gyűjtőrész „Referencia-kezelő megnyitása” hivatkozása a `/referenciak` oldalra vezet. A közös jelszavas belépés itt is szükséges. Az első induláskor 43 projekt és 50 helyszín kerül az adatbázisba; későbbi indulások és telepítések nem írják felül a szerkesztéseket.

A kereső mellett kategória-, azonosítási állapot-, tervév- és fotólinkszűrő használható. A projektek adatlapján szerkeszthetők a leírások, forrás- és fotólinkek, címkék, helyszínek és koordináták. Új projektek és helyszínek felvehetők. Az archiválás visszafordítható: az „Archiváltak” szűrővel megnyitva törölhető az archiválás jelölése. Az egyidejű módosításokat verzióellenőrzés védi.

A JSON biztonsági mentés az aktuális teljes listát tartalmazza. A JSON import csak új projektazonosítókat vesz fel, a meglévő adatokat nem cseréli le. A helyszínazonosítók stabilak; a koordináták kezdetben hiányoznak, ellenőrzött WGS84 értékekkel egészíthetők ki. A kutatási lista személyes szakmai munkákból készült; a GAUT szerepe, bizonytalan adatok és fotóengedélyek publikálás előtt ellenőrizendők.

A referenciaadatok a meglévő `DATA_DIR/gaut.sqlite` adatbázisban tárolódnak. Az adatbázis és a feltöltött fájlok rendszeres külső biztonsági mentése továbbra is ajánlott.

Minden referencia több gyűjtőrészhez is rendelhető (Misi, Nándi, Attila, Krisztián). A Közös ettől független jelölés, nevekkel együtt is kiválasztható. A névszűrő minden hozzárendelt résztvevő listájában megjeleníti ugyanazt a rekordot. A `sections` tömb az irányadó, a `section` mező a régi formátummal való kompatibilitást szolgálja. Mindenki minden referenciát láthat és szerkeszthet a közös belépéssel. A meglévő rekordok egyszeri migrációval Krisztián jelölést kapnak, az összes korábbi módosításuk megőrzésével. Régebbi, gyűjtőrész nélküli JSON importnál az új rekordok a Közös részbe kerülnek.

A cím melletti „Honlapon megjeleníthető referencia” jelölés külön jóváhagyási adat (`website_publishable`, boolean). Alapból minden referencia jelöletlen. Mentéssel rögzül, szűrhető, a JSON export/import megőrzi. A későbbi honlapreferencia-gyűjtés a megjelölt, nem archivált rekordokra épül.

Referencia törlése: a kártya Törlés gombja vagy az adatlap Referencia törlése gombja külön kukába helyezi a tételt. A Törölt referenciák (kuka) szűrőben visszaállítható. A képek, lokációk és az archiválás állapota megmaradnak. A JSON mentés a kukát is megőrzi; azonosító szerinti újraimportálás nem állítja vissza véletlenül a törölt tételt. Honlapgyűjtéskor a deleted_at értékkel rendelkező tételeket is ki kell hagyni.

Összevonás: az ellenőrzött JSON lista `groups` tömbjének elemei `name`, `records: [{id, revision}, ...]` mezőket tartalmaznak; az első rekord marad meg. Az opcionális `additional_sections` ismert résztvevőket adhat hozzá. Az egész lista egy tranzakcióban fut, ütközés esetén semmit nem módosít. Az eltérő munkaleírásokat névvel, tervévvel és eredeti azonosítóval megőrzi, a fotófájlokat áthelyezés nélkül hozzárendeli a közös tételhez, a helyszínazonosítókat megtartja. Az eredeti rekordokat és hozzárendeléseket a privát `reference_merges` előzmény és a JSON export `merge_history` mezője őrzi. A felületen visszavonható; későbbi adatlapszerkesztés esetén az ütközésvédelem megakadályozza az új adatok felülírását. Az összevont forrásrekordokat a normál listából és a kukából kizárjuk (`merged_into`), honlapexportnál is ki kell hagyni őket. Az összevont referencia honlapjelölése csak akkor marad jóváhagyott, ha minden egyes eredeti tétel az volt.
