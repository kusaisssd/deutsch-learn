/**
 * خلط مصفوفة بشكل عشوائي (Fisher-Yates Shuffle).
 *
 * - لا يعدّل المصفوفة الأصلية → يُرجع نسخة جديدة (immutable).
 * - عشوائية حقيقية و متساوية.
 *
 * مقابل في C#:
 *   public static IList<T> Shuffle<T>(this IEnumerable<T> source) { ... }
 */
export function shuffle<T>(array: readonly T[]): T[] {
  const result = [...array];           // نسخة جديدة كي لا نعدّل الأصلية
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];   // تبديل
  }
  return result;
}
