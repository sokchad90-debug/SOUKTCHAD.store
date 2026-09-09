/**
 * Sokchad Product Service — PHP API Version
 * Connected to souktchad.shop/api backend (MySQL)
 * NO Supabase dependency
 *
 * Exports (preserved for backward compatibility):
 *   fetchProducts, createProduct, updateProduct,
 *   getCategoryUUID, getCategoryMockId
 */

import { Product } from '@/services/mockData';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = 'http://10.0.2.2:8080';
const AUTH_TOKEN_KEY = 'sokchad_auth_token';

// ---------------------------------------------------------------------------
// Category mapping
// ---------------------------------------------------------------------------
// The MySQL `products` table stores category_id as a plain string such as
// "electronics", "vehicles", "fashion", "home", "agriculture", "services",
// "sports", "other". The front-end uses the same mock IDs, so the mapping is
// mostly identity — kept here so callers that historically passed mock IDs
// (including legacy aliases like "real_estate") still resolve correctly.

const CATEGORY_MAP: Record<string, string> = {
  electronics: 'electronics',
  vehicles: 'vehicles',
  fashion: 'fashion',
  real_estate: 'real_estate',
  home_garden: 'home_garden',
  home: 'home',
  agriculture: 'agriculture',
  services: 'services',
  sports: 'sports',
  jobs: 'jobs',
  art_collectibles: 'art_collectibles',
  other: 'other',
};

const CATEGORY_REVERSE_MAP: Record<string, string> = {};
Object.entries(CATEGORY_MAP).forEach(([key, val]) => {
  if (!CATEGORY_REVERSE_MAP[val]) CATEGORY_REVERSE_MAP[val] = key;
});

/** Map a front-end/mock category ID to the MySQL category_id string. */
export function getCategoryUUID(mockId: string): string | null {
  if (!mockId) return null;
  return CATEGORY_MAP[mockId] || mockId;
}

/** Map a MySQL category_id string back to the front-end/mock category ID. */
export function getCategoryMockId(uuid: string): string {
  if (!uuid) return '';
  return CATEGORY_REVERSE_MAP[uuid] || uuid;
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

async function getToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

async function authHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...extra,
  };
  const token = await getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// ---------------------------------------------------------------------------
// Response → Product mapping
// ---------------------------------------------------------------------------

/**
 * Transform a PHP/MySQL product row into the app's `Product` interface.
 *
 * MySQL columns mapped:
 *   id, seller_id, title_en/fr/ar, description_en/fr/ar, price, currency,
 *   category_id, condition, location, image/images, is_pinned, is_featured,
 *   status, views, created_at, discount_percent, discount_until, stock,
 *   max_order_qty
 */
