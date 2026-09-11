import React, { useCallback, useState, useEffect, useRef } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, Pressable, PressableProps, StyleSheet, ActivityIndicator, LayoutChangeEvent, useWindowDimensions } from 'react-native';
import { BottomTabBar, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useApp } from '@/contexts/AppContext';
import { CANONICAL_MAX_SURFACE_WIDTH, scale } from '@/constants/responsive';
import { IS_SHORT_SCREEN } from '@/ui/responsive';

// ─── Tab Bar Measurement ───
let _tabBarY = 0;
let _tabBarHeight = 0;
let _setters: ((y: number, h: number) => void)[] = [];

export function getMeasuredTabBarBottom() { return _tabBarY; }
export function getMeasuredTabBarHeight() { return _tabBarHeight; }

export function useTabBarLayout() {
  const [layout, setLayout] = useState(() => ({ y: _tabBarY, height: _tabBarHeight }));

  useEffect(() => {
    const update = (y: number, height: number) => setLayout({ y, height });
    _setters.push(update);
    return () => {
      _setters = _setters.filter(setter => setter !== update);
    };
  }, []);

  return layout;
}

function TabIcon({ name, color, size }: { name: any; color: string; size: number }) {
  return <MaterialIcons name={name} size={scale(26)} color={color} />;
}

function StableTabButton(props: PressableProps & { children?: React.ReactNode }) {
  return (
    <Pressable
      {...props}
      android_ripple={null}
      style={(state) => [
        typeof props.style === 'function' ? (props.style as any)(state) : props.style,
        { opacity: 1 },
      ]}
    />
  );
}

