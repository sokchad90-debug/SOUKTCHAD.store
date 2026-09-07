/**
 * Blocked Sellers Service
 * ========================
 * Frontend service for blocking / unblocking sellers.
 * Communicates with the PHP backend (api_blocks.php) via HTTP fetch.
 *
 * Auth token is read from AsyncStorage key 'sokchad_auth_token'
 * and sent as `Authorization: Bearer <token>`.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://10.0.2.2:8080/api_blocks.php';
const AUTH_TOKEN_KEY = 'sokchad_auth_token';
const REQUEST_TIMEOUT = 15000;

// ============================================================
// INTERNAL HELPERS
// ============================================================

async function getToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

async function apiFetch(
  method: 'GET' | 'POST',
  body?: Record<string, any>,
  queryParams?: Record<string, string>,
): Promise<any> {
  const token = await getToken();
  if (!token) {
    return { success: false, error: 'Not authenticated' };
  }

  let url = API_URL;
  if (queryParams) {
    const params = new URLSearchParams(queryParams);
    url = `${API_URL}?${params.toString()}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
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
// PUBLIC API
// ============================================================

/**
 * Block a seller by their user ID.
 * @returns true on success, false on failure.
 */
export async function blockSeller(sellerId: string): Promise<boolean> {
  const res = await apiFetch('POST', { action: 'block', seller_id: sellerId });
  return res?.success === true;
}

/**
 * Unblock a seller by their user ID.
 * @returns true on success, false on failure.
 */
export async function unblockSeller(sellerId: string): Promise<boolean> {
  const res = await apiFetch('POST', { action: 'unblock', seller_id: sellerId });
  return res?.success === true;
}

/**
 * Get the list of all blocked sellers for the current user.
 * Each item: { seller_id, created_at, seller_name, avatar, seller_code, seller_location }
 * @returns array of blocked seller objects (empty on error).
 */
export async function getBlockedSellers(): Promise<any[]> {
  const res = await apiFetch('GET');
  return res?.success && Array.isArray(res.data) ? res.data : [];
}

/**
 * Check whether a specific seller is blocked by the current user.
 * @returns true if blocked, false otherwise (including on error).
 */
export async function isSellerBlocked(sellerId: string): Promise<boolean> {
  const res = await apiFetch('GET', undefined, { check: sellerId });
  return res?.success && res.data?.blocked === true;
}