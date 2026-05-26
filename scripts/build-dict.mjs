/**
 * build-dict.mjs — مُولِّد بيانات القاموس (يُشغَّل محلياً مرّة واحدة).
 *
 * يقرأ قاموسَي RosaeNLG الضخمين (المبنيَّين على german-pos-dict / Morphy):
 *   - german-words-dict  → الأسماء (الجنس + الحالات الأربع مفرد/جمع)
 *   - german-verbs-dict  → الأفعال (كل الأزمنة)
 * و يُخرج ملفّين مُبسَّطين خاصّين بالتطبيق في public/data/:
 *   - dict-nouns.json  (صيغة مصفوفة مضغوطة)
 *   - dict-verbs.json  (Partizip II + المساعد + الحاضر + الماضي فقط)
 *
 * الهدف: تصغير الحجم (حذف Konjunktiv/Imperativ غير المطلوبة) و تبسيط
 * قراءة العميل. الملفّان الناتجان يُرفعان مع المشروع، فلا يحتاج Vercel
 * لهذه الحِزم وقت النشر (يكفي تثبيتها محلياً لتشغيل هذا السكربت):
 *
 *   npm install --no-save german-words-dict german-verbs-dict
 *   node scripts/build-dict.mjs
 *
 * المصدر/الترخيص: البيانات من Morphy + korrekturen.de بترخيص
 * CC BY-SA 4.0 (تُنسب في صفحة القاموس).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const nounsSrc = JSON.parse(
  readFileSync(join(root, 'node_modules/german-words-dict/dist/words.json'), 'utf8')
);
const verbsSrc = JSON.parse(
  readFileSync(join(root, 'node_modules/german-verbs-dict/dist/verbs.json'), 'utf8')
);

// أفعال تأخذ «sein» في الـ Perfekt (قائمة german-verbs + إضافات شائعة منفصلة).
const ALWAYS_SEIN = new Set([
  'aufwachen', 'aufwachsen', 'einziehen', 'entstehen', 'fahren', 'fallen', 'fliegen',
  'gehen', 'geschehen', 'hüpfen', 'kommen', 'laufen', 'passieren', 'reisen', 'rennen',
  'springen', 'steigen', 'aussteigen', 'einsteigen', 'sinken', 'sterben', 'wachsen',
  'bleiben', 'sein', 'werden', 'treten', 'auswandern', 'begegnen', 'explodieren',
  'folgen', 'landen', 'starten', 'wandern', 'zurückkehren', 'verbrennen',
  // إضافات شائعة (أفعال حركة/تغيّر حالة منفصلة) لتحسين الدقّة:
  'aufstehen', 'ankommen', 'abfahren', 'losfahren', 'losgehen', 'weggehen', 'weglaufen',
  'zurückkommen', 'mitkommen', 'umsteigen', 'einschlafen', 'aufstehen', 'umziehen',
  'erscheinen', 'verschwinden', 'ertrinken', 'wegfahren', 'hinfallen', 'umfallen',
]);

// ───────── الأسماء ─────────
// صيغة الإخراج لكل اسم (مصفوفة): [G, NOM.S, NOM.P, AKK.S, AKK.P, DAT.S, DAT.P, GEN.S, GEN.P]
const nounsOut = {};
let nounCount = 0;
for (const [word, info] of Object.entries(nounsSrc)) {
  if (!info || !info.G) continue;
  const g = (k, n) => (info[k] && info[k][n]) || '';
  nounsOut[word] = [
    info.G,
    g('NOM', 'SIN'), g('NOM', 'PLU'),
    g('AKK', 'SIN'), g('AKK', 'PLU'),
    g('DAT', 'SIN'), g('DAT', 'PLU'),
    g('GEN', 'SIN'), g('GEN', 'PLU'),
  ];
  nounCount++;
}

// ───────── الأفعال ─────────
// يحوّل صيغة الشخص (قد تكون نصاً أو مصفوفة للأفعال المنفصلة) إلى نص واحد.
const flat = (x) => (Array.isArray(x) ? x.filter(Boolean).join(' ') : x || '');
// يستخرج الأزمنة الستّة بترتيب: ich, du, er/sie/es, wir, ihr, sie/Sie
const six = (tense) => {
  if (!tense || !tense.S || !tense.P) return null;
  const out = [
    flat(tense.S['1']), flat(tense.S['2']), flat(tense.S['3']),
    flat(tense.P['1']), flat(tense.P['2']), flat(tense.P['3']),
  ];
  return out.some(Boolean) ? out : null;
};

const verbsOut = {};
let verbCount = 0;
for (const [verb, info] of Object.entries(verbsSrc)) {
  const pres = six(info['PRÄ']);
  const pret = six(info['PRT']);
  if (!pres) continue; // بلا حاضر = لا فائدة
  verbsOut[verb] = {
    p2: (info.PA2 && info.PA2[0]) || '',
    sein: ALWAYS_SEIN.has(verb),
    pres,
    pret: pret || null,
  };
  verbCount++;
}

const nounsPath = join(root, 'public/data/dict-nouns.json');
const verbsPath = join(root, 'public/data/dict-verbs.json');
writeFileSync(nounsPath, JSON.stringify(nounsOut));
writeFileSync(verbsPath, JSON.stringify(verbsOut));

const mb = (p) => (readFileSync(p).length / 1024 / 1024).toFixed(2);
console.log(`✓ nouns: ${nounCount} entries → ${mb(nounsPath)} MB`);
console.log(`✓ verbs: ${verbCount} entries → ${mb(verbsPath)} MB`);
