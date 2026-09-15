import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { formatPrice } from '@/constants/config';
import { borderRadius, shadows } from '@/constants/theme';
import { FlatList } from 'react-native';
import { scale, usePhoneLayout } from '@/constants/responsive';
import ProductCard from '@/components/ProductCard';


export default function PromotedScreen() {
  const layoutP = usePhoneLayout();
  const CARD_WIDTH = Math.floor((layoutP.contentWidth - scale(24)) / 2);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, language, products } = useApp();
  
  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const lb = (en: string, fr: string, ar: string) => isFr ? fr : isAr ? ar : en;

  const promoted = useMemo(() => products.filter(p => p.isPinned), [products]);

  const renderItem = ({ item: product }: { item: typeof promoted[0] }) => {
    // SHARED ProductCard (same as home) — identical size/details; SPONSORISÉ badge on top
    return (
      <View style={{ width: layoutP.recentCardWidth }}>
        <View style={[styles.pinnedBadge, { backgroundColor: '#8B5CF6', position: 'absolute', top: scale(8), left: scale(8), zIndex: 10 }]}>
          <MaterialIcons name="push-pin" size={scale(10)} color="#FFF" />
          <Text style={styles.pinnedBadgeText}>SPONSORISÉ</Text>
        </View>
        <ProductCard product={product} />
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <MaterialIcons name={isAr ? "arrow-forward" : "arrow-back"} size={scale(24)} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {lb('Promoted Products', 'Produits sponsorisés', 'منتجات مروّجة')}
        </Text>
        <View style={{ width: scale(24) }} />
      </View>

      {promoted.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="campaign" size={scale(56)} color={colors.textTertiary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {lb('No promoted products', 'Aucun produit sponsorisé', 'لا توجد منتجات مميزة')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={promoted}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={{ padding: scale(16), paddingBottom: insets.bottom + scale(16) }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: scale(16), paddingVertical: scale(14), borderBottomWidth: 1,
  },
  headerTitle: { fontSize: scale(18), fontWeight: '700' },
  row: { justifyContent: 'space-between', marginBottom: scale(12) },
  card: {
    borderRadius: borderRadius.md, borderWidth: 1, overflow: 'hidden',
  },
  cardImage: { width: '100%' },
  pinnedBadge: {
    position: 'absolute', top: scale(8), left: scale(8), flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: scale(8), paddingVertical: scale(4), borderRadius: scale(6), gap: scale(4),
  },
  pinnedBadgeText: { color: '#FFF', fontSize: scale(9), fontWeight: '700' },
  cardInfo: { padding: scale(10), gap: scale(2) },
  cardPrice: { fontSize: scale(15), fontWeight: '700' },
  cardTitle: { fontSize: scale(13), fontWeight: '500', lineHeight: 18 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: scale(3), marginTop: scale(4) },
  cardLocation: { fontSize: scale(11) },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: scale(12) },
  emptyText: { fontSize: scale(16), fontWeight: '500' },
});
