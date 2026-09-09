/**
 * Sokchad API Service Layer
 * ========================
 * Centralized REST API abstraction for communicating with a custom backend.
 * 
 * ARCHITECTURE:
 * - Designed for deployment on custom hosting (cPanel/hPanel, e.g. Hostinger)
 * - Backend: Node.js or PHP RESTful API with MySQL database
 * - NO Firebase, Supabase, or third-party BaaS dependency
 * - All endpoints use standard HTTP methods (GET, POST, PUT, DELETE)
 * 
 * SETUP:
 * 1. Set API_BASE_URL to your custom domain (e.g. https://api.sokchad.com)
 * 2. Backend must implement the endpoints defined below
 * 3. All responses follow { success: boolean, data?: any, error?: string } format
 * 
 * MIGRATION:
 * Currently uses local mock data. When the custom backend is ready:
 * 1. Update API_BASE_URL
 * 2. Remove mock fallbacks
 * 3. Backend MySQL schema matches the interfaces in services/mockData.ts
 */

// ============================================================
// CONFIGURATION
// ============================================================

/** 
 * Replace with your custom domain when backend is deployed.
 * Example: 'https://api.sokchad.com/v1'
 * Leave empty to use mock data fallback.
 */
export const API_BASE_URL = 'http://10.0.2.2:8080';

/** Request timeout in milliseconds */
const REQUEST_TIMEOUT = 15000;

/** Auth token storage key */
const AUTH_TOKEN_KEY = 'sokchad_auth_token';

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
  perPage: number;
  total: number;
  totalPages: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface SignupPayload {
  fullName: string;
  username: string;
  email: string;
  phone: string;  // 8-digit Chad number (without +235 prefix)
  password: string;
  accountType: 'buyer' | 'seller';
}

export interface CreateProductPayload {
  title_en: string;
  title_fr: string;
  title_ar: string;
  description_en: string;
  description_fr: string;
  description_ar: string;
  price: number;
  category_id: string;
  condition: 'new' | 'used' | 'like_new';
  location: string;
  images: string[];  // Base64 or URLs
}

export interface CreateOrderPayload {
  product_id: string;
  payment_method_id: string;
  buyer_phone: string;
  reference_id: string;
}

export interface SendMessagePayload {
  conversation_id: string;
  text: string;
}

// ============================================================
// HTTP CLIENT
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

let cachedToken: string | null = null;

async function getAuthToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  try {
    cachedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    return cachedToken;
  } catch {
    return null;
  }
}

async function setAuthToken(token: string): Promise<void> {
  cachedToken = token;
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
}

async function clearAuthToken(): Promise<void> {
  cachedToken = null;
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
}

/**
 * Core HTTP request handler.
 * Automatically attaches auth token and handles timeouts.
 */
