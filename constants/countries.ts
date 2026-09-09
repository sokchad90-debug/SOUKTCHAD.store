export interface Country {
  code: string;
  name: { en: string; fr: string; ar: string };
  dialCode: string;
  flag: string;
  phoneLength: number; // exact digits required after dial code
  region: string;
}

export type Region = 'africa' | 'middle_east' | 'europe' | 'asia' | 'americas';

export const REGIONS: { id: Region; name: { en: string; fr: string; ar: string }; icon: string }[] = [
  { id: 'africa', name: { en: 'Africa', fr: 'Afrique', ar: 'أفريقيا' }, icon: 'public' },
  { id: 'middle_east', name: { en: 'Middle East', fr: 'Moyen-Orient', ar: 'الشرق الأوسط' }, icon: 'public' },
  { id: 'europe', name: { en: 'Europe', fr: 'Europe', ar: 'أوروبا' }, icon: 'public' },
  { id: 'asia', name: { en: 'Asia', fr: 'Asie', ar: 'آسيا' }, icon: 'public' },
  { id: 'americas', name: { en: 'Americas', fr: 'Ameriques', ar: 'الأمريكيتين' }, icon: 'public' },
];

// Sokchad is Chad-only (🇹🇩). Only Chad is available; all other countries are removed.
export const ALL_COUNTRIES: Country[] = [
  { code: 'TD', name: { en: 'Chad', fr: 'Tchad', ar: 'تشاد' }, dialCode: '+235', flag: '🇹🇩', phoneLength: 8, region: 'africa' },
];

// Cities per country code (Chad only)
export const COUNTRY_CITIES: Record<string, string[]> = {
  TD: ["N'Djamena", 'Moundou', 'Abeche', 'Sarh', 'Kelo', 'Koumra', 'Pala', 'Am Timan', 'Bongor', 'Mongo', 'Doba', 'Ati', 'Massaguet', 'Lai', 'Mao'],
};

// Default enabled countries — Chad only
export const DEFAULT_ENABLED_COUNTRIES = ['TD'];
