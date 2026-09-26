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
  // Product variants (optional, seller-enabled per product)
  variants?: ProductVariant[];
  wholesale?: WholesaleDeal; // optional bulk pricing
}

export interface ProductVariant {
  id: string;
  specs: { label: { en: string; fr: string; ar: string }; value: string | { en: string; fr: string; ar: string } }[];
  image: string;       // real photo of THIS variant
  price: number;       // per-unit price for this variant
  stock: number;       // independent stock
}

// helper: localized spec value
export const specValue = (v: ProductVariant['specs'][number]['value'], lang: 'en' | 'fr' | 'ar'): string =>
  typeof v === 'string' ? v : (v[lang] || v.en);

export interface WholesaleDeal {
  minQty: number;      // wholesale threshold
  unitPrice: number;   // wholesale per-unit price
  unitLabel?: { en: string; fr: string; ar: string }; // selling unit e.g. "pièce/قطعة"
}

export interface Review {
  id: string;
  orderId: string;
  productId: string;
  buyerId: string;
  buyerName: string;
  buyerAvatar?: string;
  sellerId: string;
  rating: number;
  text: string;
  photoUri?: string;
  /** Reviewer-uploaded photos of the received product (up to 4) */
  photoUris?: string[];
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
  variantColor?: string;
  variantSpecs?: string;
}

import { CATEGORY_TREE, CATEGORY_IMAGE_BY_ID } from '@/services/categoryTree';

// ─── Pending variant selection (product -> checkout -> order) ───
// PEEK (read-only) for display; CLEAR only after order success (consume-on-mount loses selection on remount).
let pendingVariantSelection: { productId: string; variantId: string; specs: { label: string; value: string }[]; image: string; unitPrice: number; stock: number } | null = null;
export const setPendingVariantSelection = (sel: NonNullable<typeof pendingVariantSelection>) => { pendingVariantSelection = sel; };
export const peekPendingVariantSelection = (productId: string) =>
  pendingVariantSelection && pendingVariantSelection.productId === productId ? pendingVariantSelection : null;
export const clearPendingVariantSelection = () => { pendingVariantSelection = null; };

/** Flattened category list derived from the fixed-ID tree (sokchad-v1).
 *  'all' kept for existing logic; hasChildren computed from the tree. */
export const categories: Category[] = [
  { id: 'all', name: { en: 'All', fr: 'Tout', ar: 'الكل' }, icon: 'apps', color: '#6366F1' },
  ...CATEGORY_TREE.map(n => ({
    id: n.id,
    parentId: n.parentId,
    hasChildren: CATEGORY_TREE.some(x => x.parentId === n.id),
    name: { en: n.nameFr, fr: n.nameFr, ar: n.nameAr },
    icon: n.icon || 'category',
    color: n.color || '#6366F1',
    image: CATEGORY_IMAGE_BY_ID[n.id],
  })),
];

export const paymentMethods: PaymentMethod[] = [
  { id: 'airtel', name: 'Airtel Money', logo: '', color: '#E4002B', instructions: 'Dial *222# > Send Money > Enter number > Enter amount > Confirm with PIN', isActive: true, countries: ['TD'] },
  { id: 'moov', name: 'Moov Money', logo: '', color: '#0066CC', instructions: 'Dial *155# > Transfer > Enter number > Enter amount > Confirm with PIN', isActive: true, countries: ['TD'] },
  { id: 'cod', name: 'Cash on Delivery', logo: '', color: '#059669', instructions: 'Pay cash directly to the seller upon receiving the item at the agreed location.', isActive: true },
];

