/**
 * نماذج «الأبجدية العربية» — قسم Grundlagen قبل المواقف.
 *
 * كل حرف يحوي:
 *   - الشكل الأساسي + الاسم
 *   - النطق في الفصحى و النطق في السورية (يختلفان لبعض الأحرف مثل ج، ق)
 *   - تشبيه ألماني للنطق
 *   - 5-6 كلمات مثال غنية في الصيغتين
 */

import { BilingualVocab } from './arabic-scenarios.model';

export interface AlphabetLetter {
  /** معرّف لاتيني (للـ URL مثل /alphabet/alif) */
  id: string;
  /** الحرف منفرداً (مثل ب) */
  letter: string;
  /** الاسم بحروف لاتينية (Alif, Ba, Ta…) */
  name: string;
  /** اسم الحرف بالعربية */
  arabicName: string;
  /** ترتيب أبجدي 1-28 */
  position: number;
  /** نطق الحرف في الفصحى (بترانسليتراتشن) */
  fushaSound: string;
  /** نطق الحرف في السورية (قد يختلف؛ مثلاً ق → ʾ أو ث → ت) */
  syrianSound: string;
  /** تشبيه ألماني للنطق */
  germanHint: string;
  /** كلمات مثال (ثنائية: فصحى/سورية + ترجمة ألمانية) */
  examples: BilingualVocab[];
}

export interface ArabicAlphabetData {
  letters: AlphabetLetter[];
}
