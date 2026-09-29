// SERVICES HUB demo data (owner-approved spec 2026-09-29 — Restaurants + PDF books + Print-on-demand)
// Remote images (souktchad.shop/dl/demo/) — NOT bundled in APK.
export interface Restaurant { id: string; name: { en: string; fr: string; ar: string }; city: string; rating: number; reviews: number; isOpen: boolean; deliveryFee: number; etaMin: number; etaMax: number; logo: string; cover: string; verified: boolean; mealIds: string[]; }
export interface Meal { id: string; restaurantId: string; name: { en: string; fr: string; ar: string }; price: number; image: string; available: boolean; extras: { id: string; name: { en: string; fr: string; ar: string }; price: number }[]; }
export interface PdfBook { id: string; title: { en: string; fr: string; ar: string }; author: string; language: 'fr' | 'en' | 'ar'; pages: number; sizeMB: string; price: number; cover: string; storeId: string; storeName: string; category: 'commerce' | 'cuisine' | 'etudes' | 'budget'; rating: number; reviews: number; previewPages: number; }
export interface PrintWorkshop { id: string; name: { en: string; fr: string; ar: string }; city: string; rating: number; reviews: number; productIds: string[]; }
export interface PrintItem { id: string; category: 'tshirts' | 'mugs' | 'cards' | 'documents' | 'booklets'; name: { en: string; fr: string; ar: string }; basePrice: number; image: string; workshopId: string; etaHours: number; options: { sizes?: string[]; colors?: string[]; quantityStep: number; docPages?: boolean; cover?: boolean }; }

const IMG = (k: string) => `https://souktchad.shop/dl/demo/${k}.jpg`;

export const SERVICE_CATEGORIES: { id: string; name: { en: string; fr: string; ar: string }; image: string; count: number }[] = [
  { id: 'restaurants', name: { en: 'Restaurants', fr: 'Restaurants', ar: 'المطاعم' }, image: IMG('food_chari'), count: 0 },
  { id: 'pdf_books', name: { en: 'PDF Books', fr: 'Livres PDF', ar: 'كتب PDF' }, image: IMG('book_comm'), count: 0 },
  { id: 'print_pod', name: { en: 'Print on demand', fr: 'Impression à la demande', ar: 'الطباعة عند الطلب' }, image: IMG('print_tshirt'), count: 0 },
];

export const RESTAURANTS: Restaurant[] = [
  { id: 'r1', name: { en: 'Saveurs du Chari', fr: 'Saveurs du Chari', ar: 'نكهات الشاري' }, city: "N'Djamena", rating: 4.7, reviews: 32, isOpen: true, deliveryFee: 1000, etaMin: 25, etaMax: 35, logo: IMG('food_chari'), cover: IMG('food_chari'), verified: true, mealIds: [] },
  { id: 'r2', name: { en: 'Grill du Sahel', fr: 'Grill du Sahel', ar: 'مشاوي الساحل' }, city: "N'Djamena", rating: 4.5, reviews: 24, isOpen: true, deliveryFee: 750, etaMin: 30, etaMax: 45, logo: IMG('food_sahel'), cover: IMG('food_sahel'), verified: true, mealIds: [] },
  { id: 'r3', name: { en: 'Cuisine de Moundou', fr: 'Cuisine de Moundou', ar: 'مطبخ منداو' }, city: 'Moundou', rating: 4.6, reviews: 18, isOpen: true, deliveryFee: 500, etaMin: 20, etaMax: 30, logo: IMG('food_moundou'), cover: IMG('food_moundou'), verified: false, mealIds: [] },
  { id: 'r4', name: { en: 'Poisson du Lac', fr: 'Poisson du Lac', ar: 'سمك البحيرة' }, city: 'Moundou', rating: 4.4, reviews: 15, isOpen: false, deliveryFee: 600, etaMin: 30, etaMax: 40, logo: IMG('food_lac'), cover: IMG('food_lac'), verified: true, mealIds: [] },
  { id: 'r5', name: { en: 'Saveurs de Sarh', fr: 'Saveurs de Sarh', ar: 'نكهات سار' }, city: 'Sarh', rating: 4.3, reviews: 12, isOpen: true, deliveryFee: 500, etaMin: 25, etaMax: 40, logo: IMG('food_sarh'), cover: IMG('food_sarh'), verified: false, mealIds: [] },
  { id: 'r6', name: { en: 'Cuisine Oasis', fr: 'Cuisine Oasis', ar: 'مطبخ الواحة' }, city: 'Abéché', rating: 4.2, reviews: 9, isOpen: true, deliveryFee: 400, etaMin: 20, etaMax: 35, logo: IMG('food_oasis'), cover: IMG('food_oasis'), verified: false, mealIds: [] },
  { id: 'r7', name: { en: 'Four Salam', fr: 'Four Salam', ar: 'فرن السلام' }, city: "N'Djamena", rating: 4.5, reviews: 21, isOpen: true, deliveryFee: 500, etaMin: 15, etaMax: 30, logo: IMG('food_salam'), cover: IMG('food_salam'), verified: false, mealIds: [] },
  { id: 'r8', name: { en: 'Kelo Repas', fr: 'Kelo Repas', ar: 'وجبات كيلو' }, city: 'Kelo', rating: 4.0, reviews: 7, isOpen: false, deliveryFee: 450, etaMin: 25, etaMax: 40, logo: IMG('food_kelo'), cover: IMG('food_kelo'), verified: false, mealIds: [] },
  { id: 'r9', name: { en: 'Table Abéché', fr: 'Table Abéché', ar: 'مائدة أبشي' }, city: 'Abéché', rating: 4.4, reviews: 13, isOpen: true, deliveryFee: 400, etaMin: 20, etaMax: 30, logo: IMG('food_abeche'), cover: IMG('food_abeche'), verified: true, mealIds: [] },
  { id: 'r10', name: { en: 'Cuisine Jardin', fr: 'Cuisine Jardin', ar: 'مطبخ البستان' }, city: "N'Djamena", rating: 4.3, reviews: 11, isOpen: true, deliveryFee: 550, etaMin: 20, etaMax: 35, logo: IMG('food_jardin'), cover: IMG('food_jardin'), verified: false, mealIds: [] },
];

