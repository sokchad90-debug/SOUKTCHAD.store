import React, { useMemo, useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import ProductCard from '@/components/ProductCard';
import { borderRadius } from '@/constants/theme';
import { impactLight } from '@/services/haptics';
import { scale } from '@/constants/responsive';

export default function FavoritesScreen() {
  const router = useRouter();
  const { colors, language, isFavorite, products, productsLoading, refreshProducts, isReady } = useApp();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const favoriteProducts = useMemo(() => {
    return products.filter(p => isFavorite(p.id));
  }, [products, isFavorite]);

  const loadFavorites = useCallback(async () => {
    setLoadError(false);
    try {
      await refreshProducts();
    } catch (e) {
      setLoadError(true);
    }
  }, [refreshProducts]);

  // Initial load — ensure products are fetched from DB
  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshProducts();
      setLoadError(false);
    } catch (e) {
      setLoadError(true);
    } finally {
      setRefreshing(false);
    }
  }, [refreshProducts]);

  const onRetry = useCallback(() => {
    setLoadError(false);
    loadFavorites();
  }, [loadFavorites]);

  const isAr = language === 'ar';
  const isFr = language === 'fr';

  const label = (en: string, fr: string, ar: string) => {
    if (isAr) return ar;
    if (isFr) return fr;
    return en;
  };

  const browseProducts = useCallback(() => {
    impactLight();
    router.push('/(tabs)' as any);
  }, [router]);

  // ---- Loading indicator while data loads (blank screen fix) ----
  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header — always visible with title and count */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {label('Favorites', 'Favoris', 'المفضلة')}
        </Text>
        <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
          {favoriteProducts.length} {label('items', 'articles', 'عنصر')}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + scale(80) },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* ─── Skeleton loading ─── */}
        {productsLoading && !refreshing ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} style={{ marginBottom: scale(16) }} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              {label('Loading favorites…', 'Chargement…', 'جارٍ التحميل…')}
            </Text>
          </View>
        ) : /* ─── Error state ─── */
        loadError ? (
          <View style={styles.centerState}>
            <View style={[styles.errorIconWrap, { backgroundColor: colors.errorLight }]}>
              <MaterialIcons name="cloud-off" size={scale(40)} color={colors.error} />
            </View>
            <Text style={[styles.stateTitle, { color: colors.textPrimary }]}>
              {label('Connection Error', 'Erreur de connexion', 'خطأ في الاتصال')}
            </Text>
            <Text style={[styles.stateDesc, { color: colors.textSecondary }]}>
              {label(
                'Could not load favorites. Check your connection and try again.',
                'Impossible de charger les favoris. Vérifiez votre connexion.',
                'تعذّر تحميل المفضلات. تحقق من اتصالك وحاول مرة أخرى.'
              )}
            </Text>
            <Pressable
              onPress={onRetry}
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.88 : 1 },
              ]}
            >
              <MaterialIcons name="refresh" size={scale(18)} color="#fff" />
              <Text style={styles.actionBtnText}>
                {label('Retry', 'Réessayer', 'إعادة المحاولة')}
              </Text>
            </Pressable>
          </View>
        ) : /* ─── Empty state ─── */
        favoriteProducts.length === 0 ? (
          <View style={styles.centerState}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.primary + '15' }]}>
              <MaterialIcons name="favorite-border" size={scale(44)} color={colors.primary} />
            </View>
            <Text style={[styles.stateTitle, { color: colors.textPrimary }]}>
              {label('No Favorites Yet', 'Aucun favori', 'لا توجد مفضلات')}
            </Text>
            <Text style={[styles.stateDesc, { color: colors.textSecondary }]}>
              {label(
                'Tap the heart icon on products to save them here.',
                'Appuyez sur l\'icône cœur pour sauvegarder.',
                'اضغط على أيقونة القلب لحفظ المنتجات هنا.'
              )}
            </Text>
            <Pressable
              onPress={browseProducts}
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.88 : 1 },
              ]}
            >
              <MaterialIcons name="storefront" size={scale(18)} color="#fff" />
              <Text style={styles.actionBtnText}>
                {label('Browse Products', 'Parcourir', 'تصفح المنتجات')}
              </Text>
            </Pressable>
          </View>
        ) : (
          /* ─── Product grid ─── */
          <View style={styles.grid}>
            {favoriteProducts.map((product: any, index: number) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    paddingHorizontal: scale(16),
    paddingTop: scale(8),
    paddingBottom: scale(12),
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: scale(24),
    fontWeight: '800',
  },
  headerSub: {
    fontSize: scale(14),
    marginTop: scale(2),
  },

  scrollContent: {
    padding: scale(16),
  },

  // ─── Loading ───
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(60),
  },
  loadingText: {
    fontSize: scale(14),
    fontWeight: '500',
  },

  // ─── Centered state (empty / error) ───
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(48),
    paddingHorizontal: scale(24),
  },
  emptyIconWrap: {
    width: scale(88),
    height: scale(88),
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: scale(16),
  },
  errorIconWrap: {
    width: scale(88),
    height: scale(88),
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: scale(16),
  },
  stateTitle: {
    fontSize: scale(18),
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: scale(8),
  },
  stateDesc: {
    fontSize: scale(14),
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: scale(24),
  },

  // ─── Action button (Browse / Retry) ───
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    paddingHorizontal: scale(24),
    paddingVertical: scale(12),
    borderRadius: borderRadius.md,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: scale(14),
    fontWeight: '700',
  },

  // ─── Product grid ───
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});