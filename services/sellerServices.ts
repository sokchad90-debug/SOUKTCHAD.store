/**
 * Seller Payment Methods & Blocked Sellers Service
 */
import { supabase } from '@/lib/supabase';

// ─── Seller Payment Methods ───

export interface SellerPaymentMethod {
  id: string;
  seller_id: string;
  method_type: string;
  account_name: string;
  account_number: string;
  is_primary: boolean;
  is_active: boolean;
  created_at: string;
}

export async function getSellerPaymentMethods(sellerId: string): Promise<SellerPaymentMethod[]> {
  const { data, error } = await supabase
    .from('seller_payment_methods')
    .select('*')
    .eq('seller_id', sellerId)
    .eq('is_active', true)
    .order('is_primary', { ascending: false });
  if (error) return [];
  return data || [];
}

export async function getMyPaymentMethods(): Promise<SellerPaymentMethod[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  return getSellerPaymentMethods(user.id);
}

export async function addPaymentMethod(method: Omit<SellerPaymentMethod, 'id' | 'created_at' | 'seller_id'>): Promise<{ success: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };
  const { error } = await supabase
    .from('seller_payment_methods')
    .insert({ ...method, seller_id: user.id });
  return { success: !error, error: error?.message };
}

export async function updatePaymentMethod(id: string, updates: Partial<SellerPaymentMethod>): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('seller_payment_methods')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  return { success: !error, error: error?.message };
}

export async function deletePaymentMethod(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('seller_payment_methods')
    .delete()
    .eq('id', id);
  return { success: !error, error: error?.message };
}

export async function setPrimaryPaymentMethod(id: string): Promise<{ success: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };
  await supabase.from('seller_payment_methods').update({ is_primary: false }).eq('seller_id', user.id);
  const { error } = await supabase.from('seller_payment_methods').update({ is_primary: true }).eq('id', id);
  return { success: !error, error: error?.message };
}

// ─── Blocked Sellers ───

export async function blockSeller(sellerId: string): Promise<{ success: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };
  const { error } = await supabase
    .from('blocked_sellers')
    .insert({ buyer_id: user.id, seller_id: sellerId });
  return { success: !error, error: error?.message };
}

export async function unblockSeller(sellerId: string): Promise<{ success: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };
  const { error } = await supabase
    .from('blocked_sellers')
    .delete()
    .eq('buyer_id', user.id)
    .eq('seller_id', sellerId);
  return { success: !error, error: error?.message };
}

export async function getBlockedSellers(): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('blocked_sellers')
    .select('seller_id')
    .eq('buyer_id', user.id);
  if (error || !data) return [];
  return data.map((d: any) => d.seller_id);
}

export async function isSellerBlocked(sellerId: string): Promise<boolean> {
  const blocked = await getBlockedSellers();
  return blocked.includes(sellerId);
}

// ─── App Settings (Feature Flags) ───

export async function getAppSetting(key: string): Promise<{ value: string; enabled: boolean } | null> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value, is_enabled')
    .eq('key', key)
    .single();
  if (error || !data) return null;
  return { value: data.value, enabled: data.is_enabled };
}

export async function getAllAppSettings(): Promise<Record<string, { value: string; enabled: boolean }>> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value, is_enabled');
  if (error || !data) return {};
  const result: Record<string, { value: string; enabled: boolean }> = {};
  data.forEach((d: any) => {
    result[d.key] = { value: d.value, enabled: d.is_enabled };
  });
  return result;
}