const EXTRA = (id: string, en: string, fr: string, ar: string, price: number) => ({ id, name: { en, fr, ar }, price });

const mkMeal = (id: string, rid: string, en: string, fr: string, ar: string, price: number, img: string, avail = true) => ({
  id, restaurantId: rid,
  name: { en, fr, ar }, price, image: img, available: avail,
  extras: [EXTRA('x1', 'Extra rice', 'Riz supplémentaire', 'أرز إضافي', 500), EXTRA('x2', 'Extra sauce', 'Sauce en plus', 'صوص إضافي', 300), EXTRA('x3', 'Drink', 'Boisson', 'مشروب', 400)],
});

export const MEALS: Meal[] = [
  mkMeal('m1', 'r1', 'Grilled fish & plantains', 'Poisson braisé & bananes', 'سمك مشوي وموز جاكاس', 3500, IMG('food_chari')),
  mkMeal('m2', 'r1', 'Charity rice plate', 'Riz du Chari', 'أرز الشاري', 2500, IMG('food_jardin')),
  mkMeal('m3', 'r1', 'Chicken yassa', 'Poulet yassa', 'دجاج ياسا', 3000, IMG('food_oasis')),
  mkMeal('m4', 'r2', 'Beef skewers (4)', 'Brochettes de bœuf', 'أسياخ لحم', 4000, IMG('food_sahel')),
  mkMeal('m5', 'r2', 'Mixed grill platter', 'Assiette grill mixte', 'مشاوي مشكلة', 5000, IMG('food_lac')),
  mkMeal('m6', 'r2', 'Sheep kebab', 'Kébab mouton', 'كباب ضأن', 4500, IMG('food_abeche')),
  mkMeal('m7', 'r3', 'Moundou specialty (rice & okra)', 'Plat spécial Moundou', 'طبق منداو الخاص', 2800, IMG('food_moundou')),
  mkMeal('m8', 'r3', 'Baba & sauce gombo', 'Baba & sauce gombo', 'بابا وصوص الجوبو', 2200, IMG('food_sarh')),
  mkMeal('m9', 'r4', 'Nile perch grilled', 'Perche du Nil braisée', 'سمك النيل المشوي', 4000, IMG('food_lac')),
  mkMeal('m10', 'r4', 'Fish soup & rice', 'Soupe de poisson & riz', 'شربة سمك وأرز', 3000, IMG('food_sahel')),
  mkMeal('m11', 'r5', 'Sarh rice stew', 'Riz sauce de Sarh', 'أرز بيخنة سار', 2600, IMG('food_sarh')),
  mkMeal('m12', 'r5', 'Vegetable Couscous', 'Couscous aux légumes', 'كسكس بالخضار', 2400, IMG('food_jardin')),
  mkMeal('m13', 'r6', 'Oasis roasted chicken', 'Poulet rôti Oasis', 'دجاج مشوي الواحة', 3500, IMG('food_oasis')),
  mkMeal('m14', 'r6', 'Chicken liver plate', 'Plat abats de poulet', 'طبق أحشاء الدجاج', 2000, IMG('food_abeche')),
  mkMeal('m15', 'r7', 'Pizza margherita', 'Pizza margherita', 'بيتزا مارغريتا', 3000, IMG('food_salam')),
  mkMeal('m16', 'r7', 'Fresh bread basket', 'Panier de pain frais', 'سلة خبز طازج', 1000, IMG('food_salam')),
  mkMeal('m17', 'r8', 'Kelo burger & fries', 'Burger Kelo & frites', 'برغر كيلو وبطاطس', 2500, IMG('food_kelo')),
  mkMeal('m18', 'r8', 'Club sandwich', 'Club sandwich', 'ساندويتش كلوب', 2000, IMG('food_sahel'), false),
  mkMeal('m19', 'r9', 'Abéché lentils', 'Lentilles d Abéché', 'عدس أبشي', 1800, IMG('food_abeche')),
  mkMeal('m20', 'r9', 'Millet porridge', 'Boule de mil', 'عصيدة الدخن', 1500, IMG('food_jardin')),
  mkMeal('m21', 'r10', 'Jardin salad bowl', 'Salade Jardin', 'سلطة البستان', 2000, IMG('food_jardin')),
  mkMeal('m22', 'r10', 'Bean soup', 'Soupe de haricots', 'شربة الفاصوليا', 1700, IMG('food_sarh')),
  mkMeal('m23', 'r10', 'Vegetable Couscous (2)', 'Couscous végétarien', 'كسكس نباتي', 2300, IMG('food_jardin')),
  mkMeal('m24', 'r1', 'Fruit juice & dates', 'Jus de fruits & dattes', 'عصير وتمر', 1200, IMG('food_moundou')),
  mkMeal('m25', 'r2', 'Grilled chicken legs (2)', 'Cuisses de poulet grillées', 'أراكين دجاج مشوية', 3800, IMG('food_oasis')),
  mkMeal('m26', 'r3', 'Goat stew & baba', 'Ragoût de chèvre & baba', 'بيخنة الماعز وبابا', 2900, IMG('food_moundou')),
  mkMeal('m27', 'r5', 'Rice and beans', 'Riz & haricots', 'أرز ولوبيا', 1900, IMG('food_kelo')),
  mkMeal('m28', 'r9', 'Dates plate', 'Plateau de dattes', 'طبق تمر', 1300, IMG('food_abeche')),
  mkMeal('m29', 'r10', 'Green salad', 'Salade verte', 'سلطة خضراء', 1400, IMG('food_jardin')),
  mkMeal('m30', 'r7', 'Cheese pizza', 'Pizza au fromage', 'بيتزا بالجبن', 3500, IMG('food_salam'), false),
];

