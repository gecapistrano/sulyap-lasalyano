/**
 * One-shot builder: regenerates 02-i18n.js dictionaries for all locales.
 * Run: node scripts/_build-i18n.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildRest } from './_locales-asia-eu.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, '02-i18n.js');

const SCAN_EN = {
  'scan.title': 'Live Scan',
  'scan.point': 'Point at memorabilia — tap an outline for details',
  'scan.tapOutline': 'Tap to view',
  'scan.detectedLabel': '{code} DETECTED!',
  'scan.itemsFound': 'items found',
  'scan.loadingModel': 'Loading model…',
  'scan.loadingScanner': 'Loading live scanner',
  'scan.loadingCatalog': 'Loading from catalog…',
  'scan.scanning': 'scanning…',
  'scan.tipPrefix': 'Tip:',
  'scan.tip1': 'Hold steady — an outline appears only after a confident lock. Tap it for details.',
  'scan.tip2': 'Pinch with two fingers to zoom the camera.',
  'scan.tip3': 'Ensure good lighting for better detection.',
  'scan.tip4': 'Tap X to return to the camera and scan another item.',
  'scan.needAccess': 'Camera access needed',
  'scan.unavailable': 'Camera unavailable',
  'scan.enableTitle': 'Enable camera to scan',
  'scan.enableHint': 'Tap “Enable Camera” to let your browser access the camera for Live Scan.',
  'scan.enableBtn': 'Enable Camera',
  'scan.retryBtn': 'Retry Camera',
  'scan.unsupported': 'Camera is not supported in this browser.',
  'scan.denied': 'Please allow camera access to scan artifacts.',
  'scan.notFound': 'No camera was found on this device.',
  'scan.inUse': 'Camera may be in use by another tab. Close other tabs and try again.',
  'scan.failed': 'Camera access failed. Try again.',
  'scan.historical': 'Historical Context',
  'scan.tapMore': 'Tap to learn more',
  'scan.unknownItem': 'Unknown item',
  'scan.noCatalog': 'No catalog record found for this detection.',
  'scan.noCatalogFor': 'No published catalog record found for {code}.',
  'scan.loadingCatalogDetails': 'Loading catalog details…',
  'scan.modelFailed': 'Could not load the recognition model. Check your connection and reload.',
  'scan.backHome': 'Back to home',
  'scan.darkMode': 'Toggle dark mode',
  'scan.exit': 'Back to live scan',
  'scan.expandDetails': 'Show details',
  'scan.collapseDetails': 'Hide details',
  'scan.viewer': 'Artifact 3D view. Drag to rotate, pinch to zoom.',
  'scan.lightMode': 'Switch to light mode',
  'scan.darkModeOn': 'Switch to dark mode',
};

/** Knowledge Graph page chrome — product name kept literal across locales. */
const KG_EN = {
  'kg.title': 'Knowledge Graph',
  'kg.back': '← Back',
  'kg.backLabel': 'Go back',
  'kg.status': 'Drag to orbit · pinch to zoom',
  'kg.loading': 'Loading knowledge graph',
  'kg.error': 'Could not load the knowledge graph.',
  'kg.zoomIn': 'Zoom in',
  'kg.zoomOut': 'Zoom out',
  'kg.fit': 'Fit all',
  'kg.layout': 'Layout',
  'kg.layoutWeb': 'Web',
  'kg.layoutTimeline': 'Timeline',
  'kg.legend': 'Legend',
  'kg.legendPresident': 'President',
  'kg.legendArtifact': 'Artifact',
  'kg.legendCategory': 'Category',
  'kg.legendEra': 'Era',
  'kg.legendEventPlace': 'Event / Place',
  'kg.themeLight': 'Switch to light mode',
  'kg.themeDark': 'Switch to dark mode',
  'kg.aria': 'Knowledge graph. Drag to orbit, pinch or use buttons to zoom, two-finger drag to pan, tap a node to select.',
  'kg.zoomControls': 'Zoom controls',
  'kg.legendToggle': 'Show or hide the legend',
};

/** President profile page chrome — proper names stay untranslated in JS data. */
const PRES_EN = {
  'pres.back': '← Back',
  'pres.backLabel': 'Go back',
  'pres.realName': 'Real name',
  'pres.nickname': 'Nickname',
  'pres.realNamePh': '[Full legal name to be confirmed]',
  'pres.nicknamePh': '[Nickname to be confirmed]',
  'pres.history': 'History / bibliography',
  'pres.historyBody':
    'A short biography and bibliography will appear here. [Placeholder pending curatorial research.]',
  'pres.memories': 'Photos & memories',
  'pres.carouselPrev': 'Previous photo',
  'pres.carouselNext': 'Next photo',
  'pres.slidePh': 'Photo slot reserved',
  'pres.missing': 'President not found.',
  'pres.missingHint': 'Return home to browse the collection.',
};

