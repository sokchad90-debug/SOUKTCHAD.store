import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { formatPrice } from '@/constants/config';
import { shadows } from '@/constants/theme';
import { selection } from '@/services/haptics';
import { scale, usePhoneLayout } from '@/constants/responsive';
import { fetchSellerStats, StatsFromAPI } from '@/services/ordersService';

// Color palette — fixed, consistent, Enterprise SaaS
const C = {
  revenue: '#059669',
  revenueBg: '#0596690D',
  pending: '#D97706',
  pendingBg: '#D977060D',
  primary: '#6366F1',
  primaryBg: '#6366F10D',
  views: '#8B5CF6',
  viewsBg: '#8B5CF60D',
  buyers: '#0EA5E9',
  buyersBg: '#0EA5E90D',
  stock: '#F59E0B',
  stockBg: '#F59E0B0D',
  completion: '#10B981',
  completionBg: '#10B9810D',
  confirmed: '#10B981',
  pendingStatus: '#F59E0B',
  completedStatus: '#3B82F6',
  gold: '#F59E0B',
  goldBg: '#F59E0B0D',
};

export default function SellerAnalyticsScreen() {
  const layoutK = usePhoneLayout();
  const KPI_W = Math.floor((layoutK.contentWidth - scale(10)) / 2);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    colors, t, language, user, isLoggedIn, orders, products, reviews,
    getReviewsForSeller, isReady, categories: appCategories,
  } = useApp();

  const [refreshing, setRefreshing] = useState(false);
  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const lb = useCallback((en: string, fr: string, ar: string) => isFr ? fr : isAr ? ar : en, [isFr, isAr]);

  const userListings = useMemo(() => (products || []).filter(p => {
    if (!p?.sellerId || !user?.id) return false;
    return p.sellerId === user.id
      || String(p.sellerId) === String(user.numericId ?? '')
      || String(p.sellerId) === String(user.sellerId ?? '');
  }), [products, user?.id, user?.numericId, user?.sellerId]);

  const sellerOrders = useMemo(() => (orders || []).filter((o: any) => {
    if (!o?.sellerId || !user?.id) return false;
    return o.sellerId === user.id
      || String(o.sellerId) === String(user.numericId ?? '')
      || String(o.sellerId) === String(user.sellerId ?? '');
  }), [orders, user?.id, user?.numericId, user?.sellerId]);

  const [apiStats, setApiStats] = useState<StatsFromAPI | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (isLoggedIn) {
      setStatsLoading(true);
      fetchSellerStats().then(({ data, error }) => {
        if (data && !error) setApiStats(data);
        setStatsLoading(false);
      }).catch(() => setStatsLoading(false));
    }
  }, [isLoggedIn]);

  const sellerReviews = useMemo(() => user?.isSeller ? getReviewsForSeller(user.id) : [], [user?.id, user?.isSeller, getReviewsForSeller]);

  const totalRevenue = useMemo(() =>
    sellerOrders.filter(o => o?.status === 'confirmed' || o?.status === 'completed').reduce((sum, o) => sum + (o?.amount || 0), 0),
    [sellerOrders]
  );
  const totalViews = useMemo(() => userListings.reduce((sum, p) => sum + (p?.views || 0), 0), [userListings]);
  const avgOrderValue = useMemo(() => sellerOrders.length > 0 ? Math.round(totalRevenue / sellerOrders.length) : 0, [totalRevenue, sellerOrders]);
  const uniqueBuyers = useMemo(() => new Set(sellerOrders.map(o => o?.buyerId)).size, [sellerOrders]);
  const totalStock = useMemo(() => userListings.reduce((sum, p) => sum + (p?.stock || 0), 0), [userListings]);
  const confirmedOrders = useMemo(() => sellerOrders.filter(o => o?.status === 'confirmed' || o?.status === 'completed'), [sellerOrders]);
  const pendingOrders = useMemo(() => sellerOrders.filter(o => o?.status === 'pending'), [sellerOrders]);
  const completionRate = useMemo(() => {
    if (sellerOrders.length === 0) return 0;
    return Math.round((confirmedOrders.length / sellerOrders.length) * 100);
  }, [sellerOrders, confirmedOrders]);

  const avgRating = useMemo(() => {
    if (!sellerReviews || sellerReviews.length === 0) return 0;
    const sum = sellerReviews.reduce((s, r) => s + (r?.rating || 0), 0);
    return Math.round((sum / sellerReviews.length) * 10) / 10;
  }, [sellerReviews]);

  const ratingBreakdown = useMemo(() => {
    const breakdown = [0, 0, 0, 0, 0];
    sellerReviews.forEach(r => {
      const star = Math.min(5, Math.max(1, r?.rating || 0));
      breakdown[star - 1]++;
    });
    return breakdown;
  }, [sellerReviews]);

  const categoryStats = useMemo(() => {
    const catMap: Record<string, number> = {};
    userListings.forEach(p => { if (p?.categoryId) catMap[p.categoryId] = (catMap[p.categoryId] || 0) + 1; });
    return Object.entries(catMap).map(([catId, count]) => {
      const cat = appCategories.find(c => c.id === catId);
      return {
        id: catId,
        name: cat ? (cat.name[language] || cat.name.en) : catId,
        count,
        color: cat?.color || '#6366F1',
        percentage: userListings.length > 0 ? Math.round((count / userListings.length) * 100) : 0,
      };
    }).sort((a, b) => b.count - a.count);
  }, [userListings, language, appCategories]);

  const topProducts = useMemo(() => {
    return [...userListings].sort((a, b) => (b?.views || 0) - (a?.views || 0)).slice(0, 5);
  }, [userListings]);

  const revenueByStatus = useMemo(() => {
    const confirmed = sellerOrders.filter(o => o?.status === 'confirmed' || o?.status === 'completed').reduce((s, o) => s + (o?.amount || 0), 0);
    const pending = sellerOrders.filter(o => o?.status === 'pending').reduce((s, o) => s + (o?.amount || 0), 0);
    return { confirmed, pending };
  }, [sellerOrders]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

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
        <MaterialIcons name="analytics" size={scale(64)} color={colors.textSecondary} />
        <Text style={{ fontSize: scale(18), fontWeight: '700', color: colors.textPrimary, marginTop: scale(12), fontFamily: 'Cairo-Bold' }}>
          {lb('Seller Account Required', 'Compte vendeur requis', 'حساب بائع مطلوب')}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ─── Header ─── */}
      <View style={[aStyles.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[aStyles.headerTitle, { color: colors.textPrimary }]}>
            {lb('Analytics', 'Analytique', 'الإحصائيات')}
          </Text>
          <Text style={[aStyles.headerSub, { color: colors.textTertiary }]}>
            {user?.username || user?.name || ''}
          </Text>
        </View>
        <Pressable
          onPress={() => { selection(); router.push('/seller-settings' as any); }}
          style={aStyles.headerGear}
          hitSlop={12}
        >
          <MaterialIcons name="settings" size={scale(22)} color={colors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + scale(90), paddingHorizontal: scale(16), paddingTop: scale(12) }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        {/* ═══ Export Invoices ═══ */}
        <Pressable
          onPress={() => { selection(); router.push('/seller/invoices' as any); }}
          style={({ pressed }) => [aStyles.exportBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.88 : 1 }, shadows.card]}
        >
          <MaterialIcons name="receipt-long" size={scale(20)} color="#FFF" />
          <Text style={aStyles.exportBtnText}>
            {lb('Export Invoices', 'Exporter les factures', 'تصدير الفواتير')}
          </Text>
          <MaterialIcons name="chevron-right" size={scale(20)} color="#FFF" />
        </Pressable>

        {/* ═══ Revenue Hero Card ═══ */}
        <View style={[aStyles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.card]}>
          <View style={aStyles.heroTop}>
            <View style={[aStyles.heroIcon, { backgroundColor: C.revenueBg }]}>
              <MaterialIcons name="trending-up" size={scale(28)} color={C.revenue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[aStyles.heroLabel, { color: colors.textTertiary }]}>
                {lb('Confirmed Revenue', 'Revenu confirmé', 'الإيرادات المؤكدة')}
              </Text>
              <Text style={[aStyles.heroValue, { color: C.revenue }]}>
                {formatPrice(revenueByStatus.confirmed)}
              </Text>
            </View>
          </View>
          <View style={[aStyles.heroDivider, { backgroundColor: colors.border }]} />
          <View style={aStyles.heroSubRow}>
            <View style={aStyles.heroSubItem}>
              <View style={[aStyles.heroSubIcon, { backgroundColor: C.pendingBg }]}>
                <MaterialIcons name="hourglass-top" size={scale(14)} color={C.pending} />
              </View>
              <View>
                <Text style={[aStyles.heroSubLabel, { color: colors.textSecondary }]}>{lb('Pending', 'Attente', 'معلق')}</Text>
                <Text style={[aStyles.heroSubValue, { color: C.pending }]}>{formatPrice(revenueByStatus.pending)}</Text>
              </View>
            </View>
            <View style={[aStyles.heroSubDivider, { backgroundColor: colors.border }]} />
            <View style={aStyles.heroSubItem}>
              <View style={[aStyles.heroSubIcon, { backgroundColor: C.primaryBg }]}>
                <MaterialIcons name="shopping-cart" size={scale(14)} color={C.primary} />
              </View>
              <View>
                <Text style={[aStyles.heroSubLabel, { color: colors.textSecondary }]}>{lb('Avg Order', 'Panier moyen', 'متوسط الطلب')}</Text>
                <Text style={[aStyles.heroSubValue, { color: C.primary }]}>{formatPrice(avgOrderValue)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ═══ KPI Grid ═══ */}
        <View style={aStyles.kpiGrid}>
          <KPICard icon="visibility" label={lb('Total Views', 'Vues totales', 'إجمالي المشاهدات')} value={String(totalViews)} color={C.views} bg={C.viewsBg} colors={colors} />
          <KPICard icon="people" label={lb('Unique Buyers', 'Acheteurs uniques', 'مشترون فريدون')} value={String(uniqueBuyers)} color={C.buyers} bg={C.buyersBg} colors={colors} />
          <KPICard icon="inventory-2" label={lb('Total Stock', 'Stock total', 'إجمالي المخزون')} value={String(totalStock)} color={C.stock} bg={C.stockBg} colors={colors} />
          <KPICard icon="percent" label={lb('Completion Rate', 'Taux de finalisation', 'معدل الإكمال')} value={completionRate + '%'} color={C.completion} bg={C.completionBg} colors={colors} />
        </View>

        {/* ═══ Order Status ═══ */}
        <SectionTitle text={lb('ORDER STATUS', 'STATUT DES COMMANDES', 'حالة الطلبات')} color={colors.textSecondary} />
        <View style={[aStyles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.card]}>
          <StatusBar label={lb('Confirmed', 'Confirmées', 'مؤكدة')} count={confirmedOrders.length} total={sellerOrders.length} color={C.confirmed} colors={colors} />
          <View style={[aStyles.rowDivider, { backgroundColor: colors.border }]} />
          <StatusBar label={lb('Pending', 'Attente', 'منتظرة')} count={pendingOrders.length} total={sellerOrders.length} color={C.pendingStatus} colors={colors} />
          <View style={[aStyles.rowDivider, { backgroundColor: colors.border }]} />
          <StatusBar label={lb('Completed', 'Terminées', 'مكتملة')} count={sellerOrders.filter(o => o?.status === 'completed').length} total={sellerOrders.length} color={C.completedStatus} colors={colors} />
        </View>

        {/* ═══ Rating Analysis ═══ */}
        <SectionTitle text={lb('CUSTOMER RATINGS', 'ÉVALUATIONS CLIENTS', 'تقييمات العملاء')} color={colors.textSecondary} />
        <View style={[aStyles.ratingCard, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.card]}>
          <View style={aStyles.ratingTopRow}>
            <View style={aStyles.ratingScoreWrap}>
              <Text style={[aStyles.ratingScore, { color: colors.textPrimary }]}>
                {avgRating > 0 ? avgRating.toFixed(1) : '—'}
              </Text>
              <View style={aStyles.ratingStarsRow}>
                {[1, 2, 3, 4, 5].map(star => (
                  <MaterialIcons
                    key={star}
                    name={star <= Math.round(avgRating) ? 'star' : 'star-border'}
                    size={scale(16)}
                    color={star <= Math.round(avgRating) ? C.gold : colors.textTertiary}
                  />
                ))}
              </View>
              <Text style={[aStyles.ratingCount, { color: colors.textSecondary }]}>
                {sellerReviews.length} {lb('reviews', 'avis', 'تقييم')}
              </Text>
            </View>
            <View style={{ flex: 1, gap: scale(6) }}>
              {[5, 4, 3, 2, 1].map(star => {
                const count = ratingBreakdown[star - 1];
                const pct = sellerReviews.length > 0 ? (count / sellerReviews.length) * 100 : 0;
                return (
                  <View key={star} style={aStyles.ratingBarRow}>
                    <Text style={[aStyles.ratingBarStar, { color: colors.textSecondary }]}>{star}</Text>
                    <MaterialIcons name="star" size={scale(10)} color={C.gold} />
                    <View style={[aStyles.ratingBarTrack, { backgroundColor: colors.border + '40' }]}>
                      <View style={[aStyles.ratingBarFill, { width: `${pct}%` as `${number}%`, backgroundColor: C.gold }]} />
                    </View>
                    <Text style={[aStyles.ratingBarCount, { color: colors.textSecondary }]}>{count}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* ═══ Category Distribution ═══ */}
        {categoryStats.length > 0 ? (
          <>
            <SectionTitle text={lb('PRODUCT CATEGORIES', 'CATÉGORIES PRODUITS', 'فئات المنتجات')} color={colors.textSecondary} />
            <View style={[aStyles.categoryCard, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.card]}>
              {categoryStats.map((cat, idx) => (
                <View key={cat.id} style={[aStyles.categoryRow, idx < categoryStats.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: colors.border, paddingBottom: scale(12), marginBottom: scale(12) }]}>
                  <View style={[aStyles.categoryDot, { backgroundColor: cat.color }]} />
                  <Text style={[aStyles.categoryName, { color: colors.textSecondary }]} numberOfLines={1}>
                    {cat.name}
                  </Text>
                  <View style={[aStyles.categoryBar, { backgroundColor: colors.border + '40' }]}>
                    <View style={[aStyles.categoryBarFill, { width: `${cat.percentage}%` as `${number}%`, backgroundColor: cat.color }]} />
                  </View>
                  <Text style={[aStyles.categoryCount, { color: cat.color }]}>
                    {cat.count}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* ═══ Top Products ═══ */}
        {topProducts.length > 0 ? (
          <>
            <SectionTitle text={lb('TOP PRODUCTS BY VIEWS', 'PRODUITS LES PLUS VUS', 'المنتجات الأكثر مشاهدة')} color={colors.textSecondary} />
            <View style={{ gap: scale(8) }}>
              {topProducts.map((product, index) => {
                const title = product?.title?.[language] || product?.title?.en || '';
                const price = product?.price || 0;
                const views = product?.views || 0;
                const hasDiscount = (product?.discountPercent ?? 0) > 0 && product?.discountUntil && new Date(product.discountUntil).getTime() > Date.now();
                const rankColors = [C.gold, '#94A3B8', '#B45309'];
                const rankColor = rankColors[index] || C.primary;
                return (
                  <Pressable
                    key={product.id}
                    onPress={() => router.push('/product/' + product.id as any)}
                    style={({ pressed }) => [aStyles.topProductCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.92 : 1 }, shadows.card]}
                  >
                    <View style={[aStyles.rankBadge, { backgroundColor: rankColor }]}>
                      <Text style={aStyles.rankText}>{index + 1}</Text>
                    </View>
                    {product?.images?.[0] ? (
                      <Image source={{ uri: product.images[0] }} style={aStyles.topProductThumb} contentFit="cover" />
                    ) : (
                      <View style={[aStyles.topProductThumb, { backgroundColor: colors.backgroundSecondary, alignItems: 'center', justifyContent: 'center' }]}>
                        <MaterialIcons name="image" size={scale(18)} color={colors.textSecondary} />
                      </View>
                    )}
                    <View style={{ flex: 1, gap: scale(2) }}>
                      <Text style={[aStyles.topProductTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                        {title}
                      </Text>
                      <Text style={[aStyles.topProductPrice, { color: colors.primary }]}>
                        {formatPrice(hasDiscount ? Math.round(price * (1 - Math.min(30, product?.discountPercent || 0) / 100)) : price)}
                      </Text>
                    </View>
                    <View style={[aStyles.topProductViews, { backgroundColor: C.viewsBg }]}>
                      <MaterialIcons name="visibility" size={scale(12)} color={C.views} />
                      <Text style={[aStyles.topProductViewsText, { color: C.views }]}>
                        {views}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {/* ═══ Store Health ═══ */}
        <SectionTitle text={lb('STORE HEALTH', 'SANTÉ BOUTIQUE', 'صحة المتجر')} color={colors.textSecondary} />
        <View style={[aStyles.healthCard, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.card]}>
          <HealthItem icon="verified" color={C.buyers} label={lb('Verified Status', 'Statut vérifié', 'الحالة الموثقة')} status={user?.isVerified ? 'active' : 'inactive'} colors={colors} lb={lb} />
          <View style={[aStyles.rowDivider, { backgroundColor: colors.border }]} />
          <HealthItem icon="inventory-2" color={C.primary} label={lb('Products Listed', 'Produits publiés', 'منتجات منشورة')} status={userListings.length > 0 ? 'active' : 'inactive'} colors={colors} lb={lb} />
          <View style={[aStyles.rowDivider, { backgroundColor: colors.border }]} />
          <HealthItem icon="star" color={C.gold} label={lb('Customer Reviews', 'Avis clients', 'تقييمات العملاء')} status={sellerReviews.length > 0 ? 'active' : 'inactive'} colors={colors} lb={lb} />
          <View style={[aStyles.rowDivider, { backgroundColor: colors.border }]} />
          <HealthItem icon="receipt-long" color={C.revenue} label={lb('Order Activity', 'Activité commandes', 'نشاط الطلبات')} status={sellerOrders.length > 0 ? 'active' : 'inactive'} colors={colors} lb={lb} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ───
function SectionTitle({ text, color }: { text: string; color: string }) {
  return <Text style={[aStyles.sectionTitle, { color, marginTop: scale(20) }]}>{text}</Text>;
}

function KPICard({ icon, label, value, color, bg, colors }: {
  icon: string; label: string; value: string; color: string; bg: string; colors: any;
}) {
  return (
    <View style={[aStyles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.card]}>
      <View style={[aStyles.kpiIconWrap, { backgroundColor: bg }]}>
        <MaterialIcons name={icon as any} size={scale(20)} color={color} />
      </View>
      <Text style={[aStyles.kpiValue, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[aStyles.kpiLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function StatusBar({ label, count, total, color, colors }: {
  label: string; count: number; total: number; color: string; colors: any;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <View style={aStyles.statusBarRow}>
      <View style={[aStyles.statusBarDot, { backgroundColor: color }]} />
      <Text style={[aStyles.statusBarLabel, { color: colors.textSecondary }]}>{label}</Text>
      <View style={[aStyles.statusBarTrack, { backgroundColor: 'rgba(128,128,128,0.12)' }]}>
        <View style={[aStyles.statusBarFill, { width: `${pct}%` as `${number}%`, backgroundColor: color }]} />
      </View>
      <Text style={[aStyles.statusBarValue, { color }]}>{count} ({pct}%)</Text>
    </View>
  );
}

function HealthItem({ icon, color, label, status, colors, lb }: {
  icon: string; color: string; label: string; status: 'active' | 'inactive'; colors: any;
  lb: (en: string, fr: string, ar: string) => string;
}) {
  return (
    <View style={aStyles.healthRow}>
      <View style={[aStyles.healthIconWrap, { backgroundColor: color + '12' }]}>
        <MaterialIcons name={icon as any} size={scale(18)} color={color} />
      </View>
      <Text style={[aStyles.healthLabel, { color: colors.textPrimary, flex: 1 }]}>{label}</Text>
      {status === 'active' ? (
        <View style={[aStyles.healthBadge, { backgroundColor: C.completion + '12' }]}>
          <MaterialIcons name="check-circle" size={scale(14)} color={C.completion} />
          <Text style={[aStyles.healthBadgeText, { color: C.completion }]}>
            {lb('Active', 'Actif', 'نشط')}
          </Text>
        </View>
      ) : (
        <View style={[aStyles.healthBadge, { backgroundColor: colors.textTertiary + '12' }]}>
          <MaterialIcons name="radio-button-unchecked" size={scale(14)} color={colors.textSecondary} />
          <Text style={[aStyles.healthBadgeText, { color: colors.textSecondary }]}>
            {lb('Inactive', 'Inactif', 'غير نشط')}
          </Text>
        </View>
      )}
    </View>
  );
}

// Workaround removed — StatusBar now receives colors as prop

const aStyles = StyleSheet.create({
  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: scale(16), paddingVertical: scale(12), borderBottomWidth: 0.5 },
  headerTitle: { fontSize: scale(22), fontWeight: '800', fontFamily: 'Cairo-Bold' },
  headerSub: { fontSize: scale(12), fontWeight: '500', marginTop: scale(2), fontFamily: 'Cairo-Regular' },
  headerGear: { width: scale(36), height: scale(36), borderRadius: scale(18), alignItems: 'center', justifyContent: 'center' },

  // Section title
  sectionTitle: { fontSize: scale(11), fontWeight: '700', letterSpacing: 1, marginBottom: scale(10), fontFamily: 'Cairo-Bold' },

  // Hero revenue card
  heroCard: { borderRadius: scale(20), borderWidth: 0.5, padding: scale(20), gap: scale(14) },
  exportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: scale(16), paddingHorizontal: scale(16), paddingVertical: scale(14), marginBottom: scale(12), gap: scale(10) },
  exportBtnText: { flex: 1, color: '#FFF', fontSize: scale(15), fontWeight: '800', fontFamily: 'Cairo-Bold' },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: scale(14) },
  heroIcon: { width: scale(56), height: scale(56), borderRadius: scale(28), alignItems: 'center', justifyContent: 'center' },
  heroLabel: { fontSize: scale(13), fontWeight: '600', fontFamily: 'Cairo-Medium' },
  heroValue: { fontSize: scale(26), fontWeight: '800', fontFamily: 'Cairo-Bold', marginTop: scale(2) },
  heroDivider: { height: 1, flex: 1 },
  heroSubRow: { flexDirection: 'row', alignItems: 'center' },
  heroSubItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: scale(10) },
  heroSubDivider: { width: 1, height: scale(36) },
  heroSubIcon: { width: scale(32), height: scale(32), borderRadius: scale(16), alignItems: 'center', justifyContent: 'center' },
  heroSubLabel: { fontSize: scale(11), fontWeight: '600', fontFamily: 'Cairo-Medium' },
  heroSubValue: { fontSize: scale(15), fontWeight: '800', fontFamily: 'Cairo-Bold', marginTop: scale(1) },

  // KPI grid
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(10), marginTop: scale(16) },
  kpiCard: { borderRadius: scale(16), borderWidth: 0.5, padding: scale(14), gap: scale(6) },
  kpiIconWrap: { width: scale(36), height: scale(36), borderRadius: scale(18), alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: scale(22), fontWeight: '800', fontFamily: 'Cairo-Bold' },
  kpiLabel: { fontSize: scale(11), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },

  // Status card
  statusCard: { borderRadius: scale(16), borderWidth: 0.5, padding: scale(16), gap: scale(12) },
  rowDivider: { height: 1, flex: 1 },
  statusBarRow: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
  statusBarDot: { width: scale(8), height: scale(8), borderRadius: scale(4) },
  statusBarLabel: { fontSize: scale(13), fontWeight: '600', width: scale(80), fontFamily: 'Cairo-SemiBold' },
  statusBarTrack: { flex: 1, height: scale(8), borderRadius: scale(4), overflow: 'hidden' },
  statusBarFill: { height: '100%', borderRadius: 4 },
  statusBarValue: { fontSize: scale(12), fontWeight: '700', width: scale(72), textAlign: 'right', fontFamily: 'Cairo-Bold' },

  // Rating card
  ratingCard: { borderRadius: scale(16), borderWidth: 0.5, padding: scale(20) },
  ratingTopRow: { flexDirection: 'row', gap: scale(20) },
  ratingScoreWrap: { alignItems: 'center', gap: scale(4) },
  ratingScore: { fontSize: scale(40), fontWeight: '800', fontFamily: 'Cairo-Bold' },
  ratingStarsRow: { flexDirection: 'row', gap: scale(2) },
  ratingCount: { fontSize: scale(12), fontFamily: 'Cairo-Regular' },
  ratingBarRow: { flexDirection: 'row', alignItems: 'center', gap: scale(4) },
  ratingBarStar: { fontSize: scale(12), fontWeight: '700', width: scale(12), fontFamily: 'Cairo-Bold' },
  ratingBarTrack: { flex: 1, height: scale(6), borderRadius: scale(3), overflow: 'hidden' },
  ratingBarFill: { height: '100%', borderRadius: 3 },
  ratingBarCount: { fontSize: scale(11), fontWeight: '600', width: scale(20), textAlign: 'right', fontFamily: 'Cairo-SemiBold' },

  // Category card
  categoryCard: { borderRadius: scale(16), borderWidth: 0.5, padding: scale(16) },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
  categoryDot: { width: scale(10), height: scale(10), borderRadius: scale(5) },
  categoryName: { fontSize: scale(13), fontWeight: '500', width: scale(70), fontFamily: 'Cairo-Regular' },
  categoryBar: { flex: 1, height: scale(8), borderRadius: scale(4), overflow: 'hidden' },
  categoryBarFill: { height: '100%', borderRadius: 4 },
  categoryCount: { fontSize: scale(13), fontWeight: '700', width: scale(24), textAlign: 'right', fontFamily: 'Cairo-Bold' },

  // Top products
  topProductCard: { flexDirection: 'row', alignItems: 'center', padding: scale(12), borderRadius: scale(14), borderWidth: 0.5, gap: scale(10) },
  rankBadge: { width: scale(24), height: scale(24), borderRadius: scale(12), alignItems: 'center', justifyContent: 'center' },
  rankText: { color: '#FFF', fontSize: scale(12), fontWeight: '800', fontFamily: 'Cairo-Bold' },
  topProductThumb: { width: scale(44), height: scale(44), borderRadius: scale(8) },
  topProductTitle: { fontSize: scale(14), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },
  topProductPrice: { fontSize: scale(14), fontWeight: '800', fontFamily: 'Cairo-Bold' },
  topProductViews: { flexDirection: 'row', alignItems: 'center', gap: scale(3), paddingHorizontal: scale(8), paddingVertical: scale(4), borderRadius: 9999 },
  topProductViewsText: { fontSize: scale(12), fontWeight: '700', fontFamily: 'Cairo-Bold' },

  // Health card
  healthCard: { borderRadius: scale(16), borderWidth: 0.5, padding: scale(16), gap: scale(12) },
  healthRow: { flexDirection: 'row', alignItems: 'center', gap: scale(10) },
  healthIconWrap: { width: scale(34), height: scale(34), borderRadius: scale(17), alignItems: 'center', justifyContent: 'center' },
  healthLabel: { fontSize: scale(14), fontWeight: '500', fontFamily: 'Cairo-Regular' },
  healthBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(10), paddingVertical: scale(4), borderRadius: 9999, gap: scale(4) },
  healthBadgeText: { fontSize: scale(12), fontWeight: '700', fontFamily: 'Cairo-Bold' },
});
