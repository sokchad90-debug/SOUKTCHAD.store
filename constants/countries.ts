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

export const ALL_COUNTRIES: Country[] = [
  // ── Africa ──
  { code: 'TD', name: { en: 'Chad', fr: 'Tchad', ar: 'تشاد' }, dialCode: '+235', flag: '🇹🇩', phoneLength: 8, region: 'africa' },
  { code: 'CM', name: { en: 'Cameroon', fr: 'Cameroun', ar: 'الكاميرون' }, dialCode: '+237', flag: '🇨🇲', phoneLength: 9, region: 'africa' },
  { code: 'NG', name: { en: 'Nigeria', fr: 'Nigeria', ar: 'نيجيريا' }, dialCode: '+234', flag: '🇳🇬', phoneLength: 10, region: 'africa' },
  { code: 'NE', name: { en: 'Niger', fr: 'Niger', ar: 'النيجر' }, dialCode: '+227', flag: '🇳🇪', phoneLength: 8, region: 'africa' },
  { code: 'CF', name: { en: 'Central African Republic', fr: 'Centrafrique', ar: 'جمهورية أفريقيا الوسطى' }, dialCode: '+236', flag: '🇨🇫', phoneLength: 8, region: 'africa' },
  { code: 'SD', name: { en: 'Sudan', fr: 'Soudan', ar: 'السودان' }, dialCode: '+249', flag: '🇸🇩', phoneLength: 9, region: 'africa' },
  { code: 'LY', name: { en: 'Libya', fr: 'Libye', ar: 'ليبيا' }, dialCode: '+218', flag: '🇱🇾', phoneLength: 9, region: 'africa' },
  { code: 'EG', name: { en: 'Egypt', fr: 'Egypte', ar: 'مصر' }, dialCode: '+20', flag: '🇪🇬', phoneLength: 10, region: 'africa' },
  { code: 'DZ', name: { en: 'Algeria', fr: 'Algerie', ar: 'الجزائر' }, dialCode: '+213', flag: '🇩🇿', phoneLength: 9, region: 'africa' },
  { code: 'MA', name: { en: 'Morocco', fr: 'Maroc', ar: 'المغرب' }, dialCode: '+212', flag: '🇲🇦', phoneLength: 9, region: 'africa' },
  { code: 'TN', name: { en: 'Tunisia', fr: 'Tunisie', ar: 'تونس' }, dialCode: '+216', flag: '🇹🇳', phoneLength: 8, region: 'africa' },
  { code: 'SN', name: { en: 'Senegal', fr: 'Senegal', ar: 'السنغال' }, dialCode: '+221', flag: '🇸🇳', phoneLength: 9, region: 'africa' },
  { code: 'CI', name: { en: "Ivory Coast", fr: "Cote d'Ivoire", ar: 'ساحل العاج' }, dialCode: '+225', flag: '🇨🇮', phoneLength: 10, region: 'africa' },
  { code: 'GH', name: { en: 'Ghana', fr: 'Ghana', ar: 'غانا' }, dialCode: '+233', flag: '🇬🇭', phoneLength: 9, region: 'africa' },
  { code: 'KE', name: { en: 'Kenya', fr: 'Kenya', ar: 'كينيا' }, dialCode: '+254', flag: '🇰🇪', phoneLength: 9, region: 'africa' },
  { code: 'ET', name: { en: 'Ethiopia', fr: 'Ethiopie', ar: 'إثيوبيا' }, dialCode: '+251', flag: '🇪🇹', phoneLength: 9, region: 'africa' },
  { code: 'TZ', name: { en: 'Tanzania', fr: 'Tanzanie', ar: 'تنزانيا' }, dialCode: '+255', flag: '🇹🇿', phoneLength: 9, region: 'africa' },
  { code: 'CD', name: { en: 'DR Congo', fr: 'RD Congo', ar: 'الكونغو الديمقراطية' }, dialCode: '+243', flag: '🇨🇩', phoneLength: 9, region: 'africa' },
  { code: 'CG', name: { en: 'Congo', fr: 'Congo', ar: 'الكونغو' }, dialCode: '+242', flag: '🇨🇬', phoneLength: 9, region: 'africa' },
  { code: 'GA', name: { en: 'Gabon', fr: 'Gabon', ar: 'الغابون' }, dialCode: '+241', flag: '🇬🇦', phoneLength: 7, region: 'africa' },
  { code: 'ZA', name: { en: 'South Africa', fr: 'Afrique du Sud', ar: 'جنوب أفريقيا' }, dialCode: '+27', flag: '🇿🇦', phoneLength: 9, region: 'africa' },

  // ── Middle East ──
  { code: 'SA', name: { en: 'Saudi Arabia', fr: 'Arabie Saoudite', ar: 'المملكة العربية السعودية' }, dialCode: '+966', flag: '🇸🇦', phoneLength: 9, region: 'middle_east' },
  { code: 'AE', name: { en: 'UAE', fr: 'Emirats Arabes Unis', ar: 'الإمارات العربية المتحدة' }, dialCode: '+971', flag: '🇦🇪', phoneLength: 9, region: 'middle_east' },
  { code: 'QA', name: { en: 'Qatar', fr: 'Qatar', ar: 'قطر' }, dialCode: '+974', flag: '🇶🇦', phoneLength: 8, region: 'middle_east' },
  { code: 'KW', name: { en: 'Kuwait', fr: 'Koweit', ar: 'الكويت' }, dialCode: '+965', flag: '🇰🇼', phoneLength: 8, region: 'middle_east' },
  { code: 'BH', name: { en: 'Bahrain', fr: 'Bahrein', ar: 'البحرين' }, dialCode: '+973', flag: '🇧🇭', phoneLength: 8, region: 'middle_east' },
  { code: 'OM', name: { en: 'Oman', fr: 'Oman', ar: 'عمان' }, dialCode: '+968', flag: '🇴🇲', phoneLength: 8, region: 'middle_east' },
  { code: 'JO', name: { en: 'Jordan', fr: 'Jordanie', ar: 'الأردن' }, dialCode: '+962', flag: '🇯🇴', phoneLength: 9, region: 'middle_east' },
  { code: 'LB', name: { en: 'Lebanon', fr: 'Liban', ar: 'لبنان' }, dialCode: '+961', flag: '🇱🇧', phoneLength: 8, region: 'middle_east' },
  { code: 'IQ', name: { en: 'Iraq', fr: 'Irak', ar: 'العراق' }, dialCode: '+964', flag: '🇮🇶', phoneLength: 10, region: 'middle_east' },
  { code: 'TR', name: { en: 'Turkey', fr: 'Turquie', ar: 'تركيا' }, dialCode: '+90', flag: '🇹🇷', phoneLength: 10, region: 'middle_east' },

  // ── Europe ──
  { code: 'FR', name: { en: 'France', fr: 'France', ar: 'فرنسا' }, dialCode: '+33', flag: '🇫🇷', phoneLength: 9, region: 'europe' },
  { code: 'DE', name: { en: 'Germany', fr: 'Allemagne', ar: 'ألمانيا' }, dialCode: '+49', flag: '🇩🇪', phoneLength: 10, region: 'europe' },
  { code: 'GB', name: { en: 'United Kingdom', fr: 'Royaume-Uni', ar: 'المملكة المتحدة' }, dialCode: '+44', flag: '🇬🇧', phoneLength: 10, region: 'europe' },
  { code: 'IT', name: { en: 'Italy', fr: 'Italie', ar: 'إيطاليا' }, dialCode: '+39', flag: '🇮🇹', phoneLength: 10, region: 'europe' },
  { code: 'ES', name: { en: 'Spain', fr: 'Espagne', ar: 'إسبانيا' }, dialCode: '+34', flag: '🇪🇸', phoneLength: 9, region: 'europe' },
  { code: 'BE', name: { en: 'Belgium', fr: 'Belgique', ar: 'بلجيكا' }, dialCode: '+32', flag: '🇧🇪', phoneLength: 9, region: 'europe' },
  { code: 'CH', name: { en: 'Switzerland', fr: 'Suisse', ar: 'سويسرا' }, dialCode: '+41', flag: '🇨🇭', phoneLength: 9, region: 'europe' },

  // ── Asia ──
  { code: 'CN', name: { en: 'China', fr: 'Chine', ar: 'الصين' }, dialCode: '+86', flag: '🇨🇳', phoneLength: 11, region: 'asia' },
  { code: 'IN', name: { en: 'India', fr: 'Inde', ar: 'الهند' }, dialCode: '+91', flag: '🇮🇳', phoneLength: 10, region: 'asia' },
  { code: 'PK', name: { en: 'Pakistan', fr: 'Pakistan', ar: 'باكستان' }, dialCode: '+92', flag: '🇵🇰', phoneLength: 10, region: 'asia' },
  { code: 'MY', name: { en: 'Malaysia', fr: 'Malaisie', ar: 'ماليزيا' }, dialCode: '+60', flag: '🇲🇾', phoneLength: 10, region: 'asia' },
  { code: 'ID', name: { en: 'Indonesia', fr: 'Indonesie', ar: 'إندونيسيا' }, dialCode: '+62', flag: '🇮🇩', phoneLength: 10, region: 'asia' },

  // ── Americas ──
  { code: 'US', name: { en: 'United States', fr: 'Etats-Unis', ar: 'الولايات المتحدة' }, dialCode: '+1', flag: '🇺🇸', phoneLength: 10, region: 'americas' },
  { code: 'CA', name: { en: 'Canada', fr: 'Canada', ar: 'كندا' }, dialCode: '+1', flag: '🇨🇦', phoneLength: 10, region: 'americas' },
  { code: 'BR', name: { en: 'Brazil', fr: 'Bresil', ar: 'البرازيل' }, dialCode: '+55', flag: '🇧🇷', phoneLength: 11, region: 'americas' },
];