const en = {
  skip: 'Skip to content',
  school: 'De La Salle University Philippines',
  'school.short': 'DLSU Dasmariñas',
  'nav.home': 'Home',
  'nav.history': 'History',
  'nav.gallery': 'DLSU Presidents’ Memorabilia',
  'nav.library': 'AEA-IRC at DLSU-D',
  'nav.soon': 'Sulyap Lasalyano',
  'nav.menu': 'Menu',
  'nav.close': 'Close menu',
  lang: 'Language',
  'hero.title': 'Presidents’ Memorabilia',
  'hero.title.line1': 'Presidents’',
  'hero.title.line2': 'Memorabilia',
  'hero.alt': 'Campus Collection',
  'hero.powered': 'Powered by',
  'hero.lead': 'A quiet archive of medals, portraits, and ceremonial pieces from each presidency.',
  'flip.label': 'About Sulyap Lasalyano',
  'flip.label.warm': 'Back to home',
  'flip.switch': 'Switch view',
  'cta.explore': 'Browse the collection',
  'cta.history': 'View history',
  'cta.scan': 'Scan artifacts now!',
  'cta.kg': 'View Knowledge Graph ->',
  'cta.hint': 'Are you onsite at the museum?',
  'ag.title': 'About',
  'ag.copy':
    'The Presidents’ Memorabilia is a collection housed at the Aklatang Emilio Aguinaldo – Information Resource Center (AEA-IRC) of De La Salle University-Dasmariñas. It preserves artifacts such as commemorative trophies, plaques, and travel souvenirs that embody the Lasallian values and leadership of the university’s former presidents. As a historical link between the DLSU-D community’s past and its future, the collection supports the university’s identity as a Heritage and Cultural Center.',
  'aea.title': 'About Aklatang Emilio Aguinaldo – Information Resource Center (AEA-IRC)',
  'aea.title.lead': 'About',
  'aea.title.rest': 'Aklatang Emilio Aguinaldo – Information Resource Center (AEA-IRC)',
  'aea.info': 'About Aklatang Emilio Aguinaldo – Information Resource Center (AEA-IRC)',
  'aea.info.btn': 'Info',
  'aea.info.close': 'Close',
  'aea.info.hint': 'click here',
  'aea.info.body':
    'The Aklatang Emilio Aguinaldo – Information Resource Center (AEA-IRC) is a replica of the Aguinaldo Shrine in Kawit, the home of the first Philippine President, General Emilio Aguinaldo, and its facade is a larger version of the shrine. The building was the brainchild of Br. Andrew Gonzales and was inaugurated on April 30, 1992. This makes the structure itself a piece of heritage, a fitting home for the Presidents’ Memorabilia.',
  'aea.info.body2':
    'It began in 1977 as a classroom-sized library with two staff members, when General Emilio Aguinaldo College Dasmariñas Campus was first established. Its growth into a landmark that forms part of a museum complex envisioned as a cultural zone reflects DLSU-D’s identity as a Heritage and Cultural Center.',
  'scroll.more': 'Scroll',
  'col.title': 'Objects that carry the university’s story',
  'col.p1':
    '[Collection description: two or three sentences about what the collection holds, who it honors, and how the pieces were gathered.]',
  'col.p2':
    'Browse medals, portraits, ceremonial pieces, and documents from each presidency. Every item has a short note on where it came from and why it was kept.',
  'col.link': 'Browse the museum',
  'bld.name': '[Building or person name]',
  'about.title': 'About the developer',
  'about.body':
    '[Developer bio: who built this site, what the project set out to do, and how to get in touch.]',
  'about.photo': 'Photo of the developer (placeholder)',
  'gal.title': 'Museum',
  'gal.intro': 'Four pieces from the collection. Select one to see it larger.',
  'foot.enjoy': 'Enjoy your visit!',
  'foot.top': 'Back to top',
  'foot.copy': '© 2026 De La Salle University–Dasmariñas',
  'lb.close': 'Close',
  'lb.prev': 'Previous item',
  'lb.next': 'Next item',
  'nx.kick': 'What’s next',
  'nx.gallery': 'Open the museum',
  'nx.gallery.p': 'Four pieces from the collection: medals, portraits, and ceremonial objects.',
  'nx.home': 'Return home',
  'nx.home.p': 'Back to the collection story and campus stage.',
  'nx.meta': 'Hash route · deep-linkable',
  'nx.edu.kicker': 'What is',
  'nx.edu.title': 'Sulyap Lasalyano',
  'nx.edu.mark': '?',
  'nx.edu.cats.by': 'By',
  'nx.edu.intro.p1':
    'Sulyap Lasalyano is a web-based augmented reality system that lets you explore the Presidents’ Memorabilia at the Aklatang Emilio Aguinaldo – Information Resource Center (AEA-IRC) of De La Salle University-Dasmariñas.',
  'nx.edu.intro.p2':
    'Point your camera at an artifact and it identifies the item and shows its story on your screen. There is nothing to download or install. Just open it in your mobile browser.',
  'nx.edu.intro.why': 'Why was it created?',
  'nx.edu.intro.p3':
    'The Presidents’ Memorabilia preserves the legacy and Lasallian values of DLSU-D’s former presidents, but traditional displays can only show so much. Static displays and printed labels struggle to hold the attention of a generation raised on digital and interactive experiences, which has led to low visitation and a fading awareness of the university’s own heritage.',
  'nx.edu.intro.p4':
    'Sulyap Lasalyano was built to close that gap. It turns a passive gallery visit into an active, immersive learning experience, helping students, faculty, staff, and visitors discover, understand, and appreciate DLSU-D’s institutional heritage. In support of UN Sustainable Development Goal 11.4, it also uses technology to protect and promote cultural heritage.',
  'nx.edu.features': 'Core features',
  'nx.edu.scan.name': 'Live Scan',
  'nx.edu.scan.body':
    'Live Scan is the heart of the system. It uses your phone’s camera and a custom-trained YOLOv8 object detection model, trained on images of the memorabilia, to recognize artifacts in real time.',
  'nx.edu.scan.s1': 'Open Live Scan from the home page and allow camera access.',
  'nx.edu.scan.s2': 'Point your camera at a memorabilia item inside the gallery.',
  'nx.edu.scan.s3':
    'Once the system is confident about the item, a 3D model of the artifact appears on your screen.',
  'nx.edu.scan.s4':
    'An information sheet slides up showing the artifact’s name, year, associated president, and description. Close it to scan another item.',
  'nx.edu.scan.tip':
    'If an item isn’t recognized, try a different angle or better lighting.',
  'nx.edu.scan.cta': 'Try',
  'nx.edu.kg.name': 'Knowledge Graph',
  'nx.edu.kg.body':
    'The Knowledge Graph shows how the collection fits together. Instead of viewing each artifact in isolation, you can see the connections between the AEA-IRC, DLSU-D, the university presidents, the years, and the artifacts. Circles represent each of these, and lines show which are related.',
  'nx.edu.kg.how':
    'To use it, open View Knowledge Graph from the home page, drag to pan around the graph, and use the plus and minus buttons to zoom. It helps you see the bigger story behind each item, such as which artifacts belong to which president and era.',
  'nx.edu.kg.cta': 'View',
  'nx.edu.also.title': 'Also in the system',
  'nx.edu.also.browse.label': 'Browse:',
  'nx.edu.also.browse':
    'Prefer not to use the camera? Pick a DLSU-D president, view their memorabilia, and open any artifact to see a rotatable, zoomable 3D model with its details.',
  'nx.edu.also.lang.label': 'Multilingual support:',
  'nx.edu.also.lang':
    'Read the content in English, Filipino, Spanish, French, Chinese, Korean, or Japanese.',
  'nx.edu.credit':
    'Sulyap Lasalyano is a thesis project by Lagajino, Ricafrente, and Capistrano, Bachelor of Science in Computer Science, Specializing in Intelligent Systems, under adviser Tita R. Herradura.',
  'nx.edu.inspire': 'Frontend inspired by',
  'skip.next': 'Next section',
  'menu.title': 'Navigate',
  'toast.lang': 'Language',
  'toast.lang.detail': 'Switched to English',
  'toast.offline': 'You are offline',
  'toast.offline.detail': 'Some links may not work until you reconnect.',
  'toast.online': 'Back online',
  'toast.online.detail': 'Connection restored.',
  'img.fail': 'Image unavailable',
  nojs: 'JavaScript is off. You can still read the pages via the links below.',
  'pre.name': 'President’s Memorabilia',
  'pre.loading': 'Loading…',
  'pre.ready': 'Ready',
  '404.title': 'Route not found',
  '404.body': 'This path is not part of the collection. Head home.',
  '404.home': 'Back to home',
  'guide.title': 'Pat Riotik',
  'guide.subtitle': 'Pat · site guide',
  'guide.close': 'Close guide',
  'guide.fab.open': 'Open Pat · site guide',
  'guide.fab.close': 'Close Pat · site guide',
  'guide.welcome':
    'Hey there — I’m Pat! Happy to help you poke around this collection. What are you curious about?',
  'guide.placeholder': 'Ask about the collection…',
  'guide.input.label': 'Ask Pat',
  'guide.send': 'Send message',
  'guide.chip.importance': 'Why are these items important?',
  'guide.chip.visit': 'Who can visit the museum?',
  'guide.chip.maintain': 'Who keeps and maintains the collection?',
  'guide.reply.limited':
    "Hmmm.. I might be able to respond to your input soon. For now, there's not much I can say about that. But don't worry! You can learn more by browsing deeper into the website and scanning more artifacts. Have fun exploring! 💚",
  'guide.reply.soon':
    "Hmmm.. I might be able to respond to your input soon. For now, there's not much I can say about that. But don't worry! You can learn more by browsing deeper into the website and scanning more artifacts. Have fun exploring! 💚",
  'guide.reply.hello':
    'Hey! I’m Pat Riotik, your friendly site guide. Ask me about the Presidents’ Memorabilia, AEA-IRC, Live Scan, the Knowledge Graph, or what’s on this home page—happy to share what I know. 💚',
  'guide.reply.ack': 'Alright! I’m right here if you need anything about the collection. 💚',
  'guide.reply.thanks': 'You’re very welcome! Enjoy exploring. 💚',
  'guide.reply.bye': 'Bye for now — have fun exploring! 💚',
  'guide.reply.importance':
    'Happy to share — the Presidents’ Memorabilia preserves artifacts such as commemorative trophies, plaques, and travel souvenirs that embody the Lasallian values and leadership of DLSU-D’s former presidents. As a historical link between the community’s past and future, the collection supports the university’s identity as a Heritage and Cultural Center.',
  'guide.reply.visit':
    'You’re welcome anytime — Sulyap Lasalyano helps students, faculty, staff, and visitors discover and appreciate DLSU-D’s institutional heritage—onsite at the Presidents’ Memorabilia in AEA-IRC, or through this digital experience in a mobile browser.',
  'guide.reply.maintain':
    'Here’s the scoop — the collection is housed at the Aklatang Emilio Aguinaldo – Information Resource Center (AEA-IRC) of De La Salle University-Dasmariñas, a fitting home for the Presidents’ Memorabilia as part of DLSU-D’s Heritage and Cultural Center identity.',
  'guide.reply.what':
    'Glad you asked! Sulyap Lasalyano is a web-based augmented reality system for the Presidents’ Memorabilia at AEA-IRC, DLSU-D. Point your camera at an artifact and it identifies the item and shows its story—nothing to download or install; just open it in your mobile browser.',
  'guide.reply.why':
    'Here’s why it matters — traditional displays struggle to hold attention and visitation has been low. Sulyap Lasalyano turns a passive gallery visit into an active learning experience, and supports UN Sustainable Development Goal 11.4 by using technology to protect and promote cultural heritage.',
  'guide.reply.scan':
    'Fun one! Live Scan uses your phone’s camera and a custom-trained YOLOv8 model to recognize memorabilia in real time. Allow camera access, point at an item, then a 3D model and info sheet appear. Try another angle or better lighting if it isn’t recognized.',
  'guide.reply.kg':
    'Love this part — the Knowledge Graph shows how the collection fits together—links among AEA-IRC, DLSU-D, presidents, years, and artifacts. Open it from the home page, drag to pan, and use +/− to zoom.',
  'guide.reply.browse':
    'No camera? No problem — browse by DLSU-D president, open memorabilia, and view a rotatable, zoomable 3D model with details.',
  'guide.reply.lang':
    'Yep! You can read the content in English, Filipino, Spanish, French, Chinese, Korean, or Japanese.',
  'guide.reply.aeairc':
    'Nice ask — AEA-IRC is a replica of the Aguinaldo Shrine in Kawit—a larger facade version of the shrine. It was the brainchild of Br. Andrew Gonzales and was inaugurated on April 30, 1992. It began in 1977 as a classroom-sized library when the campus was first established.',
  'guide.reply.team':
    'Proud to say — Sulyap Lasalyano is a thesis project by Lagajino, Ricafrente, and Capistrano (BS Computer Science, Specializing in Intelligent Systems), under adviser Tita R. Herradura.',
  'guide.reply.presidents':
    'You’ll meet them on the home page — former presidents in the collection story, including Br. Inigo, Br. Andrew, Br. Armin, Br. Donato, Br. Gus, Br. Mawel, Br. Rolly, Br. Sockie, and Dr. Quebengco. Browse their memorabilia from the marquee!',
  ...SCAN_EN,
  ...KG_EN,
  ...PRES_EN,
  items: [
    { t: 'Inaugural medallion', d: '[Year]. Worn at the inauguration ceremony. [Short note about this piece.]' },
    { t: 'Official portrait', d: '[Year]. Hung in the president’s hall. [Short note about this piece.]' },
    { t: 'Ceremonial gavel', d: '[Year]. Used to open the first assembly. [Short note about this piece.]' },
    { t: 'Signed charter', d: '[Year]. Signed and sealed on the day of appointment. [Short note about this piece.]' },
  ],
};

