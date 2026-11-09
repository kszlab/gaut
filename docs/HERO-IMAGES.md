# Hero-képek előállítása

A honlap nyitóképei most a koncepciótáblákból külön képekre bontott, 2400 px szélességre felskálázott WebP fájlok (`public/site/img/hero-1.webp`, `hero-2.webp`, `hero-3.webp`). Ezek még AI-vizualizációk, nem végleges anyagok. A második körben a ChatGPT módosította a képeket (2000×1333, 3:2, mindhárom teljes épületképpel). A hero-3-on már nincsenek jobbra futó vonalak, ezért a Szinkron ikonoszlopa a kép jobb szélén, rövid lime csatlakozóvonalakkal ül.

## Hogyan kerül be

Tedd a kész fájlt a `public/site/img/` mappába, a következő nevek valamelyikén (a webp előnyt élvez a jpg-vel szemben; ha egyik sincs, az oldal a régi `heroN.png` ideiglenes képet keresné):

| Arculat | Fájlnév |
| --- | --- |
| 01 Rendszer | `hero-1.webp` vagy `hero-1.jpg` |
| 02 Struktúra | `hero-2.webp` vagy `hero-2.jpg` |
| 03 Szinkron | `hero-3.webp` vagy `hero-3.jpg` |

Ajánlott méret: legalább 2000 px széles, 4:3 vagy 3:2 arány, 300 KB alatti webp/jpg (érdemes tömöríteni). Az oldal a kép szélét elhalványítja, ezért a háttér legyen egységes, szöveg és felület nélkül. A 03-nál az épület jobb széle után legyen kb. 8% üres sötét sáv az ikonoszlopnak.

## Kép-promptok (ChatGPT / image_gen, angolul)

Mindhárom promptban az a lényeg, hogy **csak az épület** legyen a képen: ne legyen rajta laptop, böngésző, felirat, logó, menü, gomb vagy ember a kép szélén.

**01 Rendszer**

```
Clean high-resolution architectural visualization, isometric three-quarter view of a modern contemporary commercial building with glass facades, terraces and a few trees, white and light grey tones, thin teal (#007F82) building-services lines running through the facade and roof as integrated engineering paths. Light neutral off-white background fading softly at the edges (#F4F7F7), generic building, not a real project. No text, no logo, no people, no UI, no laptop, no border. 3:2 landscape, 2400 px wide, sharp detail.
```

**02 Struktúra**

```
Editorial architectural photograph at golden hour of a generic contemporary commercial building facade, dark graphite panels and glass, warm interior light, a young tree in front, subtle thin copper (#B36C45) lines tracing the facade joints like system lines. Calm sky with soft warm tones, generous space on the left side of the frame. Not a real identifiable building. No text, no logo, no UI, no border. 4:3 landscape, 2400 px wide, photorealistic.
```

**03 Szinkron**

```
Technical visualization of a modern multi-storey glass office building in cutaway view on a deep ink blue background (#152C52), interconnected building subsystems drawn as glowing vivid lime (#C5E64A) pipes, ducts and cable paths across the floors, a few small figures for scale, a tree at the lower left. Leave about 8% empty dark ink blue space at the right edge (icon boxes are added on the website). Dark ink blue background everywhere else. No text, no logo, no UI, no laptop, no border. 3:2 landscape, 2400 px wide.
```

A Szinkron ikonoszlop függőleges helyzetét a `public/site/site.css`-ben a `.sys-icons li:nth-child(n)` szabályok adják meg; másik kép esetén ott kell igazítani.
