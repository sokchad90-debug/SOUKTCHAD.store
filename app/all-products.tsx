import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { BOTTOM_NAV_CONTENT_GAP, scale, usePhoneLayout } from '@/constants/responsive';
import ProductCard from '@/components/ProductCard';
import ConnectionStateView from '@/components/ConnectionStateView';

const PAGE_SIZE = 10;

export default function AllProductsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const layout = usePhoneLayout();
  const { colors, language, products, productsError, productsLoading, refreshProducts } = useApp();
  const isAr = language === 'ar';
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);

  const all = useMemo(() => {
    // Newest first: postedDate desc (ISO strings compare lexicographically)
    return [...(products as any[])].sort((a: any, b: any) =>
      String(b.postedDate ?? '').localeCompare(String(a.postedDate ?? ''))
    );
  }, [products]);

  const filtered = useMemo(() => {
    if (!search.trim()) return all;
    const q = search.trim().toLowerCase();
    return all.filter((p: any) =>
      (p.title?.en || p.title?.fr || '').toLowerCase().includes(q) ||
      (p.title?.fr || '').toLowerCase().includes(q) ||
      (p.title?.ar || '').includes(q)
    );
  }, [all, search]);

  const visible = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);
  const hasMore = visible.length < filtered.length;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refreshProducts(); } finally { setRefreshing(false); }
  }, [refreshProducts]);

  const renderItem = useCallback(({ item }: { item: any }) => <ProductCard product={item} />, []);
  const keyExtractor = useCallback((p: any) => String(p.id), []);

  const Footer = hasMore ? (
    <Pressable
      onPress={() => setPage((p) => p + 1)}
      style={({ pressed }) => [styles.moreBtn, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
    >
      <Text style={[styles.moreText, { color: colors.primary }]}>
        {language === 'fr' ? 'Charger plus' : language === 'ar' ? 'تحميل المزيد' : 'Load more'}
      </Text>
    </Pressable>
  ) : filtered.length > 0 ? (
    <Text style={[styles.endText, { color: colors.textTertiary }]}>
      {language === 'fr' ? 'Fin des résultats' : language === 'ar' ? 'نهاية النتائج' : 'End of results'}
    </Text>
  ) : null;

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: '#4C1CEA' }]}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Header: back + title + search (identity-consistent — purple like home) */}
      <View style={[styles.header, { width: layout.surfaceWidth }, isAr && { flexDirection: 'row-reverse' }]}>
        <Pressable hitSlop={scale(10)} onPress={() => router.back()}>
          <MaterialIcons name={isAr ? 'chevron-right' : 'chevron-left'} size={scale(28)} color="#FFF" />
        </Pressable>
        <Text style={[styles.headerTitle, isAr && { textAlign: 'right' }]}>
          {language === 'fr' ? 'Tous les produits' : language === 'ar' ? 'جميع المنتجات' : 'All Products'}
        </Text>
        <View style={{ width: scale(28) }} />
      </View>
      <View style={[styles.searchWrap, { width: layout.surfaceWidth }]}>
        <View style={[styles.searchBar, isAr && { flexDirection: 'row-reverse' }]}>
          <MaterialIcons name="search" size={scale(20)} color="#64748B" />
          <TextInput
            style={[styles.searchInput, { textAlign: isAr ? 'right' : 'left' }]}
            placeholder={isAr ? 'ابحث عن منتج…' : 'Rechercher un produit…'}
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={(t) => { setSearch(t); setPage(1); }}
          />
          {search.length > 0 ? (
            <Pressable hitSlop={scale(8)} onPress={() => { setSearch(''); setPage(1); }}>
              <MaterialIcons name="close" size={scale(18)} color="#94A3B8" />
            </Pressable>
          ) : null}
        </View>
      </View>
      <View style={{ flex: 1, width: layout.surfaceWidth, backgroundColor: colors.background }}>
            <Text style={[styles.countText, { color: colors.textPrimary, textAlign: isAr ? 'right' : 'left' }]}>
        {language === 'fr'
          ? filtered.length === 1 ? '1 produit' : `${filtered.length} produits`
          : language === 'ar'
            ? filtered.length === 1 ? 'منتج واحد' : filtered.length === 2 ? 'منتجان' : `${filtered.length} منتجًا`
            : filtered.length === 1 ? '1 product' : `${filtered.length} products`}
      </Text>
      <FlatList
        key={`all-grid-2`}
        data={visible}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={2}
        columnWrapperStyle={[styles.gridRow, { paddingHorizontal: layout.horizontalPadding }, isAr && { flexDirection: 'row-reverse' }]}
        contentContainerStyle={[styles.gridContent, { paddingBottom: insets.bottom + BOTTOM_NAV_CONTENT_GAP + layout.smallGap }]}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onEndReachedThreshold={0.4}
        onEndReached={() => { if (hasMore) setPage((p) => p + 1); }}
        ListFooterComponent={Footer}
        ListEmptyComponent={
          search.trim() ? <View style={styles.empty}><MaterialIcons name="search-off" size={scale(44)} color={colors.textTertiary} /><Text style={[styles.emptyText, { color: colors.textTertiary }]}>{language === 'fr' ? 'Aucun produit trouvé' : language === 'ar' ? 'لا توجد منتجات' : 'No products found'}</Text></View>
            : <ConnectionStateView state={productsError ? 'error' : 'empty'} onRetry={productsError ? refreshProducts : undefined} retrying={productsLoading} />
        }
      />
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, alignItems: 'center', backgroundColor: '#F8FAFC' },
  keyboard: { flex: 1, width: '100%', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: scale(48), paddingHorizontal: scale(12) },
  headerTitle: { color: '#FFFFFF', fontSize: scale(16), fontWeight: '800', fontFamily: 'Cairo-Bold' },
  searchWrap: { paddingHorizontal: scale(12), paddingBottom: scale(8) },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: scale(8), backgroundColor: '#FFFFFF', height: scale(44), borderRadius: scale(999), paddingHorizontal: scale(14) },
  searchInput: { flex: 1, fontSize: scale(14), color: '#0F172A', fontFamily: 'Cairo-Regular' },
  countText: { fontSize: scale(13), fontWeight: '700', paddingHorizontal: scale(16), marginBottom: scale(6), fontFamily: 'Cairo-Bold' },
  gridRow: { paddingHorizontal: scale(16), justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: scale(2) },
  gridContent: { paddingHorizontal: 0, paddingTop: scale(4) },
  moreBtn: { marginHorizontal: scale(16), marginVertical: scale(10), paddingVertical: scale(10), borderRadius: scale(12), borderWidth: 1, alignItems: 'center' },
  moreText: { fontSize: scale(13), fontWeight: '700', fontFamily: 'Cairo-Bold' },
  endText: { textAlign: 'center', paddingVertical: scale(12), fontSize: scale(12), fontFamily: 'Cairo-Regular' },
  empty: { alignItems: 'center', gap: scale(10), paddingTop: scale(80) },
  emptyText: { fontSize: scale(14), fontFamily: 'Cairo-Regular' },
});
