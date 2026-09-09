# Seller Profile Reorganization — Comprehensive Implementation Plan

## Executive Summary

Reorganize the Sokchad seller experience from a fragmented, mock-data-driven set of screens into a **professional seller dashboard with real database statistics**. The current architecture has significant overlap, dead tabs, client-side computed stats from mock data, and no real DB-powered seller stats pipeline. This plan consolidates everything into a clean, real-data dashboard.

---

## 1. Current State Analysis

### 1.1 File Inventory & Sizes

| File | Lines | Role |
|------|-------|------|
| `app/(tabs)/profile.tsx` | 1709 | **Monolith** — buyer profile, seller profile, settings, verification, tabs (products/orders/stats/reviews), modals |
| `app/(tabs)/store-profile.tsx` | 661 | Store header, banner/logo upload, delivery cities, product grid, share |
| `app/(tabs)/seller-stats.tsx` | 447 | Revenue card, 2×2 stat grid, quick actions, recent orders, inventory summary |
| `app/(tabs)/seller-analytics.tsx` | 472 | Deep analytics: category breakdown, top products, rating breakdown, revenue by status |
| `app/(tabs)/seller-orders.tsx` | 277 | Order list with tab filters (all/pending/confirmed/completed) |
| `app/settings.tsx` | 651 | Settings page (language, dark mode, account, seller settings, support, blocked sellers, logout) |
| `app/seller-payments.tsx` | 389 | Payment receiving numbers configuration |
| `contexts/AppContext.tsx` | 2053 | Global state — has buyer orders/stats API fetch but **NO seller orders/stats API fetch** |
| `services/orderStats.ts` | 210 | `fetchBuyerStats()`, `fetchUserOrders()` — buyer-focused |
| `services/ordersService.ts` | 270 | `fetchMyOrders()`, `createOrder()`, `confirmOrder()`, `fetchSellerStats()` — exists but **unused by screens** |
| `services/sellerServices.ts` | 128 | Supabase-based payment methods + blocked sellers (legacy, partially dead) |
| `services/adminService.ts` | 301 | Admin API: `fetchAllUsers()`, `fetchSellers()`, `fetchAdminStats()`, ban/verify |

### 1.2 Backend API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `api_stats.php` | GET | **Seller stats** (revenue, orders, products, category breakdown, avg rating) — `handleSellerStats($userId)` |
| `api_stats.php?scope=admin` | GET | Admin dashboard stats |
| `admin/api_stats.php` | GET | Admin stats (duplicate, separate auth) |
| `api_buyer_stats.php` | GET | Buyer stats (completed, pending, success rate, unique sellers, is_trusted) |
| `api_orders.php` | GET | List orders (role=buyer/seller/all, status filter, pagination) |
| `api_orders.php` | POST | Create order |
| `api_orders.php?id=X` | PUT | Update order (confirm, receive, dispute, cancel) |
| `seller_delivery_cities.php` | GET/PUT | Seller delivery cities |
| `seller_payment_methods.php` | GET/PUT | Seller payment methods |
| `seller_shipping.php` | GET/PUT | Seller shipping companies |
| `follows.php` | GET/POST | Follow/unfollow sellers |
| `seller_stats.php?id=X` | GET | Public seller stats (followers/following) |

### 1.3 Key Problems Identified

#### A. Massive Code Duplication
- **Settings block is duplicated 3×**: `profile.tsx` (inline `SettingsBlock` variable, ~210 lines), `settings.tsx` (standalone screen, ~650 lines), and the settings content is nearly identical in both.
- **Stats computation duplicated 4×**: `profile.tsx` (seller tab 'stats', ~35 lines), `seller-stats.tsx` (full screen), `seller-analytics.tsx` (full screen), all compute `totalRevenue`, `pendingCount`, `confirmedCount`, `totalViews`, `avgOrderValue`, `uniqueBuyers`, `totalStock`, `avgRating` from the **same mock `orders` array** via `useMemo`.
- **Order list rendering duplicated 2×**: `profile.tsx` (seller tab 'orders') and `seller-orders.tsx` both render the same order cards.
- **Product grid duplicated 3×**: `profile.tsx` (seller tab 'products'), `store-profile.tsx`, and `sell.tsx` all render the same product cards.
- **Header/store info duplicated**: `store-profile.tsx` and `seller-stats.tsx` both render a colored header with avatar, store name, store ID, product count, settings gear.

