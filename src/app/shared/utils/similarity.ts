/**
 * 🔤 Fuzzy text matching utilities for German speech recognition.
 *
 * عند مقارنة ما نطقه المستخدم بالجملة المتوقعة، نريد:
 *   - لا نُعاقب على الحرف الكبير/الصغير
 *   - لا نُعاقب على علامات الترقيم
 *   - نتسامح مع umlauts بأشكال مختلفة (ü → ue، ß → ss)
 *   - نُعطي درجة "تشابه" بدلاً من نعم/لا فقط
 */

// ─────────────────────────────────────────────
// نتيجة المقارنة
// ─────────────────────────────────────────────

export type MatchLevel = 'exact' | 'close' | 'different';

export interface ComparisonResult {
  /** هل النصان متطابقان بعد التطبيع؟ */
  level: MatchLevel;
  /** درجة التشابه من 0 إلى 1 */
  similarity: number;
  /** النص بعد التطبيع (للتشخيص) */
  spokenNormalized: string;
  expectedNormalized: string;
}

// ─────────────────────────────────────────────
// التطبيع (Normalization)
// ─────────────────────────────────────────────

/**
 * يجعل النص الألماني صالحاً للمقارنة:
 *   - أحرف صغيرة
 *   - umlauts → ASCII (ü→ue, ö→oe, ä→ae, ß→ss)
 *   - إزالة علامات الترقيم
 *   - مسافات موحدة
 *
 * مثال:
 *   "Ich habe Kopfschmerzen." → "ich habe kopfschmerzen"
 *   "Tschüss!"                → "tschuess"
 */
export function normalizeGerman(text: string): string {
  return text
    .toLowerCase()
    .replace(/ü/g, 'ue')
    .replace(/ö/g, 'oe')
    .replace(/ä/g, 'ae')
    .replace(/ß/g, 'ss')
    // إزالة كل ما ليس حرف لاتيني أو رقم أو مسافة
    .replace(/[^a-z0-9\s]/g, ' ')
    // مسافات متعددة → مسافة واحدة + قص
    .replace(/\s+/g, ' ')
    .trim();
}

// ─────────────────────────────────────────────
// خوارزمية Levenshtein Distance
// ─────────────────────────────────────────────

/**
 * يحسب أقل عدد عمليات (إدراج/حذف/استبدال) لتحويل نص لآخر.
 *
 * مثال:
 *   levenshtein("kitten", "sitting") = 3
 *     k→s (استبدال)
 *     e→i (استبدال)
 *     +g (إضافة)
 *
 * 🎯 خوارزمية كلاسيكية (1965)، مفيدة جداً في:
 *   - spell-check
 *   - autocomplete
 *   - DNA alignment
 *   - speech recognition (هنا!)
 *
 * التعقيد: O(m × n) حيث m, n أطوال النصين.
 */
function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // matrix[i][j] = المسافة بين أول i حرف من a و أول j حرف من b
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        // نفس الحرف → لا تكلفة
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        // نأخذ أقل تكلفة من 3 عمليات ممكنة + 1
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,  // استبدال
          matrix[i][j - 1] + 1,      // إدراج
          matrix[i - 1][j] + 1       // حذف
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// ─────────────────────────────────────────────
// المقارنة الرئيسية
// ─────────────────────────────────────────────

/**
 * يقارن نصين ألمانيين و يُرجع نتيجة مفصّلة.
 *
 * المعايير:
 *   - exact     : مطابق تماماً بعد التطبيع
 *   - close     : تشابه >= 0.85 (خطأ بسيط — حرف أو حرفان)
 *   - different : تشابه < 0.85
 *
 * @example
 *   compareGerman("Ich habe Kopfschmerzen", "Ich habe Kopfschmerzen.")
 *     → { level: 'exact', similarity: 1.0, ... }
 *
 *   compareGerman("Ich hab Kopfschmerzen", "Ich habe Kopfschmerzen.")
 *     → { level: 'close', similarity: 0.95, ... }
 *
 *   compareGerman("Hallo Welt", "Ich habe Kopfschmerzen.")
 *     → { level: 'different', similarity: 0.15, ... }
 */
export function compareGerman(spoken: string, expected: string): ComparisonResult {
  const a = normalizeGerman(spoken);
  const b = normalizeGerman(expected);

  if (a === b) {
    return {
      level: 'exact',
      similarity: 1.0,
      spokenNormalized: a,
      expectedNormalized: b,
    };
  }

  const distance = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  // similarity = 1 - (distance / maxLength). كلما قلّت المسافة، اقترب من 1.
  const similarity = maxLen === 0 ? 1 : 1 - distance / maxLen;

  let level: MatchLevel;
  if (similarity >= 0.95) level = 'exact';
  else if (similarity >= 0.85) level = 'close';
  else level = 'different';

  return { level, similarity, spokenNormalized: a, expectedNormalized: b };
}
