/**
 * Sokchad Verification Service — PHP API Version
 * Connected to souktchad.shop/api backend (MySQL)
 * NO Supabase dependency
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = 'http://10.0.2.2:8080';

export interface VerificationRequest {
  id: string;
  user_id: string;
  id_front_url: string;
  id_back_url: string;
  selfie_url: string;
  receipt_url: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  user_email?: string;
  user_name?: string;
  user_phone?: string;
}

async function getToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem('sokchad_auth_token');
  } catch {
    return null;
  }
}

async function apiCall(endpoint: string, options: any = {}) {
  const token = await getToken();
  const headers: any = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  return await response.json();
}

// ─── User-facing ───

export async function submitVerificationRequest(
  userId: string,
  idFrontUri: string,
  idBackUri: string,
  selfieUri: string,
  receiptUri: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const token = await getToken();
    const formData = new FormData();
    formData.append('action', 'submit');
    formData.append('user_id', userId);
    formData.append('id_front', { uri: idFrontUri, type: 'image/jpeg', name: 'id_front.jpg' } as any);
    formData.append('id_back', { uri: idBackUri, type: 'image/jpeg', name: 'id_back.jpg' } as any);
    formData.append('selfie', { uri: selfieUri, type: 'image/jpeg', name: 'selfie.jpg' } as any);
    formData.append('receipt', { uri: receiptUri, type: 'image/jpeg', name: 'receipt.jpg' } as any);

    const response = await fetch(`${API_BASE}/api_verification.php`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await response.json();
    return { success: data.success, error: data.error };
  } catch (e: any) {
    return { success: false, error: e.message || 'Submission failed' };
  }
}

export async function getUserVerificationStatus(userId: string): Promise<VerificationRequest | null> {
  try {
    const data = await apiCall(`/api_verification.php?user_id=${userId}`);
    if (data.success && data.data) {
      return data.data as VerificationRequest;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Admin-facing ───

export async function getAllVerificationRequests(): Promise<VerificationRequest[]> {
  try {
    const data = await apiCall('/admin/api_verification.php?status=pending');
    if (data.success && data.data) {
      return data.data as VerificationRequest[];
    }
    return [];
  } catch {
    return [];
  }
}

export async function approveVerificationRequest(
  requestId: string,
  adminNotes?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const data = await apiCall(`/admin/api_verification.php?id=${requestId}`, {
      method: 'PUT',
      body: JSON.stringify({ action: 'approve', admin_notes: adminNotes || 'Approved' }),
    });
    return { success: data.success, error: data.error };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function rejectVerificationRequest(
  requestId: string,
  adminNotes?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const data = await apiCall(`/admin/api_verification.php?id=${requestId}`, {
      method: 'PUT',
      body: JSON.stringify({ action: 'reject', admin_notes: adminNotes || 'Rejected' }),
    });
    return { success: data.success, error: data.error };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}