#### B. Mock Data Instead of Real DB Stats
- **`orders` in AppContext is initialized from `mockOrders`** (line 503: `useState<Order[]>(mockOrders)`). Seller stats screens filter this mock array client-side.
- **No seller orders API fetch**: AppContext fetches buyer orders via `fetchUserOrders('buyer')` on login (line 1090) but **never fetches seller orders** via `fetchUserOrders('seller')`.
- **`api_stats.php` exists and returns real seller stats** (revenue, order counts, category breakdown, avg rating) but **is never called by any screen**. `ordersService.ts` has `fetchSellerStats()` (line 257) that calls `api_stats.php`, but it's imported nowhere.
- **`seller-stats.tsx`, `seller-analytics.tsx`, `seller-orders.tsx` all use `orders` from context** which is mock data, not API data.

#### C. Dead/Hidden Tabs
From `_layout.tsx`:
- `seller-stats` → `href: null` (hidden — "stats now inside profile")
- `seller-analytics` → `href: null` (hidden)
- `seller-orders` → `href: null` (hidden)
- `favorites` → `href: null` (hidden for sellers)
- `profile` → `href: null` for sellers (hidden — sellers use store-profile)

**Visible seller tabs**: `store-profile`, `chats`, `sell`, and `profile` is hidden. So sellers see 3 tabs: Store, Chats, Products.
**Visible buyer tabs**: `index` (home), `categories`, `chats`, `sell` (hidden for buyers), `profile`.

The hidden screens (`seller-stats`, `seller-analytics`, `seller-orders`) are still in the codebase and routeable programmatically but not visible in the tab bar. `seller-stats.tsx` is referenced as a tab but `href: null`.

#### D. Fragmented Seller Experience
- Seller sees: `store-profile` (store management) + `sell` (product management) + `profile` (hidden, but has seller tabs for products/orders/stats/reviews).
- Settings are embedded inline in `profile.tsx` for sellers (`SettingsBlock`) but also exist as a separate `/settings` route.
- Store management (banner, logo, delivery cities) is in `store-profile.tsx`.
- Payment numbers are in `seller-payments.tsx` (separate route).
- Stats are embedded in `profile.tsx` seller tab AND in the hidden `seller-stats.tsx` and `seller-analytics.tsx` screens.

#### E. Architecture Issues
- `profile.tsx` is 1709 lines — a monolith handling guest, buyer, seller, admin redirect, settings, verification, and all tabs.
- `sellerServices.ts` uses Supabase while the rest of the app uses the PHP API — Supabase calls are likely dead/failing.
- `blockedSellers` service in `settings.tsx` imports from `@/services/blockedSellers` (Supabase-based) while AppContext has PHP-based follow/block endpoints.

---

## 2. Target Architecture

### 2.1 Design Principles
1. **Real DB data everywhere** — replace all mock-data client-side stat computation with `api_stats.php` and `api_orders.php?role=seller`.
2. **Single source of truth** — one stats fetch in AppContext, consumed by all screens.
3. **Separation of concerns** — split the monolith into focused components/screens.
4. **No duplication** — shared components extracted to `components/seller/`.
5. **Professional dashboard** — consolidated seller dashboard as the primary tab.

### 2.2 Proposed Tab Structure (Sellers)

| Tab | Screen | Purpose |
|-----|--------|---------|
| **Dashboard** | `store-profile.tsx` (renamed/repurposed) | Unified seller dashboard: header, revenue, stats grid, recent orders, quick actions, inventory summary |
| **Products** | `sell.tsx` | Product management (add/list/edit) |
| **Orders** | `seller-orders.tsx` (made visible) | Full order list with filters |
| **Chats** | `chats.tsx` | Chat with buyers |
| **Profile** | `profile.tsx` (simplified) | Account info, settings, verification, logout |

