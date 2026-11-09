# GAUT honlap: tervezői audit és három koncepció

Állapot: **előkészítés, jóváhagyásra vár.** A három koncepció a `/koncepcio` címen nézhető meg (előnézetek, a keresők elől rejtve). **A honlap-szerkesztőben mentett és közzétett tartalmat mutatják** (a vázlatot belépve a `?elonezet=1` címzéssel); ahol nincs mentett tartalom, mintaadat látszik „Minta" jelzéssel. A jelenlegi oldal ettől nem változott, csak a kontrasztja javult (lásd lent).

## 1. Mit vizsgáltam, és mit mértem

Két különböző dolgot választok szét: **mérés** (számmal, reprodukálható) és **szakmai megítélés** (vélemény, ami vitatható).

### Mérés

| Vizsgálat | Eredmény |
| --- | --- |
| Kontraszt, törzsszöveg | rendben mindhárom arculatban (12,5–14,8) |
| Kontraszt, szürkébb szöveg | rendben (5,1–8,8) |
| Kontraszt, **kis kiemelt szöveg** (felirat, sorszám, szerepkör, link) | **hibás volt**: Rendszer 4,47 a fő háttéren és 4,14 a sávokon, Struktúra 4,34 a sávokon (minimum 4,5). **Javítva**, új tartalék színekkel (`--accent-text`): Rendszer 5,4 felett, Struktúra 5,1 felett. Egy teszt őrzi. |
| Szimbolikus kiemelés (réz `#B36C45` kis szövegként) | 3,55: kis szövegnek nem használható, csak jelnek és nagy felületnek |
| Oldalsúly (főoldal, tömörítetlenül, helyi) | 253 KB: 33 KB HTML, egy 149 KB-os nyitókép, egy betűcsalád (48 KB). A többi arculat képe csak váltáskor töltődik be. |
| Tömörítés az éles szolgáltatáson | a Render előtti hálózat tömöríti (br), nincs teendő |
| Szerkezet | egy látható `<h1>`, a másik kettő rejtett (arculatváltó miatt); minden képnek van `alt` attribútuma; `lang` rendben |
| Gyorsítótár | **hiányosság**: a képek, stílusok és szkriptek `no-cache` fejlécet kapnak érvényesítő (ETag) nélkül, ezért minden látogatáskor újratöltődnek. Éles indulás előtt ujjlenyomatos fájlnevek és hosszú gyorsítótár kell. |
| Konzolhibák | a nyilvános oldalon nem kerestem külön, a mérés a javítás után, a kiválasztott koncepción lesz elvégezve |

Nem mértem még: billentyűzetes használatot, teljes SEO-ellenőrzést, valódi teljesítménymérést (Lighthouse jellegű). Ezek a kiválasztott koncepció elkészülte után jönnek, nem a vázlatokon.

### Megítélés: miért tűnik az oldal „AI-szagúnak"

Ezek az én szakmai megállapításaim a jelenlegi (Rendszer, Struktúra, Szinkron) oldalról:

1. **Három szín- és betűváltozat, egy szerkezet.** A váltó azt sugallja, hogy három arculat van, de a váz azonos. Valódi választás nincs, csak kozmetika.
2. **Kártyarács mindenhol.** A szakterületek, referenciák és csapat is keretes, lekerekített dobozokban; a szakaszok ritmusa azonos, szimmetrikus. Ez a legtipikusabb sablonjel.
3. **Generált illusztrációk.** A referenciakártyák izometrikus épületrajzai általánosak, bármelyik cégé lehetnének. A nyitóképek AI-vizualizációk, tipikus „üvegépület zöld vezetékekkel" látvánnyal.
4. **Kisméretű dekoráció.** Pillek, ikonok minden kártyán, kicsi felirat-kicsengések. Sok a díszítő elem, kevés a tartalom.
5. **Hangsúly nélküli szöveg.** A főcím és a törzsszöveg közti különbség mérsékelt, a tipográfia nem hordoz karaktert.
6. **Nincs valódi anyag.** Nincs fotó, valódi referencia, valódi szám vagy tény, ezért minden egyforma és kicserélhető.

A legnagyobb javulást nem a kód hozza, hanem a **valódi fotók, a valódi szövegek és egy következetes döntés**.

## 2. A három koncepció

Mindhárom a valódi cégleírást és a mintaadatokat használja. Különbségük szerkezeti: más a rács, más a képhasználat, más a tartalom megjelenítése.

### A · Szerkesztőségi tipográfia
- **Hangulat:** nyugodt, kifinomult, szerkesztőségi. Kép nélkül is teljes.
- **Szerkezet:** nagy serif főcím, bal oldali sorszámozott szakaszcímek, a tartalom jobb oldalon. Dobozok helyett vékony vonalak.
- **Referenciák:** index-szerű lista (év, név, terület, hely), nem kártyák.
- **Színek:** meleg papír `#F2EFE9`, grafit `#252B2F`, egyetlen réz kiemelés (kis szövegben `#8C4D2D`).
- **Betűk:** Newsreader (serif) és Jost.
- **Erőssége:** a legkevésbé „sablonos", és a legkevesebb kép kell hozzá. A legkönnyebb karbantartani.
- **Kockázata:** ha nincs mit mondani a szövegben, üresnek hat. A tipográfia minőségétől függ.

