// @ts-nocheck
import { AuthUser, SendOTPOptions, SignUpResult, GoogleSignInResult } from '../types';
import { safeSupabaseOperation, getSharedSupabaseClient } from '../../core/client';
import { configManager } from '../../core/config';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

// Ensure Web platform correctly handles auth callbacks
WebBrowser.maybeCompleteAuthSession();

// Visibility change listener related variables
let lastVisibilityChange = 0;
let visibilityListener: (() => void) | null = null;

// Operation state tracking to prevent deadlock
let isUpdatingUserInOTPFlow = false;

const TIMEOUT_CONFIG = {
  AUTH_OPERATIONS: 10000,
  DATA_QUERIES: 8000,  
  SESSION_REFRESH: 5000,
  USER_UPDATE: 15000,
};

// Utility function to add timeout to any Promise with proper cleanup
const withTimeout = <T>(
  promise: Promise<T>, 
  timeoutMs: number, 
  operation: string = 'Operation'
): Promise<T> => {
  let timeoutId: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operation} timeout after ${timeoutMs/1000} seconds`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
};

const isAuthError = (error: any): boolean => {
  if (error.message?.includes('timeout')) return false;
  return error.status === 401 || 
         error.status === 403 || 
         error.message?.includes('invalid_token');
};

// Visibility monitoring logic - used to optimize auth event handling
const setupVisibilityMonitoring = () => {
  if (visibilityListener || Platform.OS !== 'web' || typeof document === 'undefined') {
    return;
  }

  visibilityListener = () => {
    lastVisibilityChange = Date.now();
  };

  document.addEventListener('visibilitychange', visibilityListener);
};

export const isVisibilityTriggeredAuthEvent = (event: string): boolean => {
  if (event !== 'SIGNED_IN') return false;

  const timeSinceVisibilityChange = Date.now() - lastVisibilityChange;
  return timeSinceVisibilityChange < 1000;
};

export const getLastVisibilityChange = (): number => lastVisibilityChange;

// Enhanced event filtering to prevent deadlock
export const shouldIgnoreAuthEvent = (event: string): boolean => {
  // Ignore USER_UPDATED events during updateUser operation to prevent deadlock
  if (event === 'USER_UPDATED' && isUpdatingUserInOTPFlow) {
    return true;
  }
  
  // Ignore visibility-triggered events
  if (isVisibilityTriggeredAuthEvent(event)) {
    return true;
  }
  
  return false;
};

export class AuthService {
  constructor() {
    // Initialize visibility monitoring
    setupVisibilityMonitoring();
  }

  private get supabase() {
    return getSharedSupabaseClient();
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    // Use Supabase session
    try {
      const client = getSharedSupabaseClient();
      const { data: { session }, error } = await client.auth.getSession();
      if (error || !session) return null;
      
      const user = session.user;
      return {
        id: user.id,
        email: user.email || '',
        app_metadata: user.app_metadata || {},
        user_metadata: user.user_metadata || {},
        aud: 'authenticated',
        created_at: user.created_at || new Date().toISOString(),
      } as AuthUser;
    } catch (e) {
      console.warn('[AuthService] getSession error:', e);
      return null;
    }
  }

  // Unified session.user mapping - used by all auth flows
  private mapSessionToAuthUser(sessionUser: any): AuthUser {
    return {
      id: sessionUser.id,
      email: sessionUser.email || '',
      username: sessionUser.user_metadata?.username || 
               sessionUser.user_metadata?.full_name || 
               sessionUser.user_metadata?.name || 
               sessionUser.email?.split('@')[0] || 
               `user_${sessionUser.id.slice(0, 8)}`,
      created_at: sessionUser.created_at,
      updated_at: sessionUser.updated_at || sessionUser.created_at,
    };
  }

  async sendOTP(email: string, options: SendOTPOptions = {}) {
    try {
      const client = getSharedSupabaseClient();
      const { error } = await client.auth.signInWithOtp({ email });
      if (error) return { error: error.message, errorType: 'business' };
      return { error: null };
    } catch (e: any) {
      return { error: e.message, errorType: 'business' };
    }
  }

  async verifyOTPAndLogin(email: string, otp: string, options?: { password?: string }) {
    try {
      const client = getSharedSupabaseClient();
      const { data, error } = await client.auth.verifyOtp({ email, token: otp, type: 'email' });
      if (error) return { error: error.message, user: null, errorType: 'business' };
      return { error: null, user: data.user };
    } catch (e: any) {
      return { error: e.message, user: null, errorType: 'business' };
    }
  }

  async signUpWithPassword(email: string, password: string, metadata: Record<string, any> = {}): Promise<SignUpResult> {
    try {
      const client = getSharedSupabaseClient();
      const { data, error } = await client.auth.signUp({ email, password, options: { data: metadata } });
      if (error) return { error: error.message, errorType: 'business' };
      return { error: null, user: data.user };
    } catch (e: any) {
      return { error: e.message, errorType: 'business' };
    }
  }

  async signInWithPassword(email: string, password: string) {
    try {
      const client = getSharedSupabaseClient();
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message, user: null, errorType: 'business' };
      return { error: null, user: data.user };
    } catch (e: any) {
      return { error: e.message, user: null, errorType: 'business' };
    }
  }

  async signOut() {
    try {
      const client = getSharedSupabaseClient();
      await client.auth.signOut();
    } catch (e) {
      console.warn('[AuthService] signOut error:', e);
    }
    return {};
  }

  async logout() {
    return this.signOut();
  }

  async refreshSession() {
    try {
      const client = getSharedSupabaseClient();
      await client.auth.refreshSession();
    } catch (e) {
      console.warn('[AuthService] refreshSession error:', e);
    }
    return;
  }

  async signInWithGoogle(): Promise<GoogleSignInResult> {
    // Supabase auth disabled — app now uses PHP API (auth_email.php)
    return { error: 'Use PHP API' };
  }

  onAuthStateChange(callback: (user: AuthUser | null) => void) {
    // Supabase auth disabled — app now uses PHP API (auth_email.php)
    // Return a no-op unsubscribe function
    return {
      unsubscribe: () => {},
    };
  }
}

export const authService = new AuthService();