**Removed/consolidated**:
- `seller-stats.tsx` → merged into Dashboard
- `seller-analytics.tsx` → merged into Dashboard as a "Detailed Analytics" expandable section or separate route `/seller-analytics`
- `store-profile.tsx` → becomes the Dashboard

### 2.3 Proposed Component Architecture

```
components/seller/
├── SellerDashboardHeader.tsx     — Banner, avatar, store name, ID, rating, settings gear
├── RevenueHeroCard.tsx            — Total revenue card with sub-stats
├── StatsGrid.tsx                  — 2×2 (or 2×3) stat cards (pending, confirmed, products, views, buyers, stock)
├── QuickActions.tsx               — Add product, discounts, analytics, my store
├── RecentOrdersList.tsx           — Last 5 orders with "See All" → seller-orders
├── InventorySummary.tsx           — Stock, buyers, rating compact row
├── CategoryBreakdown.tsx          — Category bar chart (from api_stats.php)
├── StoreInfoCard.tsx              — Owner, email, phone, verification status
├── DeliveryCitiesManager.tsx      — Multi-select city chips
├── PaymentMethodsCard.tsx         — Link to /seller-payments
├── SellerOrderCard.tsx            — Reusable order card (used in dashboard + orders screen)
├── SellerProductCard.tsx          — Reusable product card (used in dashboard + sell screen)
└── SellerStatsHook.ts             — useSellerStats() custom hook
```

```
hooks/
├── useSellerStats.ts              — Fetches + caches api_stats.php data
└── useSellerOrders.ts             — Fetches + caches api_orders.php?role=seller
```

---

## 3. Implementation Plan

### Phase 1: Backend — Enhance `api_stats.php` (No new endpoints needed)

The existing `api_stats.php` `handleSellerStats()` already returns:
- `total_revenue`, `total_orders`, `total_products`, `order_status` (counts by status), `category_breakdown`, `avg_rating`, `review_count`

**Enhancements needed**:
1. **Add `total_views`** — `SELECT COALESCE(SUM(views), 0) FROM products WHERE seller_id = :uid AND status = 'active'`
2. **Add `unique_buyers`** — `SELECT COUNT(DISTINCT buyer_id) FROM orders WHERE seller_id = :uid`
3. **Add `total_stock`** — `SELECT COALESCE(SUM(stock), 0) FROM products WHERE seller_id = :uid AND status = 'active'`
4. **Add `avg_order_value`** — computed: `total_revenue / (confirmed+completed count)` or `0`
5. **Add `pending_revenue`** — `SELECT COALESCE(SUM(amount), 0) FROM orders WHERE seller_id = :uid AND status = 'pending'`
6. **Add `recent_orders`** (last 5) — joined with product image, buyer name, status
7. **Add `top_products`** (by views, top 5) — `SELECT id, title_en, title_fr, title_ar, price, views, stock, (first image) FROM products WHERE seller_id = :uid ORDER BY views DESC LIMIT 5`
8. **Add `rating_breakdown`** — `SELECT rating, COUNT(*) FROM reviews WHERE seller_id = :uid GROUP BY rating`

**Files to modify**: `backend/api_stats.php` (add fields to `handleSellerStats()`)

### Phase 2: Frontend Services — Create Seller Stats Service

Create `services/sellerStatsService.ts`:

```typescript
// Wraps api_stats.php call with auth, caching, and typed response
export interface SellerStats {
  total_revenue: number;
  pending_revenue: number;
  total_orders: number;
  total_products: number;
  total_views: number;
  total_stock: number;
  unique_buyers: number;
  avg_order_value: number;
  avg_rating: number;
  review_count: number;
  order_status: Record<string, number>;
  category_breakdown: Array<{...}>;
  rating_breakdown: number[]; // [count_1star, count_2star, ..., count_5star]
  recent_orders: Array<{...}>;
  top_products: Array<{...}>;
}

export async function fetchSellerStats(): Promise<ApiResponse<SellerStats>>;
```

**Files to create**: `services/sellerStatsService.ts`
**Files to deprecate**: `services/sellerServices.ts` (Supabase-based, replace PHP equivalents)

### Phase 3: AppContext — Add Seller Orders + Stats State