function dbRowToProduct(row: any): Product {
  const id = String(row.id ?? '');
  const titleEn = row.title_en || '';
  const titleFr = row.title_fr || '';
  const titleAr = row.title_ar || '';
  const descEn = row.description_en || '';
  const descFr = row.description_fr || '';
  const descAr = row.description_ar || '';

  // Images: support either a single `image` column, a JSON `images` column,
  // or a comma-separated list.
  let images: string[] = [];
  if (Array.isArray(row.images) && row.images.length) {
    images = row.images.map(String);
  } else if (row.cover_image) {
    images = [String(row.cover_image)];
  } else if (row.image) {
    images = String(row.image)
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);
  }

  return {
    id,
    title: { en: titleEn, fr: titleFr, ar: titleAr },
    description: { en: descEn, fr: descFr, ar: descAr },
    price: Number(row.price ?? 0),
    images,
    categoryId: getCategoryMockId(row.category_id || ''),
    sellerId: String(row.seller_id ?? ''),
    condition: (row.condition as Product['condition']) || 'new',
    location: row.location || '',
    postedDate: row.created_at || new Date().toISOString(),
    isPinned: row.is_pinned === 1 || row.is_pinned === true,
    pinnedUntil: row.pinned_until || undefined,
    isFeatured: row.is_featured === 1 || row.is_featured === true,
    views: Number(row.views ?? 0),
    sellerName: row.seller_name || row.sellerName || '',
    sellerVerified: row.seller_verified === 1 || row.seller_verified === true,
    discountPercent: row.discount_percent != null ? Number(row.discount_percent) : undefined,
    discountUntil: row.discount_until || undefined,
    stock: row.stock != null ? Number(row.stock) : undefined,
    maxOrderQty: row.max_order_qty != null ? Number(row.max_order_qty) : undefined,
    soldCount: row.sold_count != null ? Number(row.sold_count) : undefined,
    rating: row.rating != null ? Number(row.rating) : undefined,
    reviewsCount: row.reviews_count != null ? Number(row.reviews_count) : undefined,
    tagLabel: row.tag_label || undefined,
    freeShipping: row.free_shipping === 1 || row.free_shipping === true || undefined,
    warrantyDays: row.warranty_days != null ? Number(row.warranty_days) : undefined,
    deliveryType: row.delivery_type || undefined,
    deliveryFee: row.delivery_fee != null ? Number(row.delivery_fee) : undefined,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch products from the PHP API.
 *
 * Supports optional filter params that map to the PHP backend's query string:
 *   category, search, sort, status, id, limit
 *
 * @example
 *   const { data, error } = await fetchProducts({ category: 'electronics' });
 *   const { data } = await fetchProducts({ id: '42' }); // single product
 */
export async function fetchProducts(
  options: {
    category?: string;
    search?: string;
    sort?: string;
    status?: string;
    id?: string | number;
    limit?: number;
  } = {},
): Promise<{ data: Product[]; error: string | null }> {
  try {
    const params = new URLSearchParams();
    if (options.category) params.append('category', getCategoryUUID(options.category) || options.category);
    if (options.search) params.append('search', options.search);
    if (options.sort) params.append('sort', options.sort);
    if (options.status) params.append('status', options.status);
    if (options.id != null) params.append('id', String(options.id));
    if (options.limit != null) params.append('limit', String(options.limit));

    const qs = params.toString();
    const url = `${API_BASE}/products.php${qs ? `?${qs}` : ''}`;
    const headers = await authHeaders();

    const response = await fetch(url, { method: 'GET', headers });
    const result = await response.json();

    if (result.success && result.data != null) {
      // PHP API returns { data: { items: [...], total, page } } for lists
      // or { data: { single product } } for single product
      let rows: any[];
      if (Array.isArray(result.data)) {
        rows = result.data;
      } else if (result.data.items && Array.isArray(result.data.items)) {
        rows = result.data.items;
      } else {
        rows = [result.data];
      }
      const products = rows.map(dbRowToProduct);
      return { data: products, error: null };
    }
    return { data: [], error: result.error || 'Failed to fetch products' };
  } catch (e: any) {
    console.error('fetchProducts error:', e?.message);
    return { data: [], error: e?.message || 'Network error' };
  }
}

/**
 * Create a new product via the PHP API (POST /products.php).
 * Requires authentication (JWT from AsyncStorage).
 *
 * Accepts a Product-shaped object using either the app's nested title/desc
 * fields ({title:{en,fr,ar}}) or flat legacy fields (titleEn/title/description).
 */
export async function createProduct(
  product: Partial<Product> & Record<string, any>,
  sellerId: string,
): Promise<{ data: Product | null; error: string | null }> {
  try {
    const headers = await authHeaders();

    const body: Record<string, any> = {
      seller_id: sellerId,
      title_en: product.title?.en ?? product.titleEn ?? product.title ?? '',
      title_fr: product.title?.fr ?? product.titleFr ?? '',
      title_ar: product.title?.ar ?? product.titleAr ?? '',
      description_en: product.description?.en ?? product.descriptionEn ?? product.description ?? '',
      description_fr: product.description?.fr ?? product.descriptionFr ?? '',
      description_ar: product.description?.ar ?? product.descriptionAr ?? '',
      price: Number(product.price ?? 0),
      currency: product.currency ?? 'XAF',
      category_id: getCategoryUUID(product.categoryId ?? product.category ?? '') || 'other',
      condition: product.condition ?? 'new',
      location: product.location ?? '',
      status: product.status ?? 'active',
    };

    if (Array.isArray(product.images) && product.images.length) {
      body.image = product.images[0];
      body.images = product.images.join(',');
    } else if (product.image) {
      body.image = product.image;
    }

    if (product.discountPercent != null) body.discount_percent = product.discountPercent;
    if (product.discountUntil) body.discount_until = product.discountUntil;
    if (product.stock != null) body.stock = product.stock;
    if (product.maxOrderQty != null) body.max_order_qty = product.maxOrderQty;
    if ((product as any).warrantyDays != null) body.warranty_days = (product as any).warrantyDays;
    if ((product as any).deliveryType) body.delivery_type = (product as any).deliveryType;
    if ((product as any).deliveryFee != null) body.delivery_fee = (product as any).deliveryFee;
    if (product.tagLabel) body.tag_label = product.tagLabel;
    if (product.stock != null) body.stock = product.stock;
    if (product.maxOrderQty != null) body.max_order_qty = product.maxOrderQty;

    const response = await fetch(`${API_BASE}/products.php`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const result = await response.json();

    if (result.success && result.data) {
      return { data: dbRowToProduct(result.data), error: null };
    }
    return { data: null, error: result.error || result.message || 'Create failed' };
  } catch (e: any) {
    console.error('createProduct error:', e?.message);
    return { data: null, error: e?.message || 'Network error' };
  }
}

/**
 * Update a product via the PHP API (PUT /products.php?id=<id>).
 * Requires authentication. Accepts either app-shaped or snake_case fields.
 */
export async function updateProduct(
  id: string,
  updates: Record<string, any>,
): Promise<{ data: Product | null; error: string | null }> {
  try {
    const headers = await authHeaders();

    // Translate app-shaped fields → snake_case DB columns
    const body: Record<string, any> = { ...updates };

    if (updates.title && typeof updates.title === 'object') {
      body.title_en = updates.title.en ?? '';
      body.title_fr = updates.title.fr ?? '';
      body.title_ar = updates.title.ar ?? '';
      delete body.title;
    } else if (typeof updates.title === 'string') {
      body.title_en = updates.title;
    }

    if (updates.description && typeof updates.description === 'object') {
      body.description_en = updates.description.en ?? '';
      body.description_fr = updates.description.fr ?? '';
      body.description_ar = updates.description.ar ?? '';
      delete body.description;
    } else if (typeof updates.description === 'string') {
      body.description_en = updates.description;
    }

    if (updates.categoryId) {
      body.category_id = getCategoryUUID(updates.categoryId) || updates.categoryId;
      delete body.categoryId;
    }

    if (Array.isArray(updates.images)) {
      body.image = updates.images[0];
      body.images = updates.images.join(',');
      delete body.images;
    }

    const response = await fetch(`${API_BASE}/products.php?id=${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
    const result = await response.json();

    if (result.success) {
      // If the API returns the updated row, map it; otherwise return null data.
      const data = result.data ? dbRowToProduct(result.data) : null;
      return { data, error: null };
    }
    return { data: null, error: result.error || result.message || 'Update failed' };
  } catch (e: any) {
    console.error('updateProduct error:', e?.message);
    return { data: null, error: e?.message || 'Network error' };
  }
}