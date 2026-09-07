/**
 * Order Stats Service
 * ===================
 * Frontend service that fetches buyer order statistics and the current user's
 * orders from the PHP backend. Both functions use the JWT auth token stored
 * in AsyncStorage under the key 'sokchad_auth_token'.
 *
 * ENDPOINTS:
 *   GET /api_buyer_stats.php  → buyer order statistics summary
 *   GET /api_orders.php       → list of orders for the current user (buyer/seller)
 *
 * USAGE:
 *   import { fetchBuyerStats, fetchUserOrders } from '@/services/orderStats';
 *   const { data: stats } = await fetchBuyerStats();
 *   const { data: orders } = await fetchUserOrders('buyer');
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// CONFIGURATION
// ============================================================
export const API_BASE_URL = 'http://10.0.2.2:8080';

const AUTH_TOKEN_KEY = 'sokchad_auth_token';
const REQUEST_TIMEOUT = 15000; // 15s

// ============================================================
// TYPES
// ============================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/** Buyer order statistics returned by api_buyer_stats.php. */
export interface BuyerStats {
  completed_count: number;
  total_count: number;
  pending_count: number;
  cancelled_count: number;
  disputed_count: number;
  confirmed_count: number;
  delivered_count: number;
  /** completed / (completed + cancelled + disputed) * 100, rounded */
  success_rate: number;
  /** count of distinct sellers the buyer has ordered from (COMPLETED orders only) */
  unique_sellers: number;
  /** alias of unique_sellers — distinct sellers among COMPLETED orders */
  unique_sellers_count: number;
  /** orders placed in the last 30 days */
  orders_last_30d: number;
  /** ISO timestamp of the earliest completed order, or null */
  first_completed_date: string | null;
  /** ISO timestamp of the most recent completed order, or null */
  last_completed_date: string | null;
  /** buyer-initiated cancellations (status = 'cancelled') */
  cancelled_by_buyer: number;
  /** completed>=50 AND unique_sellers>=50 AND success_rate>=75 */
  is_trusted: boolean;
}

/** A single order row as returned by api_orders.php (with product info joined). */
export interface OrderFromAPI {
  id: number;
  product_id: number;
  buyer_id: number;
  seller_id: number;
  amount: number;
  payment_method_id: string | null;
  reference_id: string;
  order_number: string | null;
  transaction_number: string | null;
  buyer_phone: string;
  status: 'pending' | 'confirmed' | 'disputed' | 'cancelled' | 'delivered' | 'completed';
  escrow_status: 'none' | 'held' | 'released' | 'refunded' | string;
  shipping_address: string;
  shipping_city: string;
  shipping_company_id: number | null;
  tracking_number: string;
  created_at: string;
  updated_at: string;
  // Joined product / seller / payment fields
  product_title_en?: string;
  product_title_fr?: string;
  product_title_ar?: string;
  product_image?: string;
  seller_name?: string;
  buyer_name?: string;
  payment_method_name?: string;
  payment_method_color?: string;
  // Snapshot fields (saved at order creation time)
  product_title_snapshot?: string | null;
  product_image_snapshot?: string | null;
  product_price_snapshot?: number | null;
  seller_name_snapshot?: string | null;
  store_name_snapshot?: string | null;
}

export interface PaginatedOrders extends ApiResponse<OrderFromAPI[]> {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

// ============================================================
// HTTP CLIENT
// ============================================================

async function getToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

async function authJsonRequest<T = any>(
  endpoint: string,
  timeoutMs: number = REQUEST_TIMEOUT,
): Promise<ApiResponse<T>> {
  const token = await getToken();
  if (!token) {
    return { success: false, error: 'No auth token found. Please log in.' };
  }

  const url = `${API_BASE_URL}/${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const json = await response.json();
    if (!response.ok) {
      return { success: false, error: json.error || `HTTP ${response.status}` };
    }
    return json as ApiResponse<T>;
  } catch (err: any) {
    clearTimeout(timeout);
    if (err?.name === 'AbortError') {
      return { success: false, error: 'Request timed out.' };
    }
    return { success: false, error: err?.message || 'Network error.' };
  }
}

// ============================================================
// API FUNCTIONS
// ============================================================

/**
 * Fetch the authenticated buyer's order statistics.
 *
 * Calls: GET /api_buyer_stats.php
 *
 * @example
 *   const { data, error } = await fetchBuyerStats();
 *   if (data) {
 *     console.log('Completed:', data.completed_count, 'Trusted:', data.is_trusted);
 *   }
 */
export async function fetchBuyerStats(
  timeoutMs: number = REQUEST_TIMEOUT,
): Promise<ApiResponse<BuyerStats>> {
  return authJsonRequest<BuyerStats>('api_buyer_stats.php', timeoutMs);
}

/**
 * Fetch the current user's orders (as buyer, seller, or both).
 *
 * Calls: GET /api_orders.php?role=<role>&page=<page>[&status=<status>]
 *
 * @param role   Filter by 'buyer', 'seller', or 'all' (default 'all')
 * @param page   Pagination page (default 1)
 * @param status Optional status filter ('pending', 'confirmed', 'disputed', 'cancelled', 'delivered', 'completed')
 *
 * @example
 *   const { data, error } = await fetchUserOrders('buyer');
 *   if (data) { setOrders(data); }
 */
export async function fetchUserOrders(
  role: 'buyer' | 'seller' | 'all' = 'all',
  page: number = 1,
  status?: string,
  timeoutMs: number = REQUEST_TIMEOUT,
): Promise<PaginatedOrders> {
  const params = new URLSearchParams({ role, page: String(page) });
  if (status) params.append('status', status);

  const result = await authJsonRequest<OrderFromAPI[]>(
    `api_orders.php?${params.toString()}`,
    timeoutMs,
  );
  return result as PaginatedOrders;
}