/**
 * Orders Service
 * ==============
 * Frontend service layer that communicates with the PHP backend
 * via standard HTTP fetch requests.
 * 
 * USAGE:
 * 1. Set API_BASE_URL to your Hostinger domain (e.g., 'https://yourdomain.com/api')
 * 2. All functions return { success, data, error } format
 * 3. Auth token is automatically attached from AsyncStorage
 * 
 * EXAMPLE:
 *   import { fetchMyOrders, createOrder } from '@/services/ordersService';
 *   const { data, error } = await fetchMyOrders();
 *   const result = await createOrder({ product_id: '123', ... });
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// CONFIGURATION — Update this when your backend is deployed
// ============================================================
export const API_BASE_URL = 'https://souktchad.shop/api';

const AUTH_TOKEN_KEY = 'sokchad_auth_token';
const REQUEST_TIMEOUT = 15000;

// ============================================================
// TYPES
// ============================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface OrderFromAPI {
  id: number;
  product_id: number;
  buyer_id: number;
  seller_id: number;
  amount: number;
  payment_method_id: string;
  reference_id: string;
  buyer_phone: string;
  status: 'pending' | 'confirmed' | 'disputed' | 'cancelled' | 'delivered' | 'completed';
  created_at: string;
  updated_at: string;
  // Joined fields
  product_title_en?: string;
  product_title_fr?: string;
  product_title_ar?: string;
  product_image?: string;
  seller_name?: string;
  buyer_name?: string;
  payment_method_name?: string;
}

export interface CreateOrderPayload {
  product_id: string;
  payment_method_id: string;
  reference_id: string;
  buyer_phone: string;
}

export interface StatsFromAPI {
  total_revenue: number;
  total_orders: number;
  total_products: number;
  order_status: Record<string, number>;
  category_breakdown: Array<{
    id: string;
    name_en: string;
    name_fr: string;
    name_ar: string;
    color: string;
    product_count: number;
  }>;
  avg_rating: number;
  review_count: number;
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

async function apiRequest<T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  body?: Record<string, any>,
  requiresAuth: boolean = true,
): Promise<ApiResponse<T>> {
  if (!API_BASE_URL) {
    return { success: false, error: 'API_BASE_URL not configured. Set it in services/ordersService.ts' };
  }

  const url = `${API_BASE_URL}/${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  if (requiresAuth) {
    const token = await getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const json = await response.json();

    if (!response.ok) {
      return { success: false, error: json.error || `HTTP ${response.status}` };
    }

    return json;
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      return { success: false, error: 'Request timed out.' };
    }
    return { success: false, error: err.message || 'Network error.' };
  }
}

// ============================================================
// ORDER API FUNCTIONS
// ============================================================

/**
 * Fetch all orders for the current user.
 * 
 * @param role - Filter by 'buyer', 'seller', or 'all'
 * @param status - Optional status filter ('pending', 'confirmed', etc.)
 * @param page - Pagination page number
 * 
 * @example
 * // In a React component:
 * const { data, error } = await fetchMyOrders('buyer', 'pending', 1);
 * if (error) { Alert.alert('Error', error); return; }
 * setOrders(data);
 */
export async function fetchMyOrders(
  role: 'buyer' | 'seller' | 'all' = 'all',
  status?: string,
  page: number = 1,
): Promise<PaginatedResponse<OrderFromAPI>> {
  const params = new URLSearchParams({ role, page: String(page) });
  if (status) params.append('status', status);

  const result = await apiRequest<OrderFromAPI[]>('GET', `api_orders.php?${params.toString()}`);
  return result as PaginatedResponse<OrderFromAPI>;
}

/**
 * Fetch a single order by ID.
 * 
 * @example
 * const { data, error } = await fetchOrderById('42');
 * if (data) { console.log('Order amount:', data.amount); }
 */
export async function fetchOrderById(orderId: string): Promise<ApiResponse<OrderFromAPI>> {
  return apiRequest<OrderFromAPI>('GET', `api_orders.php?id=${orderId}`);
}

/**
 * Create a new order (purchase a product).
 * Requires authentication. Only buyer accounts can create orders.
 * 
 * @example
 * const result = await createOrder({
 *   product_id: '15',
 *   payment_method_id: 'airtel_money',
 *   reference_id: 'AT-20260226-12345',
 *   buyer_phone: '90123456',
 * });
 * if (result.success) {
 *   Alert.alert('Success', 'Order placed!');
 * } else {
 *   Alert.alert('Error', result.error);
 * }
 */
export async function createOrder(payload: CreateOrderPayload): Promise<ApiResponse<OrderFromAPI>> {
  return apiRequest<OrderFromAPI>('POST', 'api_orders.php', payload);
}

/**
 * Confirm an order (seller action).
 * 
 * @example
 * await confirmOrder('42');
 */
export async function confirmOrder(orderId: string): Promise<ApiResponse> {
  return apiRequest('PUT', `api_orders.php?id=${orderId}`, { action: 'confirm' });
}

/**
 * Mark an order item as received (buyer action → completes the order).
 * 
 * @example
 * await markOrderReceived('42');
 */
export async function markOrderReceived(orderId: string): Promise<ApiResponse> {
  return apiRequest('PUT', `api_orders.php?id=${orderId}`, { action: 'receive' });
}

/**
 * Raise a dispute on an order (buyer or admin action).
 * 
 * @example
 * await disputeOrder('42', 'Item was not as described');
 */
export async function disputeOrder(orderId: string, reason: string): Promise<ApiResponse> {
  return apiRequest('PUT', `api_orders.php?id=${orderId}`, { action: 'dispute', reason });
}

// ============================================================
// STATISTICS API FUNCTIONS
// ============================================================

/**
 * Fetch seller statistics (revenue, orders, category breakdown).
 * 
 * @example
 * const { data } = await fetchSellerStats();
 * console.log('Revenue:', data.total_revenue);
 */
export async function fetchSellerStats(): Promise<ApiResponse<StatsFromAPI>> {
  return apiRequest<StatsFromAPI>('GET', 'api_stats.php');
}

/**
 * Fetch admin dashboard statistics.
 * 
 * @example
 * const { data } = await fetchAdminStats();
 * console.log('Total sellers:', data.sellers);
 */
export async function fetchAdminStats(): Promise<ApiResponse<any>> {
  return apiRequest<any>('GET', 'api_stats.php?scope=admin');
}