/** Fill overrides onto a clone of EN. */
function locale(overrides) {
  const out = { ...en, items: en.items.map((it) => ({ ...it })) };
  for (const [k, v] of Object.entries(overrides)) {
    if (k === 'items') out.items = v;
    else out[k] = v;
  }
  return out;
}

const fil = locale({
  skip: 'Lumaktaw sa nilalaman',
  'nav.home': 'Home',
  'nav.history': 'Kasaysayan',
  'nav.gallery': 'DLSU Presidents’ Memorabilia',
  'nav.library': 'AEA-IRC at DLSU-D',
  'nav.soon': 'Sulyap Lasalyano',
  'nav.menu': 'Menu',
  'nav.close': 'Isara ang menu',
  lang: 'Wika',
  'hero.title': 'Mga Alaala ng mga Pangulo',
  'hero.title.line1': 'Mga Alaala ng',
  'hero.title.line2': 'mga Pangulo',
  'hero.alt': 'Koleksyon ng Kampus',
  'hero.powered': 'Pinapagana ng',
  'hero.lead':
    'Isang tahimik na archive ng mga medalya, larawan, at seremonyal na piraso mula sa bawat panunungkulan.',
  'flip.label': 'Tungkol sa Sulyap Lasalyano',
  'flip.label.warm': 'Bumalik sa tahanan',
  'flip.switch': 'Palitan ang view',
  'cta.explore': 'Tingnan ang koleksiyon',
  'cta.history': 'Tingnan ang kasaysayan',
  'cta.scan': 'I-scan ang mga bagay at matuto!',
  'cta.kg': 'Tingnan ang Knowledge Graph ->',
  'cta.hint': 'Nasa museo ka ba ngayon?',
  'ag.title': 'Tungkol',
  'ag.copy':
    'Ang Presidents’ Memorabilia ay isang koleksyon na nasa Aklatang Emilio Aguinaldo – Information Resource Center (AEA-IRC) ng De La Salle University-Dasmariñas. Pinangangalagaan nito ang mga artifact gaya ng mga commemorative trophy, plaque, at mga souvenir sa paglalakbay na sumasalamin sa mga pagpapahalagang Lasalyano at pamumuno ng mga dating pangulo ng unibersidad. Bilang historikal na ugnayan sa pagitan ng nakaraan at kinabukasan ng komunidad ng DLSU-D, sinusuportahan ng koleksyon ang identidad ng unibersidad bilang Heritage and Cultural Center.',
  'aea.title': 'Tungkol sa Aklatang Emilio Aguinaldo – Information Resource Center (AEA-IRC)',
  'aea.title.lead': 'Tungkol sa',
  'aea.title.rest': 'Aklatang Emilio Aguinaldo – Information Resource Center (AEA-IRC)',
  'aea.info': 'Tungkol sa Aklatang Emilio Aguinaldo – Information Resource Center (AEA-IRC)',
  'aea.info.btn': 'Info',
  'aea.info.close': 'Isara',
  'aea.info.hint': 'i-click dito',
  'aea.info.body':
    'Ang Aklatang Emilio Aguinaldo – Information Resource Center (AEA-IRC) ay replica ng Aguinaldo Shrine sa Kawit, tahanan ng unang Pangulo ng Pilipinas, Heneral Emilio Aguinaldo, at mas malaki ang facade nito kaysa sa shrine. Ideya ito ni Br. Andrew Gonzales at inagurasyon noong Abril 30, 1992. Ang gusali mismo ay bahagi ng pamana—angkop na tahanan para sa Presidents’ Memorabilia.',
  'aea.info.body2':
    'Nagsimula ito noong 1977 bilang classroom-sized library na may dalawang kawani, nang itatag ang General Emilio Aguinaldo College Dasmariñas Campus. Ang paglaki nito bilang landmark sa museo complex na inilaan bilang cultural zone ay sumasalamin sa identidad ng DLSU-D bilang Heritage and Cultural Center.',
  'scroll.more': 'Mag-scroll',
  'col.title': 'Mga bagay na nagdadala ng kuwento ng unibersidad',
  'col.p1':
    '[Paglalarawan ng koleksiyon: dalawa o tatlong pangungusap tungkol sa laman ng koleksiyon, sino ang pinararangalan, at paano nalikom ang mga piraso.]',
  'col.p2':
    'Silipin ang mga medalya, larawan, seremonyal na kagamitan, at dokumento mula sa bawat panunungkulan. May maikling tala ang bawat bagay kung saan ito galing at bakit ito iningatan.',
  'col.link': 'Tingnan ang museo',
  'bld.name': '[Pangalan ng gusali o tao]',
  'about.title': 'Tungkol sa developer',
  'about.body':
    '[Talambuhay ng developer: sino ang gumawa ng site, ano ang layunin ng proyekto, at paano makikipag-ugnayan.]',
  'about.photo': 'Larawan ng developer (placeholder)',
  'gal.title': 'Museo',
  'gal.intro': 'Apat na piraso mula sa koleksiyon. Pumili ng isa para makita nang mas malaki.',
  'foot.enjoy': 'Magsaya sa inyong pagbisita!',
  'foot.top': 'Bumalik sa itaas',
  'lb.close': 'Isara',
  'lb.prev': 'Naunang bagay',
  'lb.next': 'Susunod na bagay',
  'nx.kick': 'Susunod',
  'nx.gallery': 'Buksan ang museo',
  'nx.gallery.p': 'Apat na piraso mula sa koleksiyon: medalya, larawan, at seremonyal na bagay.',
  'nx.home': 'Bumalik sa tahanan',
  'nx.home.p': 'Bumalik sa kuwento ng koleksiyon at entablado ng kampus.',
  'nx.meta': 'Hash route · may deep link',
  'nx.edu.kicker': 'Ano ang',
  'nx.edu.cats.by': 'Ni',
  'nx.edu.intro.p1':
    'Ang Sulyap Lasalyano ay web-based augmented reality system na nagpapagalugad sa Presidents’ Memorabilia sa Aklatang Emilio Aguinaldo – Information Resource Center (AEA-IRC) ng De La Salle University-Dasmariñas.',
  'nx.edu.intro.p2':
    'Itutok ang camera sa artifact at kakilalanin ito, at lalabas ang kuwento sa screen. Walang i-download o i-install—buksan lang sa mobile browser.',
  'nx.edu.intro.why': 'Bakit ito ginawa?',
  'nx.edu.intro.p3':
    'Pinangangalagaan ng Presidents’ Memorabilia ang pamana at mga pagpapahalagang Lasalyano ng mga dating pangulo ng DLSU-D, pero limitado ang tradisyonal na display. Nahihirapan ang static display at printed label na hawakan ang atensyon ng henerasyong sanay sa digital at interactive na karanasan—kaya mababa ang bisita at unti-unting nawawala ang kamalayan sa sariling pamana ng unibersidad.',
  'nx.edu.intro.p4':
    'Ginawa ang Sulyap Lasalyano para punan ang puwang na iyon. Ginagawa nitong aktibo at immersive ang pagbisita sa gallery, tinutulungan ang mga estudyante, guro, kawani, at bisita na tuklasin at pahalagahan ang institutional heritage ng DLSU-D. Bilang suporta sa UN Sustainable Development Goal 11.4, ginagamit din nito ang teknolohiya upang protektahan at itaguyod ang cultural heritage.',
  'nx.edu.features': 'Mga pangunahing tampok',
  'nx.edu.scan.body':
    'Ang Live Scan ang puso ng sistema. Ginagamit nito ang camera ng telepono at custom-trained YOLOv8 object detection model, na sinanay sa mga larawan ng memorabilia, upang kilalanin ang mga artifact nang real time.',
  'nx.edu.scan.s1': 'Buksan ang Live Scan mula sa home page at payagan ang camera access.',
  'nx.edu.scan.s2': 'Itutok ang camera sa memorabilia sa loob ng gallery.',
  'nx.edu.scan.s3':
    'Kapag confident na ang sistema sa item, lalabas ang 3D model ng artifact sa screen.',
  'nx.edu.scan.s4':
    'Lalabas ang information sheet na may pangalan, taon, kaugnay na pangulo, at paglalarawan. Isara ito para mag-scan ng iba.',
  'nx.edu.scan.tip':
    'Kung hindi makilala ang item, subukan ang ibang anggulo o mas maliwanag na ilaw.',
  'nx.edu.scan.cta': 'Subukan',
  'nx.edu.kg.body':
    'Ipinapakita ng Knowledge Graph kung paano magkakaugnay ang koleksiyon. Sa halip na tingnan ang bawat artifact nang mag-isa, makikita mo ang ugnayan ng AEA-IRC, DLSU-D, mga pangulo, mga taon, at mga artifact. Bilog ang bawat isa; linya ang ugnayan.',
  'nx.edu.kg.how':
    'Buksan ang View Knowledge Graph mula sa home page, i-drag para mag-pan, at gamitin ang plus at minus para mag-zoom. Makikita mo ang mas malaking kuwento—alin ang memorabilia ng aling pangulo at panahon.',
  'nx.edu.kg.cta': 'Tingnan',
  'nx.edu.also.title': 'Mayroon ding',
  'nx.edu.also.browse.label': 'Browse:',
  'nx.edu.also.browse':
    'Ayaw gumamit ng camera? Pumili ng pangulo ng DLSU-D, tingnan ang memorabilia, at buksan ang artifact para sa rotatable, zoomable 3D model na may detalye.',
  'nx.edu.also.lang.label': 'Multilingual support:',
  'nx.edu.also.lang':
    'Basahin ang content sa English, Filipino, Spanish, French, Chinese, Korean, o Japanese.',
  'nx.edu.credit':
    'Ang Sulyap Lasalyano ay thesis project nina Lagajino, Ricafrente, at Capistrano, Bachelor of Science in Computer Science, Specializing in Intelligent Systems, sa ilalim ni Tita R. Herradura.',
  'nx.edu.inspire': 'Inspirasyon sa frontend mula kay',
  'skip.next': 'Susunod na seksyon',
  'menu.title': 'Mag-navigate',
  'toast.lang': 'Wika',
  'toast.lang.detail': 'Lumipat sa Filipino',
  'toast.offline': 'Walang koneksyon',
  'toast.offline.detail': 'Maaaring hindi gumana ang ilang link hanggang makabalik ang koneksyon.',
  'toast.online': 'May koneksyon na',
  'toast.online.detail': 'Nabawi ang koneksyon.',
  'img.fail': 'Hindi available ang larawan',
  nojs: 'Naka-off ang JavaScript. Mabubasa pa rin ang pahina sa mga link sa ibaba.',
  'pre.name': 'Mga Alaala ng mga Pangulo',
  'pre.loading': 'Naglo-load…',
  'pre.ready': 'Handa',
  '404.title': 'Hindi nahanap ang route',
  '404.body': 'Hindi bahagi ng koleksiyon ang path na ito. Bumalik sa tahanan.',
  '404.home': 'Bumalik sa tahanan',
  'guide.subtitle': 'Pat · gabay sa site',
  'guide.close': 'Isara ang gabay',
  'guide.fab.open': 'Buksan si Pat · gabay sa site',
  'guide.fab.close': 'Isara si Pat · gabay sa site',
  'guide.welcome':
    'Kumusta — ako si Pat! Masaya akong tumulong sa’yo maglibot sa koleksiyong ito. Ano ang gusto mong malaman?',
  'guide.placeholder': 'Magtanong tungkol sa koleksiyon…',
  'guide.input.label': 'Magtanong kay Pat',
  'guide.send': 'Ipadala ang mensahe',
  'guide.chip.importance': 'Bakit mahalaga ang mga bagay na ito?',
  'guide.chip.visit': 'Sino ang maaaring bumisita sa museo?',
  'guide.chip.maintain': 'Sino ang nangangalaga at nagpapanatili ng koleksiyon?',
  'guide.reply.limited':
    'Hmmm.. Baka makasagot ako sa input mo sa lalong madaling panahon. Sa ngayon, wala akong masyadong masasabi diyan. Pero huwag mag-alala! Matuto pa sa pamamagitan ng mas malalim na pag-browse sa website at pag-scan ng mas maraming artifact. Magsaya sa paggalugad! 💚',
  'guide.reply.soon':
    'Hmmm.. Baka makasagot ako sa input mo sa lalong madaling panahon. Sa ngayon, wala akong masyadong masasabi diyan. Pero huwag mag-alala! Matuto pa sa pamamagitan ng mas malalim na pag-browse sa website at pag-scan ng mas maraming artifact. Magsaya sa paggalugad! 💚',
  'guide.reply.hello':
    'Kumusta! Ako si Pat Riotik, kaibigang gabay mo sa site. Magtanong tungkol sa Presidents’ Memorabilia, AEA-IRC, Live Scan, Knowledge Graph, o kung ano ang nasa home page—masayang sasagutin ko ang alam ko. 💚',
  'guide.reply.ack': 'Sige! Nandito lang ako kung may kailangan ka tungkol sa koleksiyon. 💚',
  'guide.reply.thanks': 'Walang anuman! Enjoy ang pag-explore. 💚',
  'guide.reply.bye': 'Ingat — magsaya sa paggalugad! 💚',
  'guide.reply.importance':
    'Masaya kong ibahagi — pinangangalagaan ng Presidents’ Memorabilia ang mga artifact gaya ng commemorative trophy, plaque, at travel souvenir na sumasalamin sa mga pagpapahalagang Lasalyano at pamumuno ng mga dating pangulo ng DLSU-D. Bilang historikal na ugnayan ng nakaraan at kinabukasan, sinusuportahan nito ang identidad ng unibersidad bilang Heritage and Cultural Center.',
  'guide.reply.visit':
    'Malugod kayong inaanyayahan — tinutulungan ng Sulyap Lasalyano ang mga estudyante, guro, kawani, at bisita na tuklasin ang pamana ng DLSU-D—sa Presidents’ Memorabilia sa AEA-IRC, o sa digital na karanasan sa mobile browser.',
  'guide.reply.maintain':
    'Eto ang kuwento — nasa Aklatang Emilio Aguinaldo – Information Resource Center (AEA-IRC) ng De La Salle University-Dasmariñas ang koleksiyon—angkop na tahanan para sa Presidents’ Memorabilia bilang bahagi ng identidad ng DLSU-D bilang Heritage and Cultural Center.',
  'guide.reply.what':
    'Magandang tanong! Ang Sulyap Lasalyano ay web-based augmented reality system para sa Presidents’ Memorabilia sa AEA-IRC, DLSU-D. Itutok ang camera sa artifact para makilala ito at makita ang kuwento—walang i-download; buksan lang sa mobile browser.',
  'guide.reply.why':
    'Ito ang dahilan — kulang ang tradisyonal na display para sa bagong henerasyon at mababa ang bisita. Ginawa ang Sulyap Lasalyano para gawing aktibo ang pagbisita, at sumusuporta ito sa UN Sustainable Development Goal 11.4 sa pagprotekta at pagpapalaganap ng cultural heritage.',
  'guide.reply.scan':
    'Masaya ’to! Gumagamit ang Live Scan ng camera at custom-trained YOLOv8 para kilalanin ang memorabilia nang real time. Payagan ang camera, itutok sa item, tapos lalabas ang 3D model at info sheet. Subukan ang ibang anggulo o mas maliwanag na ilaw kung hindi makilala.',
  'guide.reply.kg':
    'Paborito ko ’to — ipinapakita ng Knowledge Graph kung paano magkakaugnay ang AEA-IRC, DLSU-D, mga pangulo, taon, at artifacts. Buksan mula sa home page, i-drag para mag-pan, at gamitin ang +/− para mag-zoom.',
  'guide.reply.browse':
    'Ayaw ng camera? Walang problema — mag-browse ayon sa pangulo ng DLSU-D, buksan ang memorabilia, at tingnan ang rotatable, zoomable 3D model na may detalye.',
  'guide.reply.lang':
    'Oo! Mababasa ang content sa English, Filipino, Spanish, French, Chinese, Korean, o Japanese.',
  'guide.reply.aeairc':
    'Magandang tanong — replica ng Aguinaldo Shrine sa Kawit ang AEA-IRC—mas malaking facade. Ideya ito ni Br. Andrew Gonzales at inagurasyon noong Abril 30, 1992. Nagsimula ito noong 1977 bilang classroom-sized library nang itatag ang campus.',
  'guide.reply.team':
    'Ipinagmamalaki ko — thesis project nina Lagajino, Ricafrente, at Capistrano (BS Computer Science, Specializing in Intelligent Systems), sa ilalim ni Tita R. Herradura.',
  'guide.reply.presidents':
    'Makikilala mo sila sa home page — sina Br. Inigo, Br. Andrew, Br. Armin, Br. Donato, Br. Gus, Br. Mawel, Br. Rolly, Br. Sockie, at Dr. Quebengco. Mag-browse ng kanilang memorabilia mula sa marquee!',
  'scan.point': 'Itutok sa memorabilia — i-tap ang outline para sa detalye',
  'scan.tapOutline': 'I-tap para makita',
  'scan.detectedLabel': '{code} DETECTED!',
  'scan.itemsFound': 'item na nahanap',
  'scan.loadingModel': 'Naglo-load ang modelo…',
  'scan.loadingScanner': 'Nilo-load ang live scanner',
  'scan.loadingCatalog': 'Kinukuha mula sa katalogo…',
  'scan.scanning': 'nagsa-scan…',
  'scan.tipPrefix': 'Tip:',
  'scan.tip1': 'Hawakan nang steady — lalabas ang outline kapag confident na ang lock. I-tap para sa detalye.',
  'scan.tip2': 'Mag-pinch gamit ang dalawang daliri para mag-zoom.',
  'scan.tip3': 'Siguraduhing maliwanag para mas magandang detection.',
  'scan.tip4': 'I-tap ang X para bumalik sa camera at mag-scan ng iba.',
  'scan.needAccess': 'Kailangan ang access sa camera',
  'scan.unavailable': 'Hindi available ang camera',
  'scan.enableTitle': 'Paganahin ang camera para mag-scan',
  'scan.enableHint': 'I-tap ang “Enable Camera” para payagan ang browser na gamitin ang camera para sa Live Scan.',
  'scan.enableBtn': 'Paganahin ang Camera',
  'scan.retryBtn': 'Subukan Muli ang Camera',
  'scan.unsupported': 'Hindi suportado ang camera sa browser na ito.',
  'scan.denied': 'Payagan ang camera access para mag-scan ng artifacts.',
  'scan.notFound': 'Walang nakitang camera sa device na ito.',
  'scan.inUse': 'Maaaring ginagamit ang camera ng ibang tab. Isara ang iba at subukan ulit.',
  'scan.failed': 'Hindi nagawa ang camera access. Subukan ulit.',
  'scan.historical': 'Kontekstong Pangkasaysayan',
  'scan.tapMore': 'I-tap para matuto pa',
  'scan.unknownItem': 'Hindi kilalang item',
  'scan.noCatalog': 'Walang catalog record para sa detection na ito.',
  'scan.noCatalogFor': 'Walang nai-publish na catalog record para sa {code}.',
  'scan.loadingCatalogDetails': 'Nilo-load ang detalye ng catalog…',
  'scan.modelFailed': 'Hindi ma-load ang recognition model. Tingnan ang koneksyon at i-reload.',
  'scan.backHome': 'Bumalik sa tahanan',
  'scan.darkMode': 'I-toggle ang dark mode',
  'scan.exit': 'Bumalik sa live scan',
  'scan.expandDetails': 'Ipakita ang detalye',
  'scan.collapseDetails': 'Itago ang detalye',
  'scan.viewer': '3D view ng artifact. I-drag para umikot, i-pinch para mag-zoom.',
  'scan.lightMode': 'Lumipat sa light mode',
  'scan.darkModeOn': 'Lumipat sa dark mode',
  'kg.title': 'Knowledge Graph',
  'kg.back': '← Bumalik',
  'kg.backLabel': 'Bumalik',
  'kg.status': 'I-drag para umikot · i-pinch para mag-zoom',
  'kg.loading': 'Nilo-load ang knowledge graph',
  'kg.error': 'Hindi ma-load ang knowledge graph.',
  'kg.zoomIn': 'Palakihin',
  'kg.zoomOut': 'Paliitin',
  'kg.fit': 'Sakupin lahat',
  'kg.layout': 'Ayos',
  'kg.layoutWeb': 'Web',
  'kg.layoutTimeline': 'Timeline',
  'kg.legend': 'Palatandaan',
  'kg.legendPresident': 'Pangulo',
  'kg.legendArtifact': 'Artifact',
  'kg.legendCategory': 'Kategorya',
  'kg.legendEra': 'Panahon',
  'kg.legendEventPlace': 'Pangyayari / Lugar',
  'kg.themeLight': 'Lumipat sa light mode',
  'kg.themeDark': 'Lumipat sa dark mode',
  'kg.aria': 'Knowledge graph. I-drag para umikot, i-pinch o gamitin ang mga pindutan para mag-zoom, dalawang daliri para mag-pan, at i-tap ang isang node para pumili.',
  'kg.zoomControls': 'Mga kontrol sa zoom',
  'kg.legendToggle': 'Ipakita o itago ang palatandaan',
  'pres.back': '← Bumalik',
  'pres.backLabel': 'Bumalik',
  'pres.realName': 'Tunay na pangalan',
  'pres.nickname': 'Palayaw',
  'pres.realNamePh': '[Kuhang legal na pangalan — kukumpirmahin pa]',
  'pres.nicknamePh': '[Palayaw — kukumpirmahin pa]',
  'pres.history': 'Kasaysayan / bibliograpiya',
  'pres.historyBody':
    'May maikling talambuhay at bibliograpiya dito. [Placeholder habang inihahanda ang pananaliksik ng curator.]',
  'pres.memories': 'Mga larawan at alaala',
  'pres.carouselPrev': 'Nakaraang larawan',
  'pres.carouselNext': 'Susunod na larawan',
  'pres.slidePh': 'Nakalaan para sa larawan',
  'pres.missing': 'Hindi nahanap ang pangulo.',
  'pres.missingHint': 'Bumalik sa tahanan para mag-browse ng koleksiyon.',
  items: [
    { t: 'Medalyon ng inagurasyon', d: '[Taon]. Isinuot sa seremonya ng inagurasyon. [Maikling tala tungkol sa piraso.]' },
    { t: 'Opisyal na larawan', d: '[Taon]. Nakasabit sa bulwagan ng pangulo. [Maikling tala tungkol sa piraso.]' },
    { t: 'Seremonyal na maso', d: '[Taon]. Ginamit sa pagbubukas ng unang pagpupulong. [Maikling tala tungkol sa piraso.]' },
    { t: 'Nilagdaang charter', d: '[Taon]. Nilagdaan at tinatakan sa araw ng pagtatalaga. [Maikling tala tungkol sa piraso.]' },
  ],
});