async function request<T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  body?: any,
  requiresAuth: boolean = true,
): Promise<ApiResponse<T>> {
  // If no base URL configured, return error indicating mock mode
  if (!API_BASE_URL) {
    return { success: false, error: 'API not configured. Using local mock data.' };
  }

  const url = `${API_BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  if (requiresAuth) {
    const token = await getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const json = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: json.error || json.message || `HTTP ${response.status}`,
      };
    }

    return { success: true, data: json.data ?? json, ...json };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { success: false, error: 'Request timed out. Please check your connection.' };
    }
    return { success: false, error: err.message || 'Network error. Please try again.' };
  }
}

// ============================================================
// API ENDPOINTS
// ============================================================
// Each function maps to a RESTful endpoint on your custom backend.
// Backend MySQL tables should mirror the TypeScript interfaces.

/**
 * ==================
 * AUTHENTICATION
 * ==================
 * Backend endpoints:
 *   POST /auth/login        → Authenticate user, return JWT tokens
 *   POST /auth/register     → Create new account
 *   POST /auth/logout       → Invalidate refresh token
 *   GET  /auth/me           → Get current user profile
 *   POST /auth/refresh      → Refresh access token
 */

export const authApi = {
  login: (payload: LoginPayload) =>
    request<{ user: any; tokens: AuthTokens }>('POST', '/auth/login', payload, false),

  register: (payload: SignupPayload) =>
    request<{ user: any; tokens: AuthTokens }>('POST', '/auth/register', payload, false),

  logout: () => request('POST', '/auth/logout'),

  getProfile: () => request<any>('GET', '/auth/me'),

  refreshToken: (refreshToken: string) =>
    request<AuthTokens>('POST', '/auth/refresh', { refreshToken }, false),
};

/**
 * ==================
 * PRODUCTS
 * ==================
 * Backend endpoints:
 *   GET    /products                → List products (supports ?category=&search=&page=&sort=)
 *   GET    /products/:id            → Get single product
 *   POST   /products                → Create product (auth required)
 *   PUT    /products/:id            → Update product (auth required, owner only)
 *   DELETE /products/:id            → Delete product (auth required, owner only)
 *   GET    /products/promoted       → Get promoted/pinned products
 *   GET    /products/seller/:id     → Get products by seller
 */

export const productsApi = {
  list: (params?: {
    category?: string;
    search?: string;
    page?: number;
    sort?: string;
    condition?: string;
    location?: string;
    priceMin?: number;
    priceMax?: number;
  }) => {
    const query = params
      ? '?' + Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
          .join('&')
      : '';
    return request<any[]>('GET', `/products${query}`, undefined, false);
  },

  getById: (id: string) =>
    request<any>('GET', `/products/${id}`, undefined, false),

  create: (payload: CreateProductPayload) =>
    request<any>('POST', '/products', payload),

  update: (id: string, payload: Partial<CreateProductPayload>) =>
    request<any>('PUT', `/products/${id}`, payload),

  delete: (id: string) =>
    request<any>('DELETE', `/products/${id}`),

  getPromoted: () =>
    request<any[]>('GET', '/products/promoted', undefined, false),

  getBySeller: (sellerId: string) =>
    request<any[]>('GET', `/products/seller/${sellerId}`, undefined, false),
};

/**
 * ==================
 * CATEGORIES
 * ==================
 * Backend endpoints:
 *   GET /categories → List all categories
 */

export const categoriesApi = {
  list: () => request<any[]>('GET', '/categories', undefined, false),
};

/**
 * ==================
 * ORDERS
 * ==================
 * Backend endpoints:
 *   GET    /orders              → List user orders (buyer or seller)
 *   GET    /orders/:id          → Get order details
 *   POST   /orders              → Create order (auth required)
 *   PUT    /orders/:id/confirm  → Seller confirms payment received
 *   PUT    /orders/:id/receive  → Buyer marks item as received
 *   PUT    /orders/:id/dispute  → Buyer raises dispute
 */

export const ordersApi = {
  list: () => request<any[]>('GET', '/orders'),

  getById: (id: string) => request<any>('GET', `/orders/${id}`),

  create: (payload: CreateOrderPayload) =>
    request<any>('POST', '/orders', payload),

  confirmPayment: (id: string) =>
    request<any>('PUT', `/orders/${id}/confirm`),

  markReceived: (id: string) =>
    request<any>('PUT', `/orders/${id}/receive`),

  raiseDispute: (id: string, reason: string) =>
    request<any>('PUT', `/orders/${id}/dispute`, { reason }),
};

/**
 * ==================
 * CONVERSATIONS / MESSAGES
 * ==================
 * Backend endpoints:
 *   GET    /conversations            → List user conversations
 *   GET    /conversations/:id        → Get conversation with messages
 *   POST   /conversations            → Start new conversation
 *   POST   /conversations/:id/messages → Send message
 */

export const messagesApi = {
  listConversations: () =>
    request<any[]>('GET', '/conversations'),

  getConversation: (id: string) =>
    request<any>('GET', `/conversations/${id}`),

  startConversation: (sellerId: string, productId: string, message: string) =>
    request<any>('POST', '/conversations', { sellerId, productId, message }),

  sendMessage: (payload: SendMessagePayload) =>
    request<any>('POST', `/conversations/${payload.conversation_id}/messages`, { text: payload.text }),
};

/**
 * ==================
 * SELLERS
 * ==================
 * Backend endpoints:
 *   GET /sellers/:id          → Get seller profile
 *   GET /sellers/:id/reviews  → Get seller reviews
 */

export const sellersApi = {
  getProfile: (id: string) =>
    request<any>('GET', `/sellers/${id}`, undefined, false),

  getReviews: (sellerId: string) =>
    request<any[]>('GET', `/sellers/${sellerId}/reviews`, undefined, false),
};

/**
 * ==================
 * REVIEWS
 * ==================
 * Backend endpoints:
 *   POST /reviews → Submit a review (auth required)
 */

export const reviewsApi = {
  submit: (payload: {
    orderId: string;
    productId: string;
    sellerId: string;
    rating: number;
    text: string;
    photoUri?: string;
  }) => request<any>('POST', '/reviews', payload),
};

/**
 * ==================
 * PAYMENT METHODS
 * ==================
 * Backend endpoints:
 *   GET /payment-methods → List active payment methods
 */

export const paymentMethodsApi = {
  list: () => request<any[]>('GET', '/payment-methods', undefined, false),
};

/**
 * ==================
 * ADMIN
 * ==================
 * Backend endpoints:
 *   GET    /admin/dashboard       → Admin dashboard stats
 *   GET    /admin/users           → List all users
 *   PUT    /admin/users/:id/ban   → Ban user
 *   PUT    /admin/users/:id/unban → Unban user
 *   PUT    /admin/users/:id/verify → Verify seller
 *   POST   /admin/staff           → Create staff member
 *   DELETE /admin/staff/:id       → Remove staff member
 *   POST   /admin/payment-methods → Create payment method
 *   PUT    /admin/payment-methods/:id → Update payment method
 *   DELETE /admin/payment-methods/:id → Delete payment method
 */

export const adminApi = {
  getDashboard: () => request<any>('GET', '/admin/dashboard'),
  listUsers: () => request<any[]>('GET', '/admin/users'),
  banUser: (userId: string, duration: string) =>
    request<any>('PUT', `/admin/users/${userId}/ban`, { duration }),
  unbanUser: (userId: string) =>
    request<any>('PUT', `/admin/users/${userId}/unban`),
  verifySeller: (userId: string, until: string) =>
    request<any>('PUT', `/admin/users/${userId}/verify`, { until }),
  createStaff: (payload: { email: string; password: string; permissions: string[] }) =>
    request<any>('POST', '/admin/staff', payload),
  removeStaff: (id: string) =>
    request<any>('DELETE', `/admin/staff/${id}`),
  createPaymentMethod: (payload: { name: string; logo: string; color: string; instructions: string }) =>
    request<any>('POST', '/admin/payment-methods', payload),
  updatePaymentMethod: (id: string, payload: any) =>
    request<any>('PUT', `/admin/payment-methods/${id}`, payload),
  deletePaymentMethod: (id: string) =>
    request<any>('DELETE', `/admin/payment-methods/${id}`),
};

/**
 * ==================
 * FILE UPLOAD
 * ==================
 * Backend endpoint:
 *   POST /upload → Upload file (multipart/form-data)
 *   Returns { success: true, data: { url: 'https://...' } }
 */

export const uploadApi = {
  uploadImage: async (uri: string, folder: string = 'products'): Promise<ApiResponse<{ url: string }>> => {
    if (!API_BASE_URL) {
      return { success: false, error: 'API not configured.' };
    }

    const token = await getAuthToken();
    const formData = new FormData();
    
    const filename = uri.split('/').pop() || 'image.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    formData.append('file', { uri, name: filename, type } as any);
    formData.append('folder', folder);

    try {
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: formData,
      });

      const json = await response.json();
      if (!response.ok) {
        return { success: false, error: json.error || 'Upload failed' };
      }
      return { success: true, data: json.data };
    } catch (err: any) {
      return { success: false, error: err.message || 'Upload failed' };
    }
  },
};

// ============================================================
// TOKEN MANAGEMENT (exported for use in AppContext)
// ============================================================

export { getAuthToken, setAuthToken, clearAuthToken };

// ============================================================
// PHP AUTH (auth_email.php) — replaces Supabase Auth for login/signup
// ============================================================

export async function signInWithPhp(email: string, password: string): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    const response = await fetch(`${API_BASE_URL}/auth_email.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', email: email.trim().toLowerCase(), password }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await response.json();
    if (data.success && data.data) {
      // Save token and user — don't await, do in parallel
      await Promise.all([
        setAuthToken(data.data.token),
        AsyncStorage.setItem('sokchad_user', JSON.stringify(data.data.user)),
      ]);
      return { success: true, user: data.data.user };
    }
    return { success: false, error: data.error || 'Login failed' };
  } catch (e: any) {
    if (e.name === 'AbortError') return { success: false, error: 'Request timeout' };
    return { success: false, error: e.message || 'Network error' };
  }
}