Add to `contexts/AppContext.tsx`:

1. **State**: `sellerOrders: OrderFromAPI[]`, `sellerStats: SellerStats | null`
2. **Fetch effect**: Mirror the buyer fetch logic (lines 1068-1128) but call `fetchUserOrders('seller')` and `fetchSellerStats()`
3. **Expose**: `sellerOrders`, `sellerStats`, `refreshSellerStats()` in context value
4. **Refresh**: Add `refreshSellerStats` callable from pull-to-refresh on dashboard

```typescript
// Add after line 509
const [sellerOrders, setSellerOrders] = useState<OrderFromAPI[]>([]);
const [sellerStats, setSellerStats] = useState<SellerStats | null>(null);

// Add after line 1128 (mirror buyer fetch effect)
useEffect(() => {
  if (!user?.isSeller) { setSellerOrders([]); setSellerStats(null); return; }
  (async () => {
    const [ordersRes, statsRes] = await Promise.allSettled([
      fetchUserOrders('seller'),
      fetchSellerStats(),
    ]);
    if (ordersRes.status === 'fulfilled' && ordersRes.value.success)
      setSellerOrders(ordersRes.value.data);
    if (statsRes.status === 'fulfilled' && statsRes.value.success)
      setSellerStats(statsRes.value.data);
  })();
}, [user?.id, user?.isSeller]);
```

**Files to modify**: `contexts/AppContext.tsx`

### Phase 4: Build Shared Seller Components

Extract reusable components from existing screens:

#### 4.1 `components/seller/SellerDashboardHeader.tsx`
- Props: `user`, `colors`, `lb`, `onSettingsPress`, `onBannerPress`, `onLogoPress`, `stats` (for rating/product count)
- Consolidates header from `store-profile.tsx` (lines 205-304) and `seller-stats.tsx` (lines 114-157)

#### 4.2 `components/seller/RevenueHeroCard.tsx`
- Props: `revenue`, `orderCount`, `avgOrderValue`, `colors`, `lb`
- From `seller-stats.tsx` lines 159-186

#### 4.3 `components/seller/StatsGrid.tsx`
- Props: `stats` (pending, confirmed, products, views), `colors`, `lb`, `onPress` handlers
- From `seller-stats.tsx` lines 188-218

#### 4.4 `components/seller/RecentOrdersList.tsx`
- Props: `orders`, `products`, `colors`, `lb`, `onOrderPress`, `onSeeAll`
- From `seller-stats.tsx` lines 249-316

#### 4.5 `components/seller/SellerOrderCard.tsx`
- Props: `order`, `product`, `colors`, `lb`, `onPress`, `statusColor`, `statusLabel`
- Extracted from `seller-stats.tsx` lines 272-313, `seller-orders.tsx`, and `profile.tsx` seller tab orders

#### 4.6 `components/seller/SellerProductCard.tsx`
- Props: `product`, `colors`, `lb`, `language`, `onPress`
- Extracted from `store-profile.tsx` lines 484-575 and `profile.tsx` lines 1006-1021

#### 4.7 `components/seller/CategoryBreakdown.tsx`
- Props: `categories` (from api_stats), `colors`, `lb`
- From `seller-analytics.tsx` and `profile.tsx` lines 1108-1120

#### 4.8 `components/seller/InventorySummary.tsx`
- Props: `stock`, `buyers`, `rating`, `colors`, `lb`
- From `seller-stats.tsx` lines 318-350

#### 4.9 `components/seller/DeliveryCitiesManager.tsx`
- Props: `selectedCities`, `onToggle`, `onSave`, `colors`, `lb`, `saving`
- From `store-profile.tsx` lines 359-434

#### 4.10 `components/seller/StoreInfoCard.tsx`
- Props: `user`, `colors`, `lb`
- From `store-profile.tsx` lines 306-334

### Phase 5: Rebuild `store-profile.tsx` as the Seller Dashboard

Transform `store-profile.tsx` from a store-management screen into the **unified seller dashboard**:

