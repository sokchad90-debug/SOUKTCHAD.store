/**
 * Sokchad Branding Service — PHP API Version
 * Connected to souktchad.shop/api backend (MySQL)
 * NO Supabase dependency
 */

const API_BASE = 'https://souktchad.shop/api';

export interface AdBanner {
  id: string;
  title: string;
  image_url: string;
  link: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

// ─── Helper: get auth token ───
async function getToken(): Promise<string | null> {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    return await AsyncStorage.getItem('sokchad_auth_token');
  } catch {
    return null;
  }
}

// ─── Helper: API call ───
async function apiCall(endpoint: string, options: any = {}) {
  const token = await getToken();
  const headers: any = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const data = await response.json();
  return data;
}

// ─── Store Logo / App Icon ───

export async function getStoreLogo(): Promise<string> {
  try {
    const data = await apiCall('/api_branding.php');
    if (data.success && data.data) {
      return data.data.logo_url || data.data.app_icon_url || '';
    }
    return '';
  } catch {
    return '';
  }
}

export async function getAppIcon(): Promise<string> {
  try {
    const data = await apiCall('/api_settings.php');
    if (data.success && data.data?.settings?.app_icon_url) {
      return data.data.settings.app_icon_url;
    }
    return '';
  } catch {
    return '';
  }
}

export async function updateStoreLogo(imageUri: string): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const token = await getToken();
    const formData = new FormData();
    formData.append('file', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'logo.jpg',
    } as any);
    formData.append('type', 'app_icon');

    const response = await fetch(`${API_BASE.replace('/api', '/admin/api_upload.php')}`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await response.json();
    if (data.success) return { success: true, url: data.data.url };
    return { success: false, error: data.error };
  } catch (e: any) {
    return { success: false, error: e.message || 'Upload failed' };
  }
}

// ─── Ad Banners ───

export async function getAdBanners(): Promise<AdBanner[]> {
  try {
    const data = await apiCall('/api_branding.php?type=banners');
    if (data.success && data.data) {
      return data.data.filter((b: any) => b.is_active);
    }
    return [];
  } catch {
    return [];
  }
}

export async function getAllAdBanners(): Promise<AdBanner[]> {
  try {
    const data = await apiCall('/api_branding.php?type=banners');
    if (data.success && data.data) {
      return data.data;
    }
    return [];
  } catch {
    return [];
  }
}

export async function addAdBanner(title: string, imageUri: string, link?: string): Promise<{ success: boolean; banner?: AdBanner; error?: string }> {
  try {
    const data = await apiCall('/api_branding.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'add_banner', title, image_url: imageUri, link }),
    });
    if (data.success) return { success: true, banner: data.data };
    return { success: false, error: data.error };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function deleteAdBanner(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const data = await apiCall(`/api_branding.php?banner_id=${id}`, { method: 'DELETE' });
    return { success: data.success };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function toggleBannerActive(id: string, isActive: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const data = await apiCall(`/api_branding.php?banner_id=${id}`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: isActive }),
    });
    return { success: data.success };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function reorderBanners(orderedIds: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    const data = await apiCall('/api_branding.php', {
      method: 'PUT',
      body: JSON.stringify({ action: 'reorder', banner_ids: orderedIds }),
    });
    return { success: data.success };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ─── Cover Image (profile cover) ───

export async function getCoverImage(): Promise<string> {
  try {
    const data = await apiCall('/api_settings.php');
    if (data.success && data.data?.settings?.default_cover_url) {
      return data.data.settings.default_cover_url;
    }
    return '';
  } catch {
    return '';
  }
}

export async function updateCoverImage(imageUri: string): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const token = await getToken();
    const formData = new FormData();
    formData.append('file', { uri: imageUri, type: 'image/jpeg', name: 'cover.jpg' } as any);
    formData.append('type', 'banner');

    const response = await fetch(`https://souktchad.shop/admin/api_upload.php`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await response.json();
    if (data.success) {
      // Save URL to settings
      await apiCall('/api_settings.php', {
        method: 'PUT',
        body: JSON.stringify({ settings: { default_cover_url: data.data.url } }),
      });
      return { success: true, url: data.data.url };
    }
    return { success: false, error: data.error };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
// ─── More Arrow Setting (categories "more" arrow color/visibility) ───

export async function getMoreArrowSetting(): Promise<{ show: boolean; color: string }> {
  try {
    const data = await apiCall('/api_settings.php');
    if (data.success && data.data?.settings) {
      const s = data.data.settings;
      return {
        show: s.more_arrow_visible !== false && s.more_arrow_visible !== '0' && s.more_arrow_visible !== 0,
        color: s.more_arrow_color || '#EF4444',
      };
    }
    return { show: true, color: '#EF4444' };
  } catch {
    return { show: true, color: '#EF4444' };
  }
}
