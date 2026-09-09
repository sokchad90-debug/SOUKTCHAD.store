import React from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { sellers } from '@/services/mockData';
import { borderRadius, shadows } from '@/constants/theme';
import { impactMedium } from '@/services/haptics';
import { scale, SCREEN_WIDTH } from '@/constants/responsive';

const CARD_WIDTH = (SCREEN_WIDTH - scale(48)) / 2;

export default function VerifiedStoresScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, language, isDark } = useApp();

  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const lb = (en: string, fr: string, ar: string) => isFr ? fr : isAr ? ar : en;

  const verifiedSellers = sellers.filter(s => s.isVerified);

  const renderStore = ({ item: seller }: { item: typeof sellers[0] }) => (
    <Pressable
      onPress={() => { impactMedium(); router.push(`/seller/${seller.id}` as any); }}
      style={({ pressed }) => [
        styles.storeCard,
        { backgroundColor: colors.surface, borderColor: colors.borderLight, opacity: pressed ? 0.88 : 1 },
        shadows.card,
      ]}
    >
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
        {seller.isOnline ? (
          <View style={styles.onlineRow}>
            <View style={[styles.onlineDot, { backgroundColor: colors.success }]} />
            <Text style={[styles.onlineText, { color: colors.success }]}>
              {lb('Online', 'En ligne', 'متصل')}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <MaterialIcons name={isAr ? "arrow-forward" : "arrow-back"} size={scale(24)} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {lb('Verified Stores', 'Boutiques vérifiées', 'متاجر موثقة')}
        </Text>
        <View style={styles.backBtn}>
          <MaterialIcons name="verified" size={scale(22)} color={colors.verified} />
        </View>
      </View>
      <FlatList
        data={verifiedSellers}
        keyExtractor={(item) => item.id}
        renderItem={renderStore}
        numColumns={2}
        columnWrapperStyle={styles.grid}
        contentContainerStyle={{ paddingBottom: insets.bottom + scale(16) }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="storefront" size={scale(48)} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
              {lb('No verified stores yet', 'Aucune boutique vérifiée', 'لا توجد متاجر موثقة بعد')}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: scale(16), paddingVertical: scale(12), borderBottomWidth: 1,
  },
  backBtn: { width: scale(40), height: scale(40), alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: scale(18), fontWeight: '800' },
  grid: { paddingHorizontal: scale(16), justifyContent: 'space-between' },
  storeCard: {
    width: CARD_WIDTH, borderRadius: borderRadius.lg, borderWidth: 1,
    padding: scale(16), marginBottom: scale(12), alignItems: 'center',
  },
  storeAvatarWrap: { position: 'relative', marginBottom: scale(12) },
  storeAvatar: {
    width: scale(72), height: scale(72), borderRadius: scale(36), borderWidth: 3,
  },
  storePlaceholderText: {
    color: '#FFF', fontSize: scale(28), fontWeight: '800', textAlign: 'center',
    lineHeight: 72,
  },
  storeBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: scale(24), height: scale(24), borderRadius: scale(12),
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3,
  },
  storeInfo: { alignItems: 'center', gap: scale(4), width: '100%' },
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