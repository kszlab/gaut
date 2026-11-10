// "Tervezési fázisok" subpage: default text in both languages and the page body.
// Everything under `phases` that has a field in content.mjs can be edited from the workspace; the rest are interface strings.

export const PHASES_PATH = { hu: '/tervezesi-fazisok', en: '/en/design-phases' };
// Phases shown with more emphasis: tender, construction and shop design (index in `items`).
const KEY_PHASES = new Set([2, 3, 4]);
// Background document named on the page (Hungarian Chamber of Engineers).
const SOURCE_URL = 'https://mernokvagyok.hu/wp-content/uploads/2024/02/tervdokumentaciok-formai-kovetelmenye.pdf';

export const PHASES_TEXT = {
  hu: {
    navLabel: 'Tervezési fázisok',
    homeLink: 'Tervezési fázisok a koncepciótól a megvalósításig',
    metaTitle: 'Tervezési fázisok | GAUT Mérnökiroda',
    metaDescription: 'Az épületgépészeti automatika és épületfelügyeleti rendszerek tervezési fázisai a koncepciótól a tender- és kiviteli terveken át a gyártmánytervezésig.',
    kicker: 'Tervezési fázisok',
    h1: 'A koncepciótól a megvalósításig',
    intro: 'Az épületgépészeti automatika tervezése során a gépészeti technológia, a villamos vezérlések és az épületfelügyeleti rendszerek összehangolt kialakítására törekszünk.\n\nAz egyes tervezési fázisok eltérő részletezettséggel határozzák meg a rendszer működését, műszaki követelményeit és megvalósításának módját. A megfelelő tervfázis kiválasztása a beruházás előrehaladásától, a rendelkezésre álló alapadatoktól és a megrendelői igényektől függ.',
    flowLabel: 'A tervezési fázisok sorrendje',
    flowNote: 'Az egyes tervfázisok nem minden beruházásnál szükségesek önálló dokumentációként; a tényleges tervezési feladatokat a projekt követelményei és a megbízás határozzák meg.',
    summaryTitle: 'A fázisok röviden',
    colPhase: 'Tervfázis', colGoal: 'Elsődleges cél', colLevel: 'Dokumentáció részletezettsége',
    detailsTitle: 'A fázisok részletesen',
    contentLabel: 'Jellemző dokumentációs tartalom', resultLabel: 'Eredmény',
    items: [
      {
        name: 'Koncepció- és jóváhagyási terv', goal: 'Műszaki megoldások és alapelvek meghatározása', level: 'Rendszerszintű',
        lead: 'A tervezés kezdeti szakaszában meghatározzuk az automatizálási rendszer alapvető feladatait, felépítését és a kapcsolódó gépészeti rendszerek működési követelményeit.',
        list: 'Automatizálandó gépészeti rendszerek és fő funkciók meghatározása.\nSzabályozási és vezérlési alapelvek.\nÉpületfelügyeleti rendszer koncepciója.\nFőbb rendszerkapcsolatok és szakági interfészek.\nElőzetes műszaki specifikáció és költségbecslés.',
        result: 'Jóváhagyható automatizálási koncepció, amely a további tervezés alapjául szolgál.'
      },
      {
        name: 'Engedélyezési terv', goal: 'Hatósági eljáráshoz szükséges adatszolgáltatás', level: 'Áttekintő',
        lead: 'Az engedélyezési terv az építési engedélyezési dokumentációhoz szükséges automatika vonatkozású műszaki információkat tartalmazza.',
        list: 'A tervezett automatika- és épületfelügyeleti rendszer rövid ismertetése.\nA gépészeti rendszerek alapvető vezérlési és felügyeleti funkciói.\nA hatósági követelmények teljesítéséhez szükséges rendszerkapcsolatok.\nA tűzvédelmi és egyéb biztonsági rendszerekkel kapcsolatos alapkövetelmények.',
        result: 'Az engedélyezési eljáráshoz szükséges szakági dokumentáció, az adott beruházás követelményei szerint.'
      },
      {
        name: 'Ajánlati (tender) terv', goal: 'Összehasonlítható kivitelezői ajánlatok előkészítése', level: 'Funkcionális és műszaki',
        lead: 'A tenderterv célja, hogy a kivitelezők egységes műszaki követelmények alapján készíthessék el ajánlataikat.\n\nA dokumentáció meghatározza az elvárt automatizálási funkciókat, a rendszer műszaki paramétereit és a megvalósításhoz szükséges főbb berendezéseket.',
        list: 'Rendszerismertetés és műszaki leírás.\nGépészeti technológiai folyamatábrák, automatikaelemekkel.\nVezérlési és szabályozási funkciók meghatározása.\nElőzetes I/O lista és adatpontigény.\nDDC/PLC-rendszer és épületfelügyelet műszaki követelményei.\nKommunikációs rendszerek és szakági interfészek.\nKapcsolószekrények főbb műszaki paraméterei.\nBerendezések és automatikaelemek műszaki specifikációja.\nMennyiségi kimutatások, ajánlatkérési költségvetés.',
        result: 'Műszakilag összehasonlítható ajánlatok készítésére alkalmas dokumentáció.'
      },
      {
        name: 'Kiviteli terv', goal: 'A megvalósítandó rendszer részletes meghatározása', level: 'Részletes, kivitelezésre alkalmas',
        lead: 'A kiviteli terv a rendszer megvalósításához szükséges műszaki megoldásokat és követelményeket határozza meg.\n\nA dokumentáció részletesen bemutatja a gépészeti rendszerek vezérlését, szabályozását, villamos működtetését és az épületfelügyeleti kapcsolódásokat.',
        list: 'Részletes műszaki leírás és tervezői nyilatkozat.\nGépészeti technológiai folyamatábrák, automatika- és vezérlési elemekkel.\nRészletes működési és szabályozási leírások.\nI/O lista, mérési és beavatkozási pontok.\nKapcsolószekrények elvi kapcsolási és felépítési tervei.\nMotorindítások, védelmek, energiaellátási követelmények.\nDDC/PLC-rendszer struktúrája és kommunikációs hálózatok.\nÉpületfelügyeleti funkciók, rendszerkapcsolatok.\nTűzvédelmi vezérlések és biztonsági reteszelések.\nTelepítési alaprajzok, fő kábelezési és nyomvonal-követelmények.\nÁrazatlan tételes költségvetési kiírás.',
        result: 'A rendszer szakszerű kivitelezéséhez szükséges műszaki dokumentáció.'
      },
      {
        name: 'Gyártmányterv', goal: 'Konkrét készülékekre és berendezésekre történő kidolgozás', level: 'Gyártmány- és sorkapocsszintű',
        lead: 'A gyártmányterv a kiviteli terv alapján, a kiválasztott gépészeti és automatika-berendezések, valamint a konkrét gyártmányok és típusok ismeretében készül.\n\nCélja a teljes rendszer gyártáshoz, szereléshez és bekötéshez szükséges részletes kidolgozása, különös tekintettel az automatika kapcsolószekrényekre és a terepi készülékek csatlakoztatására.',
        list: 'Konkrét DDC/PLC-készülékek, I/O modulok és terepi eszközök kiválasztása.\nVégleges hardveres I/O kiosztás.\nKapcsolószekrények részletes készülékelrendezési terve.\nTeljes áramút- és kapcsolási rajzdokumentáció.\nSorkapocs- és csatlakozókiosztási tervek.\nKábel- és bekötési jegyzékek, érkiosztások.\nEnergiaellátási, védelmi és szekrény-hőtechnikai méretezések.\nKommunikációs hálózati topológia és készülékcsatlakozások.\nRészletes készülék-, anyag- és alkatrészjegyzék.\nGyártáshoz és szereléshez szükséges műszaki részletek.',
        result: 'Konkrét gyártmányokra kidolgozott, kapcsolószekrény-gyártásra, szerelésre és bekötésre alkalmas dokumentáció.'
      },
      {
        name: 'Megvalósulási dokumentáció', goal: 'A ténylegesen megvalósult rendszer rögzítése', level: 'Végleges, állapotkövető',
        lead: 'A megvalósulási dokumentáció a kivitelezés során ténylegesen megvalósult műszaki állapotot rögzíti.',
        list: 'A kivitelezés során végrehajtott módosítások átvezetése.\nVégleges kapcsolási rajzok és szekrénydokumentáció.\nTényleges készülék- és I/O kiosztások.\nVégleges kábel- és sorkapocsjegyzékek.\nA megvalósult kommunikációs és rendszerkapcsolatok dokumentálása.\nA rendelkezésre álló üzembe helyezési és átadási dokumentumok hivatkozásai.',
        result: 'Az üzemeltetés, karbantartás és későbbi rendszerátalakítások műszaki alapdokumentációja.'
      }
    ],
    formTitle: 'A dokumentáció tartalmi és formai követelményei',
    formText: 'A tervek részletezettségét az adott tervezési fázis, a rendszer összetettsége és a szerződésben meghatározott műszaki tartalom határozza meg.\n\nA tervdokumentációk általános formai elemei:',
    formList: 'Azonosítható címlap, tartalomjegyzék és tervjegyzék.\nA tervezési fázisnak megfelelő műszaki leírás és rajzdokumentáció.\nEgyedi tervszámok, rajzpecsétek, tervverziók és módosítási jelölések.\nEgységes berendezés- és készülékazonosítók, jelmagyarázatok.\nA szükséges számítások, műszaki specifikációk és jegyzékek.\nA tervfázisra vonatkozó előírások szerinti hitelesítés és dokumentumformátum.',
    formNote: 'A konkrét dokumentumjegyzéket minden esetben a tervezési feladat, a szakági adatszolgáltatások és a szerződéses követelmények alapján határozzuk meg.',
    backgroundTitle: 'Szakmai és szabályozási háttér',
    backgroundText: 'A tervezési fázisok tartalmi felépítésének egyik alapja a Magyar Mérnöki Kamara Tervdokumentációk tartalmi és formai követelményeinek szabályzata, különösen az épületgépészeti automatika és épületfelügyeleti rendszerekre vonatkozó 12.6. fejezet.\n\nA gyártmánytervezés részletes tartalma a kivitelezési tervekhez kapcsolódó szakmai gyakorlatra és az adott projekt szerződéses követelményeire épül.',
    sourceLabel: 'A kamarai szabályzat megnyitása (PDF, magyar nyelvű)'
  },
  en: {
    navLabel: 'Design phases',
    homeLink: 'Design phases from concept to completion',
    metaTitle: 'Design phases | GAUT Engineering',
    metaDescription: 'The design phases of building services automation and building management systems, from concept through tender and construction design to shop design.',
    kicker: 'Design phases',
    h1: 'From concept to completion',
    intro: 'When designing building services automation we aim to bring the mechanical process, the electrical controls and the building management system together in one coordinated solution.\n\nEach design phase defines the operation of the system, its technical requirements and the way it is to be built at a different level of detail. Which phase is appropriate depends on how far the project has progressed, the input data available and the client\'s needs.',
    flowLabel: 'Order of the design phases',
    flowNote: 'Not every project needs each phase as a separate set of documents; the actual design tasks are set by the requirements of the project and by the commission.',
    summaryTitle: 'The phases at a glance',
    colPhase: 'Phase', colGoal: 'Primary purpose', colLevel: 'Level of detail',
    detailsTitle: 'The phases in detail',
    contentLabel: 'Typical content of the documentation', resultLabel: 'Result',
    items: [
      {
        name: 'Concept and approval design', goal: 'Defining the technical solutions and principles', level: 'System level',
        lead: 'At the start of the design we define the basic tasks and structure of the automation system and the operating requirements of the connected mechanical systems.',
        list: 'The mechanical systems to be automated and their main functions.\nPrinciples of control and regulation.\nConcept of the building management system.\nMain system connections and interfaces between disciplines.\nPreliminary technical specification and cost estimate.',
        result: 'An automation concept that can be approved and serves as the basis for further design.'
      },
      {
        name: 'Permit design', goal: 'Information required for the authority procedure', level: 'Overview',
        lead: 'The permit design contains the automation-related technical information required for the building permit documentation.',
        list: 'A short description of the planned automation and building management system.\nBasic control and supervision functions of the mechanical systems.\nSystem connections needed to meet the requirements of the authorities.\nBasic requirements related to fire protection and other safety systems.',
        result: 'The discipline documentation required for the permit procedure, according to the requirements of the project.'
      },
      {
        name: 'Tender design', goal: 'Preparing comparable contractor bids', level: 'Functional and technical',
        lead: 'The purpose of the tender design is to let contractors prepare their bids against the same technical requirements.\n\nThe documentation defines the automation functions expected, the technical parameters of the system and the main equipment needed to build it.',
        list: 'System description and technical specification.\nMechanical process diagrams with automation elements.\nDefinition of control and regulation functions.\nPreliminary I/O list and data point demand.\nTechnical requirements for the DDC/PLC system and building management.\nCommunication systems and interfaces between disciplines.\nMain technical parameters of the control cabinets.\nTechnical specification of equipment and automation elements.\nBills of quantities and tender cost schedule.',
        result: 'Documentation suitable for preparing technically comparable bids.'
      },
      {
        name: 'Construction design', goal: 'Detailed definition of the system to be built', level: 'Detailed, suitable for construction',
        lead: 'The construction design defines the technical solutions and requirements needed to build the system.\n\nThe documentation describes in detail the control, regulation and electrical operation of the mechanical systems and their connections to building management.',
        list: 'Detailed technical specification and designer\'s declaration.\nMechanical process diagrams with automation and control elements.\nDetailed descriptions of operation and regulation.\nI/O list, measurement and actuation points.\nSchematic wiring and layout drawings of the control cabinets.\nMotor starters, protection and power supply requirements.\nStructure of the DDC/PLC system and communication networks.\nBuilding management functions and system connections.\nFire protection controls and safety interlocks.\nInstallation layouts, main cabling and routing requirements.\nUnpriced itemised bill of quantities.',
        result: 'The technical documentation needed to build the system professionally.'
      },
      {
        name: 'Shop design', goal: 'Elaboration for specific devices and equipment', level: 'Product and terminal level',
        lead: 'The shop design is prepared on the basis of the construction design, once the mechanical and automation equipment and the specific products and types have been selected.\n\nIts purpose is to work out the whole system in the detail needed for manufacturing, installation and wiring, with particular attention to the automation control cabinets and the connection of field devices.',
        list: 'Selection of the specific DDC/PLC devices, I/O modules and field devices.\nFinal hardware I/O allocation.\nDetailed device layout drawings of the control cabinets.\nComplete circuit and wiring diagrams.\nTerminal and connector allocation drawings.\nCable and wiring schedules, core allocations.\nSizing of power supply, protection and cabinet thermal conditions.\nCommunication network topology and device connections.\nDetailed list of devices, materials and parts.\nTechnical details needed for manufacturing and installation.',
        result: 'Documentation worked out for specific products, suitable for cabinet manufacturing, installation and wiring.'
      },
      {
        name: 'As-built documentation', goal: 'Recording the system as actually built', level: 'Final, reflecting the built state',
        lead: 'The as-built documentation records the technical state actually achieved during construction.',
        list: 'Changes made during construction, carried through the documents.\nFinal wiring diagrams and cabinet documentation.\nActual device and I/O allocations.\nFinal cable and terminal schedules.\nDocumentation of the communication and system connections as built.\nReferences to the available commissioning and handover documents.',
        result: 'The basic technical documentation for operation, maintenance and later modifications of the system.'
      }
    ],
    formTitle: 'Content and form of the documentation',
    formText: 'The level of detail of the drawings and documents is set by the design phase, the complexity of the system and the technical content defined in the contract.\n\nGeneral formal elements of the design documentation:',
    formList: 'Identifiable title page, table of contents and drawing list.\nTechnical description and drawings appropriate to the design phase.\nUnique drawing numbers, title blocks, revisions and change markings.\nConsistent equipment and device tags, legends.\nThe necessary calculations, technical specifications and schedules.\nAuthentication and document format according to the rules that apply to the phase.',
    formNote: 'The actual list of documents is always defined on the basis of the design task, the input from the other disciplines and the contractual requirements.',
    backgroundTitle: 'Professional and regulatory background',
    backgroundText: 'One basis for the content of the design phases is the Hungarian Chamber of Engineers\' regulation on the content and form of design documentation (Tervdokumentációk tartalmi és formai követelményeinek szabályzata), in particular chapter 12.6 on building services automation and building management systems.\n\nThe detailed content of shop design builds on the professional practice connected to construction design and on the contractual requirements of the project.',
    sourceLabel: 'Open the Chamber regulation (PDF, in Hungarian)'
  }
};

