import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useApp } from '@/contexts/AppContext';
import { formatPrice } from '@/constants/config';
import { shadows } from '@/constants/theme';
import { selection } from '@/services/haptics';
import { scale } from '@/constants/responsive';

const BRAND = '#6366F1';

type RangeKey = 'week' | 'month' | '3months' | 'custom' | 'all';

const RANGES: RangeKey[] = ['week', 'month', '3months', 'custom', 'all'];

const startOfDay = (d: Date) => { const c = new Date(d); c.setHours(0, 0, 0, 0); return c; };
const endOfDay = (d: Date) => { const c = new Date(d); c.setHours(23, 59, 59, 999); return c; };

export default function SellerInvoicesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, language, user, isLoggedIn, sellerOrders: sellerOrdersCtx, orders, products, isReady } = useApp();

  const [generating, setGenerating] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>('month');
  const [customStart, setCustomStart] = useState<Date>(() => { const d = new Date(); d.setDate(d.getDate() - 30); return startOfDay(d); });
  const [customEnd, setCustomEnd] = useState<Date>(() => endOfDay(new Date()));

  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const lb = useCallback((en: string, fr: string, ar: string) => isFr ? fr : isAr ? ar : en, [isFr, isAr]);

  // Seller orders — prefer context sellerOrders, fall back to filtering `orders`
  const sellerOrders = useMemo(() => {
    if (sellerOrdersCtx && sellerOrdersCtx.length > 0) return sellerOrdersCtx;
    return (orders || []).filter((o: any) => {
      if (!o?.sellerId || !user?.id) return false;
      return o.sellerId === user.id
        || String(o.sellerId) === String(user.numericId ?? '')
        || String(o.sellerId) === String(user.sellerId ?? '');
    });
  }, [sellerOrdersCtx, orders, user?.id, user?.numericId, user?.sellerId]);

  const rangeLabel = useCallback((key: RangeKey) => {
    switch (key) {
      case 'week': return lb('This Week', 'Cette semaine', 'هذا الأسبوع');
      case 'month': return lb('This Month', 'Ce mois', 'هذا الشهر');
      case '3months': return lb('3 Months', '3 mois', '3 أشهر');
      case 'custom': return lb('Custom', 'Personnalisé', 'مخصص');
      case 'all': return lb('All', 'Tout', 'الكل');
      default: return key;
    }
  }, [lb]);

  // Compute the date bounds for the selected range
  const rangeBounds = useMemo(() => {
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;
    switch (range) {
      case 'week': {
        start = new Date(now); start.setDate(now.getDate() - 7); start = startOfDay(start);
        break;
      }
      case 'month': {
        start = new Date(now); start.setMonth(now.getMonth() - 1); start = startOfDay(start);
        break;
      }
      case '3months': {
        start = new Date(now); start.setMonth(now.getMonth() - 3); start = startOfDay(start);
        break;
      }
      case 'custom': {
        start = customStart;
        end = customEnd;
        break;
      }
      case 'all':
      default:
        start = null; end = null;
        break;
    }
    return { start, end };
  }, [range, customStart, customEnd]);

  // Filter orders by the selected range
  const filteredOrders = useMemo(() => {
    const { start, end } = rangeBounds;
    return sellerOrders.filter((o: any) => {
      const ts = o?.createdAt || o?.created_at || o?.date;
      const d = ts ? new Date(ts) : null;
      if (!d || isNaN(d.getTime())) return false;
      if (start && d.getTime() < start.getTime()) return false;
      if (end && d.getTime() > end.getTime()) return false;
      return true;
    });
  }, [sellerOrders, rangeBounds]);

  const filteredTotal = useMemo(() => filteredOrders.reduce((s: number, o: any) => s + getOrderAmount(o), 0), [filteredOrders]);

  const getStatusLabel = useCallback((status: string) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'pending': return lb('Pending', 'En attente', 'قيد الانتظار');
      case 'confirmed': return lb('Confirmed', 'Confirmé', 'مؤكد');
      case 'shipped': return lb('Shipped', 'En livraison', 'قيد التوصيل');
      case 'delivered': return lb('Delivered', 'Livré', 'تم التسليم');
      case 'completed': return lb('Completed', 'Terminé', 'مكتمل');
      case 'disputed': return lb('Disputed', 'Contesté', 'متنازع عليه');
      case 'cancelled': return lb('Cancelled', 'Annulé', 'ملغى');
      default: return s;
    }
  }, [lb]);

  const getStatusColor = useCallback((status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'completed' || s === 'confirmed') return '#10B981';
    if (s === 'cancelled' || s === 'disputed') return '#EF4444';
    if (s === 'delivered') return '#3B82F6';
    return '#F59E0B';
  }, []);

  const getProductTitle = useCallback((o: any) => {
    const product = products.find((p: any) => String(p.id) === String(o?.productId || o?.product_id));
    return product?.title?.[language] || product?.title?.en
      || o?.product_title_snapshot
      || o?.product_title_en || o?.product_title_fr || o?.product_title_ar
      || lb('Product', 'Produit', 'منتج');
  }, [products, language, lb]);

  const formatDate = useCallback((ts: string) => {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    const locale = isAr ? 'ar' : isFr ? 'fr-FR' : 'en-US';
    try {
      return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    }
  }, [isAr, isFr]);

  const formatDateInput = useCallback((d: Date) => {
    const locale = isAr ? 'ar' : isFr ? 'fr-FR' : 'en-US';
    try {
      return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    }
  }, [isAr, isFr]);

  const shiftDate = useCallback((d: Date, days: number) => {
    const c = new Date(d);
    c.setDate(c.getDate() + days);
    return c;
  }, []);

  const buildHtml = useCallback((title: string, list: any[]) => {
    const storeName = user?.username || user?.name || '';
    const totalRevenue = list.reduce((s: number, o: any) => s + getOrderAmount(o), 0);
    const dir = isAr ? 'rtl' : 'ltr';
    const align = isAr ? 'right' : 'left';

    const rows = list.map((o: any) => {
      const status = getStatusLabel(o?.status);
      const statusColor = getStatusColor(o?.status);
      const title = getProductTitle(o);
      const amount = getOrderAmount(o);
      const date = formatDate(o?.createdAt || o?.created_at || o?.date);
      const txn = o?.transaction_number || o?.order_number || `#${o?.id}`;
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #E2E8F0;color:#475569;font-size:12px;white-space:nowrap;">${date}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #E2E8F0;color:#0F172A;font-size:13px;font-weight:600;">${title}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:11px;white-space:nowrap;">${txn}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #E2E8F0;text-align:center;"><span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;color:${statusColor};background:${statusColor}1A;">${status}</span></td>
          <td style="padding:10px 12px;border-bottom:1px solid #E2E8F0;color:#6366F1;font-size:13px;font-weight:700;text-align:${align};white-space:nowrap;">${formatPrice(amount)}</td>
        </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html dir="${dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A; background: #fff; }
    .header { background: #6366F1; color: #fff; padding: 28px 32px; }
    .header .brand { font-size: 26px; font-weight: 800; }
    .header .sub { font-size: 13px; opacity: 0.85; margin-top: 4px; }
    .header .title { font-size: 18px; font-weight: 700; margin-top: 14px; }
    .body { padding: 24px 32px; }
    .summary { display: flex; gap: 16px; margin-bottom: 24px; }
    .summary .card { flex: 1; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; }
    .summary .card .label { font-size: 11px; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
    .summary .card .value { font-size: 20px; font-weight: 800; margin-top: 6px; }
    .summary .card .value.revenue { color: #6366F1; }
    table { width: 100%; border-collapse: collapse; }
    thead th { background: #F8FAFC; color: #64748B; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; text-align: ${align}; padding: 10px 12px; border-bottom: 1px solid #E2E8F0; }
    .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #E2E8F0; text-align: center; color: #94A3B8; font-size: 11px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">Sokchad</div>
    <div class="sub">${storeName}</div>
    <div class="title">${lb('Invoice', 'Facture', 'فاتورة')} — ${title}</div>
  </div>
  <div class="body">
    <div class="summary">
      <div class="card">
        <div class="label">${lb('Orders', 'Commandes', 'الطلبات')}</div>
        <div class="value">${list.length}</div>
      </div>
      <div class="card">
        <div class="label">${lb('Total Revenue', 'Revenu total', 'إجمالي الإيرادات')}</div>
        <div class="value revenue">${formatPrice(totalRevenue)}</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>${lb('Date', 'Date', 'التاريخ')}</th>
          <th>${lb('Product', 'Produit', 'المنتج')}</th>
          <th>${lb('Ref', 'Réf', 'المرجع')}</th>
          <th style="text-align:center;">${lb('Status', 'Statut', 'الحالة')}</th>
          <th>${lb('Price', 'Prix', 'السعر')}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">${lb('Generated by Sokchad', 'Généré par Sokchad', 'تم الإنشاء بواسطة سوكشاد')} · ${new Date().toLocaleDateString()}</div>
  </div>
</body>
</html>`;
  }, [user, isAr, isFr, lb, getStatusLabel, getStatusColor, getProductTitle, formatDate]);

  const handleGeneratePdf = useCallback(async (title: string, list: any[]) => {
    if (generating) return;
    setGenerating(title);
    try {
      const html = buildHtml(title, list);
      const { uri } = await Print.printToFileAsync({ html });

      if (Platform.OS === 'web') {
        Alert.alert(lb('PDF ready', 'PDF prêt', 'ملف PDF جاهز'), uri);
        return;
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: lb('Share invoice', 'Partager la facture', 'مشاركة الفاتورة'),
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert(lb('PDF ready', 'PDF prêt', 'ملف PDF جاهز'), uri);
      }
    } catch (e) {
      console.log('Generate PDF error:', e);
      Alert.alert(
        lb('Export failed', 'Échec de l\'export', 'فشل التصدير'),
        lb('Could not generate the PDF. Please try again.', 'Impossible de générer le PDF. Veuillez réessayer.', 'تعذر إنشاء ملف PDF. يرجى المحاولة مرة أخرى.'),
      );
    } finally {
      setGenerating(null);
    }
  }, [generating, buildHtml, lb]);

  if (!isReady) {
    return <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  if (!isLoggedIn || !user?.isSeller) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: scale(32) }}>
        <MaterialIcons name="receipt-long" size={scale(64)} color={colors.textTertiary} />
        <Text style={{ fontSize: scale(18), fontWeight: '700', color: colors.textPrimary, marginTop: scale(12), fontFamily: 'Cairo-Bold' }}>
          {lb('Seller Account Required', 'Compte vendeur requis', 'حساب بائع مطلوب')}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[iStyles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <MaterialIcons name={isAr ? 'arrow-forward' : 'arrow-back'} size={scale(24)} color={colors.textPrimary} />
        </Pressable>
        <Text style={[iStyles.headerTitle, { color: colors.textPrimary }]}>
          {lb('Invoices', 'Factures', 'الفواتير')}
        </Text>
        <View style={{ width: scale(24) }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + scale(40), paddingHorizontal: scale(16), paddingTop: scale(12) }}
        showsVerticalScrollIndicator={false}>

        {/* ===== Date range selector ===== */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: scale(8), paddingBottom: scale(4) }}>
          {RANGES.map((key) => {
            const active = range === key;
            return (
              <Pressable
                key={key}
                onPress={() => { selection(); setRange(key); }}
                style={[iStyles.rangeChip, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border }]}
              >
                <Text style={[iStyles.rangeChipText, { color: active ? '#FFF' : colors.textSecondary }]}>
                  {rangeLabel(key)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ===== Custom date pickers ===== */}
        {range === 'custom' && (
          <View style={[iStyles.customCard, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.card]}>
            <View style={iStyles.customRow}>
              <Text style={[iStyles.customLabel, { color: colors.textSecondary }]}>
                {lb('From', 'Du', 'من')}
              </Text>
              <View style={iStyles.dateStepper}>
                <Pressable onPress={() => { selection(); setCustomStart(shiftDate(customStart, -1)); }} hitSlop={8} style={[iStyles.stepBtn, { backgroundColor: colors.backgroundSecondary }]}>
                  <MaterialIcons name="remove" size={scale(18)} color={colors.textPrimary} />
                </Pressable>
                <Text style={[iStyles.dateValue, { color: colors.textPrimary }]}>{formatDateInput(customStart)}</Text>
                <Pressable onPress={() => { selection(); setCustomStart(shiftDate(customStart, 1)); }} hitSlop={8} style={[iStyles.stepBtn, { backgroundColor: colors.backgroundSecondary }]}>
                  <MaterialIcons name="add" size={scale(18)} color={colors.textPrimary} />
                </Pressable>
              </View>
            </View>
            <View style={[iStyles.customRow, { marginTop: scale(10) }]}>
              <Text style={[iStyles.customLabel, { color: colors.textSecondary }]}>
                {lb('To', 'Au', 'إلى')}
              </Text>
              <View style={iStyles.dateStepper}>
                <Pressable onPress={() => { selection(); setCustomEnd(shiftDate(customEnd, -1)); }} hitSlop={8} style={[iStyles.stepBtn, { backgroundColor: colors.backgroundSecondary }]}>
                  <MaterialIcons name="remove" size={scale(18)} color={colors.textPrimary} />
                </Pressable>
                <Text style={[iStyles.dateValue, { color: colors.textPrimary }]}>{formatDateInput(customEnd)}</Text>
                <Pressable onPress={() => { selection(); setCustomEnd(shiftDate(customEnd, 1)); }} hitSlop={8} style={[iStyles.stepBtn, { backgroundColor: colors.backgroundSecondary }]}>
                  <MaterialIcons name="add" size={scale(18)} color={colors.textPrimary} />
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* ===== Summary + Export ===== */}
        <View style={[iStyles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.card]}>
          <View style={{ flex: 1 }}>
            <Text style={[iStyles.summaryLabel, { color: colors.textTertiary }]}>
              {rangeLabel(range)}
            </Text>
            <Text style={[iStyles.summaryValue, { color: colors.textPrimary }]}>
              {filteredOrders.length} {lb('orders', 'commandes', 'طلبات')}
            </Text>
            <Text style={[iStyles.summaryRevenue, { color: colors.primary }]}>
              {formatPrice(filteredTotal)}
            </Text>
          </View>
          <Pressable
            onPress={() => { selection(); handleGeneratePdf(rangeLabel(range), filteredOrders); }}
            disabled={Boolean(generating) || filteredOrders.length === 0}
            style={({ pressed }) => [iStyles.exportBtn, { backgroundColor: colors.primary, opacity: (pressed || filteredOrders.length === 0) ? 0.6 : 1 }]}
          >
            {generating ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <MaterialIcons name="picture-as-pdf" size={scale(18)} color="#FFF" />
                <Text style={iStyles.exportBtnText}>{lb('Export PDF', 'Exporter PDF', 'تصدير PDF')}</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* ===== Orders list ===== */}
        {filteredOrders.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: scale(40) }}>
            <MaterialIcons name="receipt-long" size={scale(48)} color={colors.textTertiary} />
            <Text style={{ fontSize: scale(14), color: colors.textTertiary, marginTop: scale(12), fontFamily: 'Cairo-Regular' }}>
              {lb('No orders in this period', 'Aucune commande sur cette période', 'لا توجد طلبات في هذه الفترة')}
            </Text>
          </View>
        ) : (
          <View style={{ gap: scale(10), marginTop: scale(4) }}>
            {filteredOrders.map((o: any) => {
              const title = getProductTitle(o);
              const amount = getOrderAmount(o);
              const date = formatDate(o?.createdAt || o?.created_at || o?.date);
              const status = getStatusLabel(o?.status);
              const statusColor = getStatusColor(o?.status);
              const txn = o?.transaction_number || o?.order_number || `#${o?.id}`;
              return (
                <View key={o?.id} style={[iStyles.orderCard, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.card]}>
                  <View style={{ flex: 1, gap: scale(3) }}>
                    <Text style={[iStyles.orderTitle, { color: colors.textPrimary }]} numberOfLines={1}>{title}</Text>
                    <Text style={[iStyles.orderMeta, { color: colors.textTertiary }]}>{date} · {txn}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: scale(4) }}>
                    <Text style={[iStyles.orderAmount, { color: colors.primary }]}>{formatPrice(amount)}</Text>
                    <View style={[iStyles.statusPill, { backgroundColor: statusColor + '1A' }]}>
                      <Text style={[iStyles.statusPillText, { color: statusColor }]}>{status}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function getOrderAmount(o: any) {
  return o?.product_price_snapshot || o?.amount || 0;
}

const iStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: scale(16), paddingVertical: scale(12), borderBottomWidth: 0.5 },
  headerTitle: { fontSize: scale(17), fontWeight: '700', fontFamily: 'Cairo-Bold' },
  rangeChip: { paddingHorizontal: scale(14), paddingVertical: scale(8), borderRadius: scale(20), borderWidth: 0.5 },
  rangeChipText: { fontSize: scale(13), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },
  customCard: { borderRadius: scale(14), borderWidth: 0.5, padding: scale(14), marginTop: scale(12) },
  customRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  customLabel: { fontSize: scale(13), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },
  dateStepper: { flexDirection: 'row', alignItems: 'center', gap: scale(10) },
  stepBtn: { width: scale(30), height: scale(30), borderRadius: scale(8), alignItems: 'center', justifyContent: 'center' },
  dateValue: { fontSize: scale(13), fontWeight: '700', minWidth: scale(90), textAlign: 'center', fontFamily: 'Cairo-Bold' },
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: scale(12), borderRadius: scale(14), borderWidth: 0.5, padding: scale(14), marginTop: scale(12) },
  summaryLabel: { fontSize: scale(12), fontWeight: '600', fontFamily: 'Cairo-Medium' },
  summaryValue: { fontSize: scale(16), fontWeight: '800', marginTop: scale(2), fontFamily: 'Cairo-Bold' },
  summaryRevenue: { fontSize: scale(14), fontWeight: '700', marginTop: scale(2), fontFamily: 'Cairo-Bold' },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: scale(6), borderRadius: scale(12), paddingHorizontal: scale(14), paddingVertical: scale(12) },
  exportBtnText: { color: '#FFF', fontSize: scale(13), fontWeight: '700', fontFamily: 'Cairo-Bold' },
  orderCard: { flexDirection: 'row', alignItems: 'center', gap: scale(12), borderRadius: scale(14), borderWidth: 0.5, padding: scale(14) },
  orderTitle: { fontSize: scale(14), fontWeight: '700', fontFamily: 'Cairo-Bold' },
  orderMeta: { fontSize: scale(11), fontWeight: '500', fontFamily: 'Cairo-Regular' },
  orderAmount: { fontSize: scale(15), fontWeight: '800', fontFamily: 'Cairo-Bold' },
  statusPill: { paddingHorizontal: scale(10), paddingVertical: scale(3), borderRadius: scale(999) },
  statusPillText: { fontSize: scale(11), fontWeight: '700', fontFamily: 'Cairo-Bold' },
});