export const sellers: Seller[] = [
  {
    id: 'seller1', name: 'Moussa Electronics', avatar: 'https://souktchad.shop/dl/products/photo-1507003211169-0a1dd7228f2d.jpg', storeBg: 'https://souktchad.shop/dl/products/photo-1498049794561-7780e7231661.jpg',
    sellerId: 'Sok-84729', isVerified: true, verifiedUntil: '2025-06-15', isBanned: false, location: "N'Djamena", rating: 4.8, totalSales: 156,
    joinedDate: '2023-03-15', phone: '+235 66 XX XX XX', isOnline: true, followersCount: 234,
    paymentMethods: [{ methodId: 'airtel', receivingNumber: '66 12 34 56' }, { methodId: 'moov', receivingNumber: '99 78 90 12' }],
  },
  {
    id: 'seller2', name: 'Fatima Fashion', avatar: 'https://souktchad.shop/dl/products/photo-1494790108377-be9c29b29330.jpg', storeBg: 'https://souktchad.shop/dl/products/photo-1441986300917-64674bd600d8.jpg',
    sellerId: 'Sok-31056', isVerified: true, verifiedUntil: '2025-09-20', isBanned: false, location: 'Moundou', rating: 4.9, totalSales: 89,
    joinedDate: '2023-06-20', phone: '+235 99 XX XX XX', isOnline: false, lastSeen: '2026-02-26T08:30:00Z', followersCount: 189,
    paymentMethods: [{ methodId: 'airtel', receivingNumber: '66 98 76 54' }],
  },
  {
    id: 'seller3', name: 'Ibrahim Motors', avatar: 'https://souktchad.shop/dl/products/photo-1472099645785-5658abf4ff4e.jpg', storeBg: 'https://souktchad.shop/dl/products/photo-1568605117036-5fe5e7bab0b7.jpg',
    sellerId: 'Sok-67283', isVerified: false, isBanned: false, location: "N'Djamena", rating: 4.5, totalSales: 34,
    joinedDate: '2024-01-10', phone: '+235 68 XX XX XX', isOnline: true, followersCount: 67,
    paymentMethods: [{ methodId: 'airtel', receivingNumber: '68 11 22 33' }, { methodId: 'cod', receivingNumber: 'N/A' }],
  },
  {
    id: 'seller4', name: 'Aisha Home & Decor', avatar: 'https://souktchad.shop/dl/products/photo-1438761681033-6461ffad8d80.jpg', storeBg: 'https://souktchad.shop/dl/products/photo-1556228453-efd6c1ff04f6.jpg',
    sellerId: 'Sok-45901', isVerified: false, isBanned: false, location: 'Abéché', rating: 4.6, totalSales: 67,
    joinedDate: '2023-09-05', phone: '+235 90 XX XX XX', isOnline: false, lastSeen: '2026-02-25T18:00:00Z', followersCount: 112,
    paymentMethods: [{ methodId: 'moov', receivingNumber: '90 44 55 66' }],
  },
  {
    id: 'seller5', name: 'Hassan Agri-Supply', avatar: 'https://souktchad.shop/dl/products/photo-1500648767791-00dcc994a43e.jpg', storeBg: 'https://souktchad.shop/dl/products/photo-1500382017468-9049fed747ef.jpg',
    sellerId: 'Sok-12478', isVerified: true, verifiedUntil: '2025-11-01', isBanned: false, location: 'Sarh', rating: 4.7, totalSales: 45,
    joinedDate: '2023-11-01', phone: '+235 77 XX XX XX', isOnline: true, followersCount: 45,
    paymentMethods: [{ methodId: 'airtel', receivingNumber: '77 33 44 55' }, { methodId: 'moov', receivingNumber: '77 66 77 88' }],
  },
  {
    id: 'seller6', name: 'Tchad Mobile Center', avatar: 'https://souktchad.shop/dl/products/photo-1472099645785-5658abf4ff4e.jpg', storeBg: 'https://souktchad.shop/dl/products/photo-1498049794561-7780e7231661.jpg',
    sellerId: 'Sok-20541', isVerified: true, verifiedUntil: '2027-06-30', isBanned: false, location: "N'Djamena", rating: 4.9, totalSales: 428, joinedDate: '2022-08-12', phone: '+235 66 XX XX 14', isOnline: true, followersCount: 516,
    paymentMethods: [{ methodId: 'airtel', receivingNumber: '66 20 54 14' }, { methodId: 'moov', receivingNumber: '99 20 54 14' }],
  },
  {
    id: 'seller7', name: 'Boutique Al-Amana', avatar: 'https://souktchad.shop/dl/products/photo-1494790108377-be9c29b29330.jpg', storeBg: 'https://souktchad.shop/dl/products/photo-1441986300917-64674bd600d8.jpg',
    sellerId: 'Sok-73196', isVerified: true, verifiedUntil: '2027-03-15', isBanned: false, location: 'Abéché', rating: 4.8, totalSales: 276, joinedDate: '2022-11-03', phone: '+235 95 XX XX 31', isOnline: false, lastSeen: '2026-09-25T19:20:00Z', followersCount: 341,
    paymentMethods: [{ methodId: 'airtel', receivingNumber: '65 73 19 60' }, { methodId: 'cod', receivingNumber: 'N/A' }],
  },
  {
    id: 'seller8', name: 'Moundou Maison Moderne', avatar: 'https://souktchad.shop/dl/products/photo-1438761681033-6461ffad8d80.jpg', storeBg: 'https://souktchad.shop/dl/products/photo-1556228453-efd6c1ff04f6.jpg',
    sellerId: 'Sok-46820', isVerified: true, verifiedUntil: '2027-01-20', isBanned: false, location: 'Moundou', rating: 4.7, totalSales: 193, joinedDate: '2023-02-18', phone: '+235 99 XX XX 42', isOnline: true, followersCount: 228,
    paymentMethods: [{ methodId: 'moov', receivingNumber: '99 46 82 00' }],
  },
  {
    id: 'seller9', name: 'Épicerie du Logone', avatar: 'https://souktchad.shop/dl/products/photo-1507003211169-0a1dd7228f2d.jpg', storeBg: 'https://souktchad.shop/dl/products/photo-1416879595882-3373a0480b5b.jpg',
    sellerId: 'Sok-58314', isVerified: true, verifiedUntil: '2027-04-02', isBanned: false, location: 'Kelo', rating: 4.6, totalSales: 612, joinedDate: '2021-09-24', phone: '+235 68 XX XX 51', isOnline: true, followersCount: 184,
    paymentMethods: [{ methodId: 'airtel', receivingNumber: '68 58 31 40' }, { methodId: 'cod', receivingNumber: 'N/A' }],
  },
  {
    id: 'seller10', name: 'Sahel Auto Services', avatar: 'https://souktchad.shop/dl/products/photo-1472099645785-5658abf4ff4e.jpg', storeBg: 'https://souktchad.shop/dl/products/photo-1568605117036-5fe5e7bab0b7.jpg',
    sellerId: 'Sok-91427', isVerified: true, verifiedUntil: '2027-08-11', isBanned: false, location: "N'Djamena", rating: 4.8, totalSales: 147, joinedDate: '2022-05-09', phone: '+235 63 XX XX 72', isOnline: false, lastSeen: '2026-09-26T07:45:00Z', followersCount: 295,
    paymentMethods: [{ methodId: 'airtel', receivingNumber: '63 91 42 70' }, { methodId: 'moov', receivingNumber: '97 91 42 70' }],
  },
  {
    id: 'seller11', name: 'Doba Agro Équipement', avatar: 'https://souktchad.shop/dl/products/photo-1500648767791-00dcc994a43e.jpg', storeBg: 'https://souktchad.shop/dl/products/photo-1500382017468-9049fed747ef.jpg',
    sellerId: 'Sok-32685', isVerified: true, verifiedUntil: '2027-02-28', isBanned: false, location: 'Doba', rating: 4.7, totalSales: 221, joinedDate: '2022-10-14', phone: '+235 77 XX XX 63', isOnline: true, followersCount: 176,
    paymentMethods: [{ methodId: 'airtel', receivingNumber: '77 32 68 50' }, { methodId: 'cod', receivingNumber: 'N/A' }],
  },
  {
    id: 'seller12', name: 'Bongor Beauté', avatar: 'https://souktchad.shop/dl/products/photo-1494790108377-be9c29b29330.jpg', storeBg: 'https://souktchad.shop/dl/products/photo-1594633312681-425c7b97ccd1.jpg',
    sellerId: 'Sok-64019', isVerified: true, verifiedUntil: '2027-05-19', isBanned: false, location: 'Bongor', rating: 4.9, totalSales: 354, joinedDate: '2023-01-07', phone: '+235 90 XX XX 18', isOnline: true, followersCount: 463,
    paymentMethods: [{ methodId: 'moov', receivingNumber: '90 64 01 90' }],
  },
  {
    id: 'seller13', name: 'Sarh Bâtiment Plus', avatar: 'https://souktchad.shop/dl/products/photo-1507003211169-0a1dd7228f2d.jpg', storeBg: 'https://souktchad.shop/dl/products/photo-1581091226825-a6a2a5aee158.jpg',
    sellerId: 'Sok-15743', isVerified: true, verifiedUntil: '2027-07-08', isBanned: false, location: 'Sarh', rating: 4.6, totalSales: 189, joinedDate: '2022-12-16', phone: '+235 66 XX XX 85', isOnline: false, lastSeen: '2026-09-24T16:10:00Z', followersCount: 132,
    paymentMethods: [{ methodId: 'airtel', receivingNumber: '66 15 74 30' }, { methodId: 'cod', receivingNumber: 'N/A' }],
  },
  {
    id: 'seller14', name: 'Faya Froid & Solaire', avatar: 'https://souktchad.shop/dl/products/photo-1472099645785-5658abf4ff4e.jpg', storeBg: 'https://souktchad.shop/dl/products/photo-1509391366360-2e959784a276.jpg',
    sellerId: 'Sok-80264', isVerified: true, verifiedUntil: '2027-09-01', isBanned: false, location: 'Faya', rating: 4.8, totalSales: 118, joinedDate: '2023-04-21', phone: '+235 62 XX XX 06', isOnline: true, followersCount: 207,
    paymentMethods: [{ methodId: 'airtel', receivingNumber: '62 80 26 40' }, { methodId: 'moov', receivingNumber: '96 80 26 40' }],
  },
  {
    id: 'seller15', name: 'Mongo Sport', avatar: 'https://souktchad.shop/dl/products/photo-1507003211169-0a1dd7228f2d.jpg', storeBg: 'https://souktchad.shop/dl/products/photo-1600185365483-26d7a4cc7519.jpg',
    sellerId: 'Sok-47592', isVerified: false, isBanned: false, location: 'Mongo', rating: 4.5, totalSales: 83, joinedDate: '2024-02-11', phone: '+235 95 XX XX 29', isOnline: false, lastSeen: '2026-09-25T14:35:00Z', followersCount: 91,
    paymentMethods: [{ methodId: 'airtel', receivingNumber: '65 47 59 20' }],
  },
  {
    id: 'seller16', name: 'Les Petits du Chari', avatar: 'https://souktchad.shop/dl/products/photo-1494790108377-be9c29b29330.jpg', storeBg: 'https://souktchad.shop/dl/products/photo-1441986300917-64674bd600d8.jpg',
    sellerId: 'Sok-23976', isVerified: true, verifiedUntil: '2027-03-09', isBanned: false, location: "N'Djamena", rating: 4.7, totalSales: 265, joinedDate: '2023-05-27', phone: '+235 99 XX XX 37', isOnline: true, followersCount: 319,
    paymentMethods: [{ methodId: 'moov', receivingNumber: '99 23 97 60' }, { methodId: 'cod', receivingNumber: 'N/A' }],
  },
  {
    id: 'seller17', name: 'Oum Hadjer Immobilier', avatar: 'https://souktchad.shop/dl/products/photo-1472099645785-5658abf4ff4e.jpg', storeBg: 'https://souktchad.shop/dl/products/photo-1564013799919-ab600027ffc6.jpg',
    sellerId: 'Sok-68431', isVerified: true, verifiedUntil: '2027-06-12', isBanned: false, location: 'Oum Hadjer', rating: 4.6, totalSales: 42, joinedDate: '2022-07-30', phone: '+235 93 XX XX 41', isOnline: false, lastSeen: '2026-09-23T10:00:00Z', followersCount: 157,
    paymentMethods: [{ methodId: 'airtel', receivingNumber: '63 68 43 10' }],
  },
  {
    id: 'seller18', name: 'Atelier Couture Djamila', avatar: 'https://souktchad.shop/dl/products/photo-1494790108377-be9c29b29330.jpg', storeBg: 'https://souktchad.shop/dl/products/photo-1591047139829-d91aecb6caea.jpg',
    sellerId: 'Sok-51804', isVerified: false, isBanned: false, location: 'Moundou', rating: 4.4, totalSales: 97, joinedDate: '2024-03-08', phone: '+235 66 XX XX 80', isOnline: true, followersCount: 126,
    paymentMethods: [{ methodId: 'airtel', receivingNumber: '66 51 80 40' }],
  },
  {
    id: 'seller19', name: 'Techno Kelo', avatar: 'https://souktchad.shop/dl/products/photo-1507003211169-0a1dd7228f2d.jpg', storeBg: 'https://souktchad.shop/dl/products/photo-1498049794561-7780e7231661.jpg',
    sellerId: 'Sok-76028', isVerified: false, isBanned: false, location: 'Kelo', rating: 4.3, totalSales: 64, joinedDate: '2024-06-19', phone: '+235 68 XX XX 28', isOnline: true, followersCount: 73,
    paymentMethods: [{ methodId: 'airtel', receivingNumber: '68 76 02 80' }, { methodId: 'cod', receivingNumber: 'N/A' }],
  },
  {
    id: 'seller20', name: 'Garage Moderne d’Abéché', avatar: 'https://souktchad.shop/dl/products/photo-1507003211169-0a1dd7228f2d.jpg', storeBg: 'https://souktchad.shop/dl/products/photo-1568605117036-5fe5e7bab0b7.jpg',
    sellerId: 'Sok-39247', isVerified: true, verifiedUntil: '2027-04-25', isBanned: false, location: 'Abéché', rating: 4.7, totalSales: 132, joinedDate: '2023-07-04', phone: '+235 95 XX XX 47', isOnline: false, lastSeen: '2026-09-26T06:15:00Z', followersCount: 169,
    paymentMethods: [{ methodId: 'airtel', receivingNumber: '65 39 24 70' }, { methodId: 'moov', receivingNumber: '95 39 24 70' }],
  },
  {
    id: 'seller21', name: 'Saveurs du Moyen-Chari', avatar: 'https://souktchad.shop/dl/products/photo-1500648767791-00dcc994a43e.jpg', storeBg: 'https://souktchad.shop/dl/products/photo-1416879595882-3373a0480b5b.jpg',
    sellerId: 'Sok-84613', isVerified: false, isBanned: false, location: 'Sarh', rating: 4.5, totalSales: 305, joinedDate: '2023-10-22', phone: '+235 77 XX XX 13', isOnline: true, followersCount: 144,
    paymentMethods: [{ methodId: 'airtel', receivingNumber: '77 84 61 30' }, { methodId: 'cod', receivingNumber: 'N/A' }],
  },
  {
    id: 'seller22', name: 'Bongor Bureau & École', avatar: 'https://souktchad.shop/dl/products/photo-1472099645785-5658abf4ff4e.jpg', storeBg: 'https://souktchad.shop/dl/products/photo-1496181133206-80ce9b88a853.jpg',
    sellerId: 'Sok-12795', isVerified: false, isBanned: false, location: 'Bongor', rating: 4.2, totalSales: 76, joinedDate: '2024-01-26', phone: '+235 90 XX XX 95', isOnline: false, lastSeen: '2026-09-22T17:40:00Z', followersCount: 68,
    paymentMethods: [{ methodId: 'moov', receivingNumber: '90 12 79 50' }],
  },
  {
    id: 'seller23', name: 'Services Express Doba', avatar: 'https://souktchad.shop/dl/products/photo-1472099645785-5658abf4ff4e.jpg', storeBg: 'https://souktchad.shop/dl/products/photo-1621905252507-b35492cc74b4.jpg',
    sellerId: 'Sok-95360', isVerified: true, verifiedUntil: '2027-02-14', isBanned: false, location: 'Doba', rating: 4.6, totalSales: 154, joinedDate: '2023-06-13', phone: '+235 66 XX XX 60', isOnline: true, followersCount: 201,
    paymentMethods: [{ methodId: 'airtel', receivingNumber: '66 95 36 00' }, { methodId: 'cod', receivingNumber: 'N/A' }],
  },
  {
    id: 'seller24', name: 'Marché Vert de Mongo', avatar: 'https://souktchad.shop/dl/products/photo-1500648767791-00dcc994a43e.jpg', storeBg: 'https://souktchad.shop/dl/products/photo-1500382017468-9049fed747ef.jpg',
    sellerId: 'Sok-60482', isVerified: false, isBanned: false, location: 'Mongo', rating: 4.1, totalSales: 58, joinedDate: '2024-05-02', phone: '+235 63 XX XX 82', isOnline: true, followersCount: 51,
    paymentMethods: [{ methodId: 'airtel', receivingNumber: '63 60 48 20' }],
  },
  {
    id: 'seller25', name: 'Faya Artisanat & Déco', avatar: 'https://souktchad.shop/dl/products/photo-1494790108377-be9c29b29330.jpg', storeBg: 'https://souktchad.shop/dl/products/photo-1556228453-efd6c1ff04f6.jpg',
    sellerId: 'Sok-21867', isVerified: false, isBanned: false, location: 'Faya', rating: 4.0, totalSales: 31, joinedDate: '2024-08-17', phone: '+235 62 XX XX 67', isOnline: false, lastSeen: '2026-09-20T12:05:00Z', followersCount: 39,
    paymentMethods: [{ methodId: 'airtel', receivingNumber: '62 21 86 70' }, { methodId: 'cod', receivingNumber: 'N/A' }],
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
    price: 185000, images: ['https://souktchad.shop/dl/products/photo-1610945415295-d9bbf067e59c.jpg'],
    categoryId: 'electronics_phones', sellerId: 'seller1', condition: 'new', location: "N'Djamena",
    postedDate: '2024-12-15', isPinned: true, pinnedUntil: '2025-03-15', isFeatured: true, views: 342,
    discountPercent: 15, discountUntil: '2026-08-15', stock: 8, maxOrderQty: 5,
  },
  {
    id: 'p2', title: { en: 'iPhone 14 Pro Max', fr: 'iPhone 14 Pro Max', ar: 'آيفون 14 برو ماكس' },
    description: { en: 'iPhone 14 Pro Max 256GB Deep Purple. Excellent condition, barely used for 2 months.', fr: 'iPhone 14 Pro Max 256Go Violet Intense. Excellent état, à peine utilisé pendant 2 mois.', ar: 'آيفون 14 برو ماكس 256 جيجا بنفسجي عميق. حالة ممتازة، استخدم لمدة شهرين فقط.' },
    price: 650000, images: ['https://souktchad.shop/dl/products/photo-1678685888221-cda773a3dcdb.jpg'],
    categoryId: 'electronics_phones', sellerId: 'seller1', condition: 'like_new', location: "N'Djamena",
    postedDate: '2024-12-10', isPinned: true, pinnedUntil: '2025-02-10', isFeatured: true, views: 518, stock: 1,
  },
  {
    id: 'p3', title: { en: 'Toyota Corolla 2019', fr: 'Toyota Corolla 2019', ar: 'تويوتا كورولا 2019' },
    description: { en: 'Toyota Corolla 2019 sedan, automatic, 45,000km. AC, power windows. Clean title.', fr: 'Toyota Corolla 2019 berline, automatique, 45 000km. Climatisation, vitres électriques.', ar: 'تويوتا كورولا 2019 سيدان، أوتوماتيك، 45,000 كم. تكييف، نوافذ كهربائية.' },
    price: 8500000, images: ['https://souktchad.shop/dl/products/photo-1621007947382-bb3c3994e3fb.jpg'],
    categoryId: 'vehicles', sellerId: 'seller3', condition: 'used', location: "N'Djamena",
    postedDate: '2024-12-08', isPinned: false, isFeatured: false, views: 127, stock: 1,
  },
  {
    id: 'p4', title: { en: 'Adidas Ultraboost', fr: 'Adidas Ultraboost', ar: 'حذاء Adidas Ultraboost' },
    tagLabel: 'Choice', soldCount: 940, rating: 4.4, reviewsCount: 210, freeShipping: true,
    description: { en: 'Adidas Ultraboost running shoes, size 42. Comfortable and stylish.', fr: 'Chaussures de course Adidas Ultraboost, taille 42. Confortables et élégantes.', ar: 'حذاء Adidas Ultraboost للجري، مقاس 42. مريح وأنيق.' },
    price: 55000, images: ['https://souktchad.shop/dl/products/photo-1600185365483-26d7a4cc7519.jpg'],
    categoryId: 'shoes_men', sellerId: 'seller3', condition: 'used', location: "N'Djamena",
    postedDate: '2024-12-12', isPinned: false, isFeatured: false, views: 89,
  },
  {
    id: 'p5', title: { en: "Men's Traditional Boubou", fr: 'Boubou Traditionnel Homme', ar: 'بوبو رجالي تقليدي' },
    description: { en: 'Handcrafted traditional boubou with beautiful embroidery. Premium cotton fabric.', fr: 'Boubou traditionnel fait main avec de belles broderies. Tissu coton premium.', ar: 'بوبو تقليدي مصنوع يدوياً بتطريز جميل. قماش قطن فاخر.' },
    price: 25000, images: ['https://souktchad.shop/dl/products/photo-1591047139829-d91aecb6caea.jpg'],
    categoryId: 'fashion_traditional', sellerId: 'seller2', condition: 'new', location: 'Moundou',
    postedDate: '2024-12-14', isPinned: false, isFeatured: true, views: 203, stock: 20, maxOrderQty: 10,
  },
  {
    id: 'p6', title: { en: 'Nike Air Max Sneakers', fr: 'Baskets Nike Air Max', ar: 'أحذية نايك اير ماكس' },
    soldCount: 320, rating: 4.6, reviewsCount: 58, freeShipping: true, warrantyDays: 7,
    description: { en: 'Original Nike Air Max, Size 42 EU. Brand new in box, multiple colors available.', fr: 'Nike Air Max original, Taille 42 EU. Neuf dans la boîte, plusieurs couleurs disponibles.', ar: 'نايك اير ماكس أصلي، مقاس 42 أوروبي. جديد في العلبة، عدة ألوان متاحة.' },
    price: 45000, images: ['https://souktchad.shop/dl/products/photo-1542291026-7eec264c27ff.jpg'],
    categoryId: 'shoes_men', sellerId: 'seller2', condition: 'new', location: 'Moundou',
    postedDate: '2024-12-13', isPinned: true, pinnedUntil: '2025-01-13', isFeatured: false, views: 176,
    discountPercent: 25, discountUntil: '2026-08-10', stock: 15, maxOrderQty: 5,
    variants: [
      { id: 'p6v1', specs: [{ label: { en: 'Color', fr: 'Couleur', ar: 'اللون' }, value: { en: 'Rouge', fr: 'Rouge', ar: 'أحمر' } }, { label: { en: 'Size', fr: 'Taille', ar: 'المقاس' }, value: '41' }], image: 'https://souktchad.shop/dl/products/photo-1542291026-7eec264c27ff.jpg', price: 45000, stock: 5 },
      { id: 'p6v2', specs: [{ label: { en: 'Color', fr: 'Couleur', ar: 'اللون' }, value: { en: 'Pastel', fr: 'Pastel', ar: 'باستيل' } }, { label: { en: 'Size', fr: 'Taille', ar: 'المقاس' }, value: '41' }], image: 'https://souktchad.shop/dl/products/photo-1595950653106-6c9ebd614d3a.jpg', price: 47000, stock: 8 },
      { id: 'p6v3', specs: [{ label: { en: 'Color', fr: 'Couleur', ar: 'اللون' }, value: { en: 'Brown', fr: 'Marron', ar: 'بني' } }, { label: { en: 'Size', fr: 'Taille', ar: 'المقاس' }, value: '41' }], image: 'https://souktchad.shop/dl/products/photo-1549298916-b41d501d3772.jpg', price: 46000, stock: 3 },
      { id: 'p6v4', specs: [{ label: { en: 'Color', fr: 'Couleur', ar: 'اللون' }, value: { en: 'Multicolor', fr: 'Multicolore', ar: 'متعدد الألوان' } }, { label: { en: 'Size', fr: 'Taille', ar: 'المقاس' }, value: '41' }], image: 'https://souktchad.shop/dl/products/photo-1560769629-975ec94e6a86.jpg', price: 48000, stock: 6 },
    ],
    wholesale: { minQty: 5, unitPrice: 40000, unitLabel: { en: 'piece', fr: 'pièce', ar: 'قطعة' } },
  },
  {
    id: 'p7', title: { en: '3-Bedroom House', fr: 'Maison 3 Chambres', ar: 'منزل 3 غرف نوم' },
    description: { en: 'Spacious 3-bedroom house with garden in quiet neighborhood. Modern finishes, tiled floors.', fr: 'Maison spacieuse 3 chambres avec jardin dans quartier calme. Finitions modernes.', ar: 'منزل واسع 3 غرف نوم مع حديقة في حي هادئ. تشطيبات حديثة.' },
    price: 45000000, images: ['https://souktchad.shop/dl/products/photo-1564013799919-ab600027ffc6.jpg'],
    categoryId: 'real_estate', sellerId: 'seller4', condition: 'used', location: "N'Djamena",
    postedDate: '2024-12-01', isPinned: false, isFeatured: false, views: 67, stock: 1,
  },
  {
    id: 'p8', title: { en: 'Studio Apartment for Rent', fr: 'Studio à Louer', ar: 'ستوديو للإيجار' },
    description: { en: 'Furnished studio apartment, close to city center. Water and electricity included. 75,000/month.', fr: 'Studio meublé, proche du centre-ville. Eau et électricité incluses. 75 000/mois.', ar: 'شقة ستوديو مفروشة، قريبة من وسط المدينة. ماء وكهرباء مشمولة.' },
    price: 75000, images: ['https://souktchad.shop/dl/products/photo-1522708323590-d24dbb6b0267.jpg'],
    categoryId: 'real_estate', sellerId: 'seller4', condition: 'used', location: 'Abéché',
    postedDate: '2024-12-05', isPinned: false, isFeatured: false, views: 54,
  },
  {
    id: 'p9', title: { en: 'Solar Panel Kit 300W', fr: 'Kit Panneau Solaire 300W', ar: 'طقم ألواح شمسية 300 واط' },
    description: { en: 'Complete solar panel kit: 300W panel, charge controller, inverter, and battery. Perfect for home use.', fr: 'Kit panneau solaire complet: panneau 300W, régulateur de charge, onduleur et batterie.', ar: 'طقم ألواح شمسية كامل: لوح 300 واط، منظم شحن، عاكس، وبطارية.' },
    price: 150000, images: ['https://souktchad.shop/dl/products/photo-1509391366360-2e959784a276.jpg'],
    categoryId: 'energy_solar', sellerId: 'seller4', condition: 'new', location: 'Abéché',
    postedDate: '2024-12-11', isPinned: false, isFeatured: true, views: 145,
    discountPercent: 10, discountUntil: '2026-08-05', stock: 5, maxOrderQty: 3,
  },
  {
    id: 'p10', title: { en: 'Leather Sofa Set (3+2)', fr: 'Ensemble Canapé Cuir (3+2)', ar: 'طقم كنب جلد (3+2)' },
    description: { en: 'Premium leather sofa set, 3-seater and 2-seater. Brown color, excellent condition.', fr: 'Ensemble canapé cuir premium, 3 et 2 places. Couleur marron, excellent état.', ar: 'طقم كنب جلد فاخر، 3 مقاعد و 2 مقاعد. لون بني، حالة ممتازة.' },
    price: 280000, images: ['https://souktchad.shop/dl/products/photo-1555041469-a586c61ea9bc.jpg'],
    categoryId: 'furniture_salon', sellerId: 'seller4', condition: 'like_new', location: 'Abéché',
    postedDate: '2024-12-09', isPinned: false, isFeatured: false, views: 98,
  },
  {
    id: 'p11', title: { en: 'Tractor Spare Parts', fr: 'Pièces Détachées Tracteur', ar: 'قطع غيار جرار' },
    description: { en: 'Various tractor spare parts: filters, belts, bearings. Compatible with major brands.', fr: 'Diverses pièces détachées pour tracteur: filtres, courroies, roulements.', ar: 'قطع غيار متنوعة للجرار: فلاتر، أحزمة، محامل.' },
    price: 120000, images: ['https://souktchad.shop/dl/products/photo-1581091226825-a6a2a5aee158.jpg'],
    categoryId: 'agriculture_machinery', sellerId: 'seller5', condition: 'new', location: 'Sarh',
    postedDate: '2024-12-07', isPinned: false, isFeatured: false, views: 32, stock: 50, maxOrderQty: 20,
  },
  {
    id: 'p12', title: { en: 'Water Irrigation Pump', fr: "Pompe d'Irrigation", ar: 'مضخة ري مياه' },
    description: { en: 'Diesel-powered irrigation pump, 3-inch outlet. Ideal for farming and garden use.', fr: "Pompe d'irrigation diesel, sortie 3 pouces. Idéale pour l'agriculture.", ar: 'مضخة ري تعمل بالديزل، مخرج 3 بوصة. مثالية للزراعة.' },
    price: 95000, images: ['https://souktchad.shop/dl/products/photo-1416879595882-3373a0480b5b.jpg'],
    categoryId: 'agriculture_irrigation', sellerId: 'seller5', condition: 'new', location: 'Sarh',
    postedDate: '2024-12-06', isPinned: false, isFeatured: false, views: 28,
  },
  {
    id: 'p13', title: { en: 'JBL Bluetooth Speaker', fr: 'Enceinte Bluetooth JBL', ar: 'سماعة جي بي إل بلوتوث' },
    description: { en: 'JBL Charge 5, waterproof, 20-hour battery. Perfect for outdoor events.', fr: 'JBL Charge 5, étanche, batterie 20 heures. Parfait pour les événements.', ar: 'جي بي إل تشارج 5، مقاوم للماء، بطارية 20 ساعة.' },
    price: 35000, images: ['https://souktchad.shop/dl/products/photo-1608043152269-423dbba4e7e1.jpg'],
    categoryId: 'electronics_audio', sellerId: 'seller1', condition: 'new', location: "N'Djamena",
    postedDate: '2024-12-14', isPinned: false, isFeatured: false, views: 67,
  },
  {
    id: 'p14', title: { en: 'HP Laptop 15.6"', fr: 'Ordinateur Portable HP 15.6"', ar: 'لابتوب HP 15.6 بوصة' },
    description: { en: 'HP Laptop 15, Intel Core i5, 8GB RAM, 256GB SSD. Great for work and studies.', fr: 'HP Laptop 15, Intel Core i5, 8Go RAM, 256Go SSD. Idéal pour le travail.', ar: 'لابتوب HP 15، إنتل كور i5، 8 جيجا رام، 256 جيجا SSD.' },
    price: 320000, images: ['https://souktchad.shop/dl/products/photo-1496181133206-80ce9b88a853.jpg'],
    categoryId: 'electronics_computers_laptops', sellerId: 'seller1', condition: 'new', location: "N'Djamena",
    postedDate: '2024-12-13', isPinned: false, isFeatured: false, views: 91,
  },
  {
    id: 'p15', title: { en: 'Suzuki Alto 2020', fr: 'Suzuki Alto 2020', ar: 'سوزوكي ألتو 2020' },
    description: { en: 'Suzuki Alto 2020, manual, 28,000km. Economical city car, excellent fuel efficiency.', fr: 'Suzuki Alto 2020, manuelle, 28 000km. Voiture de ville économique.', ar: 'سوزوكي ألتو 2020، يدوي، 28,000 كم. سيارة مدينة اقتصادية.' },
    price: 4200000, images: ['https://souktchad.shop/dl/products/photo-1494976388531-d1058494cdd8.jpg'],
    categoryId: 'vehicles', sellerId: 'seller3', condition: 'used', location: "N'Djamena",
    postedDate: '2024-12-04', isPinned: false, isFeatured: false, views: 43,
  },
  {
    id: 'p16', title: { en: "Women's Abaya Collection", fr: 'Collection Abayas Femme', ar: 'مجموعة عبايات نسائية' },
    description: { en: 'Elegant abayas in various designs. Premium fabric with delicate embroidery.', fr: 'Abayas élégantes en divers modèles. Tissu premium avec broderie délicate.', ar: 'عبايات أنيقة بتصاميم متنوعة. قماش فاخر بتطريز رقيق.' },
    price: 18000, images: ['https://souktchad.shop/dl/products/photo-1594633312681-425c7b97ccd1.jpg'],
    categoryId: 'fashion_women', sellerId: 'seller2', condition: 'new', location: 'Moundou',
    postedDate: '2024-12-11', isPinned: false, isFeatured: false, views: 112,
  },
  {
    id: 'p17', title: { en: 'Shop Space for Rent', fr: 'Local Commercial à Louer', ar: 'محل تجاري للإيجار' },
    description: { en: 'Prime location shop space in central market area. 40m, ground floor, high foot traffic.', fr: 'Local commercial bien situé au marché central. 40m, rez-de-chaussée.', ar: 'محل تجاري في موقع متميز في منطقة السوق المركزي. 40 متر مربع.' },
    price: 150000, images: ['https://souktchad.shop/dl/products/photo-1582037928769-181f2644ecb7.jpg'],
    categoryId: 'real_estate', sellerId: 'seller4', condition: 'used', location: "N'Djamena",
    postedDate: '2024-12-03', isPinned: false, isFeatured: false, views: 38,
  },
  {
    id: 'p18', title: { en: 'Chest Freezer 300L', fr: 'Congélateur Coffre 300L', ar: 'فريزر أفقي 300 لتر' },
    description: { en: 'Large chest freezer, 300L capacity. Energy efficient, perfect for businesses.', fr: 'Grand congélateur coffre, 300L. Économe en énergie, idéal pour les commerces.', ar: 'فريزر أفقي كبير، سعة 300 لتر. موفر للطاقة، مثالي للأعمال.' },
    price: 195000, images: ['https://souktchad.shop/dl/products/photo-1584568694244-14fbdf83bd30.jpg'],
    categoryId: 'electromenager_froid', sellerId: 'seller4', condition: 'new', location: 'Abéché',
    postedDate: '2024-12-10', isPinned: false, isFeatured: false, views: 55,
  },
  {
    id: 'p19', title: { en: 'Organic Seeds Pack', fr: 'Pack Graines Bio', ar: 'حزمة بذور عضوية' },
    description: { en: 'Assorted organic vegetable seeds: tomato, okra, pepper, lettuce. For home or commercial farming.', fr: 'Graines bio assorties: tomate, gombo, piment, laitue. Usage domestique ou commercial.', ar: 'بذور خضروات عضوية متنوعة: طماطم، بامية، فلفل، خس.' },
    price: 8500, images: ['https://souktchad.shop/dl/products/photo-1416879595882-3373a0480b5b.jpg'],
    categoryId: 'agriculture_culture', sellerId: 'seller5', condition: 'new', location: 'Sarh',
    postedDate: '2024-12-15', isPinned: false, isFeatured: false, views: 21, stock: 100, maxOrderQty: 50,
  },
  {
    id: 'p20', title: { en: 'Samsung Smart TV 55"', fr: 'Samsung Smart TV 55"', ar: 'تلفزيون سامسونج ذكي 55 بوصة' },
    description: { en: 'Samsung 55" 4K UHD Smart TV with built-in WiFi, Netflix, YouTube. Wall mount included.', fr: 'Samsung 55" 4K UHD Smart TV avec WiFi intégré. Support mural inclus.', ar: 'تلفزيون سامسونج 55 بوصة 4K ذكي مع واي فاي مدمج.' },
    price: 285000, images: ['https://souktchad.shop/dl/products/photo-1593359677879-a4bb92f829d1.jpg'],
    categoryId: 'electronics_tv', sellerId: 'seller1', condition: 'new', location: "N'Djamena",
    postedDate: '2024-12-12', isPinned: false, isFeatured: true, views: 234,
  },
  {
    id: 'p21', title: { en: 'Wedding Decoration Service', fr: 'Service Décoration Mariage', ar: 'خدمة تزيين حفلات الزفاف' },
    description: { en: 'Complete wedding decoration: venue setup, flowers, lighting, and table arrangements.', fr: 'Décoration mariage complète: installation, fleurs, éclairage et tables.', ar: 'تزيين حفلات زفاف كامل: تجهيز القاعة، زهور، إضاءة، وترتيب الطاولات.' },
    price: 350000, images: ['https://souktchad.shop/dl/products/photo-1519741497674-611481863552.jpg'],
    categoryId: 'services', sellerId: 'seller2', condition: 'new', location: 'Moundou',
    postedDate: '2024-12-08', isPinned: false, isFeatured: false, views: 78,
  },
  {
    id: 'p22', title: { en: 'Generator 5KVA', fr: 'Groupe Électrogène 5KVA', ar: 'مولد كهربائي 5 كيلو فولت أمبير' },
    description: { en: 'Reliable 5KVA generator, diesel powered. Automatic voltage regulator. Perfect for homes and shops.', fr: 'Groupe électrogène fiable 5KVA, diesel. Régulateur de tension automatique.', ar: 'مولد كهربائي 5 كيلو فولت أمبير موثوق، يعمل بالديزل.' },
    price: 275000, images: ['https://souktchad.shop/dl/products/photo-1621905252507-b35492cc74b4.jpg'],
    categoryId: 'energy_backup', sellerId: 'seller1', condition: 'new', location: "N'Djamena",
    postedDate: '2024-12-14', isPinned: true, pinnedUntil: '2025-02-14', isFeatured: false, views: 110,
  },
  {
    id: 'p23', title: { en: 'Tecno Camon 30 256GB', fr: 'Tecno Camon 30 256 Go', ar: 'تكنو كامون 30 سعة 256 جيجابايت' },
    description: { en: 'New dual-SIM smartphone with 256GB storage, 8GB RAM, AMOLED display and fast charger included.', fr: 'Smartphone neuf double SIM avec 256 Go, 8 Go de RAM, écran AMOLED et chargeur rapide inclus.', ar: 'هاتف ذكي جديد بشريحتي اتصال وسعة 256 جيجابايت وذاكرة 8 جيجابايت وشاشة AMOLED مع شاحن سريع.' },
    price: 168000, images: ['https://souktchad.shop/dl/products/photo-1610945415295-d9bbf067e59c.jpg'], categoryId: 'electronics_phones', sellerId: 'seller6', condition: 'new', location: "N'Djamena",
    postedDate: '2026-09-18', isPinned: true, pinnedUntil: '2026-10-18', isFeatured: true, views: 486, stock: 24, maxOrderQty: 4, rating: 4.8, reviewsCount: 67, soldCount: 193, warrantyDays: 14,
  },
  {
    id: 'p24', title: { en: 'Embroidered Women’s Abaya', fr: 'Abaya femme brodée', ar: 'عباية نسائية مطرزة' },
    description: { en: 'Flowing premium crepe abaya with hand-finished embroidery, matching belt and sizes M to XXL.', fr: 'Abaya fluide en crêpe premium avec broderie soignée, ceinture assortie et tailles M à XXL.', ar: 'عباية انسيابية من الكريب الفاخر بتطريز متقن وحزام مطابق، متوفرة من مقاس M إلى XXL.' },
    price: 28500, images: ['https://souktchad.shop/dl/products/photo-1594633312681-425c7b97ccd1.jpg'], categoryId: 'fashion_women', sellerId: 'seller7', condition: 'new', location: 'Abéché',
    postedDate: '2026-09-17', isPinned: false, isFeatured: true, views: 238, stock: 36, maxOrderQty: 6, rating: 4.7, reviewsCount: 44, soldCount: 121,
  },
  {
    id: 'p25', title: { en: 'Solid Wood Dining Set for Six', fr: 'Salle à manger en bois pour six', ar: 'طقم سفرة خشبي لستة أشخاص' },
    description: { en: 'Locally finished solid-wood dining table with six padded chairs, protected varnish and delivery in Moundou.', fr: 'Table à manger en bois massif avec six chaises rembourrées, vernis protecteur et livraison à Moundou.', ar: 'طاولة طعام من الخشب الصلب مع ستة كراسٍ مبطنة وطلاء واقٍ، مع التوصيل داخل موندو.' },
    price: 395000, images: ['https://souktchad.shop/dl/products/photo-1555041469-a586c61ea9bc.jpg'], categoryId: 'furniture_dining', sellerId: 'seller8', condition: 'new', location: 'Moundou',
    postedDate: '2026-09-12', isPinned: false, isFeatured: true, views: 174, stock: 5, maxOrderQty: 1, rating: 4.6, reviewsCount: 19, soldCount: 34,
  },
  {
    id: 'p26', title: { en: 'Local Rice 25kg Bag', fr: 'Sac de riz local 25 kg', ar: 'كيس أرز محلي 25 كجم' },
    description: { en: 'Clean, sorted Chadian rice packed in a sealed 25kg bag, suitable for households, restaurants and retailers.', fr: 'Riz tchadien propre et trié, conditionné en sac scellé de 25 kg pour ménages, restaurants et détaillants.', ar: 'أرز تشادي نظيف ومفرز في كيس محكم وزن 25 كجم، مناسب للأسر والمطاعم وتجار التجزئة.' },
    price: 19500, images: ['https://souktchad.shop/dl/products/photo-1416879595882-3373a0480b5b.jpg'], categoryId: 'grocery_cereals', sellerId: 'seller9', condition: 'new', location: 'Kelo',
    postedDate: '2026-09-20', isPinned: false, isFeatured: false, views: 321, stock: 85, maxOrderQty: 12, rating: 4.9, reviewsCount: 112, soldCount: 487,
  },
  {
    id: 'p27', title: { en: 'Toyota Hilux 2017 Double Cab', fr: 'Toyota Hilux 2017 double cabine', ar: 'تويوتا هايلوكس 2017 غمارتين' },
    description: { en: 'Diesel 4x4 pickup with manual gearbox, working air conditioning, inspected suspension and 126,000 km.', fr: 'Pick-up diesel 4x4, boîte manuelle, climatisation fonctionnelle, suspension contrôlée et 126 000 km.', ar: 'سيارة بيك أب ديزل دفع رباعي بناقل يدوي وتكييف يعمل، تم فحص نظام التعليق، قطعت 126 ألف كم.' },
    price: 13750000, images: ['https://souktchad.shop/dl/products/photo-1621007947382-bb3c3994e3fb.jpg'], categoryId: 'vehicles', sellerId: 'seller10', condition: 'used', location: "N'Djamena",
    postedDate: '2026-09-09', isPinned: true, pinnedUntil: '2026-10-09', isFeatured: true, views: 903, stock: 1, maxOrderQty: 1, rating: 4.5, reviewsCount: 11, soldCount: 7,
  },
  {
    id: 'p28', title: { en: 'Petrol Water Pump 3 Inch', fr: 'Motopompe essence 3 pouces', ar: 'مضخة مياه بنزين 3 بوصات' },
    description: { en: 'Portable four-stroke irrigation pump with 3-inch inlet and outlet, filter, clamps and suction hose fittings.', fr: 'Motopompe d’irrigation portable à quatre temps, entrée et sortie 3 pouces, filtre, colliers et raccords inclus.', ar: 'مضخة ري محمولة رباعية الأشواط بمدخل ومخرج 3 بوصات، مع فلتر ومشابك ووصلات خرطوم السحب.' },
    price: 128000, images: ['https://souktchad.shop/dl/products/photo-1581091226825-a6a2a5aee158.jpg'], categoryId: 'agriculture_irrigation', sellerId: 'seller11', condition: 'new', location: 'Doba',
    postedDate: '2026-09-14', isPinned: false, isFeatured: false, views: 196, stock: 14, maxOrderQty: 3, rating: 4.6, reviewsCount: 28, soldCount: 76, warrantyDays: 30,
  },
  {
    id: 'p29', title: { en: 'Shea Body Care Set', fr: 'Coffret soin corporel au karité', ar: 'مجموعة عناية بالجسم بزبدة الشيا' },
    description: { en: 'Moisturizing set with pure shea body butter, gentle soap and nourishing oil for dry skin.', fr: 'Coffret hydratant avec beurre corporel au karité pur, savon doux et huile nourrissante pour peau sèche.', ar: 'مجموعة ترطيب تضم زبدة جسم من الشيا النقية وصابونًا لطيفًا وزيتًا مغذيًا للبشرة الجافة.' },
    price: 14500, images: ['https://souktchad.shop/dl/products/photo-1594633312681-425c7b97ccd1.jpg'], categoryId: 'beauty_skin', sellerId: 'seller12', condition: 'new', location: 'Bongor',
    postedDate: '2026-09-21', isPinned: false, isFeatured: true, views: 267, stock: 48, maxOrderQty: 8, rating: 4.8, reviewsCount: 73, soldCount: 216,
  },
  {
    id: 'p30', title: { en: 'Portland Cement 50kg', fr: 'Ciment Portland 50 kg', ar: 'أسمنت بورتلاندي 50 كجم' },
    description: { en: 'General-purpose Portland cement in a sealed 50kg bag for masonry, concrete slabs and structural work.', fr: 'Ciment Portland polyvalent en sac scellé de 50 kg pour maçonnerie, dalles et travaux de structure.', ar: 'أسمنت بورتلاندي متعدد الاستخدامات في كيس محكم وزن 50 كجم للبناء وصب البلاطات والأعمال الإنشائية.' },
    price: 11250, images: ['https://souktchad.shop/dl/products/photo-1581091226825-a6a2a5aee158.jpg'], categoryId: 'construction_materials', sellerId: 'seller13', condition: 'new', location: 'Sarh',
    postedDate: '2026-09-22', isPinned: false, isFeatured: false, views: 412, stock: 240, maxOrderQty: 50, rating: 4.7, reviewsCount: 86, soldCount: 531,
  },
  {
    id: 'p31', title: { en: 'Solar Chest Freezer 210L', fr: 'Congélateur solaire 210 L', ar: 'فريزر شمسي أفقي 210 لتر' },
    description: { en: 'Efficient 12/24V chest freezer for solar systems, with thick insulation, basket and low-voltage protection.', fr: 'Congélateur coffre efficace 12/24 V pour système solaire, avec isolation renforcée, panier et protection basse tension.', ar: 'فريزر أفقي موفر للطاقة يعمل بجهد 12/24 فولت للأنظمة الشمسية، بعزل سميك وسلة وحماية من انخفاض الجهد.' },
    price: 325000, images: ['https://souktchad.shop/dl/products/photo-1584568694244-14fbdf83bd30.jpg'], categoryId: 'electromenager_froid', sellerId: 'seller14', condition: 'new', location: 'Faya',
    postedDate: '2026-09-13', isPinned: true, pinnedUntil: '2026-10-13', isFeatured: true, views: 351, stock: 7, maxOrderQty: 2, rating: 4.9, reviewsCount: 35, soldCount: 62, warrantyDays: 90,
  },
  {
    id: 'p32', title: { en: 'Adjustable Dumbbell Set 30kg', fr: 'Kit haltères réglables 30 kg', ar: 'طقم دمبل قابل للتعديل 30 كجم' },
    description: { en: 'Home training set with two bars, secure spin-lock collars and coated plates totaling 30kg.', fr: 'Kit d’entraînement à domicile avec deux barres, bagues de serrage sécurisées et disques gainés totalisant 30 kg.', ar: 'طقم تدريب منزلي بقضيبين وأقفال لولبية آمنة وأقراص مغطاة بوزن إجمالي 30 كجم.' },
    price: 62000, images: ['https://souktchad.shop/dl/products/photo-1600185365483-26d7a4cc7519.jpg'], categoryId: 'sports_fitness', sellerId: 'seller15', condition: 'new', location: 'Mongo',
    postedDate: '2026-09-16', isPinned: false, isFeatured: false, views: 145, stock: 11, maxOrderQty: 2, rating: 4.4, reviewsCount: 22, soldCount: 49,
  },
  {
    id: 'p33', title: { en: 'Convertible Baby Stroller', fr: 'Poussette bébé convertible', ar: 'عربة أطفال قابلة للتحويل' },
    description: { en: 'Foldable stroller with reversible seat, sun canopy, storage basket and five-point safety harness for newborns and toddlers.', fr: 'Poussette pliable avec siège réversible, pare-soleil, panier et harnais cinq points pour nouveau-nés et jeunes enfants.', ar: 'عربة قابلة للطي بمقعد عكسي ومظلة شمسية وسلة تخزين وحزام أمان خماسي للرضع والأطفال الصغار.' },
    price: 78000, images: ['https://souktchad.shop/dl/products/photo-1441986300917-64674bd600d8.jpg'], categoryId: 'baby_mobility', sellerId: 'seller16', condition: 'new', location: "N'Djamena",
    postedDate: '2026-09-19', isPinned: false, isFeatured: true, views: 289, stock: 13, maxOrderQty: 2, rating: 4.8, reviewsCount: 51, soldCount: 94, warrantyDays: 14,
  },
  {
    id: 'p34', title: { en: 'Fenced Residential Plot 600m²', fr: 'Terrain résidentiel clôturé 600 m²', ar: 'قطعة أرض سكنية مسوّرة 600 م²' },
    description: { en: 'Surveyed 600m² residential plot with perimeter wall, road access and ownership documents available for verification.', fr: 'Terrain résidentiel borné de 600 m² avec mur de clôture, accès routier et documents de propriété vérifiables.', ar: 'قطعة أرض سكنية محددة المساحة 600 م² ومحاطة بسور مع طريق وصول ووثائق ملكية متاحة للتحقق.' },
    price: 6800000, images: ['https://souktchad.shop/dl/products/photo-1500382017468-9049fed747ef.jpg'], categoryId: 'real_estate', sellerId: 'seller17', condition: 'new', location: 'Oum Hadjer',
    postedDate: '2026-09-08', isPinned: true, pinnedUntil: '2026-10-08', isFeatured: false, views: 377, stock: 1, maxOrderQty: 1, rating: 4.5, reviewsCount: 8, soldCount: 3,
  },
  {
    id: 'p35', title: { en: 'Electric Sewing Machine', fr: 'Machine à coudre électrique', ar: 'ماكينة خياطة كهربائية' },
    description: { en: 'Compact sewing machine with 16 stitch patterns, buttonhole function, foot pedal and LED work light.', fr: 'Machine à coudre compacte avec 16 points, boutonnière, pédale de commande et éclairage de travail LED.', ar: 'ماكينة خياطة مدمجة تضم 16 غرزة ووظيفة عروة زر ودواسة تحكم وإضاءة LED للعمل.' },
    price: 115000, images: ['https://souktchad.shop/dl/products/photo-1591047139829-d91aecb6caea.jpg'], categoryId: 'trade_sewing', sellerId: 'seller18', condition: 'new', location: 'Moundou',
    postedDate: '2026-09-15', isPinned: false, isFeatured: false, views: 183, stock: 9, maxOrderQty: 2, rating: 4.6, reviewsCount: 26, soldCount: 58, warrantyDays: 30,
  },
  {
    id: 'p36', title: { en: 'Wi-Fi 6 Dual-Band Router', fr: 'Routeur Wi-Fi 6 double bande', ar: 'راوتر واي فاي 6 ثنائي النطاق' },
    description: { en: 'Dual-band Wi-Fi 6 router with four antennas, parental controls and stable coverage for homes and small offices.', fr: 'Routeur Wi-Fi 6 double bande avec quatre antennes, contrôle parental et couverture stable pour maison ou petit bureau.', ar: 'راوتر واي فاي 6 ثنائي النطاق بأربعة هوائيات ورقابة أبوية وتغطية مستقرة للمنازل والمكاتب الصغيرة.' },
    price: 47500, images: ['https://souktchad.shop/dl/products/photo-1498049794561-7780e7231661.jpg'], categoryId: 'electronics_networks', sellerId: 'seller19', condition: 'new', location: 'Kelo',
    postedDate: '2026-09-23', isPinned: false, isFeatured: false, views: 204, stock: 18, maxOrderQty: 4, rating: 4.3, reviewsCount: 31, soldCount: 69, warrantyDays: 14,
  },
  {
    id: 'p37', title: { en: 'Home Air-Conditioner Cleaning', fr: 'Nettoyage de climatiseur à domicile', ar: 'تنظيف مكيفات منزلية' },
    description: { en: 'On-site split air-conditioner cleaning with filter wash, coil dust removal, drain check and performance test.', fr: 'Nettoyage sur place d’un climatiseur split avec lavage des filtres, dépoussiérage, contrôle du drain et test de fonctionnement.', ar: 'تنظيف مكيف سبليت في الموقع، يشمل غسل الفلاتر وإزالة غبار الملفات وفحص التصريف واختبار الأداء.' },
    price: 15000, images: ['https://souktchad.shop/dl/products/photo-1621905252507-b35492cc74b4.jpg'], categoryId: 'services', sellerId: 'seller23', condition: 'new', location: 'Doba',
    postedDate: '2026-09-24', isPinned: false, isFeatured: false, views: 162, stock: 20, maxOrderQty: 3, rating: 4.7, reviewsCount: 39, soldCount: 88,
  },
];