export async function signUpWithPhp(payload: {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  role: 'buyer' | 'seller';
  username: string;
}): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth_email.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'signup',
        email: payload.email.trim().toLowerCase(),
        password: payload.password,
        name: payload.fullName,
        username: payload.username,
        phone: payload.phone,
        role: payload.role,
      }),
    });
    const data = await response.json();
    if (data.success && data.data) {
      await setAuthToken(data.data.token);
      await AsyncStorage.setItem('sokchad_user', JSON.stringify(data.data.user));
      return { success: true, user: data.data.user };
    }
    return { success: false, error: data.error || 'Signup failed' };
  } catch (e: any) {
    return { success: false, error: e.message || 'Network error' };
  }
}

// ============================================================
// BACKEND MYSQL SCHEMA REFERENCE
// ============================================================
/**
 * When setting up your MySQL database, create the following tables:
 *
 * -- Users table
 * CREATE TABLE users (
 *   id          INT AUTO_INCREMENT PRIMARY KEY,
 *   full_name   VARCHAR(255) NOT NULL,
 *   username    VARCHAR(100) NOT NULL UNIQUE,
 *   email       VARCHAR(255) NOT NULL UNIQUE,
 *   phone       VARCHAR(8) NOT NULL,
 *   password    VARCHAR(255) NOT NULL,  -- bcrypt hashed
 *   role        ENUM('buyer','seller','admin','staff') DEFAULT 'buyer',
 *   avatar_url  VARCHAR(500) DEFAULT NULL,
 *   cover_url   VARCHAR(500) DEFAULT NULL,
 *   is_verified BOOLEAN DEFAULT FALSE,
 *   is_banned   BOOLEAN DEFAULT FALSE,
 *   banned_until DATETIME DEFAULT NULL,
 *   seller_id   VARCHAR(20) DEFAULT NULL UNIQUE,
 *   rating      DECIMAL(3,2) DEFAULT 0.00,
 *   total_sales INT DEFAULT 0,
 *   location    VARCHAR(100) DEFAULT NULL,
 *   language_pref ENUM('en','fr','ar') DEFAULT 'en',
 *   created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 *   updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
 * );
 *
 * -- Categories table
 * CREATE TABLE categories (
 *   id       VARCHAR(50) PRIMARY KEY,
 *   name_en  VARCHAR(100) NOT NULL,
 *   name_fr  VARCHAR(100) NOT NULL,
 *   name_ar  VARCHAR(100) NOT NULL,
 *   icon     VARCHAR(50) NOT NULL,
 *   color    VARCHAR(10) NOT NULL,
 *   sort_order INT DEFAULT 0
 * );
 *
 * -- Products table
 * CREATE TABLE products (
 *   id             INT AUTO_INCREMENT PRIMARY KEY,
 *   seller_id      INT NOT NULL,
 *   title_en       VARCHAR(255) NOT NULL,
 *   title_fr       VARCHAR(255) DEFAULT '',
 *   title_ar       VARCHAR(255) DEFAULT '',
 *   description_en TEXT DEFAULT '',
 *   description_fr TEXT DEFAULT '',
 *   description_ar TEXT DEFAULT '',
 *   price          INT NOT NULL,
 *   category_id    VARCHAR(50),
 *   `condition`    ENUM('new','used','like_new') DEFAULT 'new',
 *   location       VARCHAR(100) DEFAULT '',
 *   is_pinned      BOOLEAN DEFAULT FALSE,
 *   pinned_until   DATETIME DEFAULT NULL,
 *   status         ENUM('active','sold','inactive') DEFAULT 'active',
 *   views          INT DEFAULT 0,
 *   created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 *   updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 *   FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
 *   FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
 * );
 *
 * -- Product images table
 * CREATE TABLE product_images (
 *   id         INT AUTO_INCREMENT PRIMARY KEY,
 *   product_id INT NOT NULL,
 *   image_url  VARCHAR(500) NOT NULL,
 *   sort_order INT DEFAULT 0,
 *   FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
 * );
 *
 * -- Orders table
 * CREATE TABLE orders (
 *   id                INT AUTO_INCREMENT PRIMARY KEY,
 *   product_id        INT NOT NULL,
 *   buyer_id          INT NOT NULL,
 *   seller_id         INT NOT NULL,
 *   amount            INT NOT NULL,
 *   payment_method_id VARCHAR(50),
 *   reference_id      VARCHAR(100) DEFAULT '',
 *   buyer_phone       VARCHAR(20) DEFAULT '',
 *   status            ENUM('pending','confirmed','disputed','cancelled','delivered','completed') DEFAULT 'pending',
 *   created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 *   updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 *   FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
 *   FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
 *   FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
 * );
 *
 * -- Conversations table
 * CREATE TABLE conversations (
 *   id          INT AUTO_INCREMENT PRIMARY KEY,
 *   buyer_id    INT NOT NULL,
 *   seller_id   INT NOT NULL,
 *   product_id  INT,
 *   last_message TEXT,
 *   last_message_at DATETIME,
 *   created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 *   FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
 *   FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
 *   FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
 * );
 *
 * -- Messages table
 * CREATE TABLE messages (
 *   id              INT AUTO_INCREMENT PRIMARY KEY,
 *   conversation_id INT NOT NULL,
 *   sender_id       INT NOT NULL,
 *   text            TEXT NOT NULL,
 *   text_en         TEXT DEFAULT NULL,
 *   text_fr         TEXT DEFAULT NULL,
 *   text_ar         TEXT DEFAULT NULL,
 *   created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 *   FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
 *   FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
 * );
 *
 * -- Reviews table
 * CREATE TABLE reviews (
 *   id         INT AUTO_INCREMENT PRIMARY KEY,
 *   order_id   INT NOT NULL,
 *   product_id INT NOT NULL,
 *   buyer_id   INT NOT NULL,
 *   seller_id  INT NOT NULL,
 *   rating     TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
 *   text       TEXT NOT NULL,
 *   photo_url  VARCHAR(500) DEFAULT NULL,
 *   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 *   FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
 *   FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
 *   FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
 *   FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
 * );
 *
 * -- Payment methods table
 * CREATE TABLE payment_methods (
 *   id           VARCHAR(50) PRIMARY KEY,
 *   name         VARCHAR(100) NOT NULL,
 *   logo_url     VARCHAR(500) DEFAULT '',
 *   color        VARCHAR(10) DEFAULT '#000000',
 *   instructions TEXT DEFAULT '',
 *   is_active    BOOLEAN DEFAULT TRUE,
 *   created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 * );
 *
 * -- Seller payment methods table
 * CREATE TABLE seller_payment_methods (
 *   id                INT AUTO_INCREMENT PRIMARY KEY,
 *   seller_id         INT NOT NULL,
 *   payment_method_id VARCHAR(50) NOT NULL,
 *   receiving_number  VARCHAR(30) NOT NULL,
 *   UNIQUE KEY (seller_id, payment_method_id),
 *   FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
 *   FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE CASCADE
 * );
 *
 * -- Disputes table
 * CREATE TABLE disputes (
 *   id          INT AUTO_INCREMENT PRIMARY KEY,
 *   order_id    INT NOT NULL,
 *   reporter_id INT NOT NULL,
 *   reason      TEXT NOT NULL,
 *   status      ENUM('open','resolved','rejected') DEFAULT 'open',
 *   admin_notes TEXT DEFAULT NULL,
 *   resolved_by INT DEFAULT NULL,
 *   created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 *   updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 *   FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
 *   FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
 *   FOREIGN KEY (resolved_by) REFERENCES users(id)
 * );
 *
 * -- Admin staff table
 * CREATE TABLE admin_staff (
 *   id          INT AUTO_INCREMENT PRIMARY KEY,
 *   user_id     INT NOT NULL UNIQUE,
 *   permissions JSON NOT NULL DEFAULT '[]',
 *   created_by  INT DEFAULT NULL,
 *   created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 *   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
 *   FOREIGN KEY (created_by) REFERENCES users(id)
 * );
 */
