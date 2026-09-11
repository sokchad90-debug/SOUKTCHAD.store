import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { Platform, I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '@/template';
import { lightColors, darkColors, ThemeColors } from '@/constants/theme';
import { Language, t as translate } from '@/constants/config';
import { translateMessageFull, detectLanguage } from '@/services/translation';
import {
  initializeNotifications, sendOrderNotification, sendMessageNotification,
  sendVerificationNotification, updateAppBadge,
} from '@/services/notifications';
import {
  Product, Conversation, Order, Message, Seller, PaymentMethod, Review,
  products as mockProducts,
  mockOrders, sellers as mockSellers, paymentMethods, mockReviews,
  categories as mockCategories, Category, mockSellerStats,
} from '@/services/mockData';
import { fetchProducts, createProduct as dbCreateProduct, updateProduct as dbUpdateProduct, getCategoryUUID } from '@/services/productService';
import { fetchAllUsers, fetchSellers as dbFetchSellers, banUserInDB, unbanUserInDB, verifyUserInDB, unverifyUserInDB } from '@/services/adminService';
import { fetchBuyerStats, fetchUserOrders, BuyerStats, OrderFromAPI } from '@/services/orderStats';
import { ALL_COUNTRIES, DEFAULT_ENABLED_COUNTRIES, Country, COUNTRY_CITIES } from '@/constants/countries';
import { getAdBanners, getStoreLogo } from '@/services/branding';
import { supabase } from '@/lib/supabase';
import { signOutFromSupabase, getCurrentProfile } from '@/services/supabaseAuth';

// ─── PHP API helpers (replaces Supabase calls) ───
const API_BASE = 'http://10.0.2.2:8080';
const AUTH_TOKEN_KEY = 'sokchad_auth_token';

/**
 * Generate a unique 20-digit random order number.
 * Format: exactly 20 digits, purely random, no separators.
 * Example: 22914420154225082368
 */
function generateOrderNumber(): string {
  let num = '';
  // First digit: 1-9 (no leading zero)
  num += Math.floor(Math.random() * 9 + 1).toString();
  // Remaining 19 digits: 0-9
  for (let i = 0; i < 19; i++) {
    num += Math.floor(Math.random() * 10).toString();
  }
  return num;
}

async function apiGetAuthToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

async function apiAuthHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...extra,
  };
  const token = await apiGetAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

/**
 * Fetch the current user's profile from the PHP API.
 * Endpoint: GET /api_profile.php (returns { success, data: {...} }).
 */
async function apiFetchProfile(): Promise<any | null> {
  try {
    const headers = await apiAuthHeaders();
    const res = await fetch(`${API_BASE}/api_profile.php`, { method: 'GET', headers });
    const json = await res.json();
    if (json.success && json.data) return json.data;
    return null;
  } catch (e) {
    console.log('apiFetchProfile error:', e);
    return null;
  }
}

/**
 * Update the current user's profile via the PHP API.
 * Endpoint: PUT /api_profile.php (body = partial profile fields).
 */
async function apiUpdateProfile(updates: Record<string, any>): Promise<boolean> {
  try {
    const headers = await apiAuthHeaders();
    const res = await fetch(`${API_BASE}/api_profile.php`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates),
    });
    const json = await res.json();
    return Boolean(json.success);
  } catch (e) {
    console.log('apiUpdateProfile error:', e);
    return false;
  }
}

/**
 * Fetch the current user's favorites from the PHP API.
 * Endpoint: GET /api_favorites.php (returns { success, data: [productId, ...] }).
 */
async function apiFetchFavorites(): Promise<string[]> {
  try {
    const headers = await apiAuthHeaders();
    const res = await fetch(`${API_BASE}/api_favorites.php`, { method: 'GET', headers });
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      return json.data.map((f: any) => String(f.product_id ?? f.id ?? f));
    }
    return [];
  } catch (e) {
    console.log('apiFetchFavorites error:', e);
    return [];
  }
}

/**
 * Add or remove a favorite via the PHP API.
 * Endpoint: POST /api_favorites.php { product_id, action: 'add'|'remove' }.
 */
async function apiToggleFavorite(productId: string, add: boolean): Promise<boolean> {
  try {
    const headers = await apiAuthHeaders();
    const res = await fetch(`${API_BASE}/api_favorites.php`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ product_id: productId, action: add ? 'add' : 'remove' }),
    });
    const json = await res.json();
    return Boolean(json.success);
  } catch (e) {
    console.log('apiToggleFavorite error:', e);
    return false;
  }
}

/**
 * Fetch the current user's conversations (with messages) from the PHP API.
 * Endpoint: GET /api_conversations.php (returns { success, data: [...] }).
 */
async function apiFetchConversations(): Promise<any[]> {
  try {
    const headers = await apiAuthHeaders();
    const res = await fetch(`${API_BASE}/api_conversations.php`, { method: 'GET', headers });
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) return json.data;
    return [];
  } catch (e) {
    console.log('apiFetchConversations error:', e);
    return [];
  }
}

/**
 * Start a new conversation via the PHP API.
 * Endpoint: POST /api_conversations.php { seller_id, product_id, message }.
 */
async function apiStartConversation(sellerId: string, productId: string, message: string): Promise<any | null> {
  try {
    const headers = await apiAuthHeaders();
    const res = await fetch(`${API_BASE}/api_conversations.php`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ seller_id: sellerId, product_id: productId, message }),
    });
    const json = await res.json();
    if (json.success && json.data) return json.data;
    return null;
  } catch (e) {
    console.log('apiStartConversation error:', e);
    return null;
  }
}

/**
 * Send a message in a conversation via the PHP API.
 * Endpoint: POST /api_messages.php { conversation_id, text }.
 */
async function apiSendMessage(conversationId: string, text: string): Promise<boolean> {
  try {
    const headers = await apiAuthHeaders();
    const res = await fetch(`${API_BASE}/api_messages.php`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ conversation_id: conversationId, text }),
    });
    const json = await res.json();
    return Boolean(json.success);
  } catch (e) {
    console.log('apiSendMessage error:', e);
    return false;
  }
}

/**
 * Fetch staff permissions for an admin user via the PHP API.
 * Endpoint: GET /api_profile.php?staff=1&user_id=<id> (returns { success, data: { permissions } }).
 * Falls back gracefully when the endpoint is unavailable.
 */
async function apiFetchStaffPermissions(userId: string): Promise<StaffPermission[] | undefined> {
  try {
    const headers = await apiAuthHeaders();
    const res = await fetch(`${API_BASE}/api_profile.php?staff=1&user_id=${encodeURIComponent(userId)}`, { method: 'GET', headers });
    const json = await res.json();
    if (json.success && json.data?.permissions && Array.isArray(json.data.permissions)) {
      return json.data.permissions as StaffPermission[];
    }
    return undefined;
  } catch (e) {
    console.log('apiFetchStaffPermissions error:', e);
    return undefined;
  }
}

export type UserRole = 'buyer' | 'seller' | 'super_admin' | 'staff';

export type SortOption = 'newest' | 'cheapest' | 'expensive' | 'most_viewed';
export type ConditionFilter = 'all' | 'new' | 'used' | 'like_new';

export interface FilterState {
  priceMin: number;
  priceMax: number;
  condition: ConditionFilter;
  location: string;
  sortBy: SortOption;
}

export const DEFAULT_FILTERS: FilterState = {
  priceMin: 0,
  priceMax: 50000000,
  condition: 'all',
  location: 'all',
  sortBy: 'newest',
};

export const CHAD_CITIES = [
  "N'Djamena", 'Moundou', 'Abeche', 'Sarh', 'Kelo', 'Koumra', 'Pala',
  'Am Timan', 'Bongor', 'Mongo', 'Doba', 'Ati', 'Massaguet', 'Lai', 'Mao',
];

export interface ShippingCompany {
  id: string;
  name: string;
  phone: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  logoUrl?: string;
  logo_url?: string;
}

export interface VerificationPlan {
  id: string;
  name: string;
  durationDays: number;
  price: number;
  isActive: boolean;
  createdAt: string;
}

export interface VerificationSubscription {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  userRole: UserRole;
  planId: string;
  planName: string;
  amount: number;
  durationDays: number;
  screenshotUri: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNotes?: string;
  createdAt: string;
}

interface BlacklistEntry {
  email: string;
  phone: string;
  username: string;
  bannedAt: string;
}

export interface StaffMember {
  id: string;
  email: string;
  password: string;
  name: string;
  permissions: StaffPermission[];
  createdAt: string;
  isActive: boolean;
}

export type StaffPermission = 'manage_sellers' | 'manage_disputes' | 'manage_payments' | 'manage_users' | 'view_blacklist';

interface User {
  id: string;
  numericId: string;
  name: string;
  username: string;
  email: string;
  phone: string;
  avatar: string;
  coverImage: string;
  location?: string;
  role: UserRole;
  isSeller: boolean;
  sellerId?: string;
  isVerified?: boolean;
  isVerifiedBuyer?: boolean;
  isBanned?: boolean;
  bannedUntil?: string;
  completedPurchases?: number;
  paymentMethods?: { methodId: string; receivingNumber: string }[];
  staffPermissions?: StaffPermission[];
  created_at?: string;
}

