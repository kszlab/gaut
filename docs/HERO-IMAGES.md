# Hero-képek előállítása

A honlap nyitóképei most a koncepciótáblákból külön képekre bontott, 2400 px szélességre felskálázott WebP fájlok (`public/site/img/hero-1.webp`, `hero-2.webp`, `hero-3.webp`). Ezek még AI-vizualizációk, nem végleges anyagok. A második körben a ChatGPT módosította a képeket (2000×1333, 3:2, mindhárom teljes épületképpel). A harmadik körben a hero-3 a koncepciótábla stílusát követő, drótvázas kép lett (1536×1024, 3:2): öt lime vonal fut ki a jobb szélére, és a Szinkron ikonoszlopa ezek végén ül. Az oldal a képet „lighten" keveréssel teszi a `#152C52` háttérre, ezért a kép háttere legyen ennél sötétebb vagy vele egyező, különben doboznak látszik.

## Hogyan kerül be

Tedd a kész fájlt a `public/site/img/` mappába, a következő nevek valamelyikén (a webp előnyt élvez a jpg-vel szemben; ha egyik sincs, az oldal a régi `heroN.png` ideiglenes képet keresné):

| Arculat | Fájlnév |
| --- | --- |
| 01 Rendszer | `hero-1.webp` vagy `hero-1.jpg` |
| 02 Struktúra | `hero-2.webp` vagy `hero-2.jpg` |
| 03 Szinkron | `hero-3.webp` vagy `hero-3.jpg` |

Ajánlott méret: legalább 2000 px széles, 4:3 vagy 3:2 arány, 300 KB alatti webp/jpg (érdemes tömöríteni). Az oldal a kép szélét elhalványítja, ezért a háttér legyen egységes, szöveg és felület nélkül. A 03-nál az épület jobb széle után legyen kb. 14% üres sáv, amelyben csak az ikonokhoz futó öt lime vonal van.

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

A `GAUT-03-Szinkron.png` táblát is csatolni kell stílusmintának, ezzel a bevezetővel:

```
Use the attached brand board only as a style reference for the building illustration on the laptop screen: same x-ray wireframe look, same lime service lines, same ink blue. Do not reproduce the laptop, the website layout, the text, the logo or the icon boxes; draw only the building as described below.

Technical x-ray visualization of a modern five-storey glass office building, three-quarter view from the front left, in the style of a refined architectural wireframe: thin pale-blue and white outline lines for slabs, columns, facade grid and railings, glass surfaces semi-transparent so the interior floors are visible through them. Stepped terraces on the left side, a taller block on the right.

Building services run through all floors as glowing vivid lime (#C5E64A) orthogonal lines: ducts, pipes and cable paths with a few small lime junction boxes. The lime is used sparingly, the building itself stays blue-white.

From the right side of the building, exactly five thin lime lines run horizontally to the right edge of the image, with one or two right-angle bends near the building. They reach the right edge at 22%, 37%, 52%, 67% and 81% of the image height, measured from the top. Each line ends at the edge, with nothing drawn at its end.

Background: completely flat, uniform ink blue #152C52 everywhere, no gradient, no vignette, no glow, no sky, no stars. No reflective ground: the building stands on a faint thin-line grid in slightly lighter blue that fades out quickly. Two or three small trees at the lower left drawn in muted blue-green, a few tiny human silhouettes inside for scale.

Composition: the building occupies the horizontal range from 18% to 86% of the image width and from 10% to 85% of the height. The left 18% and the right 14% contain only the flat background (and on the right the five lime lines).

No text, no letters, no logo, no icons, no UI, no laptop, no frame, no border, no watermark. Landscape 3:2, 2400 x 1600 px, sharp crisp lines.
```

A Szinkron ikonoszlop függőleges helyzetét a `public/site/site.css`-ben a `.sys-icons li:nth-child(n)` szabályok adják meg, a vonalak jobb széli magassága szerint (most 22,8%, 35%, 47%, 58,8%, 70,8%); másik kép esetén ott kell igazítani.