export const PDF_BOOKS: PdfBook[] = [
  { id: 'b1', title: { en: 'Practical Guide to Online Commerce', fr: 'Guide pratique du commerce en ligne', ar: 'دليل التجارة الإلكترونية' }, author: 'A. Mahamat', language: 'fr', pages: 64, sizeMB: '4 Mo', price: 2500, cover: IMG('book_comm'), storeId: 'seller13', storeName: 'Éditions Chari', category: 'commerce', rating: 4.6, reviews: 18, previewPages: 5 },
  { id: 'b2', title: { en: 'Everyday Recipes', fr: 'Recettes du quotidien', ar: 'وصفات يومية' }, author: 'F. Abdoulaye', language: 'fr', pages: 120, sizeMB: '7 Mo', price: 1500, cover: IMG('book_cuisine'), storeId: 'seller13', storeName: 'Cuisine & Livres', category: 'cuisine', rating: 4.8, reviews: 12, previewPages: 4 },
  { id: 'b3', title: { en: 'Ace Your Exams', fr: 'Réussir ses révisions', ar: 'النجاح في المراجعات' }, author: 'M. Tahir', language: 'fr', pages: 96, sizeMB: '5 Mo', price: 2000, cover: IMG('book_etudes'), storeId: 'seller20', storeName: 'Savoir Sahel', category: 'etudes', rating: 4.4, reviews: 9, previewPages: 3 },
  { id: 'b4', title: { en: 'Manage Your Budget', fr: 'Gérer son budget', ar: 'إدارة ميزانيتك' }, author: 'H. Souleymane', language: 'fr', pages: 48, sizeMB: '3 Mo', price: 1000, cover: IMG('book_budget'), storeId: 'seller13', storeName: 'Éditions Chari', category: 'budget', rating: 4.5, reviews: 16, previewPages: 4 },
  { id: 'b5', title: { en: 'Start Your Business in Africa', fr: 'Réussir son business en Afrique', ar: 'النجاح في التجارة الأفريقية' }, author: 'A. Mahamat', language: 'fr', pages: 88, sizeMB: '6 Mo', price: 3000, cover: IMG('book_biz'), storeId: 'seller13', storeName: 'Éditions Chari', category: 'commerce', rating: 4.7, reviews: 21, previewPages: 5 },
  { id: 'b6', title: { en: 'Home Cooking Manual', fr: 'Manuel de cuisine maison', ar: 'دليل الطبخ المنزلي' }, author: 'F. Abdoulaye', language: 'fr', pages: 140, sizeMB: '9 Mo', price: 1800, cover: IMG('book_recettes2'), storeId: 'seller20', storeName: 'Savoir Sahel', category: 'cuisine', rating: 4.5, reviews: 14, previewPages: 3 },
  { id: 'b7', title: { en: 'Learn to Code', fr: 'Apprendre à coder', ar: 'تعلم البرمجة' }, author: 'D. Kodbaye', language: 'en', pages: 150, sizeMB: '8 Mo', price: 3500, cover: IMG('book_coding'), storeId: 'seller20', storeName: 'Savoir Sahel', category: 'etudes', rating: 4.6, reviews: 11, previewPages: 4 },
  { id: 'b8', title: { en: 'Wellness Basics', fr: 'Bases du bien-être', ar: 'أساسيات العناية بالصحة' }, author: 'N. Achta', language: 'fr', pages: 60, sizeMB: '4 Mo', price: 1200, cover: IMG('book_sante'), storeId: 'seller13', storeName: 'Éditions Chari', category: 'budget', rating: 4.3, reviews: 8, previewPages: 3 },
  { id: 'b9', title: { en: 'Kids Stories 1', fr: 'Histoires pour enfants', ar: 'قصص للأطفال' }, author: 'F. Abdoulaye', language: 'fr', pages: 70, sizeMB: '5 Mo', price: 900, cover: IMG('book_kids'), storeId: 'seller20', storeName: 'Savoir Sahel', category: 'etudes', rating: 4.7, reviews: 19, previewPages: 3 },
  { id: 'b10', title: { en: 'Family Accounting', fr: 'Comptabilité familiale', ar: 'محاسبة الأسرة' }, author: 'H. Souleymane', language: 'fr', pages: 66, sizeMB: '3 Mo', price: 1400, cover: IMG('book_budget'), storeId: 'seller13', storeName: 'Éditions Chari', category: 'budget', rating: 4.4, reviews: 10, previewPages: 4 },
  { id: 'b11', title: { en: 'Street Food 50', fr: 'Street Food 50', ar: 'أكل الشارع 50' }, author: 'F. Abdoulaye', language: 'fr', pages: 110, sizeMB: '6 Mo', price: 1600, cover: IMG('book_cuisine'), storeId: 'seller20', storeName: 'Savoir Sahel', category: 'cuisine', rating: 4.6, reviews: 17, previewPages: 5 },
  { id: 'b12', title: { en: 'Marketing Made Easy', fr: 'Marketing facile', ar: 'التسويق ببساطة' }, author: 'A. Mahamat', language: 'fr', pages: 84, sizeMB: '5 Mo', price: 2200, cover: IMG('book_comm'), storeId: 'seller13', storeName: 'Éditions Chari', category: 'commerce', rating: 4.5, reviews: 13, previewPages: 4 },
  { id: 'b13', title: { en: 'Math for Kids', fr: 'Maths pour enfants', ar: 'رياضيات للأطفال' }, author: 'M. Tahir', language: 'fr', pages: 90, sizeMB: '4 Mo', price: 1100, cover: IMG('book_kids'), storeId: 'seller20', storeName: 'Savoir Sahel', category: 'etudes', rating: 4.4, reviews: 7, previewPages: 3 },
  { id: 'b14', title: { en: 'Digital Entrepreneur', fr: 'Entrepreneur digital', ar: 'رائد أعمال رقمي' }, author: 'D. Kodbaye', language: 'en', pages: 120, sizeMB: '7 Mo', price: 3200, cover: IMG('book_biz'), storeId: 'seller13', storeName: 'Éditions Chari', category: 'commerce', rating: 4.8, reviews: 25, previewPages: 5 },
  { id: 'b15', title: { en: 'Time Management', fr: 'Gestion du temps', ar: 'إدارة الوقت' }, author: 'N. Achta', language: 'fr', pages: 52, sizeMB: '3 Mo', price: 1100, cover: IMG('book_etudes'), storeId: 'seller20', storeName: 'Savoir Sahel', category: 'etudes', rating: 4.5, reviews: 12, previewPages: 3 },
  { id: 'b16', title: { en: 'Healthy Cooking', fr: 'Cuisine santé', ar: 'الطبخ الصحي' }, author: 'F. Abdoulaye', language: 'fr', pages: 100, sizeMB: '8 Mo', price: 1900, cover: IMG('book_cuisine'), storeId: 'seller20', storeName: 'Savoir Sahel', category: 'cuisine', rating: 4.6, reviews: 15, previewPages: 4 },
  { id: 'b17', title: { en: 'Local Economy', fr: 'Économie locale', ar: 'الاقتصاد المحلي' }, author: 'H. Souleymane', language: 'fr', pages: 92, sizeMB: '6 Mo', price: 2400, cover: IMG('book_budget'), storeId: 'seller13', storeName: 'Éditions Chari', category: 'commerce', rating: 4.2, reviews: 6, previewPages: 3 },
  { id: 'b18', title: { en: 'Photography for All', fr: 'Photographie pour tous', ar: 'التصوير للجميع' }, author: 'D. Kodbaye', language: 'fr', pages: 80, sizeMB: '9 Mo', price: 2600, cover: IMG('book_hist'), storeId: 'seller20', storeName: 'Savoir Sahel', category: 'etudes', rating: 4.3, reviews: 9, previewPages: 4 },
  { id: 'b19', title: { en: 'Baking at Home', fr: 'Pâtisserie maison', ar: 'الحلويات المنزلية' }, author: 'F. Abdoulaye', language: 'fr', pages: 104, sizeMB: '7 Mo', price: 1700, cover: IMG('book_recettes2'), storeId: 'seller13', storeName: 'Éditions Chari', category: 'cuisine', rating: 4.7, reviews: 20, previewPages: 5 },
  { id: 'b20', title: { en: 'Money Habits', fr: 'Habitudes d argent', ar: 'عادات المال' }, author: 'H. Souleymane', language: 'fr', pages: 58, sizeMB: '3 Mo', price: 1300, cover: IMG('book_budget'), storeId: 'seller20', storeName: 'Savoir Sahel', category: 'budget', rating: 4.4, reviews: 11, previewPages: 3 },
  { id: 'b21', title: { en: 'First Job Guide', fr: 'Guide premier emploi', ar: 'دليل الوظيفة الأولى' }, author: 'N. Achta', language: 'fr', pages: 72, sizeMB: '4 Mo', price: 1500, cover: IMG('book_biz'), storeId: 'seller13', storeName: 'Éditions Chari', category: 'commerce', rating: 4.5, reviews: 14, previewPages: 4 },
  { id: 'b22', title: { en: 'Nature Travel', fr: 'Voyage nature', ar: 'رحلة الطبيعة' }, author: 'D. Kodbaye', language: 'fr', pages: 96, sizeMB: '10 Mo', price: 2000, cover: IMG('book_hist'), storeId: 'seller20', storeName: 'Savoir Sahel', category: 'etudes', rating: 4.2, reviews: 5, previewPages: 3 },
  { id: 'b23', title: { en: 'SCHOOL Methods', fr: 'Méthodes scolaires', ar: 'مناهج مدرسية' }, author: 'M. Tahir', language: 'fr', pages: 112, sizeMB: '6 Mo', price: 2100, cover: IMG('book_etudes'), storeId: 'seller20', storeName: 'Savoir Sahel', category: 'etudes', rating: 4.6, reviews: 16, previewPages: 4 },
  { id: 'b24', title: { en: 'Nutrition Basics', fr: 'Bases de la nutrition', ar: 'أساسيات التغذية' }, author: 'N. Achta', language: 'fr', pages: 64, sizeMB: '5 Mo', price: 1250, cover: IMG('book_sante'), storeId: 'seller13', storeName: 'Éditions Chari', category: 'budget', rating: 4.3, reviews: 8, previewPages: 3 },
];

