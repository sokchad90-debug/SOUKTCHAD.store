/**
 * Supabase Auth Service
 * Replaces the PHP auth_email.php with Supabase Auth
 */
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SignUpPayload {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  role: 'buyer' | 'seller';
  city?: string;
}

export interface AuthResult {
  success: boolean;
  user?: any;
  error?: string;
}

/** Sign up a new user with Supabase Auth + auto-create profile */
export async function signUpWithSupabase(payload: SignUpPayload): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
      options: {
        data: {
          full_name: payload.fullName,
          phone: payload.phone,
          role: payload.role,
          city: payload.city || '',
        },
      },
    });

    if (error) {
      return { success: false, error: translateAuthError(error.message) };
    }

    if (!data.user) {
      return { success: false, error: 'Failed to create user' };
    }

    // The trigger handle_new_user() auto-creates the profile row with:
    // username=full_name, email, phone, is_seller=(role=='seller')
    // If auto-confirm is on, we can also update extra fields.
    // If the trigger failed for some reason, try to insert manually.
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: data.user.id,
        username: payload.fullName,
        email: payload.email.trim().toLowerCase(),
        phone: payload.phone,
        is_seller: payload.role === 'seller',
      }, { onConflict: 'id' });

    if (profileError) {
      console.warn('[Auth] Profile upsert failed:', profileError.message);
    }

    return { success: true, user: data.user };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

/** Sign in with email + password */
export async function signInWithSupabase(email: string, password: string): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      return { success: false, error: translateAuthError(error.message) };
    }

    if (!data.user) {
      return { success: false, error: 'No user returned' };
    }

    // Fetch the profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      // Profile doesn't exist — create it now as fallback
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          email: data.user.email,
          full_name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || '',
          role: data.user.user_metadata?.role || 'buyer',
          phone: data.user.user_metadata?.phone || '',
        });
      if (insertError) {
        console.warn('[Auth] Profile creation failed:', insertError.message);
      }
    }

    return { success: true, user: data.user };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

/** Sign out and clear session */
export async function signOutFromSupabase(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('[Auth] Sign out error:', err);
  }
  // Clear the auth token so the user is actually logged out,
  // but KEEP 'sokchad_user' so saved profile data (avatar, cover, name, etc.)
  // persists and is available to refresh from the API on next login.
  await AsyncStorage.removeItem('sokchad_auth_token');
}

/** Get current session (for app startup) */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) return null;
  return data.session;
}

/** Get current user profile from profiles table */
export async function getCurrentProfile() {
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

/** Reset password via email */
export async function resetPassword(email: string): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
    if (error) {
      return { success: false, error: translateAuthError(error.message) };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

/** Upgrade buyer to seller */
export async function upgradeToSeller(storeName: string, storeDescription: string, storeLocation: string): Promise<AuthResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const { error } = await supabase
      .from('profiles')
      .update({
        role: 'seller',
        store_name: storeName,
        store_description: storeDescription,
        store_location: storeLocation,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

/** Translate Supabase auth errors to Arabic/French */
function translateAuthError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return 'بيانات الدخول غير صحيحة / Identifiants invalides';
  }
  if (lower.includes('user already registered') || lower.includes('already been registered')) {
    return 'هذا البريد مسجل مسبقاً / Cet e-mail est déjà enregistré';
  }
  if (lower.includes('email not confirmed')) {
    return 'البريد غير مؤكد / E-mail non confirmé';
  }
  if (lower.includes('password should be at least')) {
    return 'كلمة المرور قصيرة جداً / Mot de passe trop court';
  }
  if (lower.includes('unable to validate email address')) {
    return 'البريد الإلكتروني غير صالح / Adresse e-mail invalide';
  }
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return 'محاولات كثيرة، حاول لاحقاً / Trop de tentatives, réessayez plus tard';
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'خطأ في الاتصال / Erreur de connexion';
  }
  return msg;
}