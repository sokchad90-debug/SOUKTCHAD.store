import React from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/contexts/AppContext';
import { CANONICAL_MAX_SURFACE_WIDTH, scale } from '@/constants/responsive';
import { IS_SHORT_SCREEN } from '@/ui/responsive';

export const getStackBottomNavHeight = (bottomInset: number, fontScale = 1) => {
  const fs = Math.max(1, Math.min(fontScale || 1, 2));
  const tabBarBase = Math.round((IS_SHORT_SCREEN ? 52 : 56) * Math.max(1, 1 + (fs - 1) * 0.45));
  return bottomInset + tabBarBase;
};

type TabItem = {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  badge?: number;
  path: string;
};

export default function StackBottomNav() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const { colors, t, language, chatBadgeCount, profileBadgeCount } = useApp();
  const isAr = language === 'ar';
  const height = getStackBottomNavHeight(insets.bottom, fontScale);
  const tabs: TabItem[] = [
    { key: 'home', label: t('home'), icon: 'storefront', path: '/(tabs)' },
    { key: 'categories', label: t('categories'), icon: 'grid-view', path: '/(tabs)/categories' },
    { key: 'services', label: t('services'), icon: 'handyman', path: '/(tabs)/services-tab' },
    { key: 'messages', label: t('messages'), icon: 'chat', badge: chatBadgeCount, path: '/(tabs)/chats' },
    { key: 'profile', label: t('profile'), icon: 'person', badge: profileBadgeCount, path: '/(tabs)/profile' },
  ];

  return (
    <View
      style={[
        styles.bar,
        {
          width: Math.min(width, CANONICAL_MAX_SURFACE_WIDTH),
          height,
          paddingBottom: insets.bottom + scale(6),
          backgroundColor: colors.tabBar,
        },
        isAr && styles.rtl,
      ]}
    >
      {tabs.map((tab) => {
        const active = tab.key === 'home';
        const tint = active ? colors.pinned : colors.textSecondary;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
            onPress={() => router.navigate(tab.path as any)}
            style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.72 : 1 }]}
          >
            <View style={styles.iconWrap}>
              <MaterialIcons name={tab.icon} size={scale(26)} color={tint} />
              {(tab.badge ?? 0) > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText} numberOfLines={1}>{tab.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
              style={[styles.label, { color: tint }]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute', bottom: 0, alignSelf: 'center', zIndex: 20,
    flexDirection: 'row', paddingTop: scale(6), paddingHorizontal: scale(8),
    borderTopWidth: 0, shadowColor: '#000', shadowOffset: { width: 0, height: scale(-2) },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 0,
  },
  rtl: { flexDirection: 'row-reverse' },
  tab: { flex: 1, minHeight: scale(48), alignItems: 'center', justifyContent: 'flex-start' },
  iconWrap: { width: scale(28), height: scale(28), alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: scale(9), fontWeight: '700', textAlign: 'center', marginTop: scale(-2), maxWidth: '100%' },
  badge: {
    position: 'absolute', top: scale(-2), right: scale(-7), minWidth: scale(16), height: scale(16),
    paddingHorizontal: scale(3), borderRadius: scale(8), backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#FFF', fontSize: scale(9), fontWeight: '700', lineHeight: scale(12) },
});
