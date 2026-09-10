import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { AlertProvider, AuthProvider } from '@/template';
import { AppProvider, useApp } from '@/contexts/AppContext';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Load Cairo fonts at the root level so they're available everywhere. */
function useCairoFonts() {
  return useFonts({
    'Cairo-Regular': require('@/assets/fonts/Cairo-Regular.ttf'),
    'Cairo-Medium': require('@/assets/fonts/Cairo-Medium.ttf'),
    'Cairo-SemiBold': require('@/assets/fonts/Cairo-SemiBold.ttf'),
    'Cairo-Bold': require('@/assets/fonts/Cairo-Bold.ttf'),
  });
}

/** Dynamic StatusBar that follows app theme (light/dark icons) */
function DynamicStatusBar() {
  const { isDark, colors } = useApp();
  return (
    <StatusBar
      style={isDark ? 'light' : 'dark'}
      backgroundColor={colors.background}
      translucent={false}
    />
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useCairoFonts();

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <View style={{ flex: 1 }}>
      <AlertProvider>
        <AuthProvider>
          <SafeAreaProvider>
            <AppProvider>
              <DynamicStatusBar />
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
