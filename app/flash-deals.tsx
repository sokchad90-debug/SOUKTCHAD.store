import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useApp } from '@/contexts/AppContext';
import { products, Product } from '@/services/mockData';
import { formatPrice } from '@/constants/config';
import ProductCard from '@/components/ProductCard';
import { scale } from '@/constants/responsive';

function formatCountdown(ms: number, language: string = 'en'): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  // Compact format like "10d 16h 24m"
  if (d > 0) {
    return `${d}d ${h}h ${m}m`;
  }
  if (h > 0) {
    return `${h}h ${m}m ${s}s`;
  }
  if (m > 0) {
    return `${m}m ${s}s`;
  }
  return `${s}s`;
}

export default function FlashDealsScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();
  const { colors, language } = useApp();
  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const lb = (en: string, fr: string, ar: string) => isFr ? fr : isAr ? ar : en;

  const [deals, setDeals] = useState<Product[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const now = Date.now();
    const active = products.filter(p => {
      if (!p.discountPercent || p.discountPercent <= 0) return false;
      if (!p.discountUntil) return false;
      return new Date(p.discountUntil).getTime() > now;
    });
    setDeals(active);
  }, []);

  // Tick every second for countdown
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const renderProduct = useCallback(({ item, index }: { item: Product; index: number }) => (
    <ProductCard product={item} index={index} />
  ), []);

  const keyExtractor = useCallback((item: Product) => item.id, []);

  // Global countdown (earliest expiring deal)
  const globalCountdown = useMemo(() => {
    if (deals.length === 0) return '0s';
    const earliest = deals.reduce((min, d) => {
      const t = new Date(d.discountUntil || '').getTime();
      return t < min ? t : min;
    }, Infinity);
    return formatCountdown(earliest - Date.now(), language);
  }, [deals, tick, language]);

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
           <MaterialIcons name="arrow-back" size={scale(22)} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerTitle}>
           <MaterialIcons name="flash-on" size={scale(18)} color="#EF4444" />
          <Text style={[styles.headerText, { color: colors.textPrimary }]}>
            {lb('Flash Deals', 'Offres Flash', 'عروض سريعة')}
          </Text>
        </View>
        <View style={styles.headerTimer}>
          <Text style={styles.headerTimerText}>{globalCountdown}</Text>
        </View>
      </View>

      {deals.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="flash-off" size={scale(48)} color={colors.textTertiary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {lb('No active flash deals', 'Aucune offre flash active', 'لا توجد عروض سريعة حاليا')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={deals}
          keyExtractor={keyExtractor}
          renderItem={renderProduct}
          numColumns={2}
          columnWrapperStyle={styles.grid}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: tabBarHeight + 16 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(12),
    paddingVertical: scale(10),
    borderBottomWidth: 1,
  },
  backBtn: { padding: scale(4) },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  headerText: {
    fontSize: scale(16),
    fontWeight: '800',
  },
  headerTimer: {
    backgroundColor: '#EF444415',
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: scale(8),
  },
  headerTimerText: {
    fontSize: scale(12),
    fontWeight: '800',
    color: '#EF4444',
  },
  grid: {
    paddingHorizontal: scale(16),
    justifyContent: 'space-between',
    paddingBottom: scale(8),
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(12),
  },
  emptyText: {
    fontSize: scale(15),
    fontWeight: '500',
  },
});