/* Remaining locales: full marketing + Pat + scan overrides; proper names kept. */
const es = locale({
  skip: 'Saltar al contenido',
  'nav.home': 'Inicio',
  'nav.history': 'Historia',
  'nav.menu': 'Menú',
  'nav.close': 'Cerrar menú',
  lang: 'Idioma',
  'hero.title': 'Memorabilia de los presidentes',
  'hero.title.line1': 'Memorabilia de',
  'hero.title.line2': 'los presidentes',
  'hero.alt': 'Colección del campus',
  'hero.powered': 'Impulsado por',
  'hero.lead':
    'Un archivo sereno de medallas, retratos y piezas ceremoniales de cada presidencia.',
  'flip.label': 'Acerca de Sulyap Lasalyano',
  'flip.label.warm': 'Volver al inicio',
  'flip.switch': 'Cambiar vista',
  'cta.explore': 'Explorar la colección',
  'cta.history': 'Ver historia',
  'cta.scan': '¡Escanea artefactos ahora!',
  'cta.kg': 'Ver Knowledge Graph ->',
  'cta.hint': '¿Estás en el museo?',
  'ag.title': 'Acerca de',
  'ag.copy':
    'La Presidents’ Memorabilia es una colección alojada en el Aklatang Emilio Aguinaldo – Information Resource Center (AEA-IRC) de De La Salle University-Dasmariñas. Preserva artefactos como trofeos conmemorativos, placas y souvenirs de viaje que encarnan los valores lasalianos y el liderazgo de los expresidentes de la universidad. Como vínculo histórico entre el pasado y el futuro de la comunidad de DLSU-D, la colección sostiene la identidad de la universidad como Heritage and Cultural Center.',
  'aea.title.lead': 'Acerca de',
  'aea.info.btn': 'Info',
  'aea.info.close': 'Cerrar',
  'aea.info.hint': 'haz clic aquí',
  'aea.info.body':
    'El Aklatang Emilio Aguinaldo – Information Resource Center (AEA-IRC) es una réplica del Aguinaldo Shrine en Kawit, hogar del primer presidente de Filipinas, el general Emilio Aguinaldo, y su fachada es una versión más grande del santuario. El edificio fue idea de Br. Andrew Gonzales y se inauguró el 30 de abril de 1992. La estructura misma es patrimonio, un hogar adecuado para la Presidents’ Memorabilia.',
  'aea.info.body2':
    'Comenzó en 1977 como una biblioteca del tamaño de un aula con dos empleados, cuando se estableció el General Emilio Aguinaldo College Dasmariñas Campus. Su crecimiento como hito de un complejo museístico pensado como zona cultural refleja la identidad de DLSU-D como Heritage and Cultural Center.',
  'gal.title': 'Museo',
  'gal.intro': 'Cuatro piezas de la colección. Elige una para verla más grande.',
  'foot.enjoy': '¡Disfruta tu visita!',
  'foot.top': 'Volver arriba',
  'lb.close': 'Cerrar',
  'lb.prev': 'Anterior',
  'lb.next': 'Siguiente',
  'nx.kick': 'Qué sigue',
  'nx.gallery': 'Abrir el museo',
  'nx.gallery.p': 'Cuatro piezas de la colección: medallas, retratos y objetos ceremoniales.',
  'nx.home': 'Volver al inicio',
  'nx.home.p': 'De vuelta a la historia de la colección y el escenario del campus.',
  'nx.edu.kicker': 'Qué es',
  'nx.edu.cats.by': 'Por',
  'nx.edu.intro.p1':
    'Sulyap Lasalyano es un sistema de realidad aumentada basado en la web que te permite explorar la Presidents’ Memorabilia en el Aklatang Emilio Aguinaldo – Information Resource Center (AEA-IRC) de De La Salle University-Dasmariñas.',
  'nx.edu.intro.p2':
    'Apunta la cámara a un artefacto y el sistema lo identifica y muestra su historia en pantalla. No hay nada que descargar ni instalar. Solo ábrelo en el navegador móvil.',
  'nx.edu.intro.why': '¿Por qué se creó?',
  'nx.edu.intro.p3':
    'La Presidents’ Memorabilia preserva el legado y los valores lasalianos de los expresidentes de DLSU-D, pero las vitrinas tradicionales solo pueden mostrar tanto. Las pantallas estáticas y las etiquetas impresas luchan por retener la atención de una generación criada en lo digital e interactivo, lo que ha llevado a baja visitación y a una conciencia cada vez menor del propio patrimonio universitario.',
  'nx.edu.intro.p4':
    'Sulyap Lasalyano se creó para cerrar esa brecha. Convierte una visita pasiva a la galería en una experiencia de aprendizaje activa e inmersiva, ayudando a estudiantes, docentes, personal y visitantes a descubrir, comprender y apreciar el patrimonio institucional de DLSU-D. En apoyo del UN Sustainable Development Goal 11.4, también usa la tecnología para proteger y promover el patrimonio cultural.',
  'nx.edu.features': 'Funciones principales',
  'nx.edu.scan.body':
    'Live Scan es el corazón del sistema. Usa la cámara del teléfono y un modelo YOLOv8 de detección de objetos entrenado a medida con imágenes de la memorabilia para reconocer artefactos en tiempo real.',
  'nx.edu.scan.s1': 'Abre Live Scan desde la página de inicio y permite el acceso a la cámara.',
  'nx.edu.scan.s2': 'Apunta la cámara a una pieza de memorabilia dentro de la galería.',
  'nx.edu.scan.s3':
    'Cuando el sistema confía en el ítem, aparece un modelo 3D del artefacto en pantalla.',
  'nx.edu.scan.s4':
    'Una ficha de información se desliza mostrando el nombre, el año, el presidente asociado y la descripción. Ciérrala para escanear otro.',
  'nx.edu.scan.tip':
    'Si un ítem no se reconoce, prueba otro ángulo o mejor iluminación.',
  'nx.edu.scan.cta': 'Probar',
  'nx.edu.kg.body':
    'El Knowledge Graph muestra cómo encaja la colección. En lugar de ver cada artefacto aislado, puedes ver las conexiones entre AEA-IRC, DLSU-D, los presidentes, los años y los artefactos. Los círculos representan cada uno; las líneas, las relaciones.',
  'nx.edu.kg.how':
    'Ábrelo con View Knowledge Graph desde la página de inicio, arrastra para desplazarte y usa más/menos para hacer zoom. Ayuda a ver la historia mayor detrás de cada pieza.',
  'nx.edu.kg.cta': 'Ver',
  'nx.edu.also.title': 'También en el sistema',
  'nx.edu.also.browse.label': 'Browse:',
  'nx.edu.also.browse':
    '¿Prefieres no usar la cámara? Elige un presidente de DLSU-D, mira su memorabilia y abre cualquier artefacto para ver un modelo 3D giratorio y con zoom, con sus detalles.',
  'nx.edu.also.lang.label': 'Soporte multilingüe:',
  'nx.edu.also.lang':
    'Lee el contenido en English, Filipino, Spanish, French, Chinese, Korean o Japanese.',
  'nx.edu.credit':
    'Sulyap Lasalyano es un proyecto de tesis de Lagajino, Ricafrente y Capistrano, Bachelor of Science in Computer Science, Specializing in Intelligent Systems, bajo la dirección de Tita R. Herradura.',
  'nx.edu.inspire': 'Frontend inspirado por',
  'skip.next': 'Siguiente sección',
  'menu.title': 'Navegar',
  'toast.lang': 'Idioma',
  'toast.lang.detail': 'Cambiado a español',
  'toast.offline': 'Sin conexión',
  'toast.offline.detail': 'Algunos enlaces pueden no funcionar hasta que te reconectes.',
  'toast.online': 'De nuevo en línea',
  'toast.online.detail': 'Conexión restaurada.',
  'img.fail': 'Imagen no disponible',
  nojs: 'JavaScript está desactivado. Aún puedes leer las páginas con los enlaces de abajo.',
  'pre.name': 'Memorabilia de los presidentes',
  'pre.loading': 'Cargando…',
  'pre.ready': 'Listo',
  '404.title': 'Ruta no encontrada',
  '404.body': 'Esta ruta no forma parte de la colección. Vuelve al inicio.',
  '404.home': 'Volver al inicio',
  'guide.subtitle': 'Pat · guía del sitio',
  'guide.close': 'Cerrar guía',
  'guide.fab.open': 'Abrir Pat · guía del sitio',
  'guide.fab.close': 'Cerrar Pat · guía del sitio',
  'guide.welcome':
    '¡Hola — soy Pat! Encantado de ayudarte a explorar esta colección. ¿Qué te interesa?',
  'guide.placeholder': 'Pregunta sobre la colección…',
  'guide.input.label': 'Preguntar a Pat',
  'guide.send': 'Enviar mensaje',
  'guide.chip.importance': '¿Por qué son importantes estos objetos?',
  'guide.chip.visit': '¿Quién puede visitar el museo?',
  'guide.chip.maintain': '¿Quién cuida y mantiene la colección?',
  'guide.reply.limited':
    'Hmmm.. Pronto podré responder mejor a tu mensaje. Por ahora no tengo mucho que decir sobre eso. ¡Pero no te preocupes! Puedes aprender más explorando el sitio y escaneando más artefactos. ¡Disfruta explorando! 💚',
  'guide.reply.soon':
    'Hmmm.. Pronto podré responder mejor a tu mensaje. Por ahora no tengo mucho que decir sobre eso. ¡Pero no te preocupes! Puedes aprender más explorando el sitio y escaneando más artefactos. ¡Disfruta explorando! 💚',
  'guide.reply.hello':
    '¡Hola! Soy Pat Riotik, tu guía amigable del sitio. Pregúntame sobre la Presidents’ Memorabilia, AEA-IRC, Live Scan, el Knowledge Graph o lo que hay en esta página de inicio—con gusto comparto lo que sé. 💚',
  'guide.reply.ack': '¡De acuerdo! Aquí estoy si necesitas algo sobre la colección. 💚',
  'guide.reply.thanks': '¡De nada! Disfruta explorando. 💚',
  'guide.reply.bye': '¡Hasta luego — diviértete explorando! 💚',
  'guide.reply.importance':
    'Con gusto — la Presidents’ Memorabilia preserva artefactos como trofeos conmemorativos, placas y souvenirs de viaje que encarnan los valores lasalianos y el liderazgo de los expresidentes de DLSU-D. Como vínculo histórico entre el pasado y el futuro de la comunidad, sostiene la identidad de la universidad como Heritage and Cultural Center.',
  'guide.reply.visit':
    'Siempre bienvenidos — Sulyap Lasalyano ayuda a estudiantes, docentes, personal y visitantes a descubrir y apreciar el patrimonio institucional de DLSU-D—en la Presidents’ Memorabilia en AEA-IRC, o con esta experiencia digital en el navegador móvil.',
  'guide.reply.maintain':
    'Te cuento — la colección está en el Aklatang Emilio Aguinaldo – Information Resource Center (AEA-IRC) de De La Salle University-Dasmariñas, un hogar adecuado para la Presidents’ Memorabilia como parte de la identidad de DLSU-D como Heritage and Cultural Center.',
  'guide.reply.what':
    '¡Buena pregunta! Sulyap Lasalyano es un sistema de realidad aumentada basado en la web para la Presidents’ Memorabilia en AEA-IRC, DLSU-D. Apunta la cámara a un artefacto y verás su historia—nada que descargar; solo ábrelo en el navegador móvil.',
  'guide.reply.why':
    'Por esto importa — las vitrinas tradicionales no retienen la atención y la visitación ha sido baja. Sulyap Lasalyano convierte una visita pasiva en aprendizaje activo, y apoya el UN Sustainable Development Goal 11.4 usando tecnología para proteger y promover el patrimonio cultural.',
  'guide.reply.scan':
    '¡Divertido! Live Scan usa la cámara del teléfono y un modelo YOLOv8 entrenado a medida para reconocer memorabilia en tiempo real. Permite la cámara, apunta a un ítem, y aparecen un modelo 3D y una ficha. Prueba otro ángulo o mejor iluminación si no se reconoce.',
  'guide.reply.kg':
    'Me encanta esta parte — el Knowledge Graph muestra cómo encaja la colección—vínculos entre AEA-IRC, DLSU-D, presidentes, años y artefactos. Ábrelo desde el inicio, arrastra para moverte y usa +/− para zoom.',
  'guide.reply.browse':
    '¿Sin cámara? Sin problema — explora por presidente de DLSU-D, abre memorabilia y mira un modelo 3D giratorio y con zoom, con detalles.',
  'guide.reply.lang':
    '¡Sí! Puedes leer el contenido en English, Filipino, Spanish, French, Chinese, Korean o Japanese.',
  'guide.reply.aeairc':
    'Buena pregunta — AEA-IRC es una réplica del Aguinaldo Shrine en Kawit—una fachada más grande. Fue idea de Br. Andrew Gonzales y se inauguró el 30 de abril de 1992. Comenzó en 1977 como biblioteca del tamaño de un aula cuando se estableció el campus.',
  'guide.reply.team':
    'Con orgullo — Sulyap Lasalyano es un proyecto de tesis de Lagajino, Ricafrente y Capistrano (BS Computer Science, Specializing in Intelligent Systems), bajo la dirección de Tita R. Herradura.',
  'guide.reply.presidents':
    'Los conocerás en la página de inicio — expresidentes de la historia de la colección, incluidos Br. Inigo, Br. Andrew, Br. Armin, Br. Donato, Br. Gus, Br. Mawel, Br. Rolly, Br. Sockie y Dr. Quebengco. ¡Explora su memorabilia en el marquee!',
  'scan.point': 'Apunta a la memorabilia — toca un contorno para ver detalles',
  'scan.tapOutline': 'Tocar para ver',
  'scan.detectedLabel': '{code} DETECTED!',
  'scan.itemsFound': 'elementos encontrados',
  'scan.loadingModel': 'Cargando modelo…',
  'scan.loadingScanner': 'Cargando el live scanner',
  'scan.loadingCatalog': 'Cargando del catálogo…',
  'scan.scanning': 'escaneando…',
  'scan.tipPrefix': 'Consejo:',
  'scan.tip1': 'Mantén firme — el contorno aparece solo con un bloqueo confiable. Tócalo para detalles.',
  'scan.tip2': 'Pellizca con dos dedos para hacer zoom.',
  'scan.tip3': 'Asegura buena iluminación para mejor detección.',
  'scan.tip4': 'Toca X para volver a la cámara y escanear otro ítem.',
  'scan.needAccess': 'Se necesita acceso a la cámara',
  'scan.unavailable': 'Cámara no disponible',
  'scan.enableTitle': 'Activa la cámara para escanear',
  'scan.enableHint': 'Toca “Enable Camera” para permitir el acceso a la cámara en Live Scan.',
  'scan.enableBtn': 'Activar cámara',
  'scan.retryBtn': 'Reintentar cámara',
  'scan.unsupported': 'La cámara no es compatible con este navegador.',
  'scan.denied': 'Permite el acceso a la cámara para escanear artefactos.',
  'scan.notFound': 'No se encontró ninguna cámara en este dispositivo.',
  'scan.inUse': 'La cámara puede estar en uso en otra pestaña. Ciérralas e inténtalo de nuevo.',
  'scan.failed': 'Falló el acceso a la cámara. Inténtalo de nuevo.',
  'scan.historical': 'Contexto histórico',
  'scan.tapMore': 'Toca para saber más',
  'scan.unknownItem': 'Objeto desconocido',
  'scan.noCatalog': 'No hay registro de catálogo para esta detección.',
  'scan.noCatalogFor': 'No hay registro publicado para {code}.',
  'scan.loadingCatalogDetails': 'Cargando detalles del catálogo…',
  'scan.modelFailed': 'No se pudo cargar el modelo de reconocimiento. Revisa la conexión y recarga.',
  'scan.backHome': 'Volver al inicio',
  'scan.darkMode': 'Alternar modo oscuro',
  'scan.exit': 'Volver al escaneo en vivo',
  'scan.expandDetails': 'Mostrar detalles',
  'scan.collapseDetails': 'Ocultar detalles',
  'scan.viewer': 'Vista 3D del artefacto. Arrastra para girar, pellizca para zoom.',
  'scan.lightMode': 'Cambiar a modo claro',
  'scan.darkModeOn': 'Cambiar a modo oscuro',
  'kg.title': 'Knowledge Graph',
  'kg.back': '← Atrás',
  'kg.backLabel': 'Volver',
  'kg.status': 'Arrastra para orbitar · pellizca para zoom',
  'kg.loading': 'Cargando el knowledge graph',
  'kg.error': 'No se pudo cargar el grafo de conocimiento.',
  'kg.zoomIn': 'Acercar',
  'kg.zoomOut': 'Alejar',
  'kg.fit': 'Encajar todo',
  'kg.layout': 'Disposición',
  'kg.layoutWeb': 'Web',
  'kg.layoutTimeline': 'Línea de tiempo',
  'kg.legend': 'Leyenda',
  'kg.legendPresident': 'Presidente',
  'kg.legendArtifact': 'Pieza',
  'kg.legendCategory': 'Categoría',
  'kg.legendEra': 'Época',
  'kg.legendEventPlace': 'Evento / Lugar',
  'kg.themeLight': 'Cambiar a modo claro',
  'kg.themeDark': 'Cambiar a modo oscuro',
  'kg.aria': 'Grafo de conocimiento. Arrastra para orbitar, pellizca o usa los botones para zoom, desliza con dos dedos para desplazar, toca un nodo para seleccionar.',
  'kg.zoomControls': 'Controles de zoom',
  'kg.legendToggle': 'Mostrar u ocultar la leyenda',
  'pres.back': '← Atrás',
  'pres.backLabel': 'Volver',
  'pres.realName': 'Nombre real',
  'pres.nickname': 'Apodo',
  'pres.realNamePh': '[Nombre legal por confirmar]',
  'pres.nicknamePh': '[Apodo por confirmar]',
  'pres.history': 'Historia / bibliografía',
  'pres.historyBody':
    'Aquí aparecerá una breve biografía y bibliografía. [Marcador de posición pendiente de investigación curatorial.]',
  'pres.memories': 'Fotos y recuerdos',
  'pres.carouselPrev': 'Foto anterior',
  'pres.carouselNext': 'Foto siguiente',
  'pres.slidePh': 'Espacio reservado para foto',
  'pres.missing': 'Presidente no encontrado.',
  'pres.missingHint': 'Vuelve al inicio para explorar la colección.',
  items: [
    { t: 'Medallón inaugural', d: '[Año]. Usado en la ceremonia de investidura. [Nota breve sobre esta pieza.]' },
    { t: 'Retrato oficial', d: '[Año]. Colgado en el salón del presidente. [Nota breve sobre esta pieza.]' },
    { t: 'Mazo ceremonial', d: '[Año]. Usado para abrir la primera asamblea. [Nota breve sobre esta pieza.]' },
    { t: 'Carta firmada', d: '[Año]. Firmada y sellada el día del nombramiento. [Nota breve sobre esta pieza.]' },
  ],
});

