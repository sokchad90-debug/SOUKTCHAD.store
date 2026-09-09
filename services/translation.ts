import { Language } from '@/constants/config';

// Extended dictionary for seamless invisible translation
const DICTIONARY: Record<string, Record<Language, string>> = {
  'bonjour': { en: 'Hello', fr: 'Bonjour', ar: 'مرحبا' },
  'hello': { en: 'Hello', fr: 'Bonjour', ar: 'مرحبا' },
  'مرحبا': { en: 'Hello', fr: 'Bonjour', ar: 'مرحبا' },
  'salut': { en: 'Hi', fr: 'Salut', ar: 'أهلا' },
  'hi': { en: 'Hi', fr: 'Salut', ar: 'أهلا' },
  'أهلا': { en: 'Hi', fr: 'Salut', ar: 'أهلا' },
  'merci': { en: 'Thank you', fr: 'Merci', ar: 'شكرا' },
  'thank you': { en: 'Thank you', fr: 'Merci', ar: 'شكرا' },
  'thanks': { en: 'Thanks', fr: 'Merci', ar: 'شكرا' },
  'شكرا': { en: 'Thank you', fr: 'Merci', ar: 'شكرا' },
  'oui': { en: 'Yes', fr: 'Oui', ar: 'نعم' },
  'yes': { en: 'Yes', fr: 'Oui', ar: 'نعم' },
  'نعم': { en: 'Yes', fr: 'Oui', ar: 'نعم' },
  'non': { en: 'No', fr: 'Non', ar: 'لا' },
  'no': { en: 'No', fr: 'Non', ar: 'لا' },
  'لا': { en: 'No', fr: 'Non', ar: 'لا' },
  'combien': { en: 'How much?', fr: 'Combien?', ar: 'بكم؟' },
  'how much': { en: 'How much?', fr: 'Combien?', ar: 'بكم؟' },
  'how much?': { en: 'How much?', fr: 'Combien?', ar: 'بكم؟' },
  'بكم': { en: 'How much?', fr: 'Combien?', ar: 'بكم؟' },
  'بكم؟': { en: 'How much?', fr: 'Combien?', ar: 'بكم؟' },
  "c'est disponible": { en: 'Is it available?', fr: "C'est disponible?", ar: 'هل متاح؟' },
  "c'est disponible?": { en: 'Is it available?', fr: "C'est disponible?", ar: 'هل متاح؟' },
  'is it available': { en: 'Is it available?', fr: "C'est disponible?", ar: 'هل متاح؟' },
  'is it available?': { en: 'Is it available?', fr: "C'est disponible?", ar: 'هل متاح؟' },
  'هل متاح': { en: 'Is it available?', fr: "C'est disponible?", ar: 'هل متاح؟' },
  'هل متاح؟': { en: 'Is it available?', fr: "C'est disponible?", ar: 'هل متاح؟' },
  'dernier prix': { en: 'Last price?', fr: 'Dernier prix?', ar: 'آخر سعر؟' },
  'dernier prix?': { en: 'Last price?', fr: 'Dernier prix?', ar: 'آخر سعر؟' },
  'last price': { en: 'Last price?', fr: 'Dernier prix?', ar: 'آخر سعر؟' },
  'last price?': { en: 'Last price?', fr: 'Dernier prix?', ar: 'آخر سعر؟' },
  'آخر سعر': { en: 'Last price?', fr: 'Dernier prix?', ar: 'آخر سعر؟' },
  'آخر سعر؟': { en: 'Last price?', fr: 'Dernier prix?', ar: 'آخر سعر؟' },
  "je suis interesse": { en: 'I am interested', fr: 'Je suis interesse', ar: 'أنا مهتم' },
  "i am interested": { en: 'I am interested', fr: 'Je suis interesse', ar: 'أنا مهتم' },
  'أنا مهتم': { en: 'I am interested', fr: 'Je suis interesse', ar: 'أنا مهتم' },
  'bonsoir': { en: 'Good evening', fr: 'Bonsoir', ar: 'مساء الخير' },
  'good evening': { en: 'Good evening', fr: 'Bonsoir', ar: 'مساء الخير' },
  'مساء الخير': { en: 'Good evening', fr: 'Bonsoir', ar: 'مساء الخير' },
  'au revoir': { en: 'Goodbye', fr: 'Au revoir', ar: 'مع السلامة' },
  'goodbye': { en: 'Goodbye', fr: 'Au revoir', ar: 'مع السلامة' },
  'bye': { en: 'Bye', fr: 'Au revoir', ar: 'مع السلامة' },
  'مع السلامة': { en: 'Goodbye', fr: 'Au revoir', ar: 'مع السلامة' },
  "d'accord": { en: 'OK', fr: "D'accord", ar: 'حسنا' },
  'ok': { en: 'OK', fr: "D'accord", ar: 'حسنا' },
  'حسنا': { en: 'OK', fr: "D'accord", ar: 'حسنا' },
  "s'il vous plait": { en: 'Please', fr: "S'il vous plait", ar: 'من فضلك' },
  'please': { en: 'Please', fr: "S'il vous plait", ar: 'من فضلك' },
  'من فضلك': { en: 'Please', fr: "S'il vous plait", ar: 'من فضلك' },
  'je veux acheter': { en: 'I want to buy', fr: 'Je veux acheter', ar: 'أريد الشراء' },
  'i want to buy': { en: 'I want to buy', fr: 'Je veux acheter', ar: 'أريد الشراء' },
  'أريد الشراء': { en: 'I want to buy', fr: 'Je veux acheter', ar: 'أريد الشراء' },
  'encore disponible': { en: 'Still available?', fr: 'Encore disponible?', ar: 'لا يزال متاح؟' },
  'still available': { en: 'Still available?', fr: 'Encore disponible?', ar: 'لا يزال متاح؟' },
  'still available?': { en: 'Still available?', fr: 'Encore disponible?', ar: 'لا يزال متاح؟' },
  'لا يزال متاح': { en: 'Still available?', fr: 'Encore disponible?', ar: 'لا يزال متاح؟' },
  'livraison possible': { en: 'Delivery possible?', fr: 'Livraison possible?', ar: 'هل التوصيل ممكن؟' },
  'delivery possible': { en: 'Delivery possible?', fr: 'Livraison possible?', ar: 'هل التوصيل ممكن؟' },
  'هل التوصيل ممكن': { en: 'Delivery possible?', fr: 'Livraison possible?', ar: 'هل التوصيل ممكن؟' },
  "c'est neuf": { en: 'Is it new?', fr: "C'est neuf?", ar: 'هل هو جديد؟' },
  'is it new': { en: 'Is it new?', fr: "C'est neuf?", ar: 'هل هو جديد؟' },
  'is it new?': { en: 'Is it new?', fr: "C'est neuf?", ar: 'هل هو جديد؟' },
  'هل هو جديد': { en: 'Is it new?', fr: "C'est neuf?", ar: 'هل هو جديد؟' },
  'envoyer les photos': { en: 'Send photos', fr: 'Envoyer les photos', ar: 'أرسل الصور' },
  'send photos': { en: 'Send photos', fr: 'Envoyer les photos', ar: 'أرسل الصور' },
  'أرسل الصور': { en: 'Send photos', fr: 'Envoyer les photos', ar: 'أرسل الصور' },
  "j'ai paye": { en: 'I have paid', fr: "J'ai paye", ar: 'لقد دفعت' },
  'i have paid': { en: 'I have paid', fr: "J'ai paye", ar: 'لقد دفعت' },
  'لقد دفعت': { en: 'I have paid', fr: "J'ai paye", ar: 'لقد دفعت' },
  'quand': { en: 'When?', fr: 'Quand?', ar: 'متى؟' },
  'when': { en: 'When?', fr: 'Quand?', ar: 'متى؟' },
  'when?': { en: 'When?', fr: 'Quand?', ar: 'متى؟' },
  'متى': { en: 'When?', fr: 'Quand?', ar: 'متى؟' },
  'متى؟': { en: 'When?', fr: 'Quand?', ar: 'متى؟' },
  'ou': { en: 'Where?', fr: 'Ou?', ar: 'أين؟' },
  'where': { en: 'Where?', fr: 'Ou?', ar: 'أين؟' },
  'where?': { en: 'Where?', fr: 'Ou?', ar: 'أين؟' },
  'أين': { en: 'Where?', fr: 'Ou?', ar: 'أين؟' },
  'أين؟': { en: 'Where?', fr: 'Ou?', ar: 'أين؟' },
};

