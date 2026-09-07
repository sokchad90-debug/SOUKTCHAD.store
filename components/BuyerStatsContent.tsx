import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, TextInput, Modal, StyleSheet, Animated, Easing, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { scale } from '@/constants/responsive';

interface BuyerStatsContentProps {
  buyerCompletedOrders: any[];
  buyerOrders: any[];
  colors: any;
  lb: (en: string, fr: string, ar: string) => string;
  isAr: boolean;
  isFr: boolean;
  statsPeriod: 'all' | '30d' | '7d' | 'custom';
  setStatsPeriod: (p: 'all' | '30d' | '7d' | 'custom') => void;
  customDateFrom: string;
  setCustomDateFrom: (s: string) => void;
  customDateTo: string;
  setCustomDateTo: (s: string) => void;
  sellersInteracted: any[];
  formatPrice: (n: number) => string;
  router: any;
  styles: any;
}

export function BuyerStatsContent(props: BuyerStatsContentProps) {
  const {
    buyerCompletedOrders, buyerOrders, colors, lb, isAr, isFr,
    statsPeriod, setStatsPeriod,
    customDateFrom, setCustomDateFrom,
    customDateTo, setCustomDateTo,
    sellersInteracted, formatPrice, router, styles,
  } = props;

  const [dateModalOpen, setDateModalOpen] = useState<'from' | 'to' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Fade-in animation for the whole section — only once on mount
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 250, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
    ]).start();
  }, []);

  // Stable computed values — use refs to prevent re-zeroing on re-render
  const lastGoodData = useRef<{ total: number; completed: number; pending: number; cancelled: number; sellers: number; rate: number; totalSpent: number } | null>(null);

  // Filter orders by selected period
  const filteredOrders = useMemo(() => {
    if (statsPeriod === 'all') return buyerOrders;
    if (statsPeriod === '30d' || statsPeriod === '7d') {
      const days = statsPeriod === '30d' ? 30 : 7;
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      return buyerOrders.filter((o: any) => {
        if (!o?.createdAt) return false;
        return new Date(o.createdAt).getTime() >= cutoff;
      });
    }
    if (statsPeriod === 'custom') {
      const fromTs = customDateFrom ? new Date(customDateFrom).getTime() : -Infinity;
      const toTs = customDateTo ? new Date(customDateTo).getTime() + 24 * 60 * 60 * 1000 : Infinity;
      return buyerOrders.filter((o: any) => {
        if (!o?.createdAt) return false;
        const d = new Date(o.createdAt).getTime();
        return d >= fromTs && d <= toTs;
      });
    }
    return buyerOrders;
  }, [buyerOrders, statsPeriod, customDateFrom, customDateTo]);

  // Compute all stats from filteredOrders — integer only, no decimals
  const stats = useMemo(() => {
    const completed = Math.round(filteredOrders.filter((o: any) => o?.status === 'completed').length);
    const total = Math.round(filteredOrders.length);
    const pending = Math.round(filteredOrders.filter((o: any) => o?.status === 'pending' || o?.status === 'confirmed' || o?.status === 'shipped').length);
    const cancelled = Math.round(filteredOrders.filter((o: any) => o?.status === 'cancelled' || o?.status === 'disputed').length);
    // Success rate: completed / (completed + cancelled) only — no pending
    const finalCount = completed + cancelled;
    const rate = finalCount > 0 ? Math.min(100, Math.max(0, Math.round((completed / finalCount) * 100))) : 0;
    // Unique sellers from ALL orders (not just completed)
    const sellers = Math.round(new Set(filteredOrders.map((o: any) => o?.sellerId).filter(Boolean)).size);
    // Total purchases: completed orders only
    const totalSpent = filteredOrders
      .filter((o: any) => o?.status === 'completed')
      .reduce((sum: number, o: any) => sum + Math.round(o?.amount || 0), 0);

    const result = { total, completed, pending, cancelled, sellers, rate, totalSpent };
    // Save last good data
    if (total > 0 || buyerOrders.length === 0) {
      lastGoodData.current = result;
    }
    return result;
  }, [filteredOrders, buyerOrders.length]);

  // Simulate loading state on mount and period change
  useEffect(() => {
    setLoading(true);
    setError(false);
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, [statsPeriod, customDateFrom, customDateTo]);

  // Display data: use last good data if current is loading
  const displayStats = loading && lastGoodData.current ? lastGoodData.current : stats;
  const hasData = displayStats.total > 0;

  // Animated number values — only animate on data change, not on re-render
  const animTotal = useRef(new Animated.Value(0)).current;
  const animCompleted = useRef(new Animated.Value(0)).current;
  const animPending = useRef(new Animated.Value(0)).current;
  const animCancelled = useRef(new Animated.Value(0)).current;
  const animSellers = useRef(new Animated.Value(0)).current;
  const animRate = useRef(new Animated.Value(0)).current;
  const lastAnimatedValues = useRef({ total: -1, completed: -1, pending: -1, cancelled: -1, sellers: -1, rate: -1 });

  useEffect(() => {
    if (loading) return;
    // Only animate if values actually changed
    const targets = [
      { anim: animTotal, val: displayStats.total, key: 'total' },
      { anim: animCompleted, val: displayStats.completed, key: 'completed' },
      { anim: animPending, val: displayStats.pending, key: 'pending' },
      { anim: animCancelled, val: displayStats.cancelled, key: 'cancelled' },
      { anim: animSellers, val: displayStats.sellers, key: 'sellers' },
      { anim: animRate, val: displayStats.rate, key: 'rate' },
    ];
    targets.forEach(({ anim, val, key }) => {
      if (lastAnimatedValues.current[key as keyof typeof lastAnimatedValues.current] !== val) {
        lastAnimatedValues.current[key as keyof typeof lastAnimatedValues.current] = val;
        // Stop previous animation and start new one
        anim.stopAnimation();
        Animated.timing(anim, { toValue: val, duration: 500, useNativeDriver: false, easing: Easing.out(Easing.ease) }).start();
      }
    });
  }, [loading, displayStats]);

  const periodOptions: Array<{ key: 'all' | '30d' | '7d' | 'custom'; label: string }> = [
    { key: 'all', label: lb('All', 'Tout', 'الكل') },
    { key: '30d', label: lb('30 days', '30 jours', '30 يوم') },
    { key: '7d', label: lb('7 days', '7 jours', '7 يوم') },
    { key: 'custom', label: lb('Custom', 'Personnalisé', 'مخصص') },
  ];

  const noDataMsg = lb('Not enough data for this period', 'Pas assez de données pour cette période', 'لا توجد بيانات كافية لهذه الفترة');
  const retryText = lb('Retry', 'Réessayer', 'إعادة المحاولة');
  const errorText = lb('Failed to load data', 'Échec du chargement', 'فشل تحميل البيانات');

  const renderStatCard = (
    icon: string, iconColor: string, bg: string, border: string,
    animValue: Animated.Value, isPercentage: boolean, label: string, valueColor: string,
  ) => (
    <View style={bsStyles.statCard}>
      <View style={[bsStyles.statCardInner, { backgroundColor: bg, borderColor: border }]}>
        <MaterialIcons name={icon as any} size={scale(18)} color={iconColor} />
        {loading ? (
          <View style={bsStyles.skeleton} />
        ) : (
          <Animated.Text style={{ fontSize: scale(22), fontWeight: '700', color: valueColor, fontFamily: 'Cairo-Bold' }}>
            {isPercentage
              ? animValue.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'], extrapolate: 'clamp' })
              : animValue.interpolate({ inputRange: [0, 9999], outputRange: ['0', '9999'], extrapolate: 'clamp' })}
          </Animated.Text>
        )}
        <Text style={bsStyles.statLabel} numberOfLines={2}>{label}</Text>
      </View>
    </View>
  );

  return (
    <Animated.View style={[styles.statsContent, { paddingBottom: scale(16), opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
      {/* Stats Card */}
      <View style={[styles.verifyProgressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* Header with period selector */}
        <View style={styles.verifyProgressHeader}>
          <MaterialIcons name="bar-chart" size={scale(18)} color={colors.primary} />
          <Text style={[styles.verifyProgressTitle, { color: colors.textPrimary, flex: 1, fontFamily: 'Cairo-SemiBold' }]}>
            {lb('Buyer Statistics', 'Statistiques de l\'acheteur', 'إحصائيات المشتري')}
          </Text>
        </View>

        {/* 4-option period selector */}
        <View style={bsStyles.periodRow}>
          {periodOptions.map(opt => (
            <Pressable key={opt.key} onPress={() => setStatsPeriod(opt.key)}
              style={[bsStyles.periodBtn, statsPeriod === opt.key && { backgroundColor: colors.primary + '15' }]}>
              <Text style={[bsStyles.periodText, { color: statsPeriod === opt.key ? colors.primary : colors.textTertiary }]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Custom date range picker — only for custom period */}
        {statsPeriod === 'custom' ? (
          <View style={bsStyles.dateRow}>
            <Pressable onPress={() => setDateModalOpen('from')}
              style={[bsStyles.dateField, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
              <MaterialIcons name="event" size={scale(14)} color={colors.primary} />
              <Text style={[bsStyles.dateText, { color: customDateFrom ? colors.textPrimary : colors.textTertiary }]}>
                {customDateFrom || lb('From date', 'Date début', 'من تاريخ')}
              </Text>
            </Pressable>
            <Text style={{ fontSize: scale(11), color: colors.textTertiary, fontFamily: 'Cairo-Regular' }}>—</Text>
            <Pressable onPress={() => setDateModalOpen('to')}
              style={[bsStyles.dateField, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
              <MaterialIcons name="event" size={scale(14)} color={colors.primary} />
              <Text style={[bsStyles.dateText, { color: customDateTo ? colors.textPrimary : colors.textTertiary }]}>
                {customDateTo || lb('To date', 'Date fin', 'إلى تاريخ')}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Error state with retry — keeps last good data */}
        {error && !hasData ? (
          <View style={bsStyles.errorBox}>
            <MaterialIcons name="cloud-off" size={scale(32)} color={colors.textTertiary} />
            <Text style={[bsStyles.errorText, { color: colors.textTertiary }]}>{errorText}</Text>
            <Pressable onPress={() => { setError(false); setLoading(true); setTimeout(() => setLoading(false), 300); }}
              style={[bsStyles.retryBtn, { borderColor: colors.primary }]}>
              <Text style={{ color: colors.primary, fontSize: scale(12), fontWeight: '600', fontFamily: 'Cairo-SemiBold' }}>{retryText}</Text>
            </Pressable>
          </View>
        ) : null}

        {/* 2x3 grid of stat cards — full width */}
        {!error && hasData ? (
          <View style={bsStyles.grid}>
            {/* Row 1 */}
            <View style={bsStyles.gridRow}>
              {renderStatCard('receipt-long', colors.primary, colors.primaryLight + '20', colors.primary + '30',
                animTotal, false, lb('Total Orders', 'Commandes totales', 'إجمالي الطلبات'), colors.primary)}
              {renderStatCard('check-circle', colors.success, colors.successLight, colors.success + '30',
                animCompleted, false, lb('Completed', 'Achats terminés', 'مكتملة'), colors.success)}
            </View>
            {/* Row 2 */}
            <View style={bsStyles.gridRow}>
              {renderStatCard('pending', colors.warning, colors.warning + '12', colors.warning + '30',
                animPending, false, lb('In Progress', 'En cours', 'قيد التنفيذ'), colors.warning)}
              {renderStatCard('cancel', colors.error, colors.error + '10', colors.error + '30',
                animCancelled, false, lb('Cancelled', 'Annulées', 'ملغاة'), colors.error)}
            </View>
            {/* Row 3 */}
            <View style={bsStyles.gridRow}>
              {renderStatCard('store', colors.accent, colors.accent + '14', colors.accent + '30',
                animSellers, false, lb('Sellers', 'Vendeurs différents', 'بائعون مختلفون'), colors.accent)}
              {renderStatCard('percent', colors.verified || colors.primary, (colors.verified || colors.primary) + '14', (colors.verified || colors.primary) + '30',
                animRate, true, lb('Success Rate', 'Taux de réussite', 'معدل النجاح'), colors.verified || colors.primary)}
            </View>
          </View>
        ) : null}

        {/* No data message — real zeros, not temporary */}
        {!error && !hasData && !loading ? (
          <View style={bsStyles.noDataBox}>
            <MaterialIcons name="bar-chart" size={scale(32)} color={colors.textTertiary} />
            <Text style={[bsStyles.noDataText, { color: colors.textTertiary }]}>{noDataMsg}</Text>
          </View>
        ) : null}

        {/* Loading skeleton */}
        {loading && !hasData ? (
          <View style={bsStyles.grid}>
            {[0, 1, 2].map(i => (
              <View key={i} style={bsStyles.gridRow}>
                <View style={bsStyles.statCard}>
                  <View style={[bsStyles.statCardInner, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                    <View style={bsStyles.skeleton} />
                    <View style={[bsStyles.skeleton, { width: scale(40) }]} />
                    <View style={[bsStyles.skeleton, { width: scale(60), height: scale(8) }]} />
                  </View>
                </View>
                <View style={bsStyles.statCard}>
                  <View style={[bsStyles.statCardInner, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                    <View style={bsStyles.skeleton} />
                    <View style={[bsStyles.skeleton, { width: scale(40) }]} />
                    <View style={[bsStyles.skeleton, { width: scale(60), height: scale(8) }]} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* Total purchases — full width bar at bottom. Only completed orders. No FCFA duplication. */}
        {!error && hasData ? (
          <View style={[bsStyles.totalBar, { borderTopColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(6), flexShrink: 1 }}>
              <MaterialIcons name="payments" size={scale(16)} color={colors.primary} />
              <Text style={[bsStyles.totalLabel, { color: colors.textSecondary }]}>
                {lb('Total Purchases', 'Total des achats', 'إجمالي المشتريات')}
              </Text>
            </View>
            {/* formatPrice already includes the currency formatting, so we don't add FCFA again */}
            <Text style={[bsStyles.totalValue, { color: colors.primary }]}>
              {formatPrice(Math.round(displayStats.totalSpent))}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Sellers interacted list */}
      {sellersInteracted.length > 0 ? (
        <View style={[styles.categoryBreakdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.categoryBreakdownTitle, { color: colors.textPrimary, fontFamily: 'Cairo-SemiBold' }]}>{lb('Sellers You Bought From', 'Vendeurs contactés', 'البائعون الذين تعاملت معهم')}</Text>
          {sellersInteracted.map((si: any) => (
            <Pressable key={si.id} onPress={() => router.push(`/seller/${si.id}`)} style={styles.sellerInteractRow}>
              {si.avatar ? (
                <View style={styles.sellerInteractAvatarWrap}>
                  <Image source={{ uri: si.avatar }} style={styles.sellerInteractAvatar} contentFit="cover" />
                </View>
              ) : (
                <View style={[styles.sellerInteractAvatarPlaceholder, { backgroundColor: colors.primaryLight }]}><MaterialIcons name="store" size={scale(16)} color={colors.primary} /></View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.categoryStatName, { color: colors.textPrimary, fontFamily: 'Cairo-Regular' }]}>{si.name}</Text>
                <Text style={{ fontSize: scale(11), color: colors.textTertiary, fontFamily: 'Cairo-Regular' }}>
                  {Math.round(si.count)} {lb('completed orders', 'commandes terminées', 'طلبات مكتملة')} · {formatPrice(Math.round(si.totalSpent))}
                </Text>
              </View>
              <MaterialIcons name={isAr ? 'chevron-left' : 'chevron-right'} size={scale(16)} color={colors.textTertiary} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Date input modal */}
      <Modal visible={dateModalOpen !== null} transparent animationType="fade" onRequestClose={() => setDateModalOpen(null)}>
        <View style={bsStyles.modalOverlay}>
          <View style={[bsStyles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[bsStyles.modalTitle, { color: colors.textPrimary }]}>
              {dateModalOpen === 'from' ? lb('From Date', 'Date de début', 'تاريخ البداية') : lb('To Date', 'Date de fin', 'تاريخ النهاية')}
            </Text>
            <Text style={[bsStyles.modalHint, { color: colors.textTertiary }]}>
              {lb('Format: YYYY-MM-DD', 'Format: AAAA-MM-JJ', 'التنسيق: سنة-شهر-يوم')}
            </Text>
            <TextInput
              value={dateModalOpen === 'from' ? customDateFrom : customDateTo}
              onChangeText={dateModalOpen === 'from' ? setCustomDateFrom : setCustomDateTo}
              placeholder="2025-01-01" placeholderTextColor={colors.textTertiary}
              style={[bsStyles.dateInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
              keyboardType="default" autoFocus
            />
            <View style={{ flexDirection: 'row', gap: scale(8), marginTop: scale(12) }}>
              <Pressable onPress={() => { if (dateModalOpen === 'from') setCustomDateFrom(''); else setCustomDateTo(''); setDateModalOpen(null); }}
                style={[bsStyles.modalBtn, { borderColor: colors.border, borderWidth: 1 }]}>
                <Text style={{ color: colors.textSecondary, fontSize: scale(13), fontWeight: '600', fontFamily: 'Cairo-SemiBold' }}>{lb('Clear', 'Effacer', 'مسح')}</Text>
              </Pressable>
              <Pressable onPress={() => setDateModalOpen(null)} style={[bsStyles.modalBtn, { backgroundColor: colors.primary }]}>
                <Text style={{ color: '#FFF', fontSize: scale(13), fontWeight: '700', fontFamily: 'Cairo-Bold' }}>{lb('Done', 'Terminé', 'تم')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
}

const bsStyles = StyleSheet.create({
  periodRow: { flexDirection: 'row', gap: scale(4), flexWrap: 'wrap', marginTop: scale(4) },
  periodBtn: { paddingHorizontal: scale(10), paddingVertical: scale(5), borderRadius: scale(8) },
  periodText: { fontSize: scale(11), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },

  dateRow: { flexDirection: 'row', gap: scale(8), marginTop: scale(8), alignItems: 'center' },
  dateField: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: scale(6), paddingHorizontal: scale(10), paddingVertical: scale(8), borderRadius: scale(10), borderWidth: 0.5 },
  dateText: { fontSize: scale(11), fontFamily: 'Cairo-Regular' },

  grid: { gap: scale(10), marginTop: scale(12) },
  gridRow: { flexDirection: 'row', gap: scale(10) },
  statCard: { flex: 1 },
  statCardInner: { borderRadius: scale(12), borderWidth: 0.5, padding: scale(10), alignItems: 'center', justifyContent: 'center', gap: scale(4), minHeight: scale(80) },
  statLabel: { fontSize: scale(11), color: '#888', textAlign: 'center', fontFamily: 'Cairo-Regular', flexShrink: 1 },

  // Skeleton for loading
  skeleton: { width: scale(30), height: scale(22), borderRadius: scale(4), backgroundColor: 'rgba(150,150,150,0.15)' },

  // No data
  noDataBox: { alignItems: 'center', paddingVertical: scale(24), gap: scale(8) },
  noDataText: { fontSize: scale(13), textAlign: 'center', fontFamily: 'Cairo-Regular' },

  // Error
  errorBox: { alignItems: 'center', paddingVertical: scale(24), gap: scale(8) },
  errorText: { fontSize: scale(13), textAlign: 'center', fontFamily: 'Cairo-Regular' },
  retryBtn: { paddingHorizontal: scale(16), paddingVertical: scale(8), borderRadius: scale(10), borderWidth: 1, marginTop: scale(4) },

  // Total purchases bar
  totalBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: scale(12), paddingTop: scale(12), borderTopWidth: 0.5, gap: scale(8) },
  totalLabel: { fontSize: scale(12), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },
  totalValue: { fontSize: scale(16), fontWeight: '800', fontFamily: 'Cairo-Bold' },

  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: scale(24) },
  modalCard: { width: '100%', maxWidth: scale(320), borderRadius: scale(16), padding: scale(20), borderWidth: 0.5, gap: scale(8) },
  modalTitle: { fontSize: scale(16), fontWeight: '700', fontFamily: 'Cairo-Bold' },
  modalHint: { fontSize: scale(11), fontFamily: 'Cairo-Regular' },
  dateInput: { height: scale(44), borderRadius: scale(10), borderWidth: 0.5, paddingHorizontal: scale(12), fontSize: scale(14), fontWeight: '500', fontFamily: 'Cairo-Regular' },
  modalBtn: { flex: 1, paddingVertical: scale(10), borderRadius: scale(10), alignItems: 'center', justifyContent: 'center' },
});