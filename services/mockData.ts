export interface Category {
  id: string;
  parentId?: string;
  hasChildren?: boolean;
  name: { en: string; fr: string; ar: string };
  icon: string;
  color: string;
  image?: any; // require() image asset
}

export interface PaymentMethod {
  id: string;
  name: string;
  logo: string;
  color: string;
  instructions?: string;
  isActive?: boolean;
  // Country codes this method is available in. Empty/undefined = all countries.
  countries?: string[];
}

export interface Seller {
  id: string;
  name: string;
  avatar: string;
  storeBg?: string;
  sellerId: string;
  isVerified: boolean;
  verifiedUntil?: string;
  isBanned: boolean;
  bannedUntil?: string;
  location: string;
  rating: number;
  totalSales: number;
  joinedDate: string;
  phone: string;
  isOnline: boolean;
  lastSeen?: string;
  followersCount?: number;
  paymentMethods: { methodId: string; receivingNumber: string }[];
}

export interface Product {
  id: string;
  title: { en: string; fr: string; ar: string };
  description: { en: string; fr: string; ar: string };
  price: number;
  images: string[];
  categoryId: string;
  sellerId: string;
  condition: 'new' | 'used' | 'like_new';
  location: string;
  postedDate: string;
  isPinned: boolean;
  pinnedUntil?: string;
  isFeatured: boolean;
  views: number;
  discountPercent?: number;
  discountUntil?: string;
  stock?: number;
  maxOrderQty?: number;
  // Optional fields populated by the PHP API (not in mock data).
  sellerName?: string;
  sellerAvatar?: string;
  sellerVerified?: boolean;
  // Feed-card optional fields (conditional rendering; null/undefined = hidden)
  soldCount?: number;
  rating?: number;
  reviewsCount?: number;
  tagLabel?: string;
  freeShipping?: boolean;
  warrantyDays?: number; // return-guarantee window (seller-editable)
  deliveryType?: 'free' | 'paid';
  deliveryFee?: number;
}

export interface Review {
  id: string;
  orderId: string;
  productId: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  rating: number;
  text: string;
  photoUri?: string;
  createdAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  translatedText?: { en?: string; fr?: string; ar?: string };
  type: 'text' | 'system';
  timestamp: string;
}