function CenterAddButton() {
  const router = useRouter();
  const { colors } = useApp();
  return (
    <Pressable
      onPress={() => { router.push('/(tabs)/sell' as any); }}
      style={({ pressed }) => [
        styles.addButton,
        { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <MaterialIcons name="add" size={scale(28)} color="#FFF" />
    </Pressable>
  );
}

function MeasuredTabBar(props: BottomTabBarProps) {
  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    _tabBarY = e.nativeEvent.layout.y;
    _tabBarHeight = e.nativeEvent.layout.height;
    _setters.forEach(s => s(_tabBarY, _tabBarHeight));
  }, []);
  return (
    <View onLayout={handleLayout}>
      <BottomTabBar {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: {
    width: scale(56), height: scale(56), borderRadius: scale(28),
    alignItems: 'center', justifyContent: 'center', marginTop: -scale(20),
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8,
  },
});

/**
 * Adaptive tab label: shrinks to fit the tab width at large OS font sizes
 * (fs200: "الملف الشخصي" stays fully visible instead of "الملف الش…").
 */
function AdaptiveTabLabel({ label, color }: { label: string; color: string }) {
  const { width } = useWindowDimensions();
  const tabW = Math.min(width, CANONICAL_MAX_SURFACE_WIDTH) / 4 - scale(8);
  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.6}
      allowFontScaling
      style={{ fontSize: scale(9), fontWeight: '700', color, textAlign: 'center' }}
    >
      {label}
    </Text>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, fontScale } = useWindowDimensions();
  // Large OS font: bar needs more room so labels (الملف الشخصي) don't clip
  const fs = Math.max(1, Math.min(fontScale || 1, 2));
  const tabBarBase = Math.round((IS_SHORT_SCREEN ? 52 : 56) * Math.max(1, 1 + (fs - 1) * 0.45));
  const tabSurfaceWidth = Math.min(windowWidth, CANONICAL_MAX_SURFACE_WIDTH);
  const { colors, t, language, user, chatBadgeCount, profileBadgeCount, isReady, authLoading, userChecked } = useApp();
  const isSeller = user?.role === 'seller' || user?.role === 'super_admin' || user?.role === 'staff' || user?.isSeller === true;
  const isAr = language === 'ar';
  const router = useRouter();
  const hasRedirected = useRef(false);

  // Seller guard: redirect seller to store-profile, away from buyer screens
  useEffect(() => {
    if (isReady && !authLoading && userChecked && isSeller && !hasRedirected.current) {
      hasRedirected.current = true;
      const timer = setTimeout(() => {
        router.replace('/(tabs)/store-profile');
      }, 100);
      return () => clearTimeout(timer);
    }
    if (!isSeller) {
      hasRedirected.current = false;
    }
  }, [isReady, authLoading, userChecked, isSeller, router]);

  if (!isReady || authLoading || !userChecked) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const HIDDEN = null;
  const VISIBLE = undefined;

  return (
    <Tabs
      key={user?.id || 'guest'}
      initialRouteName={isSeller ? 'store-profile' : 'index'}
      tabBar={(props) => <MeasuredTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarButton: (props) => <StableTabButton {...props} />,
        tabBarStyle: {
          width: tabSurfaceWidth,
          alignSelf: 'center',
          height: insets.bottom + tabBarBase,
          paddingTop: scale(6),
          paddingBottom: insets.bottom + scale(6),
          paddingHorizontal: scale(8),
          backgroundColor: colors.tabBar,
          borderTopWidth: 0,
          borderTopColor: 'transparent',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
          elevation: 0,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarIconStyle: { width: scale(28), height: scale(28), marginBottom: 0 },
        tabBarLabelStyle: { fontSize: scale(9), fontWeight: '700' as const, marginTop: -2, maxWidth: '100%' },
        tabBarBadgeStyle: { backgroundColor: '#EF4444', color: '#FFF', fontSize: scale(9), minWidth: scale(16), height: scale(16), borderRadius: scale(8), top: -2 },
      }}
    >
      {/* SELLER TABS */}
      <Tabs.Screen name="store-profile" options={{
        tabBarLabel: t('store'),
        tabBarIcon: ({ color, size }) => <TabIcon name="storefront" size={size} color={color} />,
        href: isSeller ? VISIBLE : HIDDEN,
      }} />
      <Tabs.Screen name="seller-orders" options={{
        tabBarLabel: t('orders'),
        tabBarIcon: ({ color, size }) => <TabIcon name="receipt-long" size={size} color={color} />,
        href: isSeller ? VISIBLE : HIDDEN,
      }} />
      <Tabs.Screen name="sell" options={{
        tabBarLabel: isSeller ? t('addProduct') : '',
        tabBarIcon: ({ color, size }) => <TabIcon name="add" size={size} color={color} />,
        ...(isSeller
          ? { tabBarButton: (props: any) => <CenterAddButton {...props} /> }
          : { href: HIDDEN }),
      }} />
      <Tabs.Screen name="seller-analytics" options={{
        tabBarLabel: t('analytics'),
        tabBarIcon: ({ color, size }) => <TabIcon name="analytics" size={size} color={color} />,
        href: isSeller ? VISIBLE : HIDDEN,
      }} />

      {/* HIDDEN ROUTES */}
      <Tabs.Screen name="seller-settings-tab" options={{ href: HIDDEN, headerShown: false }} />
      <Tabs.Screen name="seller-stats" options={{ href: HIDDEN, headerShown: false }} />

      {/* BUYER/PUBLIC TABS — order reverses in Arabic (RTL) so "home" sits at the right */}
      {(isAr ? [
        <Tabs.Screen key="profile" name="profile" options={{
          tabBarLabel: ({ color }) => <AdaptiveTabLabel label={t('profile')} color={color} />,
          tabBarIcon: ({ color, size }) => <TabIcon name="person" size={size} color={color} />,
          tabBarBadge: profileBadgeCount > 0 ? profileBadgeCount : undefined,
          href: isSeller ? HIDDEN : VISIBLE,
        }} />,
        <Tabs.Screen key="chats" name="chats" options={{
          tabBarLabel: ({ color }) => <AdaptiveTabLabel label={t('messages')} color={color} />,
          tabBarIcon: ({ color, size }) => <TabIcon name="chat" size={size} color={color} />,
          tabBarBadge: chatBadgeCount > 0 ? chatBadgeCount : undefined,
        }} />,
        <Tabs.Screen key="categories" name="categories" options={{
          tabBarLabel: ({ color }) => <AdaptiveTabLabel label={t('categories')} color={color} />,
          tabBarIcon: ({ color, size }) => <TabIcon name="grid-view" size={size} color={color} />,
          href: isSeller ? HIDDEN : VISIBLE,
        }} />,
        <Tabs.Screen key="index" name="index" options={{
          tabBarLabel: ({ color }) => <AdaptiveTabLabel label={t('home')} color={color} />,
          tabBarIcon: ({ color, size }) => <TabIcon name="storefront" size={size} color={color} />,
          href: isSeller ? HIDDEN : VISIBLE,
        }} />,
      ] : [
        <Tabs.Screen key="index" name="index" options={{
          tabBarLabel: ({ color }) => <AdaptiveTabLabel label={t('home')} color={color} />,
          tabBarIcon: ({ color, size }) => <TabIcon name="storefront" size={size} color={color} />,
          href: isSeller ? HIDDEN : VISIBLE,
        }} />,
        <Tabs.Screen key="categories" name="categories" options={{
          tabBarLabel: ({ color }) => <AdaptiveTabLabel label={t('categories')} color={color} />,
          tabBarIcon: ({ color, size }) => <TabIcon name="grid-view" size={size} color={color} />,
          href: isSeller ? HIDDEN : VISIBLE,
        }} />,
        <Tabs.Screen key="chats" name="chats" options={{
          tabBarLabel: ({ color }) => <AdaptiveTabLabel label={t('messages')} color={color} />,
          tabBarIcon: ({ color, size }) => <TabIcon name="chat" size={size} color={color} />,
          tabBarBadge: chatBadgeCount > 0 ? chatBadgeCount : undefined,
        }} />,
        <Tabs.Screen key="profile" name="profile" options={{
          tabBarLabel: ({ color }) => <AdaptiveTabLabel label={t('profile')} color={color} />,
          tabBarIcon: ({ color, size }) => <TabIcon name="person" size={size} color={color} />,
          tabBarBadge: profileBadgeCount > 0 ? profileBadgeCount : undefined,
          href: isSeller ? HIDDEN : VISIBLE,
        }} />,
      ])}

      {/* HIDDEN ROUTES */}
      <Tabs.Screen name="favorites" options={{ href: HIDDEN, headerShown: false }} />
      <Tabs.Screen name="settings" options={{ href: HIDDEN, headerShown: false }} />
    </Tabs>
  );
}
