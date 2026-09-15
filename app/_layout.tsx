import { useEffect, useRef } from 'react';
import { View, Appearance, AppState, Platform } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { AlertProvider, AuthProvider } from '@/template';
import { AppProvider, useApp } from '@/contexts/AppContext';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import * as NavigationBar from 'expo-navigation-bar';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Screens whose top area under the status bar is a purple (or dark-purple) header.
 *  Home tab may surface as '/', '/index' or '/(tabs)/index' depending on router depth. */
function isPurpleTopRoute(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (p === '/' || p === '/index' || p === '/(tabs)' || p === '/(tabs)/index') return true; // Home tab
  if (p.startsWith('/all-products')) return true;
  if (p.startsWith('/settings')) return true;
  return false;
}

/**
 * Single source of truth for the Android system bars.
 * - Status bar icons: LIGHT over purple/dark backgrounds, DARK over light ones
 *   (per actual region behind the bar — not the device theme alone).
 * - Navigation bar (bottom buttons): dark icons on light tab bar, light on dark.
 * - Recomputed on route change, theme change, and app resume — one owner, no conflicts.
 */
function SystemBarsManager() {
  const { isDark, colors } = useApp();
  const pathname = usePathname() || '';
  const purpleTop = isPurpleTopRoute(pathname);

  // Icon style for the status bar region actually behind the bar
  const statusStyle: 'light' | 'dark' = (purpleTop || isDark) ? 'light' : 'dark';
  const statusBg = purpleTop
    ? (pathname.startsWith('/settings') && !isDark ? '#5B48D9' : (isDark ? '#39276A' : '#4C1CEA'))
    : colors.background;

  // Bottom nav buttons legibility: dark buttons on the light tab bar, light on dark
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const navLight = !isDark; // light tab bar → dark nav buttons
    try {
      NavigationBar.setButtonStyleAsync(navLight ? 'dark' : 'light').catch(() => {});
      NavigationBar.setBackgroundColorAsync(isDark ? '#242426' : '#FFFFFF').catch(() => {});
      NavigationBar.setBorderColorAsync(isDark ? '#48484F' : '#E2E8F0').catch(() => {});
    } catch { /* older devices without the API stay system-controlled */ }
  }, [isDark]);

  // Re-assert on app resume (Android may reset bars after other apps)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        try {
          if (Platform.OS === 'android') {
            NavigationBar.setButtonStyleAsync(!isDark ? 'dark' : 'light').catch(() => {});
          }
          SystemUI.setBackgroundColorAsync(isDark ? '#242426' : '#F8FAFC').catch(() => {});
        } catch { /* noop */ }
      }
    });
    return () => sub.remove();
  }, [isDark]);

  return (
    <StatusBar
      style={statusStyle}
      backgroundColor={statusBg}
      translucent={false}
    />
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'Cairo-Regular': require('@/assets/fonts/Cairo-Regular.ttf'),
    'Cairo-Medium': require('@/assets/fonts/Cairo-Medium.ttf'),
    'Cairo-SemiBold': require('@/assets/fonts/Cairo-SemiBold.ttf'),
    'Cairo-Bold': require('@/assets/fonts/Cairo-Bold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <View style={{ flex: 1, backgroundColor: Appearance.getColorScheme() === 'dark' ? '#242426' : '#F8FAFC' }}>
      <AlertProvider>
        <AuthProvider>
          <SafeAreaProvider>
            <AppProvider>
              <SystemBarsManager />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="product/[id]" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="order/[id]" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="checkout/[id]" options={{ animation: 'slide_from_bottom' }} />
                <Stack.Screen name="conversation/[id]" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="admin/index" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="admin/dashboard" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="promoted" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="verified-stores" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="all-categories" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="seller/[id]" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="seller-payments" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="seller-settings" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="privacy-policy" options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="verification" options={{ animation: 'slide_from_right' }} />
              </Stack>
            </AppProvider>
          </SafeAreaProvider>
        </AuthProvider>
      </AlertProvider>
    </View>
  );
}