const lines = text => String(text ?? '').split('\n').map(s => s.trim()).filter(Boolean);
const two = n => String(n + 1).padStart(2, '0');

// The <main> content of the page. `esc` and `paragraphs` come from the site renderer so all text is escaped in one way.
export function phasesMain(p, { esc, paragraphs }) {
  const list = text => { const li = lines(text); return li.length ? `<ul class="ph-list">${li.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''; };
  const items = p.items.map((it, i) => ({ ...it, i, key: KEY_PHASES.has(i) }));
  return `<section class="page-hero">
  <div class="wrap">
    <p class="kicker">${esc(p.kicker)}</p>
    <h1 class="page-title">${esc(p.h1)}</h1>
    <div class="page-intro">${paragraphs(p.intro)}</div>
    <nav aria-label="${esc(p.flowLabel)}">
      <ol class="flow">${items.map(it => `<li${it.key ? ' class="key"' : ''}><a href="#fazis-${it.i + 1}"><span class="flow-num">${two(it.i)}</span><span class="flow-name">${esc(it.name)}</span></a></li>`).join('')}</ol>
    </nav>
    ${p.flowNote ? `<p class="flow-note">${esc(p.flowNote)}</p>` : ''}
  </div>
</section>

<section class="block alt">
  <div class="wrap">
    <h2>${esc(p.summaryTitle)}</h2>
    <table class="ptable">
      <thead><tr><th scope="col">${esc(p.colPhase)}</th><th scope="col">${esc(p.colGoal)}</th><th scope="col">${esc(p.colLevel)}</th></tr></thead>
      <tbody>${items.map(it => `<tr${it.key ? ' class="key"' : ''}><th scope="row"><span class="num">${two(it.i)}</span> ${esc(it.name)}</th><td data-label="${esc(p.colGoal)}">${esc(it.goal)}</td><td data-label="${esc(p.colLevel)}">${esc(it.level)}</td></tr>`).join('')}</tbody>
    </table>
  </div>
</section>

<section class="block">
  <div class="wrap">
    <h2>${esc(p.detailsTitle)}</h2>
    <div class="phases">${items.map(it => `<details class="phase${it.key ? ' key' : ''}" id="fazis-${it.i + 1}">
      <summary><span class="num">${two(it.i)}</span><span class="ph-head"><h3>${esc(it.name)}</h3><span class="ph-short">${esc(it.goal)}</span></span><span class="ph-chev" aria-hidden="true"></span></summary>
      <div class="ph-body">
        ${paragraphs(it.lead)}
        <h4>${esc(p.contentLabel)}</h4>
        ${list(it.list)}
        <p class="ph-result"><strong>${esc(p.resultLabel)}:</strong> ${esc(it.result)}</p>
      </div>
    </details>`).join('')}</div>
  </div>
</section>

<section class="block alt">
  <div class="wrap split">
    <div><h2>${esc(p.formTitle)}</h2><div class="prose">${paragraphs(p.formText)}${list(p.formList)}${paragraphs(p.formNote)}</div></div>
    <div><h2>${esc(p.backgroundTitle)}</h2><div class="prose">${paragraphs(p.backgroundText)}<p><a href="${SOURCE_URL}" target="_blank" rel="noopener noreferrer">${esc(p.sourceLabel)}</a></p></div></div>
  </div>
</section>`;
}
