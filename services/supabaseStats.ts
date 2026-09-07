/**
 * Supabase Stats Service
 * Real data from database for buyer and seller dashboards
 */
import { supabase } from '../lib/supabase';

// ─── Buyer Stats ───

export interface BuyerStats {
  totalOrders: number;
  activeOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalPurchases: number;
  favoritesCount: number;
  reviewsWritten: number;
  pendingReviews: number;
  unreadMessages: number;
  newNotifications: number;
}

export async function getBuyerStats(): Promise<BuyerStats> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {
    totalOrders: 0, activeOrders: 0, completedOrders: 0, cancelledOrders: 0,
    totalPurchases: 0, favoritesCount: 0, reviewsWritten: 0, pendingReviews: 0,
    unreadMessages: 0, newNotifications: 0,
  };

  // Fetch orders where buyer_id = user.id
  const { data: orders } = await supabase
    .from('orders')
    .select('id, status, amount')
    .eq('buyer_id', user.id);

  const allOrders = orders || [];
  const completed = allOrders.filter(o => o.status === 'completed');
  const cancelled = allOrders.filter(o => o.status === 'cancelled');
  const active = allOrders.filter(o => ['pending', 'confirmed', 'disputed', 'delivered'].includes(o.status));
  const totalPurchases = completed.reduce((sum, o) => sum + Number(o.amount || 0), 0);

  // Fetch favorites count
  const { count: favCount } = await supabase
    .from('favorites')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  // Fetch reviews written by this buyer
  const { count: reviewsCount } = await supabase
    .from('reviews')
    .select('*', { count: 'exact', head: true })
    .eq('buyer_id', user.id);

  // Pending reviews: completed orders without a review
  const completedOrderIds = completed.map(o => o.id);
  let pendingReviews = 0;
  if (completedOrderIds.length > 0) {
    const { data: reviewedOrders } = await supabase
      .from('reviews')
      .select('order_id')
      .eq('buyer_id', user.id);
    const reviewedIds = new Set((reviewedOrders || []).map(r => r.order_id));
    pendingReviews = completedOrderIds.filter(id => !reviewedIds.has(id)).length;
  }

  return {
    totalOrders: allOrders.length,
    activeOrders: active.length,
    completedOrders: completed.length,
    cancelledOrders: cancelled.length,
    totalPurchases,
    favoritesCount: favCount || 0,
    reviewsWritten: reviewsCount || 0,
    pendingReviews,
    unreadMessages: 0, // TODO: from conversations
    newNotifications: 0, // TODO: from notifications
  };
}

// ─── Seller Stats ───

export interface SellerStats {
  totalProducts: number;
  activeProducts: number;
  soldProducts: number;
  outOfStock: number;
  newOrders: number;
  inProgressOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalSales: number;
  netEarnings: number;
  commission: number;
  favoritesOnProducts: number;
  unreadMessages: number;
  avgRating: number;
  lowStockProducts: number;
}

export async function getSellerStats(): Promise<SellerStats> {
  const { data: { user } } = await supabase.auth.getUser();
  const empty: SellerStats = {
    totalProducts: 0, activeProducts: 0, soldProducts: 0, outOfStock: 0,
    newOrders: 0, inProgressOrders: 0, completedOrders: 0, cancelledOrders: 0,
    totalSales: 0, netEarnings: 0, commission: 0, favoritesOnProducts: 0,
    unreadMessages: 0, avgRating: 0, lowStockProducts: 0,
  };
  if (!user) return empty;

  // Fetch products
  const { data: products } = await supabase
    .from('products')
    .select('id, stock, status')
    .eq('seller_id', user.id);

  const allProducts = products || [];
  const active = allProducts.filter(p => p.status === 'active');
  const outOfStock = allProducts.filter(p => (p.stock ?? 0) <= 0);
  const lowStock = allProducts.filter(p => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 5);

  // Fetch orders where seller_id = user.id
  const { data: orders } = await supabase
    .from('orders')
    .select('id, status, amount')
    .eq('seller_id', user.id);

  const allOrders = orders || [];
  const completed = allOrders.filter(o => o.status === 'completed');
  const cancelled = allOrders.filter(o => o.status === 'cancelled');
  const newOrders = allOrders.filter(o => o.status === 'pending');
  const inProgress = allOrders.filter(o => ['confirmed', 'disputed', 'delivered'].includes(o.status));

  const totalSales = completed.reduce((sum, o) => sum + Number(o.amount || 0), 0);
  const commission = Math.round(totalSales * 0.05);
  const netEarnings = totalSales - commission;

  // Favorites on seller's products
  const productIds = allProducts.map(p => p.id);
  let favCount = 0;
  if (productIds.length > 0) {
    const { count } = await supabase
      .from('favorites')
      .select('*', { count: 'exact', head: true })
      .in('product_id', productIds);
    favCount = count || 0;
  }

  // Average rating
  const { data: reviews } = await supabase
    .from('reviews')
    .select('rating')
    .eq('seller_id', user.id);
  const avgRating = reviews && reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  return {
    totalProducts: allProducts.length,
    activeProducts: active.length,
    soldProducts: completed.length,
    outOfStock: outOfStock.length,
    newOrders: newOrders.length,
    inProgressOrders: inProgress.length,
    completedOrders: completed.length,
    cancelledOrders: cancelled.length,
    totalSales,
    netEarnings,
    commission,
    favoritesOnProducts: favCount,
    unreadMessages: 0,
    avgRating: Math.round(avgRating * 10) / 10,
    lowStockProducts: lowStock.length,
  };
}

// ─── Profile helpers ───

export async function getProfileData() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !profile) return null;
  return profile;
}

export async function updateProfile(updates: Record<string, any>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  return { error: error?.message || null };
}

export async function changePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { error: error?.message || null };
}

export async function resetPasswordEmail(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  return { error: error?.message || null };
}

/**
 * Get the app version from expo-constants or package.json
 */
export function getAppVersion(): string {
  try {
    const Constants = require('expo-constants').default;
    return Constants?.expoConfig?.version || Constants?.manifest?.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}