export const mockReviews: Review[] = [
  {
    id: 'rev1', orderId: 'ord1', productId: 'p13', buyerId: 'user1', buyerName: 'Ahmed Mahamat',
    buyerAvatar: 'https://souktchad.shop/dl/products/photo-1507003211169-0a1dd7228f2d.jpg',
    sellerId: 'seller1', rating: 5, text: 'Excellent speaker! Great quality sound, exactly as described. Delivered fast to N\'Djamena.',
    photoUris: [
      'https://souktchad.shop/dl/products/photo-1608043152269-423dbba4e7e1.jpg',
      'https://souktchad.shop/dl/products/photo-1589003077984-894e133dabab.jpg',
      'https://souktchad.shop/dl/products/photo-1545454675-3531b543be5d.jpg',
    ],
    createdAt: '2024-12-20T14:00:00Z',
  },
  {
    id: 'rev2', orderId: 'ord2', productId: 'p1', buyerId: 'user2', buyerName: 'Fatimé Abakar',
    sellerId: 'seller1', rating: 4, text: 'Galaxy A54 original, battery lasts all day. Only the charger cable is short.',
    createdAt: '2024-12-18T09:30:00Z',
  },
  {
    id: 'rev3', orderId: 'ord3', productId: 'p1', buyerId: 'user3', buyerName: 'Ousmane Déby',
    sellerId: 'seller1', rating: 5, text: 'هاتف أصلي ومضمون، التوصيل كان سريعاً إلى NDjamena. أنصح به بشدة.',
    createdAt: '2024-12-22T16:45:00Z',
  },
  {
    id: 'rev4', orderId: 'ord4', productId: 'p14', buyerId: 'user4', buyerName: 'Amina Saleh',
    sellerId: 'seller1', rating: 3, text: 'Laptop works but the screen has a small scratch on the corner. Seller responded quickly.',
    createdAt: '2024-12-19T11:20:00Z',
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