```
┌─────────────────────────────────────┐
│  SellerDashboardHeader              │  ← banner, avatar, name, ID, rating, settings
├─────────────────────────────────────┤
│  RevenueHeroCard (real DB data)     │  ← total_revenue from api_stats.php
├─────────────────────────────────────┤
│  StatsGrid 2×3                      │  ← pending, confirmed, products, views, buyers, stock
│  (all from api_stats.php)            │
├─────────────────────────────────────┤
│  QuickActions                        │  ← Add Product, Orders, Analytics, My Store
├─────────────────────────────────────┤
│  RecentOrdersList (last 5)          │  ← from api_stats.php recent_orders OR sellerOrders
│  [See All → seller-orders]           │
├─────────────────────────────────────┤
│  InventorySummary                    │  ← stock, buyers, rating
├─────────────────────────────────────┤
│  CategoryBreakdown                   │  ← from api_stats.php category_breakdown
├─────────────────────────────────────┤
│  StoreInfoCard                       │  ← owner, email, phone, verified status
├─────────────────────────────────────┤
│  PaymentMethodsCard → /seller-payments│
├─────────────────────────────────────┤
│  DeliveryCitiesManager               │
├─────────────────────────────────────┤
│  My Products grid (compact)          │  ← from products filtered by sellerId
│  [See All → sell tab]                │
└─────────────────────────────────────┘
```

**Key changes**:
- Replace `useMemo` client-side stat computation with `sellerStats` from context (real DB data)
- Replace `sellerOrders` from mock `orders` array with `sellerOrders` from context (real API data)
- Add pull-to-refresh that calls `refreshSellerStats()` + `refreshProducts()`
- Remove inline stat computation (lines 49-51 in current `store-profile.tsx`)

**Files to modify**: `app/(tabs)/store-profile.tsx` (complete rewrite, ~400 lines using shared components)

### Phase 6: Update `seller-orders.tsx` — Real Data

- Replace `orders` from context (mock) with `sellerOrders` from context (real API data)
- Make this tab visible in `_layout.tsx` (`href: isSeller ? undefined : null`)
- Use `SellerOrderCard` shared component
- Add order actions (confirm) using `confirmOrder()` from `ordersService.ts`

**Files to modify**: `app/(tabs)/seller-orders.tsx`, `app/(tabs)/_layout.tsx`

### Phase 7: Simplify `profile.tsx` — Remove Seller Tabs

For sellers, `profile.tsx` should become a simple **account/settings screen**:
- Remove seller tab navigation (products/orders/stats/reviews) — these are now in the Dashboard and Orders tab
- Remove the inline `SettingsBlock` for sellers — point to `/settings` route instead (like buyers do)
- Keep: profile card, avatar/cover, edit profile, verification status, badges, stats row (compact)
- Remove: seller products grid (→ sell tab), seller orders list (→ seller-orders tab), seller stats tab (→ dashboard), seller reviews (→ can be a section in dashboard or `/seller-reviews` route)

**Expected size reduction**: 1709 → ~600 lines

**Files to modify**: `app/(tabs)/profile.tsx` (major refactor)

### Phase 8: Consolidate Settings

- Remove the inline `SettingsBlock` from `profile.tsx` (lines 569-781, ~210 lines)
- Sellers navigate to `/settings` just like buyers (the gear icon in `store-profile.tsx` already does this)
- `settings.tsx` already has the full seller settings section (lines 298-330) — keep it as the single source
- Remove duplicated settings state (password modal, edit profile modal, language modal, blocked sellers modal) from `profile.tsx` — these exist in `settings.tsx`

**Files to modify**: `app/(tabs)/profile.tsx` (remove ~400 lines of settings + modals)

### Phase 9: Update Tab Layout

Update `app/(tabs)/_layout.tsx`:

```typescript
// SELLER TABS — 5: Dashboard, Products, Orders, Chats, Profile
<Tabs.Screen name="store-profile" options={{
  title: isAr ? 'لوحة' : 'Dashboard',  // renamed from 'Ma boutique'
  tabBarIcon: ({ color, size }) => <TabIcon name="dashboard" size={size} color={color} />,
  href: isSeller ? undefined : null,
}} />
<Tabs.Screen name="sell" options={{
  title: isAr ? 'منتجاتي' : 'Produits',
  tabBarIcon: ({ color, size }) => <TabIcon name="add-circle" size={size} color={color} />,
  href: isSeller ? undefined : null,
}} />
<Tabs.Screen name="seller-orders" options={{
  title: isAr ? 'الطلبات' : 'Commandes',
  tabBarIcon: ({ color, size }) => <TabIcon name="receipt-long" size={size} color={color} />,
  href: isSeller ? undefined : null,  // NOW VISIBLE
}} />
<Tabs.Screen name="chats" options={{ ... }} />
<Tabs.Screen name="profile" options={{
  title: isAr ? 'حسابي' : 'Compte',
  href: isSeller ? undefined : null,  // NOW VISIBLE for sellers too
}} />

// HIDDEN (keep routeable but not in tab bar)
<Tabs.Screen name="seller-stats" options={{ href: null }} />
<Tabs.Screen name="seller-analytics" options={{ href: null }} />
<Tabs.Screen name="index" options={{ href: isSeller ? null : undefined }} />
<Tabs.Screen name="categories" options={{ href: isSeller ? null : undefined }} />
<Tabs.Screen name="favorites" options={{ href: null }} />
```

**Files to modify**: `app/(tabs)/_layout.tsx`

### Phase 10: Clean Up Dead Code

1. **Remove `sellerServices.ts`** — Supabase-based, replaced by PHP API calls
2. **Remove `services/blockedSellers.ts`** (if exists) — Supabase-based, use PHP API
3. **Remove or archive `seller-stats.tsx`** — functionality merged into Dashboard. Keep as a routeable screen for deep-link compatibility or remove entirely.
4. **Remove or archive `seller-analytics.tsx`** — functionality merged into Dashboard. Can keep as `/seller-analytics` route for detailed analytics view (link from Dashboard "Analytics" quick action).
5. **Remove duplicate stat computation** from all screens — use `sellerStats` from context
6. **Remove `mockOrders` initialization** for seller contexts — only use as fallback if API fails

---

## 4. Data Flow Summary

### Current (Broken):
```
AppContext.orders = mockOrders (local state)
  ↓
seller-stats.tsx: orders.filter(sellerId === user.id) → client-side stats (MOCK)
seller-analytics.tsx: orders.filter(sellerId === user.id) → client-side stats (MOCK)
seller-orders.tsx: orders.filter(sellerId === user.id) → order list (MOCK)
profile.tsx: orders.filter(sellerId === user.id) → client-side stats (MOCK)

api_stats.php EXISTS but NEVER CALLED
fetchSellerStats() in ordersService.ts EXISTS but NEVER IMPORTED
```

### Target (Real DB):
```
AppContext
  ├── useEffect → fetchUserOrders('seller') → sellerOrders state (REAL)
  ├── useEffect → fetchSellerStats() → sellerStats state (REAL)
  │
  ↓ (consumed by all screens)
  ├── store-profile.tsx (Dashboard): sellerStats + sellerOrders → real stats
  ├── seller-orders.tsx: sellerOrders → real order list
  ├── seller-analytics.tsx: sellerStats → real analytics (if kept)
  └── profile.tsx: sellerStats (compact summary only)
```

---

## 5. Migration Checklist

### Backend
- [ ] Enhance `api_stats.php` `handleSellerStats()` with: `total_views`, `unique_buyers`, `total_stock`, `avg_order_value`, `pending_revenue`, `recent_orders`, `top_products`, `rating_breakdown`

### Services
- [ ] Create `services/sellerStatsService.ts` with `fetchSellerStats()` typed wrapper
- [ ] Remove/deprecate `services/sellerServices.ts` (Supabase)
- [ ] Update `services/ordersService.ts` — keep `fetchSellerStats()` or redirect to new service

### Context
- [ ] Add `sellerOrders` and `sellerStats` state to AppContext
- [ ] Add seller orders/stats fetch effect (mirror buyer fetch)
- [ ] Add `refreshSellerStats()` function
- [ ] Expose in context value + type

