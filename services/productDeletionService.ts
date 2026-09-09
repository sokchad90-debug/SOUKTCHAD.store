const API_BASE_URL = 'http://10.0.2.2:8080';

export async function submitDeletionRequest(productId: string, reason: string): Promise<{ success: boolean; error?: string }> {
  try {
    const token = await getAuthToken();
    const res = await fetch(`${API_BASE_URL}/api/products/delete-request.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ product_id: productId, reason }),
    });
    const data = await res.json();
    return { success: data.success, error: data.error };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getMyDeletionRequests(): Promise<any[]> {
  try {
    const token = await getAuthToken();
    const res = await fetch(`${API_BASE_URL}/api/products/delete-request.php`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const data = await res.json();
    return data.success ? (data.data || []) : [];
  } catch { return []; }
}

async function getAuthToken(): Promise<string> {
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  return (await AsyncStorage.getItem('sokchad_auth_token')) || '';
}