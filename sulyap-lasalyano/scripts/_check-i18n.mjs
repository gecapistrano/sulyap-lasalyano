/** Sanity-check generated 02-i18n.js dictionaries. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const dir = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(dir, '02-i18n.js'), 'utf8');
const start = src.indexOf('window.T = ');
const end = src.indexOf(';\n\n  var LANGS');
if (start < 0 || end < 0) throw new Error('Could not locate window.T block');
const block = src.slice(start, end + 1);
const sandbox = { window: {} };
vm.runInNewContext(block, sandbox);
const T = sandbox.window.T;
const langs = Object.keys(T);
const enKeys = Object.keys(T.en).filter((k) => k !== 'items').sort();
console.log('langs', langs.join(','));
console.log('EN keys', enKeys.length);

const must = [
  'nx.edu.intro.p1',
  'nx.edu.scan.body',
  'guide.reply.limited',
  'guide.reply.hello',
  'aea.info.body2',
  'scan.title',
  'scan.enableBtn',
  'scan.tip1',
  'kg.title',
  'kg.back',
  'kg.backLabel',
  'kg.status',
  'pres.back',
  'pres.realName',
  'pres.history',
  'pres.memories',
  '404.title',
];
for (const code of langs) {
  const missing = must.filter((k) => T[code][k] === undefined || T[code][k] === '');
  if (missing.length) console.error(code, 'MISSING', missing);
  const sameAsEn = must.filter((k) => code !== 'en' && T[code][k] === T.en[k]);
  // Live Scan / product names may intentionally match EN
  const okSame = sameAsEn.filter((k) => !['scan.title', 'kg.title', 'nx.edu.scan.name', 'nx.edu.kg.name', 'nx.edu.title', 'guide.title'].includes(k) && !k.includes('.name'));
  if (code !== 'en' && okSame.length) {
    console.log(code, 'still-EN (sample)', okSame.slice(0, 5));
  }
}
// FIL limited must be Tagalog
if (String(T.fil['guide.reply.limited']).includes('I might be able')) {
  console.error('FIL guide.reply.limited still English');
  process.exit(1);
}
if (!String(T.fil['nx.edu.intro.p1']).includes('Sulyap Lasalyano')) {
  console.error('FIL nx.edu.intro.p1 unexpected');
  process.exit(1);
}
if (!String(T.es['cta.hint']).toLowerCase().includes('museo')) {
  console.error('ES cta.hint unexpected', T.es['cta.hint']);
  process.exit(1);
}
console.log('ok');