### Components (new)
- [ ] `components/seller/SellerDashboardHeader.tsx`
- [ ] `components/seller/RevenueHeroCard.tsx`
- [ ] `components/seller/StatsGrid.tsx`
- [ ] `components/seller/QuickActions.tsx`
- [ ] `components/seller/RecentOrdersList.tsx`
- [ ] `components/seller/SellerOrderCard.tsx`
- [ ] `components/seller/SellerProductCard.tsx`
- [ ] `components/seller/CategoryBreakdown.tsx`
- [ ] `components/seller/InventorySummary.tsx`
- [ ] `components/seller/DeliveryCitiesManager.tsx`
- [ ] `components/seller/StoreInfoCard.tsx`
- [ ] `components/seller/PaymentMethodsCard.tsx`

### Screens (modify)
- [ ] Rewrite `app/(tabs)/store-profile.tsx` as Dashboard using real data + shared components
- [ ] Update `app/(tabs)/seller-orders.tsx` to use `sellerOrders` from context
- [ ] Simplify `app/(tabs)/profile.tsx` — remove seller tabs, remove settings block, remove modals
- [ ] Optionally update `app/(tabs)/seller-analytics.tsx` to use `sellerStats` from context
- [ ] Update `app/(tabs)/_layout.tsx` — make `seller-orders` and `profile` visible for sellers

### Cleanup
- [ ] Archive or remove `app/(tabs)/seller-stats.tsx` (merged into Dashboard)
- [ ] Remove duplicate settings code from `profile.tsx`
- [ ] Remove duplicate stat computation from all screens
- [ ] Update `services/adminService.ts` — verify no seller-related overlap

---

## 6. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| `api_stats.php` not deployed or DB schema differs | Dashboard shows zeros | Add fallback: if API fails, compute from `sellerOrders` state (which may also be empty) → show "No data yet" empty states |
| `fetchUserOrders('seller')` returns empty (no orders in DB) | Stats all zero | Show empty state cards with "No orders yet" messaging |
| Removing settings from `profile.tsx` breaks existing UX | Users can't find settings | Settings gear in Dashboard header → `/settings` route (already exists) |
| Hidden `seller-stats.tsx` still routeable | Confusion if deep-linked | Keep file but redirect to Dashboard, or keep as alias |
| Supabase `sellerServices.ts` removal breaks imports | Build errors | Search all imports, replace with PHP API equivalents |
| Tab order change confuses existing users | UX disruption | Keep similar order: Dashboard (was Store), Products, Orders, Chats, Profile |

---

## 7. Estimated Effort

| Phase | Description | Est. Hours |
|-------|-------------|------------|
| 1 | Backend: Enhance api_stats.php | 2-3h |
| 2 | Services: Create sellerStatsService.ts | 1h |
| 3 | AppContext: Add seller orders/stats state | 2h |
| 4 | Components: Build 12 shared components | 6-8h |
| 5 | Rewrite store-profile.tsx as Dashboard | 4-5h |
| 6 | Update seller-orders.tsx | 1-2h |
| 7 | Simplify profile.tsx | 3-4h |
| 8 | Consolidate settings | 1h (mostly deletion) |
| 9 | Update _layout.tsx | 0.5h |
| 10 | Cleanup dead code | 1-2h |
| **Total** | | **~22-29h** |

---

## 8. Key Decisions Required

1. **Should `seller-analytics.tsx` remain as a separate route?** Recommend: keep as `/seller-analytics` deep-link from Dashboard "Analytics" quick action, but not as a visible tab.

2. **Should `seller-stats.tsx` be deleted or kept as redirect?** Recommend: delete, redirect route to `store-profile`.

3. **Should the seller "Profile" tab show buyer-like content (orders/favorites) or just account/settings?** Recommend: account/settings only — sellers manage products/orders in their dedicated tabs.

4. **Should reviews be a separate tab or a Dashboard section?** Recommend: Dashboard section (collapsible) or a `/seller-reviews` route from Dashboard.

5. **Should `sellerServices.ts` (Supabase) be removed entirely?** Recommend: yes — verify no other imports exist, replace `getSellerPaymentMethods` with PHP API equivalent from AppContext (`fetchSellerPaymentMethods`).