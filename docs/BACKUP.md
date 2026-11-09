# Mentés és visszaállítás

A GAUT anyaggyűjtő minden adata (adatbázis, feltöltött fájlok, referenciafotók, a honlap képei, a honlap szövegei és verziói) a Render tartós lemezén van, a `DATA_DIR` (`/app/data`) könyvtárban. A GitHub csak a kódot őrzi. A teljes mentést egyetlen fájlban lehet letölteni.

## Mi van a mentésben

Egy `gaut-mentes-ÉÉÉÉHHNN-ÓÓPP.tar.gz` fájl:

| Fájl | Tartalom |
| --- | --- |
| `gaut.sqlite` | az adatbázis **konzisztens pillanatképe** (a futó alkalmazás mellett is biztonságos) |
| `files/` | a munkatérbe feltöltött fájlok minden verziója |
| `reference-photos/` | a referenciák fotói |
| `site-media/` | a honlap képei (nyitóképek, portrék, borítók) |
| `manifest.json` | létrehozás ideje, minden fájl mérete és SHA-256 ellenőrzőösszege |

## 1. Kézi letöltés

Belépés után a munkatér főoldalán a „Teljes mentés letöltése" gomb. Ugyanez a `/api/backup` cím. A letöltés a fájlok méretétől függően percekig tarthat.

## 2. Automatikus napi mentés a saját gépre (ajánlott)

A mentés csak akkor véd, ha a szerveren **kívül** is van példány. A `tools/backup-gaut.ps1` minden futáskor letölti a mentést, ellenőrzi, és az utolsó 30-at tartja meg.

**a) Mentési token létrehozása.** Egy hosszú, véletlen karakterlánc, amit a szerver és a script ismer. PowerShellben:

```powershell
-join ((48..57)+(97..122) | Get-Random -Count 48 | ForEach-Object {[char]$_})
```

**b) A token beállítása a szerveren.** Render → `gaut` szolgáltatás → Environment → új változó: `GAUT_BACKUP_TOKEN` = a token (legalább 32 karakter, enélkül a token-os letöltés ki van kapcsolva). Mentés után a Render újratelepíti a szolgáltatást. A tokent nem a repóba és nem chatbe kell írni.

**c) A token a saját gépen.** Mentsd egy fájlba, amit csak te olvashatsz: `%USERPROFILE%\.gaut-backup-token` (egyetlen sor, a token). Vagy állítsd be a `GAUT_BACKUP_TOKEN` környezeti változót.

**d) Kipróbálás kézzel:**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\backup-gaut.ps1
```

A mentések a `%USERPROFILE%\GAUT-mentesek` mappába kerülnek, a `mentes.log` fájlba pedig minden futás eredménye. Hiba esetén a script nem nulla kilépési kóddal áll meg, és a log „HIBA" sort kap.

**e) Napi ütemezés** (minden nap 3:00-kor; ha a gép akkor ki volt kapcsolva, bekapcsoláskor pótolja):

```powershell
$action  = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -ExecutionPolicy Bypass -File "C:\ÚTVONAL\gaut\tools\backup-gaut.ps1"'
$trigger = New-ScheduledTaskTrigger -Daily -At 3am
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun:$false
Register-ScheduledTask -TaskName 'GAUT mentés' -Action $action -Trigger $trigger -Settings $settings
```

A mappát érdemes a NAS-ra vagy felhőtárhelyre is szinkronizálni, hogy a mentés ne csak egy gépen legyen meg.

A Render a tartós lemezekről magától is készíthet pillanatképeket. Ellenőrizd a Render felületén, hogy a `gaut` lemezén be van-e kapcsolva és meddig őrzi őket. Ez kiegészítés, nem helyettesíti a saját gépre mentést.

## 3. Mentés ellenőrzése

```sh
node tools/backup-tools.mjs verify gaut-mentes-20261109-0300.tar.gz
```

Ellenőrzi a tar szerkezetét, minden fájl méretét és SHA-256 összegét, hogy nincs-e hiányzó vagy extra fájl, és az adatbázis `integrity_check` eredményét. Hibánál nem nulla kilépési kóddal áll meg. Érdemes időnként (például havonta) lefuttatni egy régebbi mentésen is.

## 4. Visszaállítás

A visszaállítás mindig az ellenőrzéssel kezdődik: hibás mentésből a script nem ír semmit. Ha a célkönyvtár nem üres, `--force` nélkül megáll.

**Próbavisszaállítás a saját gépen** (így lehet bármikor megnézni, hogy a mentés használható):

```sh
node tools/backup-tools.mjs restore gaut-mentes-20261109-0300.tar.gz ./visszaallitott-adat
DATA_DIR=./visszaallitott-adat GAUT_PASSWORD=<legalább 12 karakter> npm start
```

Ezután a `http://127.0.0.1:3000` címen a mentés pillanatának állapota látszik (egy próbajelszóval, a valódi jelszó nem kell).

**Éles visszaállítás a Renderen.** Ez felülírja az éles adatot, ezért csak akkor, ha az adat elveszett vagy megsérült:

1. Töltsd fel a mentést a szolgáltatás gépére (Render → `gaut` → Shell, vagy SSH/SCP a Render felületén megadott címre).
2. Futtasd: `node tools/backup-tools.mjs restore /tmp/mentes.tar.gz /app/data --force`
3. **Azonnal indítsd újra a szolgáltatást** (Render → Manual Deploy → Restart). A futó alkalmazás a régi adatbázist tartja nyitva, ezért az újraindítás előtt ne használd az oldalt.
4. Belépés után ellenőrizd a referenciák számát, a honlap szövegeit és a képeket.

A `/app/data` kitisztítása nélkül is elég a `--force`: a script a maradék `-wal` és `-shm` fájlokat is törli, hogy ne játsszon rá régi napló a visszaállított adatbázisra.

## Mit nem véd

- Ha a mentés letöltése óta változott valami, az nincs benne. Napi mentésnél ez legfeljebb egy nap munkája.
- A Render környezeti változói (a közös jelszó, a mentési token) nincsenek a mentésben. Ezeket külön, jelszókezelőben érdemes tárolni.
- A kód a GitHubon van, a mentésnek nem része.