export interface Conversation {
  id: string;
  buyerId: string;
  sellerId: string;
  sellerName?: string;
  productId: string;
  messages: Message[];
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

export interface Order {
  id: string;
  orderNumber?: string;
  productId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  paymentMethodId: string;
  referenceId: string;
  status: 'pending' | 'confirmed' | 'disputed' | 'cancelled' | 'delivered' | 'completed';
  createdAt: string;
  buyerPhone: string;
  deliveredAt?: string;
  completedAt?: string;
  transaction_number?: string;
  created_at?: string;
  // Joined/snapshot fields (from API or saved at order creation)
  product_title_snapshot?: string | null;
  product_image_snapshot?: string | null;
  product_price_snapshot?: number | null;
  seller_name_snapshot?: string | null;
  store_name_snapshot?: string | null;
  product_title_en?: string;
  product_title_fr?: string;
  product_title_ar?: string;
  product_image?: string;
  seller_name?: string;
}

export const categories: Category[] = [
  { id: 'all', name: { en: 'All', fr: 'Tout', ar: 'الكل' }, icon: 'apps', color: '#6366F1' },
  { id: 'electronics', name: { en: 'Electronics', fr: 'Électronique', ar: 'إلكترونيات' }, icon: 'devices', color: '#3B82F6', image: require('@/assets/images/categories/electronics.png') },
  { id: 'fashion', name: { en: 'Clothing', fr: 'Vêtements', ar: 'ملابس' }, icon: 'checkroom', color: '#EC4899', image: require('@/assets/images/categories/fashion.png') },
  { id: 'shoes', name: { en: 'Shoes', fr: 'Chaussures', ar: 'أحذية' }, icon: 'hiking', color: '#F59E0B', image: require('@/assets/images/categories/shoes.png') },
];

export const paymentMethods: PaymentMethod[] = [
  { id: 'airtel', name: 'Airtel Money', logo: '', color: '#E4002B', instructions: 'Dial *222# > Send Money > Enter number > Enter amount > Confirm with PIN', isActive: true, countries: ['TD'] },
  { id: 'moov', name: 'Moov Money', logo: '', color: '#0066CC', instructions: 'Dial *155# > Transfer > Enter number > Enter amount > Confirm with PIN', isActive: true, countries: ['TD'] },
  { id: 'cod', name: 'Cash on Delivery', logo: '', color: '#059669', instructions: 'Pay cash directly to the seller upon receiving the item at the agreed location.', isActive: true },
];

export const sellers: Seller[] = [
  {
    id: 'seller1', name: 'Moussa Electronics', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=75&fm=jpg', storeBg: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800&q=75&fm=jpg',
    sellerId: 'Sok-84729', isVerified: true, verifiedUntil: '2027-06-15', isBanned: false, location: "N'Djamena", rating: 4.8, totalSales: 156,
    joinedDate: '2023-03-15', phone: '+235 66 XX XX XX', isOnline: true, followersCount: 234,
    paymentMethods: [{ methodId: 'airtel', receivingNumber: '66 12 34 56' }, { methodId: 'moov', receivingNumber: '99 78 90 12' }],
  },
  {
    id: 'seller2', name: 'Fatima Fashion', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&q=75&fm=jpg', storeBg: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=75&fm=jpg',
    sellerId: 'Sok-31056', isVerified: true, verifiedUntil: '2025-09-20', isBanned: false, location: 'Moundou', rating: 4.9, totalSales: 89,
    joinedDate: '2023-06-20', phone: '+235 99 XX XX XX', isOnline: false, lastSeen: '2026-02-26T08:30:00Z', followersCount: 189,
    paymentMethods: [{ methodId: 'airtel', receivingNumber: '66 98 76 54' }],
  },
  {
    id: 'seller3', name: 'Ibrahim Motors', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=800&q=75&fm=jpg', storeBg: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800&q=75&fm=jpg',
    sellerId: 'Sok-67283', isVerified: false, isBanned: false, location: "N'Djamena", rating: 4.5, totalSales: 34,
    joinedDate: '2024-01-10', phone: '+235 68 XX XX XX', isOnline: true, followersCount: 67,
    paymentMethods: [{ methodId: 'airtel', receivingNumber: '68 11 22 33' }, { methodId: 'cod', receivingNumber: 'N/A' }],
  },
  {
    id: 'seller4', name: 'Aisha Home & Decor', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=800&q=75&fm=jpg', storeBg: 'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=800&q=75&fm=jpg',
    sellerId: 'Sok-45901', isVerified: false, isBanned: false, location: 'Abéché', rating: 4.6, totalSales: 67,
    joinedDate: '2023-09-05', phone: '+235 90 XX XX XX', isOnline: false, lastSeen: '2026-02-25T18:00:00Z', followersCount: 112,
    paymentMethods: [{ methodId: 'moov', receivingNumber: '90 44 55 66' }],
  },
  {
    id: 'seller5', name: 'Hassan Agri-Supply', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&q=75&fm=jpg', storeBg: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=75&fm=jpg',
    sellerId: 'Sok-12478', isVerified: true, verifiedUntil: '2025-11-01', isBanned: false, location: 'Sarh', rating: 4.7, totalSales: 45,
    joinedDate: '2023-11-01', phone: '+235 77 XX XX XX', isOnline: true, followersCount: 45,
    paymentMethods: [{ methodId: 'airtel', receivingNumber: '77 33 44 55' }, { methodId: 'moov', receivingNumber: '77 66 77 88' }],
  },
];

export const mockSellerStats: Record<string, any> = {
  seller1: { followers_count: 234, completed_orders: 156, success_rate: 92, failed_orders: 4, orders_last_30d: 23 },
  seller2: { followers_count: 189, completed_orders: 89, success_rate: 95, failed_orders: 2, orders_last_30d: 12 },
  seller3: { followers_count: 67, completed_orders: 34, success_rate: 88, failed_orders: 3, orders_last_30d: 5 },
  seller4: { followers_count: 112, completed_orders: 67, success_rate: 91, failed_orders: 5, orders_last_30d: 8 },
  seller5: { followers_count: 45, completed_orders: 45, success_rate: 100, failed_orders: 0, orders_last_30d: 3 },
};

export const products: Product[] = [
  {
    id: 'p1', title: { en: 'Samsung Galaxy A54', fr: 'Samsung Galaxy A54', ar: 'سامسونج جالاكسي A54' },
    soldCount: 214, rating: 4.7, reviewsCount: 31, freeShipping: true,
    description: { en: 'Brand new Samsung Galaxy A54 with 128GB storage, 6GB RAM. Sealed box with warranty.', fr: 'Samsung Galaxy A54 neuf avec 128Go de stockage, 6Go RAM. Boîte scellée avec garantie.', ar: 'سامسونج جالاكسي A54 جديد بسعة تخزين 128 جيجا، 6 جيجا رام. صندوق مغلق مع ضمان.' },
    price: 185000, images: ['https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800&q=75&fm=jpg'],
    categoryId: 'electronics', sellerId: 'seller1', condition: 'new', location: "N'Djamena",
    postedDate: '2024-12-15', isPinned: true, pinnedUntil: '2027-03-15', isFeatured: true, views: 342,
    discountPercent: 15, discountUntil: '2027-08-15', stock: 8, maxOrderQty: 5,
  },
  {
    id: 'p2', title: { en: 'iPhone 14 Pro Max', fr: 'iPhone 14 Pro Max', ar: 'آيفون 14 برو ماكس' },
    description: { en: 'iPhone 14 Pro Max 256GB Deep Purple. Excellent condition, barely used for 2 months.', fr: 'iPhone 14 Pro Max 256Go Violet Intense. Excellent état, à peine utilisé pendant 2 mois.', ar: 'آيفون 14 برو ماكس 256 جيجا بنفسجي عميق. حالة ممتازة، استخدم لمدة شهرين فقط.' },
    price: 650000, images: ['https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?w=800&q=75&fm=jpg'],
    categoryId: 'electronics', sellerId: 'seller1', condition: 'like_new', location: "N'Djamena",
    postedDate: '2024-12-10', isPinned: true, pinnedUntil: '2027-02-10', isFeatured: true, views: 518, stock: 1,
  },
  {
    id: 'p3', title: { en: 'Toyota Corolla 2019', fr: 'Toyota Corolla 2019', ar: 'تويوتا كورولا 2019' },
    description: { en: 'Toyota Corolla 2019 sedan, automatic, 45,000km. AC, power windows. Clean title.', fr: 'Toyota Corolla 2019 berline, automatique, 45 000km. Climatisation, vitres électriques.', ar: 'تويوتا كورولا 2019 سيدان، أوتوماتيك، 45,000 كم. تكييف، نوافذ كهربائية.' },
    price: 8500000, images: ['https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800&q=75&fm=jpg'],
    categoryId: 'shoes', sellerId: 'seller3', condition: 'used', location: "N'Djamena",
    postedDate: '2024-12-08', isPinned: false, isFeatured: false, views: 127, stock: 1,
  },
  {
    id: 'p4', title: { en: 'Adidas Ultraboost', fr: 'Adidas Ultraboost', ar: 'حذاء Adidas Ultraboost' },
    tagLabel: 'Choice', soldCount: 940, rating: 4.4, reviewsCount: 210, freeShipping: true,
    description: { en: 'Adidas Ultraboost running shoes, size 42. Comfortable and stylish.', fr: 'Chaussures de course Adidas Ultraboost, taille 42. Confortables et élégantes.', ar: 'حذاء Adidas Ultraboost للجري، مقاس 42. مريح وأنيق.' },
    price: 55000, images: ['https://images.unsplash.com/photo-1549298916-b41d501d3779?w=800&q=75&fm=jpg'],
    categoryId: 'shoes', sellerId: 'seller3', condition: 'used', location: "N'Djamena",
    postedDate: '2024-12-12', isPinned: false, isFeatured: false, views: 89,
  },
  {
    id: 'p5', title: { en: "Men's Traditional Boubou", fr: 'Boubou Traditionnel Homme', ar: 'بوبو رجالي تقليدي' },
    description: { en: 'Handcrafted traditional boubou with beautiful embroidery. Premium cotton fabric.', fr: 'Boubou traditionnel fait main avec de belles broderies. Tissu coton premium.', ar: 'بوبو تقليدي مصنوع يدوياً بتطريز جميل. قماش قطن فاخر.' },
    price: 25000, images: ['https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&q=75&fm=jpg'],
    categoryId: 'fashion', sellerId: 'seller2', condition: 'new', location: 'Moundou',
    postedDate: '2024-12-14', isPinned: false, isFeatured: true, views: 203, stock: 20, maxOrderQty: 10,
  },
  {
    id: 'p6', title: { en: 'Nike Air Max Sneakers', fr: 'Baskets Nike Air Max', ar: 'أحذية نايك اير ماكس' },
    soldCount: 320, rating: 4.6, reviewsCount: 58, freeShipping: true, warrantyDays: 7,
    description: { en: 'Original Nike Air Max, Size 42 EU. Brand new in box, multiple colors available.', fr: 'Nike Air Max original, Taille 42 EU. Neuf dans la boîte, plusieurs couleurs disponibles.', ar: 'نايك اير ماكس أصلي، مقاس 42 أوروبي. جديد في العلبة، عدة ألوان متاحة.' },
    price: 45000, images: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=75&fm=jpg'],
    categoryId: 'shoes', sellerId: 'seller2', condition: 'new', location: 'Moundou',
    postedDate: '2024-12-13', isPinned: true, pinnedUntil: '2027-01-13', isFeatured: false, views: 176,
    discountPercent: 25, discountUntil: '2027-08-10', stock: 15, maxOrderQty: 5,
  },
  {
    id: 'p7', title: { en: '3-Bedroom House', fr: 'Maison 3 Chambres', ar: 'منزل 3 غرف نوم' },
    description: { en: 'Spacious 3-bedroom house with garden in quiet neighborhood. Modern finishes, tiled floors.', fr: 'Maison spacieuse 3 chambres avec jardin dans quartier calme. Finitions modernes.', ar: 'منزل واسع 3 غرف نوم مع حديقة في حي هادئ. تشطيبات حديثة.' },
    price: 45000000, images: ['https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=75&fm=jpg'],
    categoryId: 'real_estate', sellerId: 'seller4', condition: 'used', location: "N'Djamena",
    postedDate: '2024-12-01', isPinned: false, isFeatured: false, views: 67, stock: 1,
  },
  {
    id: 'p8', title: { en: 'Studio Apartment for Rent', fr: 'Studio à Louer', ar: 'ستوديو للإيجار' },
    description: { en: 'Furnished studio apartment, close to city center. Water and electricity included. 75,000/month.', fr: 'Studio meublé, proche du centre-ville. Eau et électricité incluses. 75 000/mois.', ar: 'شقة ستوديو مفروشة، قريبة من وسط المدينة. ماء وكهرباء مشمولة.' },
    price: 75000, images: ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=75&fm=jpg'],
    categoryId: 'real_estate', sellerId: 'seller4', condition: 'used', location: 'Abéché',
    postedDate: '2024-12-05', isPinned: false, isFeatured: false, views: 54,
  },
  {
    id: 'p9', title: { en: 'Solar Panel Kit 300W', fr: 'Kit Panneau Solaire 300W', ar: 'طقم ألواح شمسية 300 واط' },
    description: { en: 'Complete solar panel kit: 300W panel, charge controller, inverter, and battery. Perfect for home use.', fr: 'Kit panneau solaire complet: panneau 300W, régulateur de charge, onduleur et batterie.', ar: 'طقم ألواح شمسية كامل: لوح 300 واط، منظم شحن، عاكس، وبطارية.' },
    price: 150000, images: ['https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800&q=75&fm=jpg'],
    categoryId: 'home_garden', sellerId: 'seller4', condition: 'new', location: 'Abéché',
    postedDate: '2024-12-11', isPinned: false, isFeatured: true, views: 145,
    discountPercent: 10, discountUntil: '2027-08-05', stock: 5, maxOrderQty: 3,
  },
  {
    id: 'p10', title: { en: 'Leather Sofa Set (3+2)', fr: 'Ensemble Canapé Cuir (3+2)', ar: 'طقم كنب جلد (3+2)' },
    description: { en: 'Premium leather sofa set, 3-seater and 2-seater. Brown color, excellent condition.', fr: 'Ensemble canapé cuir premium, 3 et 2 places. Couleur marron, excellent état.', ar: 'طقم كنب جلد فاخر، 3 مقاعد و 2 مقاعد. لون بني، حالة ممتازة.' },
    price: 280000, images: ['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=75&fm=jpg'],
    categoryId: 'home_garden', sellerId: 'seller4', condition: 'like_new', location: 'Abéché',
    postedDate: '2024-12-09', isPinned: false, isFeatured: false, views: 98,
  },
  {
    id: 'p11', title: { en: 'Tractor Spare Parts', fr: 'Pièces Détachées Tracteur', ar: 'قطع غيار جرار' },
    description: { en: 'Various tractor spare parts: filters, belts, bearings. Compatible with major brands.', fr: 'Diverses pièces détachées pour tracteur: filtres, courroies, roulements.', ar: 'قطع غيار متنوعة للجرار: فلاتر، أحزمة، محامل.' },
    price: 120000, images: ['https://images.unsplash.com/photo-1586771107445-b3e7eb3f3a12?w=800&q=75&fm=jpg'],
    categoryId: 'agriculture', sellerId: 'seller5', condition: 'new', location: 'Sarh',
    postedDate: '2024-12-07', isPinned: false, isFeatured: false, views: 32, stock: 50, maxOrderQty: 20,
  },
  {
    id: 'p12', title: { en: 'Water Irrigation Pump', fr: "Pompe d'Irrigation", ar: 'مضخة ري مياه' },
    description: { en: 'Diesel-powered irrigation pump, 3-inch outlet. Ideal for farming and garden use.', fr: "Pompe d'irrigation diesel, sortie 3 pouces. Idéale pour l'agriculture.", ar: 'مضخة ري تعمل بالديزل، مخرج 3 بوصة. مثالية للزراعة.' },
    price: 95000, images: ['https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=75&fm=jpg'],
    categoryId: 'agriculture', sellerId: 'seller5', condition: 'new', location: 'Sarh',
    postedDate: '2024-12-06', isPinned: false, isFeatured: false, views: 28,
  },
  {
    id: 'p13', title: { en: 'JBL Bluetooth Speaker', fr: 'Enceinte Bluetooth JBL', ar: 'سماعة جي بي إل بلوتوث' },
    description: { en: 'JBL Charge 5, waterproof, 20-hour battery. Perfect for outdoor events.', fr: 'JBL Charge 5, étanche, batterie 20 heures. Parfait pour les événements.', ar: 'جي بي إل تشارج 5، مقاوم للماء، بطارية 20 ساعة.' },
    price: 35000, images: ['https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800&q=75&fm=jpg'],
    categoryId: 'electronics', sellerId: 'seller1', condition: 'new', location: "N'Djamena",
    postedDate: '2024-12-14', isPinned: false, isFeatured: false, views: 67,
  },
  {
    id: 'p14', title: { en: 'HP Laptop 15.6"', fr: 'Ordinateur Portable HP 15.6"', ar: 'لابتوب HP 15.6 بوصة' },
    description: { en: 'HP Laptop 15, Intel Core i5, 8GB RAM, 256GB SSD. Great for work and studies.', fr: 'HP Laptop 15, Intel Core i5, 8Go RAM, 256Go SSD. Idéal pour le travail.', ar: 'لابتوب HP 15، إنتل كور i5، 8 جيجا رام، 256 جيجا SSD.' },
    price: 320000, images: ['https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&q=75&fm=jpg'],
    categoryId: 'electronics', sellerId: 'seller1', condition: 'new', location: "N'Djamena",
    postedDate: '2024-12-13', isPinned: false, isFeatured: false, views: 91,
  },
  {
    id: 'p15', title: { en: 'Suzuki Alto 2020', fr: 'Suzuki Alto 2020', ar: 'سوزوكي ألتو 2020' },
    description: { en: 'Suzuki Alto 2020, manual, 28,000km. Economical city car, excellent fuel efficiency.', fr: 'Suzuki Alto 2020, manuelle, 28 000km. Voiture de ville économique.', ar: 'سوزوكي ألتو 2020، يدوي، 28,000 كم. سيارة مدينة اقتصادية.' },
    price: 4200000, images: ['https://images.unsplash.com/photo-1549317661-bd32c8ce0afa?w=800&q=75&fm=jpg'],
    categoryId: 'vehicles', sellerId: 'seller3', condition: 'used', location: "N'Djamena",
    postedDate: '2024-12-04', isPinned: false, isFeatured: false, views: 43,
  },
  {
    id: 'p16', title: { en: "Women's Abaya Collection", fr: 'Collection Abayas Femme', ar: 'مجموعة عبايات نسائية' },
    description: { en: 'Elegant abayas in various designs. Premium fabric with delicate embroidery.', fr: 'Abayas élégantes en divers modèles. Tissu premium avec broderie délicate.', ar: 'عبايات أنيقة بتصاميم متنوعة. قماش فاخر بتطريز رقيق.' },
    price: 18000, images: ['https://images.unsplash.com/photo-1590736969955-71cc94901144?w=800&q=75&fm=jpg'],
    categoryId: 'fashion', sellerId: 'seller2', condition: 'new', location: 'Moundou',
    postedDate: '2024-12-11', isPinned: false, isFeatured: false, views: 112,
  },
  {
    id: 'p17', title: { en: 'Shop Space for Rent', fr: 'Local Commercial à Louer', ar: 'محل تجاري للإيجار' },
    description: { en: 'Prime location shop space in central market area. 40m, ground floor, high foot traffic.', fr: 'Local commercial bien situé au marché central. 40m, rez-de-chaussée.', ar: 'محل تجاري في موقع متميز في منطقة السوق المركزي. 40 متر مربع.' },
    price: 150000, images: ['https://images.unsplash.com/photo-1582037928769-181f2644ecb7?w=800&q=75&fm=jpg'],
    categoryId: 'real_estate', sellerId: 'seller4', condition: 'used', location: "N'Djamena",
    postedDate: '2024-12-03', isPinned: false, isFeatured: false, views: 38,
  },
  {
    id: 'p18', title: { en: 'Chest Freezer 300L', fr: 'Congélateur Coffre 300L', ar: 'فريزر أفقي 300 لتر' },
    description: { en: 'Large chest freezer, 300L capacity. Energy efficient, perfect for businesses.', fr: 'Grand congélateur coffre, 300L. Économe en énergie, idéal pour les commerces.', ar: 'فريزر أفقي كبير، سعة 300 لتر. موفر للطاقة، مثالي للأعمال.' },
    price: 195000, images: ['https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=800&q=75&fm=jpg'],
    categoryId: 'home_garden', sellerId: 'seller4', condition: 'new', location: 'Abéché',
    postedDate: '2024-12-10', isPinned: false, isFeatured: false, views: 55,
  },
  {
    id: 'p19', title: { en: 'Organic Seeds Pack', fr: 'Pack Graines Bio', ar: 'حزمة بذور عضوية' },
    description: { en: 'Assorted organic vegetable seeds: tomato, okra, pepper, lettuce. For home or commercial farming.', fr: 'Graines bio assorties: tomate, gombo, piment, laitue. Usage domestique ou commercial.', ar: 'بذور خضروات عضوية متنوعة: طماطم، بامية، فلفل، خس.' },
    price: 8500, images: ['https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=75&fm=jpg'],
    categoryId: 'agriculture', sellerId: 'seller5', condition: 'new', location: 'Sarh',
    postedDate: '2024-12-15', isPinned: false, isFeatured: false, views: 21, stock: 100, maxOrderQty: 50,
  },
  {
    id: 'p20', title: { en: 'Samsung Smart TV 55"', fr: 'Samsung Smart TV 55"', ar: 'تلفزيون سامسونج ذكي 55 بوصة' },
    description: { en: 'Samsung 55" 4K UHD Smart TV with built-in WiFi, Netflix, YouTube. Wall mount included.', fr: 'Samsung 55" 4K UHD Smart TV avec WiFi intégré. Support mural inclus.', ar: 'تلفزيون سامسونج 55 بوصة 4K ذكي مع واي فاي مدمج.' },
    price: 285000, images: ['https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800&q=75&fm=jpg'],
    categoryId: 'electronics', sellerId: 'seller1', condition: 'new', location: "N'Djamena",
    postedDate: '2024-12-12', isPinned: false, isFeatured: true, views: 234,
  },
  {
    id: 'p21', title: { en: 'Wedding Decoration Service', fr: 'Service Décoration Mariage', ar: 'خدمة تزيين حفلات الزفاف' },
    description: { en: 'Complete wedding decoration: venue setup, flowers, lighting, and table arrangements.', fr: 'Décoration mariage complète: installation, fleurs, éclairage et tables.', ar: 'تزيين حفلات زفاف كامل: تجهيز القاعة، زهور، إضاءة، وترتيب الطاولات.' },
    price: 350000, images: ['https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=75&fm=jpg'],
    categoryId: 'services', sellerId: 'seller2', condition: 'new', location: 'Moundou',
    postedDate: '2024-12-08', isPinned: false, isFeatured: false, views: 78,
  },
  {
    id: 'p22', title: { en: 'Generator 5KVA', fr: 'Groupe Électrogène 5KVA', ar: 'مولد كهربائي 5 كيلو فولت أمبير' },
    description: { en: 'Reliable 5KVA generator, diesel powered. Automatic voltage regulator. Perfect for homes and shops.', fr: 'Groupe électrogène fiable 5KVA, diesel. Régulateur de tension automatique.', ar: 'مولد كهربائي 5 كيلو فولت أمبير موثوق، يعمل بالديزل.' },
    price: 275000, images: ['https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=800&q=75&fm=jpg'],
    categoryId: 'home_garden', sellerId: 'seller1', condition: 'new', location: "N'Djamena",
    postedDate: '2024-12-14', isPinned: true, pinnedUntil: '2027-02-14', isFeatured: false, views: 110,
  },
];

export const mockReviews: Review[] = [
  {
    id: 'rev1', orderId: 'ord1', productId: 'p13', buyerId: 'user1', buyerName: 'Ahmed',
    sellerId: 'seller1', rating: 5, text: 'Excellent speaker! Great quality sound, exactly as described.',
    photoUri: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800&q=75&fm=jpg',
    createdAt: '2024-12-20T14:00:00Z',
  },
];

export const mockOrders: Order[] = [
  {
    id: 'ord1', orderNumber: '78234609153847261059', productId: 'p13', buyerId: 'user1', sellerId: 'seller1',
    amount: 35000, paymentMethodId: 'airtel', referenceId: 'AT-20241215-78432',
    status: 'completed', createdAt: '2024-12-15T11:00:00Z', buyerPhone: '66 88 99 00',
    deliveredAt: '2024-12-18T10:00:00Z', completedAt: '2024-12-19T12:00:00Z',
  },
  {
    id: 'ord2', orderNumber: '39184756203948571028', productId: 'p6', buyerId: 'user1', sellerId: 'seller2',
    amount: 45000, paymentMethodId: 'airtel', referenceId: '',
    status: 'pending', createdAt: '2024-12-16T09:00:00Z', buyerPhone: '66 88 99 00',
  },
];

export function getSellerById(id: string): Seller | undefined {
  return sellers.find(s => s.id === id);
}

export function getProductById(id: string): Product | undefined {
  return products.find(p => p.id === id);
}

export function getProductsBySeller(sellerId: string): Product[] {
  return products.filter(p => p.sellerId === sellerId);
}

export function getProductsByCategory(categoryId: string): Product[] {
  return products.filter(p => p.categoryId === categoryId);
}

export function getCategoryById(id: string): Category | undefined {
  return categories.find(c => c.id === id);
}

export function getPinnedProducts(): Product[] {
  return products.filter(p => p.isPinned);
}

export function getFeaturedProducts(): Product[] {
  return products.filter(p => p.isFeatured);
}