interface AppContextType {
  language: Language;
  isDark: boolean;
  colors: ThemeColors;
  user: User | null;
  isLoggedIn: boolean;
  isReady: boolean;
  authLoading: boolean;
  userChecked: boolean;
  dynamicBanners: any[];
  storeLogo: string;
  products: Product[];
  favorites: string[];
  conversations: Conversation[];
  orders: Order[];
  sellers: Seller[];
  reviews: Review[];
  searchQuery: string;
  selectedCategory: string;
  filters: FilterState;
  activeFilterCount: number;
  registeredUsernames: string[];
  usedReferenceIds: string[];
  blacklist: BlacklistEntry[];
  staffMembers: StaffMember[];
  enabledCountries: string[];
  getEnabledCountryList: () => Country[];
  getCitiesForCountry: (code: string) => string[];
  toggleCountryEnabled: (code: string) => void;
  setEnabledCountries: (codes: string[]) => void;
  t: (key: string) => string;
  setLanguage: (lang: Language) => void;
  enabledLanguages: string[];
  toggleLanguageEnabled: (lang: string) => void;
  toggleDarkMode: () => void;
  logout: () => void;
  isUsernameTaken: (username: string) => boolean;
  isReferenceIdUsed: (refId: string) => boolean;
  updateUserAvatar: (uri: string) => void;
  updateUserCover: (uri: string) => void;
  toggleFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (catId: string) => void;
  setFilters: (filters: FilterState) => void;
  resetFilters: () => void;
  addProduct: (product: Omit<Product, 'id' | 'postedDate' | 'isPinned' | 'isFeatured' | 'views'>) => void;
  setProductDiscount: (productId: string, percent: number, durationDays: number) => void;
  removeProductDiscount: (productId: string) => void;
  sendMessage: (conversationId: string, text: string) => void;
  startConversation: (sellerId: string, productId: string, initialMessage: string) => string;
  placeOrder: (productId: string, paymentMethodId: string, screenshotUri: string, buyerCity: string, shippingId: string, quantity?: number) => { success: boolean; error?: string };
  updateOrderStatus: (orderId: string, status: Order['status']) => void;
  markItemReceived: (orderId: string) => void;
  addReview: (orderId: string, productId: string, sellerId: string, rating: number, text: string, photoUri?: string) => void;
  getReviewsForProduct: (productId: string) => Review[];
  getReviewsForSeller: (sellerId: string) => Review[];
  getFilteredProducts: () => Product[];
  togglePinProduct: (productId: string, durationDays: number) => void;
  toggleSellerVerified: (sellerId: string, durationDays: number) => void;
  toggleBanSeller: (sellerId: string) => void;
  banUserWithDuration: (sellerId: string, durationDays: number) => void;
  permanentBanUser: (sellerId: string) => void;
  addPaymentMethod: (name: string, color: string, instructions: string, logoUrl?: string) => void;
  updatePaymentMethodLogo: (id: string, logoUrl: string) => void;
  updatePaymentMethod: (id: string, updates: { name?: string; color?: string; instructions?: string; logo?: string }) => void;
  togglePaymentMethodActive: (id: string) => void;
  removePaymentMethod: (id: string) => void;
  paymentMethodsList: PaymentMethod[];
  getPaymentMethodsForCountry: (countryCode: string) => PaymentMethod[];
  categories: Category[];
  subCategories: Category[];
  currentCategoryPath: { id: string; name: string }[];
  loadSubCategories: (parentId: string) => Promise<Category[]>;
  navigateToCategory: (cat: Category) => Promise<void>;
  goBackCategory: () => void;
  resetCategoryNavigation: () => void;
  shippingCompanies: ShippingCompany[];
  addShippingCompany: (name: string, phone: string, description: string) => void;
  removeShippingCompany: (id: string) => void;
  toggleShippingCompanyActive: (id: string) => void;
  confirmOrderReceived: (orderId: string) => void;
  canSellerRequestVerification: (sellerId: string) => { eligible: boolean; reason?: string };
  requestSellerVerification: () => void;
  verificationPlans: VerificationPlan[];
  verificationSubscriptions: VerificationSubscription[];
  addVerificationPlan: (name: string, durationDays: number, price: number) => void;
  removeVerificationPlan: (id: string) => void;
  toggleVerificationPlanActive: (id: string) => void;
  submitVerificationSubscription: (planId: string, screenshotUri: string) => { success: boolean; error?: string };
  approveVerificationSubscription: (subId: string) => void;
  rejectVerificationSubscription: (subId: string, notes: string) => void;
  canUserRequestVerification: () => { eligible: boolean; reason?: string };
  changeUserNumericId: (targetUserId: string, newId: string) => { success: boolean; error?: string };
  adminPaymentNumber: string;
  updateSellerPaymentMethods: (methods: { methodId: string; receivingNumber: string }[]) => void;
  fetchSellerPaymentMethods: (sellerId: number) => Promise<any[]>;
  fetchSellerShipping: (sellerId: number) => Promise<any[]>;
  fetchAvailableShippingCompanies: () => Promise<any[]>;
  updateSellerShipping: (companyIds: number[]) => Promise<void>;
  deliveryCities: string[];
  fetchDeliveryCities: (sellerId: number) => Promise<string[]>;
  updateDeliveryCities: (cities: string[]) => Promise<void>;
  deliveryMethods: string[];
  fetchDeliveryMethods: (sellerId: number) => Promise<string[]>;
  updateDeliveryMethods: (methodIds: string[]) => Promise<void>;
  selectedCity: string;
  setSelectedCity: (city: string) => void;
  uploadImage: (uri: string) => Promise<string | null>;
  updateStoreLogo: (uri: string) => Promise<void>;
  updateStoreBanner: (uri: string) => Promise<void>;
  chatBadgeCount: number;
  profileBadgeCount: number;
  clearChatBadge: () => void;
  clearProfileBadge: () => void;
  addStaffMember: (email: string, password: string, name: string, permissions: StaffPermission[]) => { success: boolean; error?: string };
  removeStaffMember: (id: string) => void;
  updateStaffPermissions: (id: string, permissions: StaffPermission[]) => void;
  toggleStaffActive: (id: string) => void;
  refreshUserProfile: () => Promise<void>;
  loadDemoUser: () => Promise<void>;
  refreshProducts: () => Promise<void>;
  getProductById: (id: string) => Product | undefined;
  getProductsByCategory: (categoryId: string) => Product[];
  getProductsBySeller: (sellerId: string) => Product[];
  getSellerById: (id: string) => Seller | undefined;
  getCategoryById: (id: string) => Category | undefined;
  getPinnedProducts: () => Product[];
  productsLoading: boolean;
  realUsers: any[];
  usersLoading: boolean;
  refreshUsers: () => Promise<void>;
  buyerOrders: any[];
  buyerCompletedOrders: any[];
  sellerOrders: any[];
  // ─── Seller Follow System ───
  followingList: string[];
  followStats: Record<string, any>;
  followedSellers: any[];
  followedProducts: any[];
  fetchFollowStatus: (sellerId: string) => Promise<{ following: boolean; notifications_enabled: boolean }>;
  toggleFollow: (sellerId: string) => Promise<boolean>;
  toggleFollowNotifications: (sellerId: string, enabled: boolean) => Promise<boolean>;
  fetchSellerStats: (sellerId: string) => Promise<any>;
  fetchFollowedSellers: () => Promise<void>;
  fetchFollowedProducts: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1599566150163-29194dcabd9c?w=200&h=200&fit=crop';
const DEFAULT_COVER = 'https://images.unsplash.com/photo-1557683316-973673baf926?w=800&h=300&fit=crop';

// Strictly numeric Secret ID: 10 digits, guaranteed unique via timestamp + random
const usedSecretIds = new Set<string>();
function generateSecretId(): string {
  let id = '';
  do {
    const ts = Date.now().toString().slice(-4);
    let rand = '';
    for (let i = 0; i < 6; i++) rand += Math.floor(Math.random() * 10).toString();
    id = ts + rand;
  } while (usedSecretIds.has(id));
  usedSecretIds.add(id);
  return id;
}

export function AppProvider({ children }: { children: ReactNode }) {
  // Real auth from template
  const { user: authUser, loading: authLoading, logout: authLogout } = useAuth();

  const [isReady, setIsReady] = useState(false);
  const [appBanners, setAppBanners] = useState<any[]>([]);
  const [appStoreLogo, setAppStoreLogo] = useState("");
  const [language, setLanguageState] = useState<Language>('fr');
  const [enabledLanguages, setEnabledLanguages] = useState<string[]>(['fr', 'ar']);
  const [isDark, setIsDark] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  // userChecked: true once we've checked AsyncStorage and Supabase session.
  // Before that, we don't know if user is null (no session) or just not loaded.
  const [userChecked, setUserChecked] = useState(false);
  // Set userChecked=true when authLoading is false (auth check complete)
  useEffect(() => {
    if (!authLoading) {
      setUserChecked(true);
    }
  }, [authLoading]);
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [productsLoading, setProductsLoading] = useState(false);
  const [dbProductsLoaded, setDbProductsLoaded] = useState(false);
  // Synchronous cache of locally-persisted products, used as a fallback in
  // getProductById before the async merge into `products` state completes.
  const localProductsRef = useRef<Product[]>([]);
  // Load locally-added products from AsyncStorage and merge them ahead of mock products
  useEffect(() => {
    AsyncStorage.getItem('sokchad_products_local').then(data => {
      if (data) {
        try {
          const localProducts: Product[] = JSON.parse(data);
          if (Array.isArray(localProducts) && localProducts.length > 0) {
            localProductsRef.current = localProducts;
            setProducts(prev => [...localProducts, ...prev.filter(p => !localProducts.some(lp => lp.id === p.id))]);
          }
        } catch (e) { console.log('load local products error:', e); }
      }
    }).catch(() => {});
  }, []);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [buyerOrders, setBuyerOrders] = useState<OrderFromAPI[]>([]);
  const [buyerCompletedOrders, setBuyerCompletedOrders] = useState<OrderFromAPI[]>([]);
  const [sellerOrders, setSellerOrders] = useState<OrderFromAPI[]>([]);
  // buyerStats mirrors the response from api_buyer_stats.php, which now includes
  // unique_sellers_count (distinct sellers among completed orders) and
  // orders_last_30d (orders placed in the last 30 days).
  const [buyerStats, setBuyerStats] = useState<BuyerStats | null>(null);
  const [sellers, setSellers] = useState<Seller[]>(mockSellers);
  const [reviews, setReviews] = useState<Review[]>(mockReviews);
  const [paymentMethodsList, setPaymentMethodsList] = useState<PaymentMethod[]>(paymentMethods);
  const [realUsers, setRealUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // ─── Seller Follow System state ───
  const [followingList, setFollowingList] = useState<string[]>([]);
  const [followStats, setFollowStats] = useState<Record<string, any>>({});
  const [followedSellers, setFollowedSellers] = useState<any[]>([]);
  const [followedProducts, setFollowedProducts] = useState<any[]>([]);
  // Local notification-enabled state per seller (persists across the session
  // and survives API failures so the toggle always reflects the user's choice).
  const [followNotifState, setFollowNotifState] = useState<Record<string, boolean>>({});
  // Persist follow/notification state to AsyncStorage so it survives app restarts.
  useEffect(() => {
    AsyncStorage.setItem('sokchad_follow_notif_state', JSON.stringify(followNotifState)).catch(() => {});
  }, [followNotifState]);
  useEffect(() => {
    AsyncStorage.setItem('sokchad_following_list', JSON.stringify(followingList)).catch(() => {});
  }, [followingList]);

  // Refs to avoid stale closures in setTimeout callbacks and stabilize function references
  const conversationsRef = useRef(conversations);
  const authLoadingRef = useRef(authLoading);
  useEffect(() => { authLoadingRef.current = authLoading; }, [authLoading]);
  const autoReplyTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
  useEffect(() => {
    return () => { autoReplyTimersRef.current.forEach(clearTimeout); };
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [filters, setFiltersState] = useState<FilterState>(DEFAULT_FILTERS);
  const [deliveryCities, setDeliveryCities] = useState<string[]>([]);
  const [deliveryMethods, setDeliveryMethods] = useState<string[]>([]);
  const [selectedCity, setSelectedCityState] = useState<string>('all');
  const [sellerDeliveryCitiesCache, setSellerDeliveryCitiesCache] = useState<Record<string, string[]>>({});
  const [usedReferenceIds, setUsedReferenceIds] = useState<string[]>(['AT-20241215-78432']);
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [enabledCountries, setEnabledCountriesState] = useState<string[]>(DEFAULT_ENABLED_COUNTRIES);
  const [categories, setCategories] = useState<Category[]>(mockCategories);
  const [subCategories, setSubCategories] = useState<Category[]>([]);
  const [currentCategoryPath, setCurrentCategoryPath] = useState<{ id: string; name: string }[]>([]);
  const [shippingCompanies, setShippingCompanies] = useState<ShippingCompany[]>([
    { id: 'ship_1', name: 'Express Tchad', phone: '+235 66 00 11 22', description: 'Fast delivery across all major cities', isActive: true, createdAt: new Date().toISOString() },
    { id: 'ship_2', name: 'Sahel Transport', phone: '+235 99 33 44 55', description: 'Affordable shipping for all of Chad', isActive: true, createdAt: new Date().toISOString() },
  ]);
  const [verificationPlans, setVerificationPlans] = useState<VerificationPlan[]>([
    { id: 'vp_1', name: '1 Month', durationDays: 30, price: 5000, isActive: true, createdAt: new Date().toISOString() },
    { id: 'vp_2', name: '3 Months', durationDays: 90, price: 12000, isActive: true, createdAt: new Date().toISOString() },
    { id: 'vp_3', name: '1 Year', durationDays: 365, price: 40000, isActive: true, createdAt: new Date().toISOString() },
  ]);
  const [verificationSubscriptions, setVerificationSubscriptions] = useState<VerificationSubscription[]>([]);
  const adminPaymentNumber = '+235 90 90 53 30';

  // ─── NEW: Delivery cities, city picker, image upload, store logo/banner ───
  // All self-contained — no forward references
  const setSelectedCity = useCallback((city: string) => {
    setSelectedCityState(city);
    AsyncStorage.setItem('sokchad_selected_city', city).catch(() => {});
    setFiltersState(prev => ({ ...prev, location: city }));
  }, []);

  // Fetch delivery cities for a seller and cache it
  const fetchAndCacheDeliveryCities = useCallback(async (sellerId: string) => {
    if (!sellerId || sellerDeliveryCitiesCache[sellerId]) return; // already cached
    try {
      const res = await fetch(`${API_BASE}/seller_delivery_cities.php?seller_id=${sellerId}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const cities = json.data.map((c: any) => c.city_name || c.name || c);
        setSellerDeliveryCitiesCache(prev => ({ ...prev, [sellerId]: cities }));
      }
    } catch {}
  }, [sellerDeliveryCitiesCache]);

  // Fetch delivery cities for all sellers with products
  const refreshAllDeliveryCities = useCallback(async () => {
    const sellerIds = [...new Set(products.map(p => p.sellerId).filter(Boolean))];
    for (const sid of sellerIds) {
      if (!sellerDeliveryCitiesCache[sid]) {
        fetchAndCacheDeliveryCities(String(sid));
      }
    }
  }, [products, sellerDeliveryCitiesCache, fetchAndCacheDeliveryCities]);

  const fetchDeliveryCities = useCallback(async (sellerId: number): Promise<string[]> => {
    try {
      const res = await fetch(`${API_BASE}/seller_delivery_cities.php?seller_id=${sellerId}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) return json.data.map((c: any) => c.city_name);
      return [];
    } catch { return []; }
  }, []);

  const updateDeliveryCities = useCallback(async (cities: string[]) => {
    setDeliveryCities(cities);
    try {
      const headers = await apiAuthHeaders();
      await fetch(`${API_BASE}/seller_delivery_cities.php`, {
        method: 'PUT', headers, body: JSON.stringify({ cities }),
      });
    } catch (e) { console.log('updateDeliveryCities error:', e); }
  }, []);

  const fetchDeliveryMethods = useCallback(async (sellerId: number): Promise<string[]> => {
    try {
      const res = await fetch(`${API_BASE}/seller_delivery_methods.php?seller_id=${sellerId}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        return json.data.map((m: any) => String(m.method_id || m.id || m));
      }
      return [];
    } catch { return []; }
  }, []);

  const updateDeliveryMethods = useCallback(async (methodIds: string[]) => {
    setDeliveryMethods(methodIds);
    try {
      const headers = await apiAuthHeaders();
      await fetch(`${API_BASE}/seller_delivery_methods.php`, {
        method: 'PUT', headers, body: JSON.stringify({ delivery_method_ids: methodIds }),
      });
    } catch (e) { console.log('updateDeliveryMethods error:', e); }
  }, []);

  const fetchSellerPaymentMethods = useCallback(async (sellerId: number): Promise<any[]> => {
    try {
      const res = await fetch(`${API_BASE}/seller_payment_methods.php?seller_id=${sellerId}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) return json.data;
      return [];
    } catch { return []; }
  }, []);

  // Fetch a seller's shipping companies (public — for buyers)
  const fetchSellerShipping = useCallback(async (sellerId: number): Promise<any[]> => {
    try {
      const res = await fetch(`${API_BASE}/seller_shipping.php?seller_id=${sellerId}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) return json.data;
      return [];
    } catch { return []; }
  }, []);

  // Fetch ALL available shipping companies (for seller to choose from)
  const fetchAvailableShippingCompanies = useCallback(async (): Promise<any[]> => {
    try {
      const headers = await apiAuthHeaders();
      const res = await fetch(`${API_BASE}/seller_shipping.php?action=available`, { headers });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) return json.data;
      return [];
    } catch { return []; }
  }, []);

  // Update seller's shipping companies
  const updateSellerShipping = useCallback(async (companyIds: number[]) => {
    try {
      const headers = await apiAuthHeaders();
      await fetch(`${API_BASE}/seller_shipping.php`, {
        method: 'PUT', headers,
        body: JSON.stringify({ shipping_company_ids: companyIds }),
      });
    } catch (e) { console.log('updateSellerShipping error:', e); }
  }, []);

  const uploadImage = useCallback(async (uri: string): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append('file', { uri, name: 'upload.jpg', type: 'image/jpeg' } as any);
      const token = await apiGetAuthToken();
      const res = await fetch(`${API_BASE}/api_upload.php`, {
        method: 'POST',
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: formData,
      });
      const json = await res.json();
      if (json.success && json.data?.url) return json.data.url;
      return null;
    } catch (e) { console.log('uploadImage error:', e); return null; }
  }, []);

  const updateStoreLogo = useCallback(async (uri: string) => {
    // INSTANT: save locally first — no waiting for upload
    setUser(prev => { if (!prev) return null; return { ...prev, avatar: uri }; });
    // Save to per-seller profile storage (shared across logins on this device)
    try {
      const sellerId = user?.id || 'unknown';
      const key = `sokchad_seller_profile_${sellerId}`;
      const existing = JSON.parse(await AsyncStorage.getItem(key) || '{}');
      existing.avatar = uri;
      existing.avatar_url = uri;
      existing.name = user?.name || existing.name;
      existing.location = user?.location || existing.location;
      existing.isVerified = user?.isVerified || existing.isVerified;
      await AsyncStorage.setItem(key, JSON.stringify(existing));
    } catch (e) { console.log('seller profile save error:', e); }
    // Persist to AsyncStorage immediately
    try {
      const savedUser = await AsyncStorage.getItem('sokchad_user').catch(() => null);
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        parsed.avatar = uri;
        parsed.avatar_url = uri;
        await AsyncStorage.setItem('sokchad_user', JSON.stringify(parsed)).catch(() => {});
      }
    } catch (e) { console.log('logo save error:', e); }
    // Try upload in background (non-blocking)
    uploadImage(uri).then(uploadedUrl => {
      if (uploadedUrl) {
        setUser(prev => { if (!prev) return null; return { ...prev, avatar: uploadedUrl }; });
        apiUpdateProfile({ avatar_url: uploadedUrl }).catch(() => {});
      }
    }).catch(() => {});
  }, [uploadImage, user?.id]);

  const updateStoreBanner = useCallback(async (uri: string) => {
    // INSTANT: save locally first
    setUser(prev => { if (!prev) return null; return { ...prev, coverImage: uri }; });
    // Save to per-seller profile storage (shared across logins)
    try {
      const sellerId = user?.id || 'unknown';
      const key = `sokchad_seller_profile_${sellerId}`;
      const existing = JSON.parse(await AsyncStorage.getItem(key) || '{}');
      existing.storeBg = uri;
      existing.cover_url = uri;
      existing.coverImage = uri;
      await AsyncStorage.setItem(key, JSON.stringify(existing));
    } catch (e) { console.log('banner save error:', e); }
    try {
      const savedUser = await AsyncStorage.getItem('sokchad_user').catch(() => null);
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        parsed.cover_url = uri;
        await AsyncStorage.setItem('sokchad_user', JSON.stringify(parsed)).catch(() => {});
      }
    } catch (e) { console.log('banner save error:', e); }
    // Try upload in background
    uploadImage(uri).then(uploadedUrl => {
      if (uploadedUrl) {
        setUser(prev => { if (!prev) return null; return { ...prev, coverImage: uploadedUrl }; });
        apiUpdateProfile({ cover_url: uploadedUrl }).catch(() => {});
      }
    }).catch(() => {});
  }, [uploadImage, user?.id]);

  const updateSellerPaymentMethodsAPI = useCallback(async (methods: { methodId: string; receivingNumber: string }[]) => {
    try {
      const headers = await apiAuthHeaders();
      for (const m of methods) {
        await fetch(`${API_BASE}/seller_payment_methods.php`, {
          method: 'POST', headers,
          body: JSON.stringify({ payment_method_id: m.methodId, receiving_number: m.receivingNumber }),
        });
      }
    } catch (e) { console.log('updateSellerPaymentMethodsAPI error:', e); }
  }, []);
  // ─── END NEW ───
  const [registeredUsernames, setRegisteredUsernames] = useState<string[]>([
    'moussa electronics', 'fatima fashion', 'ibrahim motors', 'aisha home & decor', 'hassan agri-supply',
  ]);

  const colors = isDark ? darkColors : lightColors;

  // ─── Fetch products from database ───
  const loadProductsFromDB = useCallback(async () => {
    setProductsLoading(true);
    try {
      const { data, error } = await fetchProducts({ sort: 'newest' });
      if (!error && data.length > 0) {
        // DB products take priority. Only keep local-only products
        // (non-UUID IDs like 'p1', 'p2', 'p1693...') that don't overlap with DB.
        setProducts(prev => {
          const dbIds = new Set(data.map(p => p.id));
          // Keep ALL local products (mock + user-added) that aren't in DB
          // This includes: mock products (p1, p2...) AND user-added products (p1693...)
          const localOnly = prev.filter(p => !dbIds.has(p.id));
          // DB products first, then local products (including user-added ones)
          return [...data, ...localOnly];
        });
        setDbProductsLoaded(true);
      } else if (data.length === 0 && !error) {
        // DB is empty, keep mock data + local products as demo
        setDbProductsLoaded(true);
      }
      // If error: keep current products (mock + local) unchanged
    } catch (e) {
      console.log('loadProductsFromDB error:', e);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  const refreshProducts = useCallback(async () => {
    await loadProductsFromDB();
  }, [loadProductsFromDB]);

  // ─── Category Navigation (dynamic subcategories) ───
  const loadSubCategories = useCallback(async (parentId: string): Promise<Category[]> => {
    try {
      const res = await fetch(`https://souktchad.shop/api/categories.php?parent=${encodeURIComponent(parentId)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const subs: Category[] = data.data.map((c: any) => ({
          id: String(c.id),
          parentId: c.parent_id || undefined,
          hasChildren: c.has_children || false,
          name: {
            en: c.name_en || String(c.id),
            fr: c.name_fr || c.name_en || String(c.id),
            ar: c.name_ar || c.name_en || String(c.id),
          },
          icon: c.icon || 'category',
          color: c.color || '#FF7A00',
        }));
        setSubCategories(subs);
        return subs;
      }
    } catch (e) { console.log('loadSubCategories error:', e); }
    setSubCategories([]);
    return [];
  }, []);

  const navigateToCategory = useCallback(async (cat: Category) => {
    if (cat.hasChildren) {
      // Has subcategories → load them and show them
      const subs = await loadSubCategories(cat.id);
      if (subs.length > 0) {
        const catName = cat.name[language] || cat.name.en || cat.id;
        setCurrentCategoryPath(prev => [...prev, { id: cat.id, name: catName }]);
        setSelectedCategory(cat.id);
        return;
      }
    }
    // No subcategories → show products directly
    setSelectedCategory(cat.id);
    setSubCategories([]);
  }, [loadSubCategories, language, setSelectedCategory]);

  const goBackCategory = useCallback(() => {
    setCurrentCategoryPath(prev => {
      if (prev.length <= 1) {
        setSubCategories([]);
        return [];
      }
      const newPath = prev.slice(0, -1);
      const parent = newPath[newPath.length - 1];
      if (parent) {
        loadSubCategories(parent.id);
      } else {
        setSubCategories([]);
      }
      return newPath;
    });
  }, [loadSubCategories]);

  const resetCategoryNavigation = useCallback(() => {
    setSubCategories([]);
    setCurrentCategoryPath([]);
    setSelectedCategory('all');
  }, [setSelectedCategory]);

  // ─── Fetch real users from Supabase for admin dashboard ───
  const refreshUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const users = await fetchAllUsers();
      if (users.length > 0) {
        setRealUsers(users);
        // Also update sellers list with real data
        const realSellers = users
          .filter(u => (u as any).role === 'seller' || (u as any).role === 'super_admin')
          .map(u => ({
            id: String(u.id),
            name: (u as any).username || (u as any).name || 'Seller',
            avatar: (u as any).avatar_url || (u as any).avatar || '',
            sellerId: (u as any).seller_id || String(u.id),
            isVerified: Boolean((u as any).is_verified || (u as any).isVerified),
            verifiedUntil: undefined,
            isBanned: Boolean((u as any).is_banned),
            location: (u as any).location || '',
            rating: (u as any).rating || 0,
            totalSales: (u as any).total_sales || 0,
            joinedDate: (u as any).created_at || '',
            phone: (u as any).phone || '',
            isOnline: false,
            paymentMethods: [],
          }));
        if (realSellers.length > 0) {
          // Merge: keep mock sellers that aren't in realSellers, add real sellers
          setSellers(prev => {
            const mockIds = new Set(realSellers.map(s => s.id));
            const kept = prev.filter(s => !mockIds.has(s.id));
            return [...realSellers, ...kept];
          });
        }
      }
    } catch (e) {
      console.log('refreshUsers error:', e);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  // ─── Fetch user profile from Supabase profiles table ───
  const fetchUserProfile = useCallback(async (authId: string, authEmail: string): Promise<User | null> => {
    try {
      const profile = await getCurrentProfile();

      if (!profile) {
        console.log('Profile fetch returned no data, using defaults for:', authEmail);
        return {
          id: authId,
          numericId: generateSecretId(),
          name: authEmail.split('@')[0],
          username: authEmail.split('@')[0],
          email: authEmail,
          phone: '',
          avatar: DEFAULT_AVATAR,
          coverImage: DEFAULT_COVER,
          role: 'buyer',
          isSeller: false,
          isVerified: false,
          isVerifiedBuyer: false,
          isBanned: false,
          completedPurchases: 0,
          paymentMethods: [],
        };
      }

      // Map existing profiles schema (username, is_seller, is_admin, is_super_admin) to App User
      let role: UserRole = 'buyer';
      if (profile.is_super_admin) role = 'super_admin';
      else if (profile.is_admin) role = 'staff';
      else if (profile.is_seller) role = 'seller';

      return {
        id: profile.id || authId,
        numericId: profile.seller_id || profile.numeric_id || generateSecretId(),
        name: profile.username || authEmail.split('@')[0],
        username: profile.username || authEmail.split('@')[0],
        email: profile.email || authEmail,
        phone: profile.phone || '',
        avatar: profile.avatar_url || DEFAULT_AVATAR,
        coverImage: profile.cover_image_url || DEFAULT_COVER,
        role,
        isSeller: profile.is_seller || false,
        sellerId: profile.seller_id || profile.numeric_id || undefined,
        isVerified: profile.is_verified || false,
        isVerifiedBuyer: profile.is_verified_buyer || false,
        isBanned: profile.is_banned || false,
        completedPurchases: profile.completed_purchases || 0,
        paymentMethods: [],
        created_at: profile.created_at || profile.joined_at || '',
      };
    } catch (e) {
      console.error('fetchUserProfile error:', e);
      return null;
    }
  }, []);

  // Load demo user from AsyncStorage (used by LoginModal demo login)
  const loadDemoUser = useCallback(async () => {
    try {
      const savedUser = await AsyncStorage.getItem("sokchad_user");
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        const numericId = parsed.seller_id || parsed.numeric_id || parsed.numericId || String(parsed.id ?? "").padStart(10, "0");
        setUser({
          id: String(parsed.id ?? ""),
          numericId: numericId,
          name: parsed.name || parsed.username || "",
          username: parsed.username || "",
          email: parsed.email || "",
          phone: parsed.phone || "",
          avatar: parsed.avatar || "",
          coverImage: parsed.coverImage || "",
          role: parsed.role || "buyer",
          isSeller: parsed.role === "seller" || parsed.role === "super_admin" || parsed.isSeller || false,
          sellerId: parsed.sellerId || undefined,
          isVerified: parsed.isVerified || false,
          isVerifiedBuyer: parsed.isVerifiedBuyer || false,
          isBanned: parsed.isBanned || false,
          completedPurchases: parsed.completedPurchases || 0,
          paymentMethods: parsed.paymentMethods || [],
          created_at: parsed.created_at || "",
        });
      }
    } catch (e) {}
  }, []);
  const refreshUserProfile = useCallback(async () => {
    if (!authUser) return;
    const profile = await fetchUserProfile(authUser.id, authUser.email);
    if (profile) {
      setUser(profile);
    }
  }, [authUser, fetchUserProfile]);