const { fr, zh, ko, ja } = buildRest(locale);

const T = { en, fil, es, fr, zh, ko, ja };

function emitDict(obj, indent) {
  const pad = ' '.repeat(indent);
  const pad2 = ' '.repeat(indent + 2);
  const keys = Object.keys(obj).filter((k) => k !== 'items');
  const lines = ['{'];
  for (const k of keys) {
    lines.push(`${pad2}${JSON.stringify(k)}:${JSON.stringify(obj[k])},`);
  }
  if (obj.items) {
    lines.push(`${pad2}items:[`);
    for (const it of obj.items) {
      lines.push(`${pad2}  {t:${JSON.stringify(it.t)},d:${JSON.stringify(it.d)}},`);
    }
    lines.push(`${pad2}]`);
  }
  lines.push(`${pad}}`);
  return lines.join('\n');
}

const runtime = `  var LANGS = ["en","fil","es","fr","zh","ko","ja"];
  var LANG_META = {
    en:{abbr:"EN", label:"English", toast:"Switched to English", html:"en"},
    fil:{abbr:"FIL", label:"Filipino", toast:"Lumipat sa Filipino", html:"fil"},
    es:{abbr:"ES", label:"Spanish", toast:"Cambiado a español", html:"es"},
    fr:{abbr:"FR", label:"French", toast:"Passé en français", html:"fr"},
    zh:{abbr:"ZH", label:"Chinese", toast:"已切换为中文", html:"zh-Hans"},
    ko:{abbr:"KO", label:"Korean", toast:"한국어로 전환됨", html:"ko"},
    ja:{abbr:"JA", label:"Japanese", toast:"日本語に切り替えました", html:"ja"}
  };

  var lang = "en";

  function dict(){ return window.T[lang] || window.T.en; }
  function lookup(key){
    var D = dict();
    if(D && D[key] !== undefined) return D[key];
    if(window.T.en && window.T.en[key] !== undefined) return window.T.en[key];
    return undefined;
  }

  function esc(s){
    return String(s).replace(/[&<>]/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c];
    });
  }
  function fmt(s){
    return esc(s).replace(/\\[([^\\]]+)\\]/g, '<span class="ph">[$1]</span>');
  }

  function flipLabel(){
    var warm = document.documentElement.classList.contains('warm');
    var key = warm ? 'flip.label.warm' : 'flip.label';
    var el = document.querySelector('#flip [data-i="flip.label"]');
    var v = lookup(key);
    if(el && v !== undefined) el.textContent = v;
  }

  function syncLangUI(){
    var meta = LANG_META[lang] || LANG_META.en;
    document.querySelectorAll('[data-lang-dd]').forEach(function(dd){
      var btn = dd.querySelector('.lang-dd-btn');
      var val = dd.querySelector('.lang-dd-val');
      if(val) val.textContent = meta.abbr;
      var id = btn && btn.getAttribute('aria-controls');
      var menu = (id && document.getElementById(id)) || dd.querySelector('.lang-dd-menu');
      if(menu){
        menu.querySelectorAll('[role="option"]').forEach(function(opt){
          var on = opt.getAttribute('data-value') === lang;
          opt.setAttribute('aria-selected', on ? 'true' : 'false');
        });
      }
    });
  }

  function applyLang(l, quiet){
    lang = LANGS.indexOf(l) >= 0 ? l : "en";
    store.set("pm-lang", lang);
    document.documentElement.lang = (LANG_META[lang] && LANG_META[lang].html) || lang;
    document.documentElement.setAttribute("data-lang", lang);
    document.querySelectorAll('[data-i]').forEach(function(el){
      if(el.dataset.i === 'flip.label') return;
      var v = lookup(el.dataset.i);
      if(v !== undefined) el.innerHTML = fmt(v);
    });
    document.querySelectorAll('[data-i-label]').forEach(function(el){
      var v = lookup(el.dataset.iLabel);
      if(v) el.setAttribute('aria-label', v);
    });
    flipLabel();
    syncLangUI();
    document.querySelectorAll('[data-fail]').forEach(function(el){
      el.setAttribute('data-fail', lookup('img.fail') || 'Image unavailable');
    });
    document.dispatchEvent(new CustomEvent('langchange', {detail:{lang:lang}}));
    if(!quiet && window.toast){
      window.toast('ok', lookup('toast.lang') || 'Language', lookup('toast.lang.detail') || (LANG_META[lang] && LANG_META[lang].toast) || lang);
    }
  }

  function reduceMotion(){
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function closeAllLang(immediate){
    langOpen = false;
    document.querySelectorAll('[data-lang-dd]').forEach(function(dd){
      var btn = dd.querySelector('.lang-dd-btn');
      if(btn) btn.setAttribute('aria-expanded', 'false');
    });
    document.querySelectorAll('.lang-dd-menu').forEach(function(menu){
      if(menu.hidden){
        menu.classList.remove('is-closing');
        return;
      }
      if(immediate || reduceMotion()){
        menu.classList.remove('is-closing');
        menu.hidden = true;
        return;
      }
      if(menu.classList.contains('is-closing')) return;
      menu.classList.add('is-closing');
      var done = function(e){
        if(e && e.target !== menu) return;
        menu.removeEventListener('animationend', done);
        clearTimeout(menu._closeT);
        menu.classList.remove('is-closing');
        menu.hidden = true;
      };
      menu.addEventListener('animationend', done);
      menu._closeT = setTimeout(done, 260);
    });
    syncLangUI();
  }

  function placeMenu(btn, menu){
    var r = btn.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = Math.round(r.bottom + 8) + 'px';
    menu.style.left = Math.round(r.left) + 'px';
    menu.style.right = 'auto';
    menu.style.minWidth = Math.max(Math.round(r.width), 188) + 'px';
    menu.style.zIndex = '120';
    requestAnimationFrame(function(){
      var mr = menu.getBoundingClientRect();
      if(mr.right > innerWidth - 8){
        menu.style.left = Math.max(8, Math.round(innerWidth - mr.width - 8)) + 'px';
      }
      if(mr.bottom > innerHeight - 8){
        menu.style.top = Math.max(8, Math.round(r.top - mr.height - 8)) + 'px';
      }
    });
  }

  var langOpen = false;
  var langIgnoreScroll = 0;

  function openLang(dd){
    closeAllLang(true);
    var btn = dd.querySelector('.lang-dd-btn');
    var id = btn && btn.getAttribute('aria-controls');
    var menu = (id && document.getElementById(id)) || dd.querySelector('.lang-dd-menu');
    if(!menu || !btn) return;
    if(menu.parentElement !== document.body){
      document.body.appendChild(menu);
      menu._langDd = dd;
    }
    menu.classList.remove('is-closing');
    menu.hidden = false;
    placeMenu(btn, menu);
    menu.style.animation = 'none';
    void menu.offsetWidth;
    menu.style.animation = '';
    btn.setAttribute('aria-expanded', 'true');
    langOpen = true;
    langIgnoreScroll = Date.now() + 400;
    syncLangUI();
  }

  function toggleLang(dd){
    var btn = dd.querySelector('.lang-dd-btn');
    var id = btn && btn.getAttribute('aria-controls');
    var menu = (id && document.getElementById(id)) || dd.querySelector('.lang-dd-menu');
    if(!menu) return;
    if(menu.hidden) openLang(dd); else closeAllLang();
  }

  window.applyLang = applyLang;
  window.pmFmt = fmt;
  window.pmEsc = esc;
  window.pmLang = function(){ return lang; };
  window.pmLookup = lookup;

  document.addEventListener('viewflip', flipLabel);
  document.addEventListener('routechange', flipLabel);

  function bindMenuOptions(menu){
    menu.querySelectorAll('[role="option"]').forEach(function(opt){
      if(opt._langBound) return;
      opt._langBound = true;
      opt.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        applyLang(opt.getAttribute('data-value'));
        closeAllLang();
      });
    });
  }

  document.querySelectorAll('[data-lang-dd]').forEach(function(dd){
    var btn = dd.querySelector('.lang-dd-btn');
    var menu = dd.querySelector('.lang-dd-menu');
    if(menu) bindMenuOptions(menu);
    if(btn) btn.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      toggleLang(dd);
    });
  });

  document.addEventListener('click', function(e){
    if(e.target.closest && (e.target.closest('.lang-dd-menu') || e.target.closest('[data-lang-dd]'))) return;
    closeAllLang();
  });
  addEventListener('resize', closeAllLang);
  addEventListener('scroll', function(){
    if(!langOpen || Date.now() < langIgnoreScroll) return;
    closeAllLang();
  }, {passive:true});
  addEventListener('keydown', function(e){
    if(e.key === 'Escape') closeAllLang();
  });

  applyLang(store.get("pm-lang") || "en", true);
})();
`;