### B · Fotóvezérelt, modern vállalati
- **Hangulat:** magabiztos, nyitott, hagyományos vállalati.
- **Szerkezet:** teljes szélességű fotó a nyitóképen, alatta dobozok nélküli, vonallal kezdődő oszlopok; referenciáknál nagy képfelületek.
- **Színek:** fehér, mély navy `#102A43`, egyetlen teal kiemelés.
- **Betűk:** Inter.
- **Erőssége:** a legismerősebb a látogatónak, és a valódi fotók azonnal minőséget adnak.
- **Kockázata:** **teljesen a fotóktól függ.** A mostani vázlat egy AI-képet és szürke „Fotó helye" felületeket használ. Valódi, jó projektfotók nélkül gyengébb, mint az A vagy a C.

### C · Műszaki precizitás
- **Hangulat:** mérnöki, pontos, szerkezetes.
- **Szerkezet:** sötét háttér, a nyitóképen egy **pontosan megrajzolt architektúra-ábra** az épületautomatika három szintjéről (terepi elemek, automatika, felügyelet); a szakterületek specifikációs sorok kóddal; a referenciák táblázatban.
- **Az ábra tartalma** kizárólag a cég saját leírásának fogalmait használja (DDC/PLC, vezérlőszekrény, légtechnika, fűtés-hűtés, hő- és füstelvezetés, tűzvédelem, épületfelügyelet). Nem állít terméket, számot vagy teljesítményt.
- **Színek:** mély navy `#0C1830`, egyetlen lime jelzőszín `#C5E64A`.
- **Betűk:** Plus Jakarta Sans, a feliratokhoz IBM Plex Mono.
- **Erőssége:** hiteles szakmai tartalmat mutat, amit egy AI-kép nem tud, és fotó nélkül is jól működik.
- **Kockázata:** a legerősebb kézjegyű, ezért ízlésfüggő. A sötét háttér és a monospace feliratok nem mindenkinek hívogatók, és a kis ábra mobilon kevésbé olvasható.

### Összehasonlítás

| | A | B | C |
| --- | --- | --- | --- |
| Kép nélkül működik | igen | nem | igen |
| Valódi fotót igényel | nem | **igen, sokat** | opcionális |
| „Sablonosság" | legkisebb | közepes | kicsi |
| Hangvétel | szerkesztőségi | vállalati | mérnöki |
| Karbantartás | legkönnyebb | fotófüggő | ábra szerkesztése kell |

## 3. Közös szabályok, bármelyik is nyer

- Egy kiemelő szín, minden kis szöveg legalább 4,5:1 kontraszttal.
- Szöveg 17–18 px, legfeljebb ~65–70 karakter soronként, következetes térközskála.
- Nincs dekoratív animáció; a mozgás csak állapotjelzés (hover, fókusz).
- Dobozok és lekerekítés helyett vonalak és térköz; legfeljebb két betűcsalád.
- Minden kép valódi, vagy nincs kép. Mintaadat mindig „Minta" jelzést kap.
- A szerkesztő felület és a tartalmi mezők nem változnak: a kiválasztott koncepció ugyanazt a tartalmat jeleníti meg.

## 4. Mi kell tőletek a döntéshez és a végleges oldalhoz

1. **Melyik irányt választjátok** (vagy mit vennétek át belőlük)?
2. **Fotók:** projektfotók (épület, kapcsolószekrények, felügyeleti képernyők), a csapat portréi. A B koncepcióhoz ez elengedhetetlen.
3. **Tények, amiket ti hagytok jóvá**, és amiket én nem találok ki: például a tevékenység kezdete, a referenciák száma. A Misi-féle referencialista alapján számokat tudnék javasolni, de kitenni csak jóváhagyással.
4. **Elérhetőségek** (cím, e-mail, telefon) és a végleges logó vektoros fájlja.
5. **Kapcsolatfelvételi űrlap** kell-e, vagy elég az e-mail és a telefon.

## 5. Amit a külső eszközökről döntöttem

A kiindulási prompt több eszközt javasolt. Ebből nem telepítettem semmit:
- **shadcn/ui, Magic UI:** React/Tailwind alapúak, a projekt függőségmentes szerveroldali Node és sima CSS. Az átállás újraírást jelentene, és nem javítaná az eredményt.
- **Közösségi bővítmények:** a tartalmukat nem tudom előre ellenőrizni, ezért csak átnézés után, a te kérésedre.
- **Anthropic Frontend Design, Chrome DevTools MCP:** hivatalos eszközök, használhatók, de a telepítést te végzed a saját felületeden. A minőséget nem ezek adják.
