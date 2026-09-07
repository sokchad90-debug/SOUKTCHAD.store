import AsyncStorage from '@react-native-async-storage/async-storage';
import { Seller } from '@/services/mockData';

const API_BASE = 'http://10.0.2.2:8080/admin';
const AUTH_TOKEN_KEY = 'sokchad_auth_token';

/**
 * Retrieve the JWT auth token from AsyncStorage.
 */
async function getAuthToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  } catch (e) {
    console.error('getAuthToken exception:', e);
    return null;
  }
}

/**
 * Build the standard Authorization headers for admin API calls.
 */
async function authHeaders(): Promise<HeadersInit> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Default avatar used when a profile has no avatar_url.
 */
const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1599566150163-29194dcabd9c?w=200&h=200&fit=crop';

/**
 * Map a raw API user profile to the Seller shape expected by the admin UI.
 */
function mapUserToSeller(profile: any): Seller & {
  email: string;
  role: string;
  numericId: string;
} {
  let role: string = 'buyer';
  if (profile.is_super_admin) role = 'super_admin';
  else if (profile.is_admin) role = 'staff';
  else if (profile.is_seller) role = 'seller';

  return {
    id: String(profile.id ?? ''),
    name: profile.username || profile.email?.split('@')[0] || 'Unknown',
    avatar: profile.avatar_url || DEFAULT_AVATAR,
    sellerId: profile.seller_id || '',
    isVerified: Boolean(profile.is_verified),
    verifiedUntil: profile.verified_until || undefined,
    isBanned: Boolean(profile.is_banned),
    bannedUntil: profile.banned_until || undefined,
    location: profile.location || '',
    rating: profile.rating || 0,
    totalSales: profile.total_sales || 0,
    joinedDate: profile.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
    phone: profile.phone || '',
    isOnline: false,
    lastSeen: profile.updated_at || undefined,
    paymentMethods: [],
    // Extra fields for admin
    email: profile.email || '',
    role,
    numericId: profile.seller_id || '',
  } as Seller & { email: string; role: string; numericId: string };
}

/**
 * Fetch ALL registered users from the PHP admin API.
 * Used by the Admin Dashboard to display real registered users.
 */
export async function fetchAllUsers(): Promise<Seller[]> {
  try {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/api_users.php?limit=100`, { headers });

    if (!res.ok) {
      console.error('fetchAllUsers HTTP error:', res.status, res.statusText);
      return [];
    }

    const json = await res.json();
    if (!json.success) {
      console.error('fetchAllUsers API error:', json.message || json);
      return [];
    }

    const items: any[] = json.data?.items || json.data || [];
    if (!Array.isArray(items) || items.length === 0) return [];

    return items.map(mapUserToSeller);
  } catch (e: any) {
    console.error('fetchAllUsers exception:', e);
    return [];
  }
}

/**
 * Fetch only sellers from the PHP admin API.
 */
export async function fetchSellers(): Promise<Seller[]> {
  try {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/api_users.php?role=seller&limit=100`, { headers });

    if (!res.ok) {
      console.error('fetchSellers HTTP error:', res.status, res.statusText);
      return [];
    }

    const json = await res.json();
    if (!json.success) {
      console.error('fetchSellers API error:', json.message || json);
      return [];
    }

    const items: any[] = json.data?.items || json.data || [];
    if (!Array.isArray(items) || items.length === 0) return [];

    return items.map(mapUserToSeller);
  } catch (e: any) {
    console.error('fetchSellers exception:', e);
    return [];
  }
}

/**
 * Fetch admin dashboard stats from the PHP admin API.
 */
export async function fetchAdminStats(): Promise<{
  totalUsers: number;
  totalSellers: number;
  totalBuyers: number;
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  bannedUsers: number;
  verifiedUsers: number;
  staffCount: number;
}> {
  const empty = {
    totalUsers: 0, totalSellers: 0, totalBuyers: 0, totalProducts: 0,
    totalOrders: 0, totalRevenue: 0, bannedUsers: 0, verifiedUsers: 0, staffCount: 0,
  };

  try {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/api_stats.php`, { headers });

    if (!res.ok) {
      console.error('fetchAdminStats HTTP error:', res.status, res.statusText);
      return empty;
    }

    const json = await res.json();
    if (!json.success) {
      console.error('fetchAdminStats API error:', json.message || json);
      return empty;
    }

    const d = json.data || json;
    return {
      totalUsers: Number(d.totalUsers ?? d.total_users ?? 0),
      totalSellers: Number(d.totalSellers ?? d.total_sellers ?? 0),
      totalBuyers: Number(d.totalBuyers ?? d.total_buyers ?? 0),
      totalProducts: Number(d.totalProducts ?? d.total_products ?? 0),
      totalOrders: Number(d.totalOrders ?? d.total_orders ?? 0),
      totalRevenue: Number(d.totalRevenue ?? d.total_revenue ?? 0),
      bannedUsers: Number(d.bannedUsers ?? d.banned_users ?? 0),
      verifiedUsers: Number(d.verifiedUsers ?? d.verified_users ?? 0),
      staffCount: Number(d.staffCount ?? d.staff_count ?? 0),
    };
  } catch (e: any) {
    console.error('fetchAdminStats exception:', e);
    return empty;
  }
}

/**
 * Ban a user via the PHP admin API.
 */
export async function banUserInDB(userId: string, bannedUntil: string | null): Promise<boolean> {
  try {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/api_users.php?id=${encodeURIComponent(userId)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        action: 'ban',
        is_banned: true,
        banned_until: bannedUntil,
      }),
    });

    if (!res.ok) {
      console.error('banUserInDB HTTP error:', res.status, res.statusText);
      return false;
    }

    const json = await res.json();
    return Boolean(json.success);
  } catch (e) {
    console.error('banUserInDB exception:', e);
    return false;
  }
}

/**
 * Unban a user via the PHP admin API.
 */
export async function unbanUserInDB(userId: string): Promise<boolean> {
  try {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/api_users.php?id=${encodeURIComponent(userId)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        action: 'unban',
        is_banned: false,
        banned_until: null,
      }),
    });

    if (!res.ok) {
      console.error('unbanUserInDB HTTP error:', res.status, res.statusText);
      return false;
    }

    const json = await res.json();
    return Boolean(json.success);
  } catch (e) {
    console.error('unbanUserInDB exception:', e);
    return false;
  }
}

/**
 * Verify a seller via the PHP admin API.
 */
export async function verifyUserInDB(userId: string, verifiedUntil: string): Promise<boolean> {
  try {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/api_users.php?id=${encodeURIComponent(userId)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        action: 'verify',
        is_verified: true,
        verified_until: verifiedUntil,
      }),
    });

    if (!res.ok) {
      console.error('verifyUserInDB HTTP error:', res.status, res.statusText);
      return false;
    }

    const json = await res.json();
    return Boolean(json.success);
  } catch (e) {
    console.error('verifyUserInDB exception:', e);
    return false;
  }
}

/**
 * Unverify a seller via the PHP admin API.
 */
export async function unverifyUserInDB(userId: string): Promise<boolean> {
  try {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/api_users.php?id=${encodeURIComponent(userId)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        action: 'unverify',
        is_verified: false,
        verified_until: null,
      }),
    });

    if (!res.ok) {
      console.error('unverifyUserInDB HTTP error:', res.status, res.statusText);
      return false;
    }

    const json = await res.json();
    return Boolean(json.success);
  } catch (e) {
    console.error('unverifyUserInDB exception:', e);
    return false;
  }
}