// Fix import order: move import to top by rewriting file emission only
const header = `/* EN/FIL/ES/FR/ZH/KO/JA dictionary, data-i / data-i-label, [bracket] placeholder styling.
 * Generated by scripts/_build-i18n.mjs — edit locale sources there, then rebuild.
 */
(function(){
  var store = {
    get: function(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
    set: function(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
  };

  window.T = {
    en:${emitDict(T.en, 4)},
    fil:${emitDict(T.fil, 4)},
    es:${emitDict(T.es, 4)},
    fr:${emitDict(T.fr, 4)},
    zh:${emitDict(T.zh, 4)},
    ko:${emitDict(T.ko, 4)},
    ja:${emitDict(T.ja, 4)}
  };

`;

// ESM import must be at top — this script already imported buildRest above after es.
// Node will fail because import is mid-file. Rebuild as a proper two-phase: write temp then run differently.

fs.writeFileSync(outPath, header + runtime, 'utf8');

const enKeys = new Set(Object.keys(en).filter((k) => k !== 'items'));
for (const code of Object.keys(T)) {
  const ks = Object.keys(T[code]).filter((k) => k !== 'items');
  const missing = [...enKeys].filter((k) => !ks.includes(k));
  const extra = ks.filter((k) => !enKeys.has(k));
  if (missing.length || extra.length) {
    console.warn(code, { missing, extra });
  }
}
console.log('Wrote', outPath, 'keys/lang =', enKeys.size);