  // ─── React to real auth state changes ───
  // Primary: Supabase auth listener (works even if template useAuth is disabled)
  useEffect(() => {
    // Check for existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUserProfile(session.user.id, session.user.email || '').then(profile => {
          if (profile) {
            setUser(profile);
            if (profile.username) {
              setRegisteredUsernames(prev => {
                const lower = profile.username.toLowerCase();
                if (prev.includes(lower)) return prev;
                return [...prev, lower];
              });
            }
          }
        });
        // Load favorites from Supabase
        supabase.from('favorites').select('product_id').eq('user_id', session.user.id).then(({ data }) => {
          if (data && data.length > 0) {
            setFavorites(data.map((f: any) => f.product_id));
          }
        }).then(() => {}, () => {});
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        fetchUserProfile(session.user.id, session.user.email || '').then(profile => {
          if (profile) setUser(profile);
        });
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setFavorites([]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

  // Legacy: also react to template auth (for backward compat)
  useEffect(() => {
    if (authLoading) return;
    if (authUser) {
      fetchUserProfile(authUser.id, authUser.email).then(profile => {
        if (profile) setUser(profile);
      });
    } else {
      // No Supabase session — try PHP API token from AsyncStorage
      (async () => {
        try {
          const savedUser = await AsyncStorage.getItem('sokchad_user');
          if (savedUser) {
            const parsed = JSON.parse(savedUser);
            // Generate a numeric ID from user id if not provided
            const numericId = parsed.seller_id || parsed.numeric_id || String(parsed.id ?? '').padStart(10, '0');
            // Build a User object from the PHP API user data
            setUser({
              id: String(parsed.id ?? ''),
              numericId: numericId,
              name: parsed.name || parsed.full_name || parsed.username || '',
              username: parsed.username || '',
              email: parsed.email || '',
              phone: parsed.phone || '',
              avatar: parsed.avatar_url || parsed.avatar || '',
              coverImage: parsed.cover_url || parsed.cover_image || parsed.coverImage || '',
              role: parsed.role || 'buyer',
              isSeller: parsed.role === 'seller' || parsed.role === 'super_admin' || parsed.isSeller || false,
              sellerId: parsed.seller_id || undefined,
              isVerified: parsed.is_verified || parsed.isVerified || false,
              isVerifiedBuyer: parsed.is_verified || parsed.isVerifiedBuyer || false,
              isBanned: parsed.is_banned || false,
              completedPurchases: parsed.total_purchases || 0,
              paymentMethods: parsed.paymentMethods || [],
              created_at: parsed.created_at || parsed.joined_at || '',
            });

            // ALWAYS fetch fresh profile from PHP API to override stale AsyncStorage data.
            // This runs after loading from AsyncStorage so the user sees immediately,
            // then gets refreshed with the latest DB data (avatar, cover, name, etc.).
            try {
              const p = await apiFetchProfile();
              if (p) {
                // Build a complete fresh User object mapping ALL API fields
                const freshUser = {
                  id: String(p.id ?? parsed.id ?? ''),
                  numericId: p.seller_id || p.numeric_id || numericId,
                  name: p.username || p.full_name || p.name || parsed.name || '',
                  username: p.username || parsed.username || '',
                  email: p.email || parsed.email || '',
                  phone: p.phone || parsed.phone || '',
                  avatar: p.avatar_url || p.avatar || parsed.avatar || '',
                  coverImage: p.cover_url || p.cover_image || p.coverImage || parsed.coverImage || '',
                  role: p.role || parsed.role || 'buyer',
                  isSeller: p.is_seller || p.role === 'seller' || p.role === 'super_admin' || parsed.isSeller || false,
                  sellerId: p.seller_id || parsed.sellerId || undefined,
                  isVerified: p.is_verified || parsed.isVerified || false,
                  isVerifiedBuyer: p.is_verified || parsed.isVerifiedBuyer || false,
                  isBanned: p.is_banned || false,
                  completedPurchases: p.total_purchases || p.total_sales || parsed.completedPurchases || 0,
                  paymentMethods: parsed.paymentMethods || [],
                  created_at: p.created_at || p.joined_at || parsed.created_at || '',
                };
                // Update React state with fresh DB data
                setUser(freshUser);
                // Persist fresh DB data to AsyncStorage so it survives logout/restart
                await AsyncStorage.setItem('sokchad_user', JSON.stringify({
                  ...p,
                  ...freshUser,
                  // Keep API field names for compatibility with signInWithPhp format
                  avatar_url: p.avatar_url || p.avatar || '',
                  cover_url: p.cover_url || p.cover_image || '',
                  full_name: p.full_name || p.username || '',
                  name: freshUser.name,
                  avatar: freshUser.avatar,
                  coverImage: freshUser.coverImage,
                })).catch(() => {});
              }
            } catch (e) {
              console.log('Profile fetch error:', e);
            }
          }
        } catch (e) {
          console.log('PHP session restore error:', e);
        }
      })();
    }
  }, [authUser, authLoading, fetchUserProfile]);
  // Auto demo login
  useEffect(() => {
    if (!authLoading && !authUser && !user) {
      (async () => {
        try {
          const demoFlag = await AsyncStorage.getItem('sokchad_demo_logged_in');
          if (demoFlag === 'true') {
            const savedUser = await AsyncStorage.getItem('sokchad_user');
            if (savedUser) {
              const parsed = JSON.parse(savedUser);
              setUser({
                id: String(parsed.id ?? ''), numericId: parsed.numericId || String(parsed.id ?? '').padStart(10, '0'),
                name: parsed.name || parsed.username || '', username: parsed.username || '', email: parsed.email || '',
                phone: parsed.phone || '', avatar: parsed.avatar || DEFAULT_AVATAR, coverImage: parsed.coverImage || DEFAULT_COVER,
                role: parsed.role || 'buyer', isSeller: parsed.isSeller || false, sellerId: parsed.sellerId || undefined,
                isVerified: parsed.isVerified || false, isVerifiedBuyer: parsed.isVerifiedBuyer || false,
                isBanned: parsed.isBanned || false, completedPurchases: parsed.completedPurchases || 0,
                paymentMethods: parsed.paymentMethods || [], created_at: parsed.created_at || '',
              });
            }
          }
        } catch (e) { console.log('Demo restore error:', e); }
      })();
    }
  }, [authLoading, authUser, user]);

  // ─── Fetch real buyer orders & stats from PHP API when logged in ───
  // Runs after the user session restore logic above. Uses the JWT stored in
  // AsyncStorage to call api_orders.php (orders list) and api_buyer_stats.php
  // (buyer statistics). Both calls are wrapped in a timeout + try/catch so a
  // network failure never blocks the app.
  useEffect(() => {
    if (!user) {
      // Not logged in — clear any previously fetched buyer data.
      setBuyerOrders([]);
      setBuyerCompletedOrders([]);
      setBuyerStats(null);
      return;
    }

    let cancelled = false;
    const ORDER_FETCH_TIMEOUT = 15000; // 15s

    (async () => {
      try {
        // Race both fetches against an overall timeout so we never hang.
        const [ordersRes, statsRes] = await Promise.allSettled([
          Promise.race([
            fetchUserOrders('buyer'),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('orders timeout')), ORDER_FETCH_TIMEOUT),
            ),
          ]),
          Promise.race([
            fetchBuyerStats(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('stats timeout')), ORDER_FETCH_TIMEOUT),
            ),
          ]),
        ]);

        if (cancelled) return;

        // Orders list (api_orders.php)
        if (ordersRes.status === 'fulfilled' && ordersRes.value.success && Array.isArray(ordersRes.value.data)) {
          const allOrders = ordersRes.value.data as OrderFromAPI[];
          if (!cancelled) setBuyerOrders(allOrders);
          // Completed orders subset — used for "trusted buyer" badge, reviews, etc.
          const completed = allOrders.filter(o => o.status === 'completed');
          if (!cancelled) setBuyerCompletedOrders(completed);
        } else if (ordersRes.status === 'rejected') {
          console.log('fetchUserOrders error:', ordersRes.reason?.message || ordersRes.reason);
        }

        // Fetch seller orders if user is a seller
        if (user?.isSeller || user?.role === 'seller' || user?.role === 'super_admin') {
          try {
            const sellerRes = await Promise.race([
              fetchUserOrders('seller'),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('seller orders timeout')), ORDER_FETCH_TIMEOUT),
              ),
            ]);
            if (!cancelled && sellerRes.success && Array.isArray(sellerRes.data)) {
              setSellerOrders(sellerRes.data as OrderFromAPI[]);
            }
          } catch (e) {
            console.log('fetchSellerOrders error:', e);
          }
        }

        // Fetch real conversations
        try {
          const convs = await apiFetchConversations();
          if (!cancelled && Array.isArray(convs)) {
            setConversations(convs.map((c: any) => ({
              id: String(c.id),
              buyerId: String(c.buyer_id || c.buyerId || ''),
              sellerId: String(c.seller_id || c.sellerId || ''),
              productId: String(c.product_id || c.productId || ''),
              messages: (c.messages || []).map((m: any) => ({
                id: String(m.id),
                senderId: String(m.sender_id || m.senderId || ''),
                text: m.text || m.content || '',
                type: m.type || 'text',
                timestamp: m.created_at || m.timestamp || new Date().toISOString(),
              })),
              lastMessage: c.last_message || c.lastMessage || '',
              lastMessageTime: c.last_message_time || c.updated_at || new Date().toISOString(),
              unreadCount: c.unread_count || 0,
            })));
          }
        } catch (e) {
          console.log('fetchConversations error:', e);
        }

        // Buyer stats (api_buyer_stats.php)
        if (statsRes.status === 'fulfilled' && statsRes.value.success && statsRes.value.data) {
          if (!cancelled) setBuyerStats(statsRes.value.data as BuyerStats);
        } else if (statsRes.status === 'rejected') {
          console.log('fetchBuyerStats error:', statsRes.reason?.message || statsRes.reason);
        }
      } catch (e) {
        if (!cancelled) console.log('Buyer orders/stats fetch error:', e);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  // ─── AsyncStorage initialization for non-auth data ───
  useEffect(() => {
    (async () => {
      try {
        const lang = await AsyncStorage.getItem('language').catch(() => null);
        const dark = await AsyncStorage.getItem('isDark').catch(() => null);
        const favs = await AsyncStorage.getItem('favorites').catch(() => null);
        const usernames = await AsyncStorage.getItem('registeredUsernames').catch(() => null);
        const refs = await AsyncStorage.getItem('usedReferenceIds').catch(() => null);
        const bl = await AsyncStorage.getItem('blacklist').catch(() => null);
        const staff = await AsyncStorage.getItem('staffMembers').catch(() => null);
        const countries = await AsyncStorage.getItem('enabledCountries').catch(() => null);
        const savedEnabledLangs = await AsyncStorage.getItem('enabledLanguages').catch(() => null);
        if (savedEnabledLangs) {
          try { const parsed = JSON.parse(savedEnabledLangs); if (Array.isArray(parsed) && parsed.length > 0) setEnabledLanguages(parsed); } catch {}
        }
        if (lang) {
          setLanguageState(lang as Language);
          // RTL is handled manually in components — no forceRTL needed
        }
        if (dark) setIsDark(dark === 'true');
        if (favs) try { setFavorites(JSON.parse(favs)); } catch {}
        if (usernames) try { setRegisteredUsernames(JSON.parse(usernames)); } catch {}
        if (refs) try { setUsedReferenceIds(JSON.parse(refs)); } catch {}
        if (bl) try { setBlacklist(JSON.parse(bl)); } catch {}
        if (staff) try { setStaffMembers(JSON.parse(staff)); } catch {}
        if (countries) try { setEnabledCountriesState(JSON.parse(countries)); } catch {}
        // Load persisted follow/notification state
        try {
          const savedFollowNotif = await AsyncStorage.getItem('sokchad_follow_notif_state');
          if (savedFollowNotif) setFollowNotifState(JSON.parse(savedFollowNotif));
          const savedFollowing = await AsyncStorage.getItem('sokchad_following_list');
          if (savedFollowing) { const parsed = JSON.parse(savedFollowing); if (Array.isArray(parsed)) setFollowingList(parsed); }
        } catch {}
        // Load saved city
        try {
          const savedCity = await AsyncStorage.getItem('sokchad_selected_city');
          if (savedCity && savedCity !== 'all') {
            setSelectedCityState(savedCity);
            setFiltersState(prev => ({ ...prev, location: savedCity }));
          }
        } catch {}
      } catch (e) {
        console.log('AsyncStorage init error:', e);
      } finally {
        // Set isReady IMMEDIATELY — don't block UI on product/branding fetches.
        setIsReady(true);

        // Check AsyncStorage for saved user (fast, synchronous-ish)
        // If found, setUser is called by the auth effects already.
        // If not found, mark userChecked=true so _layout knows there's no session.
        AsyncStorage.getItem('sokchad_user').then(savedUser => {
          if (!savedUser) {
            // No saved session → user is definitively null
            setUserChecked(true);
          }
          // If savedUser exists, the auth effects will load it.
          // We set userChecked after a short delay to give them time.
          // But also mark it true if authLoading is already false.
        }).catch(() => setUserChecked(true));

        // Load products in background (non-blocking)
        loadProductsFromDB().catch(e => console.log('Products load error:', e));

        // Load branding in background (non-blocking)
        Promise.all([
          getAdBanners().catch(() => null),
          getStoreLogo().catch(() => null),
        ]).then(([banners, logo]) => {
          if (banners && Array.isArray(banners) && banners.length > 0) setAppBanners(banners);
          if (logo && typeof logo === 'string') setAppStoreLogo(logo);
        }).catch(e => console.log('Branding error:', e));
        initializeNotifications().catch(() => {});
        refreshUsers().catch(() => {});
        // Load payment methods and shipping companies from PHP API
        (async () => {
          try {
            const pmRes = await fetch('https://souktchad.shop/api/payment_methods.php');
            const pmData = await pmRes.json();
            if (pmData.success && pmData.data && Array.isArray(pmData.data)) {
              const methods = pmData.data.map((m: any) => ({
                id: m.id, name: m.name, logo: m.logo_url || '', color: m.color || '#FF7A00', instructions: m.instructions || ''
              }));
              setPaymentMethodsList(methods);
            }
          } catch (e) { console.log('Payment methods load error:', e); }
          try {
            const shRes = await fetch('https://souktchad.shop/api/categories.php');
            const shData = await shRes.json();
            if (shData.success && shData.data && Array.isArray(shData.data)) {
              // Sort raw data by sort_order before mapping
              const sorted = [...shData.data]
                .filter((c: any) => c.is_active === 1 || c.is_active === true || c.is_active === '1')
                .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
              const apiCategories: Category[] = sorted.map((c: any) => ({
                id: String(c.id),
                parentId: c.parent_id || undefined,
                hasChildren: c.has_children || false,
                name: {
                  en: c.name_en || c.name?.en || String(c.id),
                  fr: c.name_fr || c.name?.fr || c.name_en || String(c.id),
                  ar: c.name_ar || c.name?.ar || c.name_en || String(c.id),
                },
                icon: c.icon || 'category',
                color: c.color || '#FF7A00',
              }));
              if (apiCategories.length > 0) {
                setCategories(apiCategories);
              }
            }
          } catch (e) { console.log('Categories load error:', e); }
        })();
      }
    })();
  }, []);

  useEffect(() => { AsyncStorage.setItem('favorites', JSON.stringify(favorites)).catch(() => {}); }, [favorites]);
  useEffect(() => { AsyncStorage.setItem('language', language).catch(() => {}); }, [language]);
  useEffect(() => { AsyncStorage.setItem('isDark', String(isDark)).catch(() => {}); }, [isDark]);
  useEffect(() => { AsyncStorage.setItem('registeredUsernames', JSON.stringify(registeredUsernames)).catch(() => {}); }, [registeredUsernames]);
  useEffect(() => { AsyncStorage.setItem('usedReferenceIds', JSON.stringify(usedReferenceIds)).catch(() => {}); }, [usedReferenceIds]);
  useEffect(() => { AsyncStorage.setItem('blacklist', JSON.stringify(blacklist)).catch(() => {}); }, [blacklist]);
  useEffect(() => { AsyncStorage.setItem('staffMembers', JSON.stringify(staffMembers)).catch(() => {}); }, [staffMembers]);
  useEffect(() => { AsyncStorage.setItem('enabledCountries', JSON.stringify(enabledCountries)).catch(() => {}); }, [enabledCountries]);

  const t = useCallback((key: string) => translate(language, key as any), [language]);
  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    AsyncStorage.setItem('language', lang).catch(() => {});
    // RTL is handled manually via isRTL = language === 'ar' in components.
    // Do NOT use I18nManager.forceRTL — it causes double-reversal with manual RTL.
  }, []);
  const toggleLanguageEnabled = useCallback((lang: string) => {
    setEnabledLanguages(prev => {
      let next: string[];
      if (prev.includes(lang)) {
        if (prev.length <= 1) return prev; // Can't disable the last language
        next = prev.filter(l => l !== lang);
      } else {
        next = [...prev, lang];
      }
      AsyncStorage.setItem('enabledLanguages', JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);
  const toggleDarkMode = useCallback(() => { setIsDark(prev => !prev); }, []);

  const isUsernameTaken = useCallback((username: string) => {
    return registeredUsernames.includes(username.trim().toLowerCase());
  }, [registeredUsernames]);

  const isReferenceIdUsed = useCallback((refId: string) => {
    return usedReferenceIds.includes(refId.trim());
  }, [usedReferenceIds]);

  const logout = useCallback(async () => {
    try {
      await signOutFromSupabase();
      await authLogout();
    } catch (e) {
      console.error('Logout error:', e);
    }
    // Clear AsyncStorage session data to prevent auto re-login
    await AsyncStorage.removeItem('sokchad_user').catch(() => {});
    await AsyncStorage.removeItem('sokchad_auth_token').catch(() => {});
    await AsyncStorage.removeItem('sokchad_demo_logged_in').catch(() => {});
    setUser(null);
  }, [authLogout]);

  const processProductImage = useCallback(async (uploadedUrl: string): Promise<string | null> => {
    // Server-side whitening pipeline (off the UI render path). Original kept.
    try {
      const token = await apiGetAuthToken();
      const res = await fetch(`${API_BASE}/api_product_image_process.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify({ url: uploadedUrl }),
      });
      const json = await res.json();
      if (json.success && json.data?.processed_url) return json.data.processed_url;
      // Fallback: keep ORIGINAL displayed inside the white frame (documented fallback)
      return uploadedUrl;
    } catch (e) { console.log('processProductImage error:', e); return uploadedUrl; }
  }, []);

  const updateUserAvatar = useCallback(async (uri: string) => {
    setUser(prev => { if (!prev) return null; return { ...prev, avatar: uri }; });
    // Always save to PHP API
    try {
      // Upload image first if it's a local URI
      if (uri && !uri.startsWith('http')) {
        const uploadedUrl = await uploadImage(uri);
        if (uploadedUrl) {
          await apiUpdateProfile({ avatar_url: uploadedUrl });
          setUser(prev => { if (!prev) return null; return { ...prev, avatar: uploadedUrl }; });
        } else {
          await apiUpdateProfile({ avatar_url: uri });
        }
      } else {
        await apiUpdateProfile({ avatar_url: uri });
      }
      // Update AsyncStorage saved user
      const savedUser = await AsyncStorage.getItem('sokchad_user').catch(() => null);
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        parsed.avatar_url = uri.startsWith('http') ? uri : (await uploadImage(uri)) || uri;
        await AsyncStorage.setItem('sokchad_user', JSON.stringify(parsed)).catch(() => {});
      }
    } catch (e) { console.log('updateUserAvatar API error:', e); }
  }, [uploadImage]);

  const updateUserCover = useCallback(async (uri: string) => {
    setUser(prev => { if (!prev) return null; return { ...prev, coverImage: uri }; });
    // Always save to PHP API
    try {
      if (uri && !uri.startsWith('http')) {
        const uploadedUrl = await uploadImage(uri);
        if (uploadedUrl) {
          await apiUpdateProfile({ cover_url: uploadedUrl });
          setUser(prev => { if (!prev) return null; return { ...prev, coverImage: uploadedUrl }; });
        } else {
          await apiUpdateProfile({ cover_url: uri });
        }
      } else {
        await apiUpdateProfile({ cover_url: uri });
      }
      // Update AsyncStorage saved user
      const savedUser = await AsyncStorage.getItem('sokchad_user').catch(() => null);
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        const finalUrl = uri.startsWith('http') ? uri : (await uploadImage(uri)) || uri;
        parsed.cover_url = finalUrl;
        await AsyncStorage.setItem('sokchad_user', JSON.stringify(parsed)).catch(() => {});
      }
    } catch (e) { console.log('updateUserCover API error:', e); }
  }, [uploadImage]);

  const toggleFavorite = useCallback((productId: string) => {
    setFavorites(prev => {
      const isFav = prev.includes(productId);
      // Sync to Supabase (fire-and-forget)
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return;
        if (!isFav) {
          supabase.from('favorites').insert({ user_id: user.id, product_id: productId }).then(() => {}).then(() => {}, () => {});
        } else {
          supabase.from('favorites').delete().eq('user_id', user.id).eq('product_id', productId).then(() => {}).then(() => {}, () => {});
        }
        }).then(() => {}, () => {});
      return isFav ? prev.filter(id => id !== productId) : [...prev, productId];
    });
  }, []);

  const isFavorite = useCallback((productId: string) => favorites.includes(productId), [favorites]);

  // ─── Follow System ───
  const apiAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = await AsyncStorage.getItem('sokchad_auth_token') || '';
    return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
  }, []);

  const fetchFollowStatus = useCallback(async (sellerId: string) => {
    try {
      const token = await AsyncStorage.getItem('sokchad_auth_token');
      if (!token) {
        // No token — fall back to local session state
        return {
          following: followingList.includes(sellerId),
          notifications_enabled: followNotifState[sellerId] ?? false,
        };
      }
      const res = await fetch(`https://souktchad.shop/api/follows.php?seller_id=${sellerId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.data) {
        const following = !!data.data.following;
        const notifications_enabled = !!data.data.notifications_enabled;
        // Cache locally so the state persists even if the API later fails
        setFollowingList(prev => following ? (prev.includes(sellerId) ? prev : [...prev, sellerId]) : prev.filter(id => id !== sellerId));
        setFollowNotifState(prev => ({ ...prev, [sellerId]: notifications_enabled }));
        return { following, notifications_enabled };
      }
    } catch (e) { console.log('fetchFollowStatus error:', e); }
    // API failed — fall back to local session state
    return {
      following: followingList.includes(sellerId),
      notifications_enabled: followNotifState[sellerId] ?? false,
    };
  }, [followingList, followNotifState]);

  const toggleFollow = useCallback(async (sellerId: string) => {
    try {
      const token = await AsyncStorage.getItem('sokchad_auth_token');
      const isFollowing = followingList.includes(sellerId);

      // Helper to bump the followers_count in followStats immediately
      const adjustFollowerCount = (delta: number) => {
        setFollowStats(prev => {
          const current = prev[sellerId] ?? mockSellerStats[sellerId] ?? { followers_count: 0 };
          const base = typeof current?.followers_count === 'number' ? current.followers_count : 0;
          return { ...prev, [sellerId]: { ...current, followers_count: Math.max(0, base + delta) } };
        });
      };

      // Try API first
      if (token) {
        try {
          const res = await fetch('https://souktchad.shop/api/follows.php', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ seller_id: parseInt(sellerId), notifications_enabled: 1 }),
          });
          const data = await res.json();
          if (data.success) {
            if (data.data.following) {
              setFollowingList(prev => [...prev, sellerId]);
              adjustFollowerCount(1);
              // Add to followedSellers for profile display
              const seller = sellers.find(s => String(s.id) === sellerId);
              if (seller) setFollowedSellers(prev => prev.includes(seller) ? prev : [...prev, seller]);
            } else {
              setFollowingList(prev => prev.filter(id => id !== sellerId));
              adjustFollowerCount(-1);
              setFollowedSellers(prev => prev.filter((s: any) => String(s.id) !== sellerId));
            }
            return data.data.following;
          }
        } catch (apiErr) {
          console.log('toggleFollow API error, using local:', apiErr);
        }
      }

      // Fallback: toggle locally (works without backend)
      if (isFollowing) {
        setFollowingList(prev => prev.filter(id => id !== sellerId));
        adjustFollowerCount(-1);
        setFollowedSellers(prev => prev.filter((s: any) => String(s.id) !== sellerId));
        return false;
      } else {
        setFollowingList(prev => [...prev, sellerId]);
        adjustFollowerCount(1);
        const seller = sellers.find(s => String(s.id) === sellerId);
        if (seller) setFollowedSellers(prev => prev.includes(seller) ? prev : [...prev, seller]);
        return true;
      }
    } catch (e) { console.log('toggleFollow error:', e); }
    return false;
  }, [followingList, sellers]);

  const toggleFollowNotifications = useCallback(async (sellerId: string, enabled: boolean) => {
    try {
      // Update local state immediately so the toggle reflects instantly and
      // persists for the session even if the API call fails.
      setFollowNotifState(prev => ({ ...prev, [sellerId]: enabled }));
      const token = await AsyncStorage.getItem('sokchad_auth_token');
      
      // Try API first
      if (token) {
        try {
          const res = await fetch('https://souktchad.shop/api/follows.php', {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ seller_id: parseInt(sellerId), notifications_enabled: enabled ? 1 : 0 }),
          });
          const data = await res.json();
          if (data.success) return true;
        } catch (apiErr) {
          console.log('toggleFollowNotifications API error, using local:', apiErr);
        }
      }
      
      // Fallback: always succeed locally (state already updated above)
      return true;
    } catch (e) { console.log('toggleFollowNotifications error:', e); }
    return false;
  }, []);

  const fetchSellerStats = useCallback(async (sellerId: string) => {
    try {
      const res = await fetch(`https://souktchad.shop/api/seller_stats.php?id=${sellerId}`);
      const data = await res.json();
      if (data.success && data.data) {
        setFollowStats(prev => ({ ...prev, [sellerId]: data.data }));
        return data.data;
      }
    } catch (e) { console.log('fetchSellerStats error:', e); }
    // Fallback: use mock seller stats when API is unavailable
    const mock = mockSellerStats[sellerId];
    if (mock) {
      setFollowStats(prev => ({ ...prev, [sellerId]: mock }));
      return mock;
    }
    return null;
  }, []);

  const fetchFollowedSellers = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('sokchad_auth_token');
      if (!token) return [];
      const res = await fetch('https://souktchad.shop/api/follows.php', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.data && data.data.items) {
        const sellers = data.data.items;
        setFollowedSellers(sellers);
        setFollowingList(sellers.map((s: any) => String(s.seller_id)));
        return sellers;
      }
    } catch (e) { console.log('fetchFollowedSellers error:', e); }
    return [];
  }, []);

  const fetchFollowedProducts = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('sokchad_auth_token');
      if (!token) return [];
      const res = await fetch('https://souktchad.shop/api/followed_products.php', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.data && data.data.items) {
        setFollowedProducts(data.data.items);
        return data.data.items;
      }
    } catch (e) { console.log('fetchFollowedProducts error:', e); }
    return [];
  }, []);

  const addProduct = useCallback(async (product: Omit<Product, 'id' | 'postedDate' | 'isPinned' | 'isFeatured' | 'views'>) => {
    // INSTANT: create product locally first, then try DB in background
    const newProduct: Product = {
      ...product,
      id: `p${Date.now()}`,
      postedDate: new Date().toISOString().split('T')[0],
      isPinned: false, isFeatured: false, views: 0,
      stock: (product as any).stock || 0,
      sellerId: user?.id || 'user1',
      sellerName: user?.name || user?.username || '',
      sellerAvatar: (user as any)?.avatar || '',
      sellerVerified: (user as any)?.isVerified || false,
    };
    // Add to state IMMEDIATELY (instant publish)
    setProducts(prev => [newProduct, ...prev]);
    // Persist to AsyncStorage IMMEDIATELY
    try {
      const existing = JSON.parse(await AsyncStorage.getItem('sokchad_products_local') || '[]');
      existing.unshift(newProduct);
      await AsyncStorage.setItem('sokchad_products_local', JSON.stringify(existing.slice(0, 50)));
    } catch (e) { console.log('persist product error:', e); }
    // Upload + whiten product images in background; replace local uris with processed urls
    if (user?.id) {
      (async () => {
        try {
          const finalImages: string[] = [];
          for (const uri of product.images) {
            if (uri && !uri.startsWith('http')) {
              const uploadedUrl = await uploadImage(uri);
              if (uploadedUrl) {
                const processedUrl = await processProductImage(uploadedUrl);
                finalImages.push(processedUrl || uploadedUrl);
                continue;
              }
            }
            finalImages.push(uri);
          }
          const updated = { ...product, images: finalImages };
          const { data: dbProduct2, error: dbErr2 } = await dbCreateProduct(updated, user.id);
          if (!dbErr2 && dbProduct2?.id) {
            setProducts(prev => prev.map(p => p.id === newProduct.id ? { ...p, id: dbProduct2.id, images: finalImages } : p));
          }
        } catch (e) { console.log('product image upload/process error:', e); }
      })();
    }
    // Try DB in background (non-blocking) — if it succeeds, update the ID
    if (user?.id) {
      dbCreateProduct(product, user.id).then(({ data: dbProduct, error }) => {
        if (!error && dbProduct?.id) {
          // Update the local product ID to match DB
          setProducts(prev => prev.map(p => p.id === newProduct.id ? { ...p, id: dbProduct.id } : p));
        }
      }).catch(e => console.log('DB create background error:', e));
    }
  }, [user?.id]);

  const setProductDiscount = useCallback((productId: string, percent: number, durationDays: number) => {
    const clampedPercent = Math.min(30, Math.max(0, percent));
    const clampedDays = Math.min(7, Math.max(1, durationDays));
    const until = new Date();
    until.setDate(until.getDate() + clampedDays);
    setProducts(prev => prev.map(p =>
      p.id === productId ? { ...p, discountPercent: clampedPercent, discountUntil: until.toISOString() } : p
    ));
  }, []);

  const removeProductDiscount = useCallback((productId: string) => {
    setProducts(prev => prev.map(p =>
      p.id === productId ? { ...p, discountPercent: undefined, discountUntil: undefined } : p
    ));
  }, []);

  const sendMessage = useCallback((conversationId: string, text: string) => {
    if (!user) return;
    const senderLang = detectLanguage(text);
    const translations = translateMessageFull(text, senderLang);
    const newMsg: Message = {
      id: `m${Date.now()}`, senderId: user.id, text, type: 'text',
      timestamp: new Date().toISOString(),
      translatedText: translations,
    };
    setConversations(prev => prev.map(c =>
      c.id === conversationId
        ? { ...c, messages: [...c.messages, newMsg], lastMessage: text, lastMessageTime: newMsg.timestamp }
        : c
    ));
    // Persist to PHP API (fire-and-forget; local state already updated)
    apiSendMessage(conversationId, text).catch(() => {});
    // NO auto-reply — real messaging only
  }, [user, language]);

  const startConversation = useCallback((sellerId: string, productId: string, initialMessage: string) => {
    if (!user) return '';
    const existing = conversationsRef.current.find(c => c.sellerId === sellerId && c.productId === productId && c.buyerId === user.id);
    if (existing) { sendMessage(existing.id, initialMessage); return existing.id; }
    const convId = `conv${Date.now()}`;
    const senderLang = detectLanguage(initialMessage);
    const translations = translateMessageFull(initialMessage, senderLang);
    const newConv: Conversation = {
      id: convId, buyerId: user.id, sellerId, productId,
      messages: [{ id: `m${Date.now()}`, senderId: user.id, text: initialMessage, type: 'text', timestamp: new Date().toISOString(), translatedText: translations }],
      lastMessage: initialMessage, lastMessageTime: new Date().toISOString(), unreadCount: 0,
    };
    setConversations(prev => [newConv, ...prev]);
    // Persist to PHP API (fire-and-forget; local state already updated)
    apiStartConversation(sellerId, productId, initialMessage).catch(() => {});
    return convId;
  }, [user, sendMessage]);

  const placeOrder = useCallback((productId: string, paymentMethodId: string, screenshotUri: string, buyerCity: string, shippingId: string, quantity: number = 1): { success: boolean; error?: string } => {
    if (!user) return { success: false, error: 'not_logged_in' };
    const product = products.find(p => p.id === productId);
    if (!product) return { success: false, error: 'product_not_found' };
    const hasDiscount = (product.discountPercent ?? 0) > 0 && product.discountUntil && new Date(product.discountUntil).getTime() > Date.now();
    const discount = hasDiscount ? Math.min(30, product.discountPercent || 0) : 0;
    const unitPrice = hasDiscount ? Math.round(product.price * (1 - discount / 100)) : product.price;
    const finalAmount = unitPrice * Math.max(1, quantity);
    // Generate unique 20-digit random order number
    const orderNumber = generateOrderNumber();
    const newOrder: Order = {
      id: `ord${Date.now()}`, orderNumber, productId, buyerId: user.id, sellerId: product.sellerId,
      amount: finalAmount, paymentMethodId, referenceId: screenshotUri,
      status: 'pending', createdAt: new Date().toISOString(), buyerPhone: `${buyerCity}|${shippingId}|qty:${quantity}`,
    };
    setOrders(prev => [newOrder, ...prev]);
    const pTitle = product?.title?.en || 'Product';
    sendOrderNotification('new_order', pTitle, language).catch(() => {});

    // ─── Save order to PHP API (real DB) ───
    (async () => {
      try {
        const headers = await apiAuthHeaders();
        await fetch(`${API_BASE}/api_orders.php`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            product_id: productId,
            seller_id: product.sellerId,
            payment_method_id: paymentMethodId,
            reference_id: screenshotUri,
            buyer_city: buyerCity,
            shipping_id: shippingId,
            quantity: quantity,
            amount: finalAmount,
          }),
        });
      } catch (e) {
        console.log('placeOrder API error:', e);
      }
    })();

    return { success: true };
  }, [user, products, language]);

  const addShippingCompany = useCallback((name: string, phone: string, description: string) => {
    const id = 'ship_' + Date.now();
    setShippingCompanies(prev => [...prev, { id, name, phone, description, isActive: true, createdAt: new Date().toISOString() }]);
  }, []);

  const removeShippingCompany = useCallback((id: string) => {
    setShippingCompanies(prev => prev.filter(s => s.id !== id));
  }, []);

  const toggleShippingCompanyActive = useCallback((id: string) => {
    setShippingCompanies(prev => prev.map(s => s.id === id ? { ...s, isActive: !s.isActive } : s));
  }, []);

  const confirmOrderReceived = useCallback((orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      return { ...o, status: 'confirmed' as const };
    }));
    if (order) {
      const prod = products.find(p => p.id === order.productId);
      sendOrderNotification('order_confirmed', prod?.title?.en || 'Product', language).catch(() => {});
    }
  }, [orders, products, language]);

  const updateOrderStatus = useCallback((orderId: string, status: Order['status']) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      const updates: Partial<Order> = { status };
      if (status === 'delivered') updates.deliveredAt = new Date().toISOString();
      if (status === 'completed') updates.completedAt = new Date().toISOString();
      return { ...o, ...updates };
    }));
  }, []);

  const markItemReceived = useCallback((orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      return { ...o, status: 'completed' as const, completedAt: new Date().toISOString() };
    }));
    if (order) {
      const prod = products.find(p => p.id === order.productId);
      sendOrderNotification('order_completed', prod?.title?.en || 'Product', language).catch(() => {});
    }
    setUser(prev => {
      if (!prev || prev.role !== 'buyer') return prev;
      const newCount = (prev.completedPurchases || 0) + 1;
      const isVerifiedBuyer = newCount >= 100;
      return { ...prev, completedPurchases: newCount, isVerifiedBuyer };
    });
  }, [orders, products, language]);

  const addReview = useCallback((orderId: string, productId: string, sellerId: string, rating: number, text: string, photoUri?: string) => {
    if (!user) return;
    const newReview: Review = {
      id: `rev${Date.now()}`, orderId, productId, buyerId: user.id, buyerName: user.name,
      sellerId, rating, text, photoUri, createdAt: new Date().toISOString(),
    };
    setReviews(prev => [newReview, ...prev]);
  }, [user]);

  const getReviewsForProduct = useCallback((productId: string) => reviews.filter(r => r.productId === productId), [reviews]);
  const getReviewsForSeller = useCallback((sellerId: string) => reviews.filter(r => r.sellerId === sellerId), [reviews]);

  const togglePinProduct = useCallback((productId: string, durationDays: number) => {
    setProducts(prev => prev.map(p => {
      if (p.id !== productId) return p;
      if (durationDays === 0) return { ...p, isPinned: false, pinnedUntil: undefined };
      const until = new Date(); until.setDate(until.getDate() + durationDays);
      return { ...p, isPinned: true, pinnedUntil: until.toISOString() };
    }));
    // Sync to DB
    if (durationDays === 0) {
      dbUpdateProduct(productId, { is_pinned: false, pinned_until: null }).catch(() => {});
    } else {
      const until = new Date(); until.setDate(until.getDate() + durationDays);
      dbUpdateProduct(productId, { is_pinned: true, pinned_until: until.toISOString() }).catch(() => {});
    }
  }, []);

  const toggleSellerVerified = useCallback((sellerId: string, durationDays: number) => {
    setSellers(prev => prev.map(s => {
      if (s.id !== sellerId) return s;
      if (durationDays === 0) {
        unverifyUserInDB(sellerId).catch(() => {});
        return { ...s, isVerified: false, verifiedUntil: undefined };
      }
      const until = new Date(); until.setDate(until.getDate() + durationDays);
      verifyUserInDB(sellerId, until.toISOString()).catch(() => {});
      return { ...s, isVerified: true, verifiedUntil: until.toISOString() };
    }));
  }, []);

  const toggleBanSeller = useCallback((sellerId: string) => {
    setSellers(prev => prev.map(s => {
      if (s.id !== sellerId) return s;
      const newBanned = !s.isBanned;
      if (newBanned) {
        banUserInDB(sellerId, null).catch(() => {});
        setProducts(prods => prods.filter(p => p.sellerId !== sellerId));
      } else {
        unbanUserInDB(sellerId).catch(() => {});
      }
      return { ...s, isBanned: newBanned, bannedUntil: undefined };
    }));
  }, []);

  const permanentBanUser = useCallback((sellerId: string) => {
    const seller = sellers.find(s => s.id === sellerId);
    if (!seller) return;
    const entry: BlacklistEntry = {
      email: seller.name.toLowerCase().replace(/\s+/g, '') + '@sokchad.td',
      phone: seller.phone,
      username: seller.name.toLowerCase(),
      bannedAt: new Date().toISOString(),
    };
    setBlacklist(prev => [...prev, entry]);
    banUserInDB(sellerId, null).catch(() => {});
    setSellers(prev => prev.map(s => s.id === sellerId ? { ...s, isBanned: true, bannedUntil: undefined } : s));
    setProducts(prev => prev.filter(p => p.sellerId !== sellerId));
  }, [sellers]);

  const banUserWithDuration = useCallback((sellerId: string, durationDays: number) => {
    const seller = sellers.find(s => s.id === sellerId);
    if (!seller) return;
    const entry: BlacklistEntry = {
      email: seller.name.toLowerCase().replace(/\s+/g, '') + '@sokchad.td',
      phone: seller.phone,
      username: seller.name.toLowerCase(),
      bannedAt: new Date().toISOString(),
    };
    setBlacklist(prev => [...prev, entry]);
    setSellers(prev => prev.map(s => {
      if (s.id !== sellerId) return s;
      let bannedUntil: string | undefined;
      if (durationDays > 0 && durationDays < 99999) {
        const until = new Date(); until.setDate(until.getDate() + durationDays);
        bannedUntil = until.toISOString();
      }
      banUserInDB(sellerId, bannedUntil || null).catch(() => {});
      return { ...s, isBanned: true, bannedUntil };
    }));
    setProducts(prev => prev.filter(p => p.sellerId !== sellerId));
  }, [sellers]);

  const addPaymentMethod = useCallback((name: string, color: string, instructions: string, logoUrl?: string) => {
    const id = name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    setPaymentMethodsList(prev => [...prev, { id, name, logo: logoUrl || '', color, instructions, isActive: true }]);
  }, []);

  const updatePaymentMethodLogo = useCallback((id: string, logoUrl: string) => {
    setPaymentMethodsList(prev => prev.map(m => m.id === id ? { ...m, logo: logoUrl } : m));
  }, []);

  const updatePaymentMethod = useCallback((id: string, updates: { name?: string; color?: string; instructions?: string; logo?: string }) => {
    setPaymentMethodsList(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  }, []);

  const togglePaymentMethodActive = useCallback((id: string) => {
    setPaymentMethodsList(prev => prev.map(m => m.id === id ? { ...m, isActive: !(m.isActive ?? true) } : m));
  }, []);

  const removePaymentMethod = useCallback((id: string) => {
    setPaymentMethodsList(prev => prev.filter(m => m.id !== id));
  }, []);

  // Return payment methods available for a given country code.
  // A method with no `countries` list (or an empty one) is available everywhere.
  const getPaymentMethodsForCountry = useCallback((countryCode: string): PaymentMethod[] => {
    if (!countryCode) return paymentMethodsList;
    return paymentMethodsList.filter(m => {
      if (m.isActive === false) return false;
      if (!m.countries || m.countries.length === 0) return true;
      return m.countries.includes(countryCode);
    });
  }, [paymentMethodsList]);

  const canSellerRequestVerification = useCallback((sellerId: string): { eligible: boolean; reason?: string } => {
    const seller = sellers.find(s => s.id === sellerId);
    if (!seller) return { eligible: false, reason: 'Seller not found' };
    if (seller.isVerified) return { eligible: false, reason: 'Already verified' };
    if (seller.totalSales < 50) return { eligible: false, reason: `Need ${50 - seller.totalSales} more operations (${seller.totalSales}/50)` };
    const ratingPercent = (seller.rating / 5) * 100;
    if (ratingPercent < 70) return { eligible: false, reason: `Rating too low (${ratingPercent.toFixed(0)}% < 70%)` };
    return { eligible: true };
  }, [sellers]);

  const canUserRequestVerification = useCallback((): { eligible: boolean; reason?: string } => {
    if (!user) return { eligible: false, reason: 'Not logged in' };
    if (user.isVerified || user.isVerifiedBuyer) return { eligible: false, reason: 'Already verified' };
    const hasPending = verificationSubscriptions.some(s => s.userId === user.id && s.status === 'pending');
    if (hasPending) return { eligible: false, reason: 'You have a pending verification request' };
    if (user.isSeller) {
      const sellerData = sellers.find(s => s.id === user.id);
      const totalOps = sellerData?.totalSales || 0;
      if (totalOps < 50) return { eligible: false, reason: `Need ${50 - totalOps} more operations (${totalOps}/50)` };
    } else {
      const buyerCompleted = orders.filter(o => o.buyerId === user.id && o.status === 'completed');
      const uniqueSellers = new Set(buyerCompleted.map(o => o.sellerId));
      const count = uniqueSellers.size;
      if (count < 100) return { eligible: false, reason: `Need ${100 - count} more operations with unique sellers (${count}/100)` };
    }
    return { eligible: true };
  }, [user, sellers, orders, verificationSubscriptions]);

  const requestSellerVerification = useCallback(() => {}, []);

  const addVerificationPlan = useCallback((name: string, durationDays: number, price: number) => {
    setVerificationPlans(prev => [...prev, {
      id: 'vp_' + Date.now(), name, durationDays, price, isActive: true, createdAt: new Date().toISOString(),
    }]);
  }, []);

  const removeVerificationPlan = useCallback((id: string) => {
    setVerificationPlans(prev => prev.filter(p => p.id !== id));
  }, []);

  const toggleVerificationPlanActive = useCallback((id: string) => {
    setVerificationPlans(prev => prev.map(p => p.id === id ? { ...p, isActive: !p.isActive } : p));
  }, []);

  const submitVerificationSubscription = useCallback((planId: string, screenshotUri: string): { success: boolean; error?: string } => {
    if (!user) return { success: false, error: 'Not logged in' };
    const plan = verificationPlans.find(p => p.id === planId);
    if (!plan) return { success: false, error: 'Plan not found' };
    const newSub: VerificationSubscription = {
      id: 'vsub_' + Date.now(), userId: user.id, userName: user.username || user.name,
      userEmail: user.email, userPhone: user.phone, userRole: user.role,
      planId: plan.id, planName: plan.name, amount: plan.price, durationDays: plan.durationDays,
      screenshotUri, status: 'pending', createdAt: new Date().toISOString(),
    };
    setVerificationSubscriptions(prev => [newSub, ...prev]);
    return { success: true };
  }, [user, verificationPlans]);

  const approveVerificationSubscription = useCallback((subId: string) => {
    setVerificationSubscriptions(prev => prev.map(s => {
      if (s.id !== subId) return s;
      return { ...s, status: 'approved' as const };
    }));
    sendVerificationNotification('approved', language).catch(() => {});
    const sub = verificationSubscriptions.find(s => s.id === subId);
    if (sub) {
      const until = new Date();
      until.setDate(until.getDate() + sub.durationDays);
      setSellers(prev => prev.map(s => s.id === sub.userId ? { ...s, isVerified: true, verifiedUntil: until.toISOString() } : s));
      setUser(prev => {
        if (!prev || prev.id !== sub.userId) return prev;
        return { ...prev, isVerified: true, isVerifiedBuyer: true };
      });
      // Update via PHP API (admin verifies user)
      try {
        apiUpdateProfile({
          user_id: sub.userId,
          is_verified: true,
          verified_until: until.toISOString(),
        }).catch(() => {});
      } catch {}
    }
  }, [verificationSubscriptions, language]);

  const rejectVerificationSubscription = useCallback((subId: string, notes: string) => {
    setVerificationSubscriptions(prev => prev.map(s => {
      if (s.id !== subId) return s;
      return { ...s, status: 'rejected' as const, adminNotes: notes };
    }));
    sendVerificationNotification('rejected', language).catch(() => {});
  }, [language]);

  const updateSellerPaymentMethods = useCallback((methods: { methodId: string; receivingNumber: string }[]) => {
    setUser(prev => {
      if (!prev) return null;
      // Persist to AsyncStorage so payment methods survive app restarts
      AsyncStorage.getItem('sokchad_user').then(saved => {
        if (saved) {
          const parsed = JSON.parse(saved);
          parsed.paymentMethods = methods;
          AsyncStorage.setItem('sokchad_user', JSON.stringify(parsed)).catch(() => {});
        }
      }).catch(() => {});
      return { ...prev, paymentMethods: methods };
    });
    setUser(prev => {
      if (prev?.isSeller && prev.id) {
        setSellers(prevSellers => prevSellers.map(s => {
          if (s.id === prev.id) return { ...s, paymentMethods: methods } as any;
          return s;
        }));
      }
      return prev;
    });
    // Also try API in background
    updateSellerPaymentMethodsAPI(methods);
  }, [updateSellerPaymentMethodsAPI]);

  const changeUserNumericId = useCallback((targetUserId: string, newId: string): { success: boolean; error?: string } => {
    const trimmedId = newId.trim();
    if (!trimmedId) return { success: false, error: 'ID cannot be empty' };
    if (user && user.numericId === trimmedId) return { success: false, error: 'This ID is already assigned to this user' };
    const takenBySeller = sellers.some(s => (s as any).numericId === trimmedId);
    if (takenBySeller) return { success: false, error: 'This ID is already taken' };
    if (usedSecretIds.has(trimmedId)) return { success: false, error: 'This ID is already in use' };
    usedSecretIds.add(trimmedId);
    setSellers(prev => prev.map(s => {
      if (s.id === targetUserId) return { ...s, numericId: trimmedId } as any;
      return s;
    }));
    setUser(prev => {
      if (!prev || prev.id !== targetUserId) return prev;
      return { ...prev, numericId: trimmedId };
    });
    return { success: true };
  }, [user, sellers]);

  // Badge counts
  const chatBadgeCount = useMemo(() => {
    return conversations.reduce((sum, c) => sum + (c?.unreadCount || 0), 0);
  }, [conversations]);

  const profileBadgeCount = useMemo(() => {
    if (!user) return 0;
    if (user.isSeller) {
      return orders.filter(o => o?.sellerId === user.id && o?.status === 'pending').length;
    }
    return orders.filter(o => o?.buyerId === user.id && (o?.status === 'confirmed' || o?.status === 'delivered')).length;
  }, [user, orders]);

  useEffect(() => {
    const total = chatBadgeCount + profileBadgeCount;
    updateAppBadge(total).catch(() => {});
  }, [chatBadgeCount, profileBadgeCount]);

  const clearChatBadge = useCallback(() => {
    setConversations(prev => prev.map(c => ({ ...c, unreadCount: 0 })));
  }, []);

  const clearProfileBadge = useCallback(() => {}, []);

  // ─── Product lookup helpers (replace static mockData imports) ───
  const getProductById = useCallback((id: string): Product | undefined => {
    const found = products.find(p => p.id === id);
    if (found) return found;
    // Fallback: check locally-persisted products (AsyncStorage cache) in case
    // the async merge into `products` state hasn't completed yet.
    return localProductsRef.current.find(p => p.id === id);
  }, [products]);

  const getProductsByCategory = useCallback((categoryId: string): Product[] => {
    return products.filter(p => p.categoryId === categoryId);
  }, [products]);

  const getProductsBySeller = useCallback((sellerId: string): Product[] => {
    return products.filter(p => p.sellerId === sellerId);
  }, [products]);

  const getCategoryById = useCallback((id: string): Category | undefined => {
    return categories.find(c => c.id === id) ?? mockCategories.find(c => c.id === id);
  }, [categories]);

  const getPinnedProducts = useCallback((): Product[] => {
    return products.filter(p => p.isPinned);
  }, [products]);

  // Find a seller by ID — searches both AppContext sellers (from DB) and mockData fallback
  const getSellerById = useCallback((id: string): Seller | undefined => {
    return sellers.find(s => String(s.id) === String(id)) || mockSellers.find(s => String(s.id) === String(id));
  }, [sellers]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.priceMin > 0) count++;
    if (filters.priceMax < 50000000) count++;
    if (filters.condition !== 'all') count++;
    if (filters.location !== 'all') count++;
    if (filters.sortBy !== 'newest') count++;
    return count;
  }, [filters]);

  const setFilters = useCallback((newFilters: FilterState) => { setFiltersState(newFilters); }, []);
  const resetFilters = useCallback(() => { setFiltersState(DEFAULT_FILTERS); }, []);

  const getFilteredProducts = useCallback(() => {
    let filtered = products;
    if (selectedCategory !== 'all') { filtered = filtered.filter(p => p.categoryId === selectedCategory); }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => p.title.en.toLowerCase().includes(q) || p.title.fr.toLowerCase().includes(q) || p.title.ar.includes(q));
    }
    filtered = filtered.filter(p => p.price >= filters.priceMin && p.price <= filters.priceMax);
    if (filters.condition !== 'all') {
      filtered = filtered.filter(p => p.condition === filters.condition);
    }
    // City filtering: show product if seller delivers to selectedCity OR seller is located in selectedCity
    if (selectedCity !== 'all') {
      filtered = filtered.filter(p => {
        // Seller's location matches the city
        if (p.location === selectedCity) return true;
        // Check seller's delivery cities cache
        const sellerCities = sellerDeliveryCitiesCache[String(p.sellerId)];
        if (sellerCities && sellerCities.includes(selectedCity)) return true;
        // If we don't have cache yet, show the product (will be filtered when cache loads)
        if (!sellerCities) return true;
        return false;
      });
    }
    switch (filters.sortBy) {
      case 'newest':
        filtered = [...filtered].sort((a, b) => new Date(b.postedDate).getTime() - new Date(a.postedDate).getTime());
        break;
      case 'cheapest':
        filtered = [...filtered].sort((a, b) => a.price - b.price);
        break;
      case 'expensive':
        filtered = [...filtered].sort((a, b) => b.price - a.price);
        break;
      case 'most_viewed':
        filtered = [...filtered].sort((a, b) => b.views - a.views);
        break;
    }
    return filtered;
  }, [products, selectedCategory, searchQuery, filters, selectedCity, sellerDeliveryCitiesCache]);

  // Staff management
  const addStaffMember = useCallback((email: string, password: string, name: string, permissions: StaffPermission[]): { success: boolean; error?: string } => {
    const normalizedEmail = email.trim().toLowerCase();
    if (staffMembers.some(s => s.email.toLowerCase() === normalizedEmail)) {
      return { success: false, error: 'email_taken' };
    }
    const newStaff: StaffMember = {
      id: `staff_${Date.now()}`,
      email: normalizedEmail,
      password,
      name: name.trim(),
      permissions,
      createdAt: new Date().toISOString(),
      isActive: true,
    };
    setStaffMembers(prev => [...prev, newStaff]);
    return { success: true };
  }, [staffMembers]);

  const removeStaffMember = useCallback((id: string) => {
    setStaffMembers(prev => prev.filter(s => s.id !== id));
  }, []);

  const updateStaffPermissions = useCallback((id: string, permissions: StaffPermission[]) => {
    setStaffMembers(prev => prev.map(s => s.id === id ? { ...s, permissions } : s));
  }, []);

  const toggleStaffActive = useCallback((id: string) => {
    setStaffMembers(prev => prev.map(s => s.id === id ? { ...s, isActive: !s.isActive } : s));
  }, []);

  const getEnabledCountryList = useCallback(() => {
    return ALL_COUNTRIES.filter(c => enabledCountries.includes(c.code));
  }, [enabledCountries]);

  const getCitiesForCountry = useCallback((code: string) => {
    return COUNTRY_CITIES[code] || [];
  }, []);

  const toggleCountryEnabled = useCallback((code: string) => {
    setEnabledCountriesState(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  }, []);

  const setEnabledCountries = useCallback((codes: string[]) => {
    setEnabledCountriesState(codes);
  }, []);

  return (
    <AppContext.Provider value={{
      language, isDark, colors, user, isLoggedIn: !!user, isReady, authLoading, userChecked, dynamicBanners: appBanners, storeLogo: appStoreLogo,
      products, favorites, conversations, orders, sellers, reviews,
      searchQuery, selectedCategory, filters, activeFilterCount, registeredUsernames, usedReferenceIds, blacklist, staffMembers,
      t, setLanguage, enabledLanguages, toggleLanguageEnabled, toggleDarkMode, logout,
      isUsernameTaken, isReferenceIdUsed, updateUserAvatar, updateUserCover,
      toggleFavorite, isFavorite, setSearchQuery, setSelectedCategory,
      setFilters, resetFilters,
      addProduct, setProductDiscount, removeProductDiscount, sendMessage, startConversation, placeOrder, updateOrderStatus, permanentBanUser, confirmOrderReceived,
      categories,
      subCategories, currentCategoryPath, loadSubCategories, navigateToCategory, goBackCategory, resetCategoryNavigation,
      followingList, followStats, followedSellers, followedProducts, fetchFollowStatus, toggleFollow, toggleFollowNotifications, fetchSellerStats, fetchFollowedSellers, fetchFollowedProducts,
      shippingCompanies, addShippingCompany, removeShippingCompany, toggleShippingCompanyActive,
      verificationPlans, verificationSubscriptions, addVerificationPlan, removeVerificationPlan, toggleVerificationPlanActive,
      submitVerificationSubscription, approveVerificationSubscription, rejectVerificationSubscription,
      canUserRequestVerification, changeUserNumericId, adminPaymentNumber, updateSellerPaymentMethods,
      fetchSellerPaymentMethods, fetchSellerShipping, fetchAvailableShippingCompanies, updateSellerShipping, deliveryCities, fetchDeliveryCities, updateDeliveryCities,
      deliveryMethods, fetchDeliveryMethods, updateDeliveryMethods,
      selectedCity, setSelectedCity, uploadImage, updateStoreLogo, updateStoreBanner,
      markItemReceived, addReview, getReviewsForProduct, getReviewsForSeller,
      getFilteredProducts, togglePinProduct, toggleSellerVerified, toggleBanSeller,
      banUserWithDuration, addPaymentMethod, updatePaymentMethodLogo, updatePaymentMethod, togglePaymentMethodActive, removePaymentMethod, paymentMethodsList, getPaymentMethodsForCountry,
      chatBadgeCount, profileBadgeCount, clearChatBadge, clearProfileBadge,
      canSellerRequestVerification, requestSellerVerification,
      addStaffMember, removeStaffMember, updateStaffPermissions, toggleStaffActive,
      enabledCountries, getEnabledCountryList, getCitiesForCountry, toggleCountryEnabled, setEnabledCountries,
      refreshUserProfile, loadDemoUser, refreshProducts,
      getProductById, getProductsByCategory, getProductsBySeller, getSellerById, getCategoryById, getPinnedProducts,
      productsLoading,
      realUsers, usersLoading, refreshUsers,
      buyerOrders, buyerCompletedOrders, sellerOrders,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
