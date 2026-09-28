import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, TextInput, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { borderRadius, shadows } from '@/constants/theme';
import { impactMedium } from '@/services/haptics';
import { BOTTOM_NAV_CONTENT_GAP, scale, usePhoneLayout } from '@/constants/responsive';
import StackBottomNav, { getStackBottomNavHeight } from '@/components/StackBottomNav';


export default function VerifiedStoresScreen() {
  const layoutP = usePhoneLayout();
  const CARD_WIDTH = Math.floor((layoutP.contentWidth - scale(24)) / 2);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const { colors, language, sellers } = useApp();
  const [search, setSearch] = useState('');

  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const lb = (en: string, fr: string, ar: string) => isFr ? fr : isAr ? ar : en;

  const verifiedSellers = useMemo(() => sellers.filter(s => s.isVerified), [sellers]);
  const filteredSellers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return verifiedSellers;
    return verifiedSellers.filter(seller =>
      [seller.name, seller.sellerId, seller.location].some(value => String(value ?? '').toLocaleLowerCase().includes(query))
    );
  }, [search, verifiedSellers]);
  const bottomNavHeight = getStackBottomNavHeight(insets.bottom, fontScale);

  const renderStore = ({ item: seller }: { item: typeof sellers[0] }) => (
    <Pressable
      onPress={() => { impactMedium(); router.push(`/seller/${seller.id}` as any); }}
      style={({ pressed }) => [
        styles.storeCard,
        { width: CARD_WIDTH },
        { backgroundColor: colors.surface, borderColor: colors.borderLight, opacity: pressed ? 0.88 : 1 },
        shadows.card,
      ]}
    >
      {seller.storeBg ? (
        <Image source={{ uri: seller.storeBg }} style={styles.storeCover} contentFit="cover" transition={200} />
      ) : (
        <View style={[styles.storeCover, { backgroundColor: colors.primaryLight || '#F1F0FB' }]} />
      )}
      <View style={styles.storeAvatarWrap}>
        {seller.avatar ? (
          <Image
            source={{ uri: seller.avatar }}
            style={[styles.storeAvatar, { borderColor: colors.verified }]}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.storeAvatar, { backgroundColor: colors.verified, borderColor: colors.verified }]}>
            <Text style={styles.storePlaceholderText}>
              {seller.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        {seller.isVerified ? (
          <View style={[styles.storeBadge, { backgroundColor: colors.verified, borderColor: colors.surface }]}>
            <MaterialIcons name="verified" size={scale(12)} color="#FFF" />
          </View>
        ) : null}
      </View>
      <View style={styles.storeInfo}>
        <Text style={[styles.storeName, { color: colors.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit={true} minimumFontScale={0.6} ellipsizeMode="tail">
          {seller.name}
        </Text>
        <View style={styles.storeMeta}>
          <MaterialIcons name="location-on" size={scale(12)} color={colors.primary} />
          <Text style={[styles.storeLocation, { color: colors.textSecondary }]} numberOfLines={1}>
            {seller.location}
          </Text>
        </View>
        <View style={styles.storeMeta}>
          <MaterialIcons name="star" size={scale(12)} color="#F59E0B" />
          <Text style={[styles.storeRating, { color: colors.textSecondary }]}>
            {seller.rating.toFixed(1)} • {seller.totalSales} {lb('sales', 'ventes', 'مبيعات')}
          </Text>
        </View>
        <View style={styles.onlineRow}>
          <View style={[styles.onlineDot, { backgroundColor: seller.isOnline ? colors.success : colors.textSecondary }]} />
          <Text style={[styles.onlineText, { color: seller.isOnline ? colors.success : colors.textSecondary }]}>
            {seller.isOnline ? lb('Online', 'En ligne', 'متصل') : lb('Offline', 'Hors ligne', 'غير متصل')}
          </Text>
        </View>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, isAr && { flexDirection: 'row-reverse' }, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Pressable onPress={() => router.back()} hitSlop={scale(12)} style={styles.backBtn}>
          <MaterialIcons name={isAr ? "arrow-forward" : "arrow-back"} size={scale(24)} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {lb('Verified Stores', 'Boutiques vérifiées', 'متاجر موثقة')}
        </Text>
        <View style={styles.backBtn}>
          <MaterialIcons name="verified" size={scale(22)} color={colors.verified} />
        </View>
      </View>
      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }, isAr && { flexDirection: 'row-reverse' }]}>
          <MaterialIcons name="search" size={scale(20)} color={colors.textSecondary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={lb('Search a store…', 'Rechercher une boutique…', 'ابحث عن متجر…')}
            placeholderTextColor={colors.textTertiary}
            style={[styles.searchInput, { color: colors.textPrimary, textAlign: isAr ? 'right' : 'left' }]}
          />
          {search.length > 0 ? (
            <Pressable accessibilityRole="button" accessibilityLabel={lb('Clear search', 'Effacer la recherche', 'مسح البحث')} onPress={() => setSearch('')} style={styles.clearButton}>
              <MaterialIcons name="close" size={scale(18)} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </View>
      <FlatList
        data={filteredSellers}
        keyExtractor={(item) => item.id}
        renderItem={renderStore}
        numColumns={2}
        columnWrapperStyle={[styles.grid, isAr && { flexDirection: 'row-reverse' }]}
        contentContainerStyle={{ paddingTop: scale(12), paddingBottom: bottomNavHeight + BOTTOM_NAV_CONTENT_GAP + scale(16) }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name={search.trim() ? 'search-off' : 'storefront'} size={scale(48)} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
              {search.trim() ? lb('No store found', 'Aucune boutique trouvée', 'لا يوجد متجر') : lb('No verified stores yet', 'Aucune boutique vérifiée', 'لا توجد متاجر موثقة بعد')}
            </Text>
          </View>
        }
      />
      <StackBottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: scale(16), paddingVertical: scale(12), borderBottomWidth: 1,
  },
  backBtn: { width: scale(48), height: scale(48), alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: scale(18), fontWeight: '800' },
  searchWrap: { paddingHorizontal: scale(16), paddingBottom: scale(12), borderBottomWidth: 1 },
  searchBar: { minHeight: scale(48), flexDirection: 'row', alignItems: 'center', gap: scale(8), borderWidth: 1, borderRadius: scale(24), paddingHorizontal: scale(14) },
  searchInput: { flex: 1, fontSize: scale(14), fontFamily: 'Cairo-Regular', paddingVertical: 0 },
  clearButton: { width: scale(48), height: scale(48), marginEnd: scale(-14), alignItems: 'center', justifyContent: 'center' },
  grid: { paddingHorizontal: scale(16), justifyContent: 'space-between' },
  storeCard: {
    borderRadius: borderRadius.lg, borderWidth: 1,
    marginBottom: scale(12), alignItems: 'center',
  },
  storeCover: { width: '100%', height: scale(96), borderTopLeftRadius: borderRadius.lg, borderTopRightRadius: borderRadius.lg },
  storeAvatarWrap: {
    position: 'relative', marginTop: scale(-38), marginBottom: scale(8), padding: scale(2),
    borderRadius: scale(40), backgroundColor: '#FFF',
  },
  storeAvatar: {
    width: scale(72), height: scale(72), borderRadius: scale(36), borderWidth: 3,
  },
  storePlaceholderText: {
    color: '#FFF', fontSize: scale(28), fontWeight: '800', textAlign: 'center',
    lineHeight: scale(72),
  },
  storeBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: scale(24), height: scale(24), borderRadius: scale(12),
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3,
  },
  storeInfo: { alignItems: 'center', gap: scale(4), width: '100%', paddingHorizontal: scale(10), paddingBottom: scale(14) },
  storeName: { fontSize: scale(14), fontWeight: '700', textAlign: 'center' },
  storeMeta: { flexDirection: 'row', alignItems: 'center', gap: scale(4) },
  storeLocation: { fontSize: scale(12), fontWeight: '500' },
  storeRating: { fontSize: scale(12), fontWeight: '500' },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: scale(4), marginTop: scale(2) },
  onlineDot: { width: scale(7), height: scale(7), borderRadius: scale(4) },
  onlineText: { fontSize: scale(11), fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: scale(64), gap: scale(12) },
  emptyTitle: { fontSize: scale(15), fontWeight: '600', textAlign: 'center' },
});