// Cities per country code (main ones for marketplace)
export const COUNTRY_CITIES: Record<string, string[]> = {
  TD: ["N'Djamena", 'Moundou', 'Abeche', 'Sarh', 'Kelo', 'Koumra', 'Pala', 'Am Timan', 'Bongor', 'Mongo', 'Doba', 'Ati', 'Massaguet', 'Lai', 'Mao'],
  CM: ['Douala', 'Yaounde', 'Garoua', 'Bamenda', 'Maroua', 'Bafoussam', 'Ngaoundere'],
  NG: ['Lagos', 'Abuja', 'Kano', 'Ibadan', 'Port Harcourt', 'Benin City', 'Kaduna'],
  NE: ['Niamey', 'Zinder', 'Maradi', 'Agadez', 'Tahoua'],
  CF: ['Bangui', 'Bimbo', 'Berbérati', 'Carnot'],
  SD: ['Khartoum', 'Omdurman', 'Port Sudan', 'Kassala'],
  EG: ['Cairo', 'Alexandria', 'Giza', 'Sharm El Sheikh', 'Luxor'],
  SA: ['Riyadh', 'Jeddah', 'Mecca', 'Medina', 'Dammam'],
  AE: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman'],
  FR: ['Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice'],
  US: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Miami'],
};

// Default enabled countries (Chad + neighbors)
export const DEFAULT_ENABLED_COUNTRIES = ['TD', 'CM', 'NG', 'NE', 'CF', 'SD'];
