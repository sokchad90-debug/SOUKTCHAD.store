import React, { useState, useMemo, useCallback } from 'react';
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
import { scale } from '@/constants/responsive';

type OrderTab = 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled';

export default function SellerOrdersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    colors, t, language, user, isLoggedIn, sellerOrders: sellerOrdersCtx, orders, products, isReady,
  } = useApp();

  const [activeTab, setActiveTab] = useState<OrderTab>('all');
  const [refreshing, setRefreshing] = useState(false);

  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const lb = useCallback((en: string, fr: string, ar: string) => isFr ? fr : isAr ? ar : en, [isFr, isAr]);

  const sellerOrders = useMemo(() => {
    if (sellerOrdersCtx && sellerOrdersCtx.length > 0) return sellerOrdersCtx;
    return (orders || []).filter((o: any) => {
      if (!o?.sellerId || !user?.id) return false;
      return o.sellerId === user.id
        || String(o.sellerId) === String(user.numericId ?? '')
        || String(o.sellerId) === String(user.sellerId ?? '');
    });
  }, [sellerOrdersCtx, orders, user?.id, user?.numericId, user?.sellerId]);

  const userListings = useMemo(() => (products || []).filter((p: any) => {
    if (!p?.sellerId || !user?.id) return false;
    return p.sellerId === user.id
      || String(p.sellerId) === String(user.numericId ?? '')
      || String(p.sellerId) === String(user.sellerId ?? '');
  }), [products, user?.id, user?.numericId, user?.sellerId]);

  const filteredOrders = useMemo(() => {
    let result = sellerOrders;
    if (activeTab !== 'all') {
      if (activeTab === 'cancelled') {
        result = result.filter((o: any) => o?.status === 'cancelled' || o?.status === 'disputed');
      } else {
        result = result.filter((o: any) => (o?.status || '').toLowerCase() === activeTab);
      }
    }
    return result;
  }, [sellerOrders, activeTab]);

  const tabCounts = useMemo(() => ({
    all: sellerOrders.length,
    pending: sellerOrders.filter((o: any) => o?.status === 'pending').length,
    confirmed: sellerOrders.filter((o: any) => o?.status === 'confirmed').length,
    completed: sellerOrders.filter((o: any) => o?.status === 'completed').length,
    cancelled: sellerOrders.filter((o: any) => o?.status === 'cancelled' || o?.status === 'disputed').length,
  }), [sellerOrders]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // TODO: add real data refresh when order API is available
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'confirmed': case 'completed': return '#10B981';
      case 'pending': return '#F59E0B';
      case 'disputed': case 'cancelled': return '#EF4444';
      case 'delivered': return '#3B82F6';
      default: return '#9CA3AF';
    }
  }, []);

  const getStatusBg = useCallback((status: string) => {
    switch (status) {
      case 'confirmed': case 'completed': return '#10B98112';
      case 'pending': return '#F59E0B12';
      case 'disputed': case 'cancelled': return '#EF444412';
      case 'delivered': return '#3B82F612';
      default: return '#9CA3AF12';
    }
  }, []);

  const getStatusLabel = useCallback((status: string) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'pending': return lb('Pending', 'Attente', 'منتظر');
      case 'confirmed': return lb('Confirmed', 'Confirmé', 'مؤكد');
      case 'shipped': return lb('Shipped', 'Expédié', 'تم الشحن');
      case 'delivered': return lb('Delivered', 'Livré', 'تم التسليم');
      case 'completed': return lb('Completed', 'Terminé', 'مكتمل');
      case 'disputed': return lb('Disputed', 'Litige', 'نزاع');
      case 'cancelled': return lb('Cancelled', 'Annulé', 'ملغى');
      default: return s;
    }
  }, [lb]);

  const formatDate = useCallback((ts: string) => {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return isAr ? 'الآن' : isFr ? "À l'instant" : 'Now';
    if (mins < 60) return isAr ? `منذ ${mins} د` : isFr ? `Il y a ${mins} min` : `${mins}m`;
    if (hrs < 24) return isAr ? `منذ ${hrs} س` : isFr ? `Il y a ${hrs} h` : `${hrs}h`;
    if (days === 1) return isAr ? 'أمس' : isFr ? 'Hier' : 'Yesterday';
    if (days < 7) return isAr ? `منذ ${days} أيام` : isFr ? `Il y a ${days} jours` : `${days}d`;
    try {
      const locale = isAr ? 'ar' : isFr ? 'fr-FR' : 'en-US';
      return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    } catch { return `${d.getDate()}/${d.getMonth() + 1}`; }
  }, [isAr, isFr]);

  if (!isReady) {
    return <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" color={colors.primary} /></View>;
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

  const statusTabs: { key: OrderTab; label: string; count: number; color: string }[] = [
    { key: 'all', label: lb('All', 'Tous', 'الكل'), count: tabCounts.all, color: colors.primary },
    { key: 'pending', label: lb('Pending', 'Attente', 'منتظر'), count: tabCounts.pending, color: '#F59E0B' },
    { key: 'confirmed', label: lb('Confirmed', 'Confirmé', 'مؤكد'), count: tabCounts.confirmed, color: '#10B981' },
    { key: 'completed', label: lb('Completed', 'Terminé', 'مكتمل'), count: tabCounts.completed, color: '#3B82F6' },
    { key: 'cancelled', label: lb('Cancelled', 'Annulé', 'ملغى'), count: tabCounts.cancelled, color: '#EF4444' },
  ];

  // Summary stats
  const totalRevenue = sellerOrders.filter((o: any) => o?.status === 'confirmed' || o?.status === 'completed').reduce((s: number, o: any) => s + (o?.amount || 0), 0);
  const pendingRevenue = sellerOrders.filter((o: any) => o?.status === 'pending').reduce((s: number, o: any) => s + (o?.amount || 0), 0);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ─── Header ─── */}
      <View style={[oStyles.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[oStyles.headerTitle, { color: colors.textPrimary }]}>
            {lb('Orders', 'Commandes', 'الطلبات')}
          </Text>
          <Text style={[oStyles.headerSub, { color: colors.textTertiary }]}>
            {sellerOrders.length} {lb('total orders', 'commandes au total', 'إجمالي الطلبات')}
          </Text>
        </View>
      </View>

      {/* ─── Summary Cards ─── */}
      <View style={oStyles.summaryRow}>
        <View style={[oStyles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.card]}>
          <View style={[oStyles.summaryIcon, { backgroundColor: '#10B98115' }]}>
            <MaterialIcons name="payments" size={scale(18)} color="#10B981" />
          </View>
          <Text style={[oStyles.summaryValue, { color: colors.textPrimary }]}>{formatPrice(totalRevenue)}</Text>
          <Text style={[oStyles.summaryLabel, { color: colors.textTertiary }]}>{lb('Confirmed', 'Confirmé', 'مؤكد')}</Text>
        </View>
        <View style={[oStyles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.card]}>
          <View style={[oStyles.summaryIcon, { backgroundColor: '#F59E0B15' }]}>
            <MaterialIcons name="hourglass-top" size={scale(18)} color="#F59E0B" />
          </View>
          <Text style={[oStyles.summaryValue, { color: colors.textPrimary }]}>{formatPrice(pendingRevenue)}</Text>
          <Text style={[oStyles.summaryLabel, { color: colors.textTertiary }]}>{lb('Pending', 'Attente', 'منتظر')}</Text>
        </View>
      </View>

      {/* ─── Status Tabs — full width, evenly distributed ─── */}
      <View style={[oStyles.tabBar, { borderBottomColor: colors.border }]}>
        {statusTabs.map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => { selection(); setActiveTab(tab.key); }}
              style={({ pressed }) => [oStyles.tabChip, { backgroundColor: isActive ? colors.primary : colors.surface, borderColor: isActive ? colors.primary : colors.border, opacity: pressed ? 0.88 : 1 }]}
            >
              <Text style={[oStyles.tabChipText, { color: isActive ? '#FFF' : colors.textSecondary }]}>{tab.label}</Text>
              {tab.count > 0 && (
                <View style={[oStyles.tabBadge, { backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : tab.color + '18' }]}>
                  <Text style={[oStyles.tabBadgeText, { color: isActive ? '#FFF' : tab.color }]}>{tab.count}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* ─── Orders List ─── */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + scale(90), paddingHorizontal: scale(16), paddingTop: scale(8) }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}>
        {filteredOrders.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: scale(24) }}>
            <Text style={{ fontSize: scale(13), color: colors.textTertiary, fontFamily: 'Cairo-Regular' }}>
              {lb('No orders found', 'Aucune commande', 'لا توجد طلبات')}
            </Text>
          </View>
        ) : (
          <View style={{ gap: scale(12) }}>
            {filteredOrders.map((order: any) => {
              const product = userListings.find((p: any) => p?.id === order?.productId);
              const pTitle = product?.title?.[language] || product?.title?.en || order?.product_title || order?.productTitle || '';
              const statusColor = getStatusColor(order?.status);
              const statusBg = getStatusBg(order?.status);
              const buyerName = order?.buyer_name || order?.buyerName || order?.buyerId || '';
              const qty = order?.quantity || order?.qty || 1;
              return (
                <Pressable
                  key={order?.id}
                  onPress={() => router.push('/order/' + order?.id as any)}
                  style={({ pressed }) => [oStyles.orderCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.92 : 1 }, shadows.card]}
                >
                  {/* Status bar (left accent) */}
                  <View style={[oStyles.orderAccent, { backgroundColor: statusColor }]} />

                  <View style={oStyles.orderBody}>
                    {/* Top: image + info + status */}
                    <View style={oStyles.orderTopRow}>
                      {product?.images?.[0] ? (
                        <Image source={{ uri: product.images[0] }} style={oStyles.orderThumb} contentFit="cover" transition={150} />
                      ) : (
                        <View style={[oStyles.orderThumb, { backgroundColor: colors.backgroundSecondary, alignItems: 'center', justifyContent: 'center' }]}>
                          <MaterialIcons name="inventory" size={scale(20)} color={colors.textTertiary} />
                        </View>
                      )}
                      <View style={{ flex: 1, gap: scale(3) }}>
                        <Text style={[oStyles.orderProduct, { color: colors.textPrimary }]} numberOfLines={2}>{pTitle}</Text>
                        <View style={oStyles.orderMetaRow}>
                          <MaterialIcons name="person-outline" size={scale(13)} color={colors.textTertiary} />
                          <Text style={[oStyles.orderMetaText, { color: colors.textTertiary }]} numberOfLines={1}>{buyerName}</Text>
                          {qty > 1 && (
                            <Text style={[oStyles.orderQty, { color: colors.textTertiary }]}>×{qty}</Text>
                          )}
                        </View>
                      </View>
                      <View style={[oStyles.orderStatusPill, { backgroundColor: statusBg }]}>
                        <View style={[oStyles.orderStatusDot, { backgroundColor: statusColor }]} />
                        <Text style={[oStyles.orderStatusText, { color: statusColor }]}>{getStatusLabel(order?.status)}</Text>
                      </View>
                    </View>

                    {/* Bottom: amount + date + chevron */}
                    <View style={[oStyles.orderBottomRow, { borderTopColor: colors.border }]}>
                      <View style={oStyles.orderAmountCol}>
                        <Text style={[oStyles.orderAmount, { color: colors.primary }]}>{formatPrice(order?.amount || 0)}</Text>
                        {order?.transactionNumber && (
                          <View style={oStyles.orderRefRow}>
                            <MaterialIcons name="receipt-long" size={scale(11)} color={colors.textTertiary} />
                            <Text style={[oStyles.orderRef, { color: colors.textTertiary }]} numberOfLines={1}>#{String(order.transactionNumber).slice(-12)}</Text>
                          </View>
                        )}
                      </View>
                      <View style={oStyles.orderDateCol}>
                        <Text style={[oStyles.orderDate, { color: colors.textTertiary }]}>{formatDate(order?.createdAt || order?.date || order?.created_at || '')}</Text>
                        <MaterialIcons name={isAr ? 'chevron-left' : 'chevron-right'} size={scale(18)} color={colors.textTertiary} />
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const oStyles = StyleSheet.create({
  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: scale(16), paddingVertical: scale(12), borderBottomWidth: 0.5 },
  headerTitle: { fontSize: scale(22), fontWeight: '800', fontFamily: 'Cairo-Bold' },
  headerSub: { fontSize: scale(12), fontWeight: '500', marginTop: scale(2), fontFamily: 'Cairo-Regular' },

  // Summary cards
  summaryRow: { flexDirection: 'row', gap: scale(10), paddingHorizontal: scale(16), paddingTop: scale(12) },
  summaryCard: { flex: 1, borderRadius: scale(14), borderWidth: 0.5, padding: scale(14), gap: scale(6) },
  summaryIcon: { width: scale(34), height: scale(34), borderRadius: scale(17), alignItems: 'center', justifyContent: 'center' },
  summaryValue: { fontSize: scale(16), fontWeight: '800', fontFamily: 'Cairo-Bold' },
  summaryLabel: { fontSize: scale(11), fontWeight: '500', fontFamily: 'Cairo-Regular' },

  // Status tabs — full width row, evenly distributed
  tabBar: { flexDirection: 'row', paddingHorizontal: scale(8), paddingVertical: scale(6), gap: scale(4), borderBottomWidth: 0.5 },
  tabChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: scale(6), borderRadius: 9999, borderWidth: 1, gap: scale(4) },
  tabChipText: { fontSize: scale(11), fontWeight: '700', fontFamily: 'Cairo-SemiBold' },
  tabBadge: { paddingHorizontal: scale(5), paddingVertical: scale(0), borderRadius: scale(7), minWidth: scale(16), alignItems: 'center' },
  tabBadgeText: { fontSize: scale(9), fontWeight: '800', fontFamily: 'Cairo-Bold' },

  // Order card
  orderCard: { flexDirection: 'row', borderRadius: scale(14), borderWidth: 0.5, overflow: 'hidden' },
  orderAccent: { width: scale(4) },
  orderBody: { flex: 1, padding: scale(14), gap: scale(12) },
  orderTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: scale(10) },
  orderThumb: { width: scale(48), height: scale(48), borderRadius: scale(10) },
  orderProduct: { fontSize: scale(14), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },
  orderMetaRow: { flexDirection: 'row', alignItems: 'center', gap: scale(4) },
  orderMetaText: { fontSize: scale(12), fontFamily: 'Cairo-Regular', flex: 1 },
  orderQty: { fontSize: scale(12), fontWeight: '600', fontFamily: 'Cairo-Medium' },
  orderStatusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(8), paddingVertical: scale(4), borderRadius: 9999, gap: scale(4) },
  orderStatusDot: { width: scale(6), height: scale(6), borderRadius: scale(3) },
  orderStatusText: { fontSize: scale(10), fontWeight: '800', fontFamily: 'Cairo-Bold' },
  orderBottomRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: scale(10), borderTopWidth: 0.5 },
  orderAmountCol: { gap: scale(2) },
  orderAmount: { fontSize: scale(17), fontWeight: '800', fontFamily: 'Cairo-Bold' },
  orderRefRow: { flexDirection: 'row', alignItems: 'center', gap: scale(3) },
  orderRef: { fontSize: scale(11), fontFamily: 'Cairo-Regular' },
  orderDateCol: { flexDirection: 'row', alignItems: 'center', gap: scale(4) },
  orderDate: { fontSize: scale(12), fontWeight: '500', fontFamily: 'Cairo-Regular' },
});