export function detectLanguage(text: string): Language {
  const arabicRegex = /[\u0600-\u06FF]/;
  const frenchIndicators = ['bonjour', 'merci', 'oui', 'non', 'je', 'le', 'la', 'les', 'est', 'un', 'une', 'des', 'pour', 'avec', 'dans', 'sur', 'pas', 'que', 'qui', 'vous', 'nous', 'sont', 'mais', 'prix', 'combien', 'disponible', 'livraison', 'acheter', 'veux', 'photos', 'neuf', 'envoyer', 'paye', 'quand', 'accord', 'interesse', 'salut', 'bonsoir', 'revoir'];
  if (arabicRegex.test(text)) return 'ar';
  const lower = text.toLowerCase();
  const frScore = frenchIndicators.filter(w => lower.includes(w)).length;
  if (frScore >= 1) return 'fr';
  return 'en';
}

/**
 * Translates a message into all three languages invisibly.
 * Returns a full { en, fr, ar } object for seamless display.
 * The receiver's app will just show their language version.
 */
export function translateMessageFull(text: string, senderLang: Language): { en: string; fr: string; ar: string } {
  const normalized = text.trim().toLowerCase().replace(/[?!.,]+$/, '');

  // Check dictionary for exact match first
  for (const [key, translations] of Object.entries(DICTIONARY)) {
    if (normalized === key) {
      return {
        en: translations.en,
        fr: translations.fr,
        ar: translations.ar,
      };
    }
  }

  // Check partial match
  for (const [key, translations] of Object.entries(DICTIONARY)) {
    if (normalized.includes(key)) {
      return {
        en: translations.en,
        fr: translations.fr,
        ar: translations.ar,
      };
    }
  }

  // No dictionary match — return original text for all languages
  // In production, this would call a real translation API
  return { en: text, fr: text, ar: text };
}

/**
 * Legacy function — kept for backward compatibility.
 */
export function translateMessage(text: string, targetLang: Language): { en?: string; fr?: string; ar?: string } {
  const full = translateMessageFull(text, detectLanguage(text));
  return { [targetLang]: full[targetLang] };
}