export const PRINT_WORKSHOPS: PrintWorkshop[] = [
  { id: 'w1', name: { en: 'Atelier Chari', fr: 'Atelier Chari', ar: 'ورشة الشاري' }, city: "N'Djamena", rating: 4.7, reviews: 21, productIds: ['p1', 'p3', 'p5'] },
  { id: 'w2', name: { en: 'Print Moundou', fr: 'Print Moundou', ar: 'طباعة منداو' }, city: 'Moundou', rating: 4.5, reviews: 14, productIds: ['p2', 'p6'] },
  { id: 'w3', name: { en: 'Sahel Impression', fr: 'Sahel Impression', ar: 'ساحل للطباعة' }, city: 'Abéché', rating: 4.6, reviews: 10, productIds: ['p4', 'p7'] },
];

export const PRINT_ITEMS: PrintItem[] = [
  { id: 'p1', category: 'tshirts', name: { en: 'Custom T-shirt', fr: 'T-shirt personnalisé', ar: 'تيشيرت مخصص' }, basePrice: 5000, image: IMG('print_tshirt'), workshopId: 'w1', etaHours: 48, options: { sizes: ['S','M','L','XL'], colors: ['white','black','blue','red'], quantityStep: 1 } },
  { id: 'p2', category: 'mugs', name: { en: 'Custom Mug', fr: 'Mug personnalisé', ar: 'كوب مخصص' }, basePrice: 3000, image: IMG('print_mug'), workshopId: 'w2', etaHours: 48, options: { colors: ['white'], quantityStep: 1 } },
  { id: 'p3', category: 'cards', name: { en: 'Business Cards (100)', fr: 'Cartes de visite (100)', ar: 'بطاقات (100)' }, basePrice: 4000, image: IMG('print_cards'), workshopId: 'w1', etaHours: 72, options: { quantityStep: 1 } },
  { id: 'p4', category: 'booklets', name: { en: 'Custom Booklet A5', fr: 'Livret personnalisé A5', ar: 'كتيب مخصص A5' }, basePrice: 2500, image: IMG('print_booklet'), workshopId: 'w3', etaHours: 48, options: { quantityStep: 10, cover: true } },
  { id: 'p5', category: 'tshirts', name: { en: 'Team T-shirt', fr: 'T-shirt équipe', ar: 'تيشيرت فريق' }, basePrice: 5500, image: IMG('print_tshirt2'), workshopId: 'w1', etaHours: 48, options: { sizes: ['S','M','L','XL'], colors: ['white','blue'], quantityStep: 5 } },
  { id: 'p6', category: 'mugs', name: { en: 'Magic Mug', fr: 'Mug magique', ar: 'كوب سحري' }, basePrice: 4500, image: IMG('print_mug2'), workshopId: 'w2', etaHours: 72, options: { colors: ['white/black'], quantityStep: 1 } },
  { id: 'p7', category: 'documents', name: { en: 'Documents Printing (A4)', fr: 'Impression documents (A4)', ar: 'طباعة مستندات A4' }, basePrice: 100, image: IMG('print_docs'), workshopId: 'w3', etaHours: 12, options: { docPages: true, quantityStep: 10 } },
  { id: 'p8', category: 'booklets', name: { en: 'Event Banner', fr: 'Bannière événement', ar: 'لافتة حدث' }, basePrice: 12000, image: IMG('print_banner'), workshopId: 'w1', etaHours: 72, options: { quantityStep: 1 } },
];

// Counts derived from real arrays (never hardcode):
export const servicesCounts = {
  restaurants: RESTAURANTS.length,
  pdf_books: PDF_BOOKS.length,
  print_pod: PRINT_ITEMS.length,
};
SERVICE_CATEGORIES.forEach(c => { c.count = (servicesCounts as any)[c.id] || 0; });
