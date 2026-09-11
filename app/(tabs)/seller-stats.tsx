import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, RefreshControl,
  ActivityIndicator, FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { formatPrice } from '@/constants/config';
import { borderRadius, shadows } from '@/constants/theme';
import { selection, impactLight, notifySuccess } from '@/services/haptics';
import { scale, usePhoneLayout } from '@/constants/responsive';

const CARD_GAP = scale(10);

export default function SellerStatsScreen() {
  const layoutS = usePhoneLayout();
  const CARD_GAP_S = scale(10);
  const CARD_W = Math.floor((layoutS.contentWidth - CARD_GAP) / 2);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    colors, t, language, user, isLoggedIn, orders, products, reviews,
    getReviewsForSeller, isReady, refreshProducts,
  } = useApp();

  const [refreshing, setRefreshing] = useState(false);

  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const lb = useCallback((en: string, fr: string, ar: string) => isFr ? fr : isAr ? ar : en, [isFr, isAr]);

  const userListings = useMemo(() => (products || []).filter(p => p?.sellerId === user?.id), [products, user?.id]);
  const sellerOrders = useMemo(() => (orders || []).filter(o => o?.sellerId === user?.id), [orders, user?.id]);
  const sellerReviews = useMemo(() => user?.isSeller ? getReviewsForSeller(user.id) : [], [user?.id, user?.isSeller, getReviewsForSeller]);

  const totalRevenue = useMemo(() =>
    sellerOrders.filter(o => o?.status === 'confirmed' || o?.status === 'completed').reduce((sum, o) => sum + (o?.amount || 0), 0),
    [sellerOrders]
  );
  const pendingCount = useMemo(() => sellerOrders.filter(o => o?.status === 'pending').length, [sellerOrders]);
  const confirmedCount = useMemo(() => sellerOrders.filter(o => o?.status === 'confirmed' || o?.status === 'completed').length, [sellerOrders]);
  const totalViews = useMemo(() => userListings.reduce((sum, p) => sum + (p?.views || 0), 0), [userListings]);
  const avgOrderValue = useMemo(() => sellerOrders.length > 0 ? Math.round(totalRevenue / sellerOrders.length) : 0, [totalRevenue, sellerOrders.length]);
  const uniqueBuyers = useMemo(() => new Set(sellerOrders.map(o => o?.buyerId)).size, [sellerOrders]);
  const totalStock = useMemo(() => userListings.reduce((sum, p) => sum + (p?.stock || 0), 0), [userListings]);
  const avgRating = useMemo(() => {
    if (!sellerReviews || sellerReviews.length === 0) return 0;
    const sum = sellerReviews.reduce((s, r) => s + (r?.rating || 0), 0);
    return Math.round((sum / sellerReviews.length) * 10) / 10;
  }, [sellerReviews]);

  const recentOrders = useMemo(() => sellerOrders.slice(0, 5), [sellerOrders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshProducts();
    setTimeout(() => setRefreshing(false), 600);
  }, [refreshProducts]);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'confirmed': case 'completed': return colors.success;
      case 'pending': return colors.warning;
      case 'disputed': return colors.error;
      case 'delivered': return colors.verified;
      default: return colors.textTertiary;
    }
  }, [colors]);

  const getStatusLabel = useCallback((status: string) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'pending': return lb('PENDING', 'EN ATTENTE', 'قيد الانتظar');
      case 'confirmed': return lb('CONFIRMED', 'CONFIRMÉ', 'مؤكد');
      case 'shipped': return lb('SHIPPED', 'EXPÉDIÉ', 'تم الشحن');
      case 'delivered': return lb('DELIVERED', 'LIVRÉ', 'تم التسليم');
      case 'completed': return lb('COMPLETED', 'TERMINÉ', 'مكتمل');
      case 'disputed': return lb('DISPUTED', 'LITIGE', 'نزاع');
      default: return s.toUpperCase();
    }
  }, [lb]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isLoggedIn || !user?.isSeller) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: scale(32) }}>
        <MaterialIcons name="storefront" size={scale(64)} color={colors.textTertiary} />
        <Text style={{ fontSize: scale(18), fontWeight: '700', color: colors.textPrimary, marginTop: scale(12), fontFamily: 'Cairo-Bold' }}>
          {lb('Seller Account Required', 'Compte vendeur requis', 'حساب بائع مطلوب')}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + scale(90), paddingTop: 0 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {/* ═══ Header with store info + settings gear ═══ */}
        <View style={[styles.headerWrap, { backgroundColor: colors.primary }]}>
          <View style={styles.headerContent}>
            <View style={styles.headerTopRow}>
              <View style={styles.headerAvatarWrap}>
                {user?.avatar ? (
                  <Image source={{ uri: user.avatar }} style={styles.headerAvatar} contentFit="cover" />
                ) : (
                  <View style={[styles.headerAvatar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                    <Text style={styles.headerAvatarText}>
                      {(user?.name || user?.username || 'S').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                {user?.isVerified ? (
                  <View style={styles.headerVerifiedBadge}>
                    <MaterialIcons name="verified" size={scale(12)} color="#FFF" />
                  </View>
                ) : null}
              </View>
              <View style={{ flex: 1, marginLeft: scale(12) }}>
                <Text style={styles.headerStoreName} numberOfLines={1}>
                  {user?.username || user?.name || ''}
                </Text>
                <Text style={styles.headerStoreId}>
                  {user?.numericId || user?.sellerId || ''}
                </Text>
                <View style={styles.headerRatingRow}>
                  <MaterialIcons name="star" size={scale(14)} color="#FFD700" />
                  <Text style={styles.headerRatingText}>
                    {avgRating > 0 ? avgRating.toFixed(1) : '—'} {'· ' + userListings.length + ' ' + lb('products', 'produits', 'منتج')}
                  </Text>
                </View>
              </View>
              {/* Settings Gear Icon */}
              <Pressable
                onPress={() => { selection(); router.push('/settings' as any); }}
                style={styles.headerGearBtn}
                hitSlop={12}
              >
                <MaterialIcons name="settings" size={scale(24)} color="#FFF" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* ═══ Revenue Hero Card ═══ */}
        <View style={styles.revenueCardWrap}>
          <View style={[styles.revenueCard, { backgroundColor: colors.surface, ...shadows.cardElevated }]}>
            <View style={styles.revenueIconWrap}>
              <MaterialIcons name="account-balance-wallet" size={scale(28)} color={colors.primary} />
            </View>
            <Text style={[styles.revenueLabel, { color: colors.textSecondary }]}>
              {lb('Total Revenue', 'Revenu total', 'إجمالي الإيرادات')}
            </Text>
            <Text style={[styles.revenueValue, { color: colors.primary }]}>
              {formatPrice(totalRevenue)}
            </Text>
            <View style={styles.revenueSubRow}>
              <View style={styles.revenueSubItem}>
                <MaterialIcons name="shopping-bag" size={scale(14)} color={colors.textTertiary} />
                <Text style={[styles.revenueSubText, { color: colors.textTertiary }]}>
                  {sellerOrders.length} {lb('orders', 'commandes', 'طلب')}
                </Text>
              </View>
              <View style={styles.revenueSubItem}>
                <MaterialIcons name="trending-up" size={scale(14)} color={colors.textTertiary} />
                <Text style={[styles.revenueSubText, { color: colors.textTertiary }]}>
                  {avgOrderValue > 0 ? formatPrice(avgOrderValue) : '0'} {'avg'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ═══ Stats Grid (2x2) ═══ */}
        <View style={styles.statsGrid}>
          <StatCard
            icon="pending-actions" color={colors.warning}
            label={lb('Pending', 'En attente', 'قيد الانتظar')}
            value={String(pendingCount)}
            colors={colors}
            onPress={() => router.push('/(tabs)/seller-orders' as any)}
          />
          <StatCard
            icon="check-circle" color={colors.success}
            label={lb('Confirmed', 'Confirmés', 'مؤكدة')}
            value={String(confirmedCount)}
            colors={colors}
            onPress={() => router.push('/(tabs)/seller-orders' as any)}
          />
          <StatCard
            icon="inventory-2" color={colors.verified}
            label={lb('Products', 'Produits', 'منتجات')}
            value={String(userListings.length)}
            colors={colors}
            onPress={() => router.push('/(tabs)/sell' as any)}
          />
          <StatCard
            icon="visibility" color={colors.pinned}
            label={lb('Views', 'Vues', 'مشاهدات')}
            value={String(totalViews)}
            colors={colors}
            onPress={() => router.push('/(tabs)/seller-analytics' as any)}
          />
        </View>

        {/* ═══ Quick Actions ═══ */}
        <View style={styles.sectionWrap}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            {lb('Quick Actions', 'Actions rapides', 'إجراءات سريعة')}
          </Text>
          <View style={styles.quickActionsRow}>
            <QuickActionBtn
              icon="add-circle" label={lb('Add Product', 'Ajouter produit', 'إضافة منتج')}
              color={colors.primary} colors={colors}
              onPress={() => router.push('/(tabs)/sell' as any)}
            />
            <QuickActionBtn
              icon="local-offer" label={lb('Discounts', 'Promotions', 'تخفيضات')}
              color="#EF4444" colors={colors}
              onPress={() => router.push('/(tabs)/sell' as any)}
            />
            <QuickActionBtn
              icon="analytics" label={lb('Analytics', 'Analytique', 'تحليلات')}
              color={colors.pinned} colors={colors}
              onPress={() => router.push('/(tabs)/seller-analytics' as any)}
            />
            <QuickActionBtn
              icon="store" label={lb('My Store', 'Ma boutique', 'متجري')}
              color={colors.verified} colors={colors}
              onPress={() => router.push('/seller/' + (user?.id || '') as any)}
            />
          </View>
        </View>

        {/* ═══ Recent Orders ═══ */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, flex: 1 }]}>
              {lb('Recent Orders', 'Commandes récentes', 'طلبات حديثة')}
            </Text>
            <Pressable onPress={() => router.push('/(tabs)/seller-orders' as any)} style={styles.seeAllBtn}>
              <Text style={[styles.seeAllText, { color: colors.primary }]}>
                {lb('See All', 'Voir tout', 'عرض الكل')}
              </Text>
              <MaterialIcons name={isAr ? 'chevron-left' : 'chevron-right'} size={scale(18)} color={colors.primary} />
            </Pressable>
          </View>

          {recentOrders.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MaterialIcons name="inbox" size={scale(40)} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {lb('No orders yet', 'Aucune commande', 'لا توجد طلبات')}
              </Text>
            </View>
          ) : (
            <View style={{ gap: scale(8) }}>
              {recentOrders.map((order) => {
                const product = userListings.find(p => p?.id === order?.productId);
                const pTitle = product?.title?.[language] || product?.title?.en || order?.product_title_en || '';
                return (
                  <Pressable
                    key={order?.id}
                    onPress={() => router.push('/order/' + order?.id as any)}
                    style={({ pressed }) => [styles.orderCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.9 : 1 }]}
                  >
                    <View style={styles.orderCardLeft}>
                      {product?.images?.[0] ? (
                        <Image source={{ uri: product.images[0] }} style={styles.orderThumb} contentFit="cover" />
                      ) : (
                        <View style={[styles.orderThumb, { backgroundColor: colors.backgroundSecondary, alignItems: 'center', justifyContent: 'center' }]}>
                          <MaterialIcons name="inventory" size={scale(20)} color={colors.textTertiary} />
                        </View>
                      )}
                    </View>
                    <View style={{ flex: 1, gap: scale(3) }}>
                      <Text style={[styles.orderProduct, { color: colors.textPrimary }]} numberOfLines={1}>
                        {pTitle}
                      </Text>
                      <Text style={[styles.orderAmount, { color: colors.primary }]}>
                        {formatPrice(order?.amount || 0)}
                      </Text>
                      <View style={styles.orderMetaRow}>
                        <View style={[styles.orderStatusBadge, { backgroundColor: getStatusColor(order?.status) + '18' }]}>
                          <Text style={[styles.orderStatusText, { color: getStatusColor(order?.status) }]}>
                            {getStatusLabel(order?.status)}
                          </Text>
                        </View>
                        {order?.transaction_number ? (
                          <Text style={[styles.orderRef, { color: colors.textTertiary }]} numberOfLines={1}>
                            #{order.transaction_number.slice(-8)}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <MaterialIcons name={isAr ? 'chevron-left' : 'chevron-right'} size={scale(20)} color={colors.textTertiary} />
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* ═══ Stock Summary ═══ */}
        <View style={styles.sectionWrap}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            {lb('Inventory Summary', 'Résumé du stock', 'ملخص المخزون')}
          </Text>
          <View style={[styles.stockCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.stockRow}>
              <View style={styles.stockItem}>
                <MaterialIcons name="inventory" size={scale(20)} color={colors.verified} />
                <Text style={[styles.stockValue, { color: colors.textPrimary }]}>{totalStock}</Text>
                <Text style={[styles.stockLabel, { color: colors.textTertiary }]}>
                  {lb('In Stock', 'En stock', 'في المخزون')}
                </Text>
              </View>
              <View style={[styles.stockDivider, { backgroundColor: colors.border }]} />
              <View style={styles.stockItem}>
                <MaterialIcons name="people" size={scale(20)} color={colors.pinned} />
                <Text style={[styles.stockValue, { color: colors.textPrimary }]}>{uniqueBuyers}</Text>
                <Text style={[styles.stockLabel, { color: colors.textTertiary }]}>
                  {lb('Buyers', 'Acheteurs', 'مشترون')}
                </Text>
              </View>
              <View style={[styles.stockDivider, { backgroundColor: colors.border }]} />
              <View style={styles.stockItem}>
                <MaterialIcons name="star" size={scale(20)} color="#FFD700" />
                <Text style={[styles.stockValue, { color: colors.textPrimary }]}>{avgRating}</Text>
                <Text style={[styles.stockLabel, { color: colors.textTertiary }]}>
                  {lb('Rating', 'Note', 'تقييم')}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ───

function StatCard({ icon, color, label, value, colors, onPress }: {
  icon: string; color: string; label: string; value: string; colors: any; onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [sStyles.statCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.9 : 1 }]}
    >
      <View style={[sStyles.statIconWrap, { backgroundColor: color + '15' }]}>
        <MaterialIcons name={icon as any} size={scale(22)} color={color} />
      </View>
      <Text style={[sStyles.statValue, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[sStyles.statLabel, { color: colors.textTertiary }]}>{label}</Text>
    </Pressable>
  );
}

function QuickActionBtn({ icon, label, color, colors, onPress }: {
  icon: string; label: string; color: string; colors: any; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => { impactLight(); onPress(); }}
      style={({ pressed }) => [sStyles.quickBtn, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.88 : 1 }]}
    >
      <View style={[sStyles.quickIconWrap, { backgroundColor: color + '15' }]}>
        <MaterialIcons name={icon as any} size={scale(22)} color={color} />
      </View>
      <Text style={[sStyles.quickLabel, { color: colors.textPrimary }]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerWrap: { paddingTop: scale(8), paddingBottom: scale(36), borderBottomLeftRadius: scale(28), borderBottomRightRadius: scale(28) },
  headerContent: { paddingHorizontal: scale(16) },
  headerTopRow: { flexDirection: 'row', alignItems: 'center' },
  headerAvatarWrap: { position: 'relative' },
  headerAvatar: { width: scale(52), height: scale(52), borderRadius: scale(26), borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.3)' },
  headerAvatarText: { fontSize: scale(22), fontWeight: '800', color: '#FFF', fontFamily: 'Cairo-Bold' },
  headerVerifiedBadge: { position: 'absolute', bottom: -2, right: -2, width: scale(18), height: scale(18), borderRadius: scale(9), backgroundColor: "#3B82F6", alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF' },
  headerStoreName: { fontSize: scale(18), fontWeight: '800', color: '#FFF', fontFamily: 'Cairo-Bold' },
  headerStoreId: { fontSize: scale(12), color: 'rgba(255,255,255,0.7)', marginTop: scale(2), fontFamily: 'Cairo-Regular' },
  headerRatingRow: { flexDirection: 'row', alignItems: 'center', gap: scale(4), marginTop: scale(4) },
  headerRatingText: { fontSize: scale(12), color: 'rgba(255,255,255,0.85)', fontFamily: 'Cairo-SemiBold' },
  headerGearBtn: { width: scale(40), height: scale(40), borderRadius: scale(20), backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  revenueCardWrap: { paddingHorizontal: scale(16), marginTop: scale(-24) },
  revenueCard: { borderRadius: borderRadius.xl, padding: scale(20), alignItems: 'center', gap: scale(6) },
  revenueIconWrap: { width: scale(52), height: scale(52), borderRadius: scale(26), backgroundColor: 'rgba(99,102,241,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: scale(4) },
  revenueLabel: { fontSize: scale(13), fontWeight: '500', fontFamily: 'Cairo-Regular' },
  revenueValue: { fontSize: scale(28), fontWeight: '800', fontFamily: 'Cairo-Bold' },
  revenueSubRow: { flexDirection: 'row', gap: scale(16), marginTop: scale(8) },
  revenueSubItem: { flexDirection: 'row', alignItems: 'center', gap: scale(4) },
  revenueSubText: { fontSize: scale(12), fontWeight: '500', fontFamily: 'Cairo-Regular' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: scale(16), gap: CARD_GAP, marginTop: scale(16) },
  sectionWrap: { paddingHorizontal: scale(16), marginTop: scale(20) },
  sectionTitle: { fontSize: scale(16), fontWeight: '700', marginBottom: scale(10), fontFamily: 'Cairo-Bold' },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: scale(10) },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: scale(2) },
  seeAllText: { fontSize: scale(13), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },
  quickActionsRow: { flexDirection: 'row', gap: scale(8) },
  emptyCard: { alignItems: 'center', paddingVertical: scale(32), borderRadius: borderRadius.lg, borderWidth: 0.5, gap: scale(8) },
  emptyText: { fontSize: scale(15), fontWeight: '500', fontFamily: 'Cairo-Regular' },
  orderCard: { flexDirection: 'row', alignItems: 'center', padding: scale(12), borderRadius: borderRadius.lg, borderWidth: 0.5, gap: scale(10) },
  orderCardLeft: {},
  orderThumb: { width: scale(48), height: scale(48), borderRadius: scale(10) },
  orderProduct: { fontSize: scale(14), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },
  orderAmount: { fontSize: scale(16), fontWeight: '800', fontFamily: 'Cairo-Bold' },
  orderMetaRow: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
  orderStatusBadge: { paddingHorizontal: scale(8), paddingVertical: scale(2), borderRadius: scale(6) },
  orderStatusText: { fontSize: scale(10), fontWeight: '700', fontFamily: 'Cairo-Bold' },
  orderRef: { fontSize: scale(11), fontFamily: 'Cairo-Regular' },
  stockCard: { borderRadius: borderRadius.lg, borderWidth: 0.5, padding: scale(16) },
  stockRow: { flexDirection: 'row', alignItems: 'center' },
  stockItem: { flex: 1, alignItems: 'center', gap: scale(4) },
  stockValue: { fontSize: scale(22), fontWeight: '800', fontFamily: 'Cairo-Bold' },
  stockLabel: { fontSize: scale(11), fontWeight: '500', fontFamily: 'Cairo-Regular' },
  stockDivider: { width: 1, height: scale(40) },
});

const sStyles = StyleSheet.create({
  statCard: { borderRadius: borderRadius.lg, borderWidth: 0.5, padding: scale(14), alignItems: 'center', gap: scale(6) },
  statIconWrap: { width: scale(38), height: scale(38), borderRadius: scale(19), alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: scale(22), fontWeight: '800', fontFamily: 'Cairo-Bold' },
  statLabel: { fontSize: scale(11), fontWeight: '600', fontFamily: 'Cairo-SemiBold', textAlign: 'center' },
  quickBtn: { flex: 1, borderRadius: borderRadius.lg, borderWidth: 0.5, padding: scale(12), alignItems: 'center', gap: scale(6) },
  quickIconWrap: { width: scale(40), height: scale(40), borderRadius: scale(20), alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: scale(11), fontWeight: '600', textAlign: 'center', fontFamily: 'Cairo-SemiBold' },
});