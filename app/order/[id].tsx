import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useApp } from '@/contexts/AppContext';
import { formatPrice } from '@/constants/config';
import { scale } from '@/constants/responsive';

export default function OrderDetailsPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, language, isDark, products, sellers, buyerOrders, orders } = useApp();
  const [copied, setCopied] = useState(false);

  const isAr = language === 'ar';
  const isFr = language === 'fr';
  const lb = (en: string, fr: string, ar: string) => isFr ? fr : isAr ? ar : en;

  // Find the order from buyerOrders OR orders (covers buyer + seller orders) OR orders (seller orders)
  const order = buyerOrders.find((o: any) => String(o.id) === String(id)) || (orders || []).find((o: any) => String(o.id) === String(id));
  
  // Normalize fields (API snake_case + mock camelCase)
  const productId = order?.productId || order?.product_id;
  const sellerId = order?.sellerId || order?.seller_id;
  const product = products.find((p: any) => String(p.id) === String(productId));
  const seller = sellers.find((s: any) => String(s.id) === String(sellerId));
  
  // Order number (fallback only)
  const orderNumber = order?.order_number || `SC-${new Date(order?.createdAt || order?.created_at || Date.now()).getFullYear()}-${String(order?.id || 0).padStart(6, '0')}`;
  // Transaction number (20-digit) — primary identifier shown to user
  const transactionNumber = order?.transaction_number || orderNumber;
  
  // Product info — use live product if available, otherwise fall back to snapshot data
  const isProductDeleted = !product;
  const productTitle = product?.title?.[language] || product?.title?.en 
    || order?.product_title_snapshot
    || order?.product_title_en || order?.product_title_fr || order?.product_title_ar
    || lb('Product', 'Produit', 'منتج');
  const productImage = product?.images?.[0] || order?.product_image_snapshot || order?.product_image || '';
  const productPrice = order?.product_price_snapshot || order?.amount || 0;
  
  // Status
  const getStatusLabel = (status: string) => {
    const map: Record<string, { en: string; fr: string; ar: string }> = {
      completed: { en: 'Completed', fr: 'Terminé', ar: 'مكتمل' },
      pending: { en: 'Pending', fr: 'En attente', ar: 'قيد الانتظار' },
      confirmed: { en: 'Confirmed', fr: 'Confirmé', ar: 'مؤكد' },
      shipped: { en: 'Shipped', fr: 'En livraison', ar: 'قيد التوصيل' },
      delivered: { en: 'Delivered', fr: 'Livré', ar: 'تم التسليم' },
      cancelled: { en: 'Cancelled', fr: 'Annulé', ar: 'ملغى' },
      disputed: { en: 'Disputed', fr: 'Contesté', ar: 'متنازع عليه' },
    };
    const s = map[status?.toLowerCase()] || map.pending;
    return isFr ? s.fr : isAr ? s.ar : s.en;
  };
  
  const getStatusColor = (status: string) => {
    const s = status?.toLowerCase();
    if (s === 'completed') return colors.success;
    if (s === 'cancelled' || s === 'disputed') return colors.error;
    if (s === 'pending' || s === 'confirmed' || s === 'shipped') return colors.warning;
    return colors.textSecondary;
  };

  const handleCopyOrder = () => {
    Clipboard.setStringAsync(transactionNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!order) {
    return (
      <SafeAreaView edges={['top']} style={[sStyles.container, { backgroundColor: colors.background }]}>
        <View style={sStyles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <MaterialIcons name={isAr ? "arrow-forward" : "arrow-back"} size={scale(24)} color={colors.textPrimary} />
          </Pressable>
          <Text style={[sStyles.headerTitle, { color: colors.textPrimary }]}>{lb('Order Details', 'Détails de la commande', 'تفاصيل الطلب')}</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.textTertiary, fontSize: scale(14) }}>{lb('Order not found', 'Commande introuvable', 'الطلب غير موجود')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const createdAt = order?.createdAt || order?.created_at;

  return (
    <SafeAreaView edges={['top']} style={[sStyles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[sStyles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <MaterialIcons name={isAr ? "arrow-forward" : "arrow-back"} size={scale(24)} color={colors.textPrimary} />
        </Pressable>
        <Text style={[sStyles.headerTitle, { color: colors.textPrimary, fontFamily: 'Cairo-Bold' }]}>
          {lb('Transaction Details', 'Détails de la transaction', 'تفاصيل العملية')}
        </Text>
        <View style={{ width: scale(24) }} />
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: scale(40), paddingHorizontal: scale(16) }}>
        {/* Transaction number card */}
        <View style={[sStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={sStyles.orderNumRow}>
            <View style={{ flex: 1 }}>
              <Text style={[sStyles.label, { color: colors.textSecondary, fontFamily: 'Cairo-Regular' }]} numberOfLines={1}>
                {lb('Transaction #', 'Numéro de transaction', 'رقم العملية')}
              </Text>
              <Text style={[sStyles.orderNumValue, { color: colors.textPrimary, fontFamily: 'Cairo-Bold' }]} numberOfLines={1}>
                {transactionNumber}
              </Text>
            </View>
            <Pressable onPress={handleCopyOrder} hitSlop={12} style={sStyles.copyBtn}>
              <MaterialIcons name={copied ? "check" : "content-copy"} size={scale(18)} color={copied ? colors.success : colors.primary} />
            </Pressable>
          </View>
          {copied ? (
            <Text style={[sStyles.copiedMsg, { color: colors.success, fontFamily: 'Cairo-Regular' }]}>
              {lb('Transaction number copied', 'Numéro de transaction copié', 'تم نسخ رقم العملية')}
            </Text>
          ) : null}
        </View>

        {/* Product card */}
        <View style={[sStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[sStyles.sectionTitle, { color: colors.textSecondary, fontFamily: 'Cairo-SemiBold' }]}>
            {lb('Product', 'Produit', 'المنتج')}
          </Text>
          <View style={sStyles.productRow}>
            {productImage ? (
              <Image source={{ uri: productImage }} style={sStyles.productImage} contentFit="cover" />
            ) : (
              <View style={[sStyles.productImagePlaceholder, { backgroundColor: colors.primaryLight }]}>
                <MaterialIcons name="image" size={scale(24)} color={colors.textTertiary} />
              </View>
            )}
            <View style={{ flex: 1, gap: scale(4) }}>
              <Text style={[sStyles.productName, { color: colors.textPrimary, fontFamily: 'Cairo-SemiBold' }]} numberOfLines={2}>
                {productTitle}
              </Text>
              <Text style={[sStyles.productPrice, { color: colors.primary, fontFamily: 'Cairo-Bold' }]}>
                {formatPrice(productPrice)}
              </Text>
            </View>
          </View>
          {isProductDeleted ? (
            <Text style={[sStyles.deletedMsg, { color: colors.textTertiary, fontFamily: 'Cairo-Regular' }]}>
              {lb('This product is no longer available', "Ce produit n'est plus disponible", 'هذا المنتج لم يعد متاحًا')}
            </Text>
          ) : null}
        </View>

        {/* Order details card */}
        <View style={[sStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[sStyles.sectionTitle, { color: colors.textSecondary, fontFamily: 'Cairo-SemiBold' }]}>
            {lb('Order Info', 'Informations', 'معلومات الطلب')}
          </Text>
          
          <View style={sStyles.detailRow}>
            <Text style={[sStyles.detailLabel, { color: colors.textSecondary, fontFamily: 'Cairo-Regular' }]}>
              {lb('Status', 'Statut', 'الحالة')}
            </Text>
            <View style={[sStyles.statusBadge, { backgroundColor: getStatusColor(order?.status) + '15' }]}>
              <Text style={[sStyles.statusText, { color: getStatusColor(order?.status), fontFamily: 'Cairo-SemiBold' }]}>
                {getStatusLabel(order?.status)}
              </Text>
            </View>
          </View>

          <View style={sStyles.detailRow}>
            <Text style={[sStyles.detailLabel, { color: colors.textSecondary, fontFamily: 'Cairo-Regular' }]}>
              {lb('Date', 'Date', 'التاريخ')}
            </Text>
            <Text style={[sStyles.detailValue, { color: colors.textPrimary, fontFamily: 'Cairo-Regular' }]}>
              {createdAt ? new Date(createdAt).toLocaleDateString(isFr ? 'fr-FR' : isAr ? 'ar' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
            </Text>
          </View>

          <View style={sStyles.detailRow}>
            <Text style={[sStyles.detailLabel, { color: colors.textSecondary, fontFamily: 'Cairo-Regular' }]}>
              {lb('Quantity', 'Quantité', 'الكمية')}
            </Text>
            <Text style={[sStyles.detailValue, { color: colors.textPrimary, fontFamily: 'Cairo-Regular' }]}>1</Text>
          </View>

          <View style={sStyles.detailRow}>
            <Text style={[sStyles.detailLabel, { color: colors.textSecondary, fontFamily: 'Cairo-Regular' }]}>
              {lb('Shipping', 'Livraison', 'التوصيل')}
            </Text>
            <Text style={[sStyles.detailValue, { color: colors.textPrimary, fontFamily: 'Cairo-Regular' }]}>
              {lb('Not included', 'Non incluse', 'غير مشمول')}
            </Text>
          </View>

          <View style={[sStyles.detailRow, { borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: scale(10), marginTop: scale(4) }]}>
            <Text style={[sStyles.detailLabel, { color: colors.textPrimary, fontFamily: 'Cairo-Bold', fontSize: scale(14) }]}>
              {lb('Total', 'Total', 'الإجمالي')}
            </Text>
            <Text style={[sStyles.totalValue, { color: colors.primary, fontFamily: 'Cairo-Bold' }]}>
              {formatPrice(productPrice)}
            </Text>
          </View>
        </View>

        {/* Seller card */}
        <View style={[sStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[sStyles.sectionTitle, { color: colors.textSecondary, fontFamily: 'Cairo-SemiBold' }]}>
            {lb('Seller', 'Vendeur', 'البائع')}
          </Text>
          <View style={sStyles.sellerRow}>
            {seller?.avatar ? (
              <Image source={{ uri: seller.avatar }} style={sStyles.sellerAvatar} contentFit="cover" />
            ) : (
              <View style={[sStyles.sellerAvatarPlaceholder, { backgroundColor: colors.primaryLight }]}>
                <MaterialIcons name="store" size={scale(20)} color={colors.primary} />
              </View>
            )}
            <View style={{ flex: 1, gap: scale(2) }}>
              <Text style={[sStyles.sellerName, { color: colors.textPrimary, fontFamily: 'Cairo-SemiBold' }]}>
                {seller?.name || order?.seller_name || order?.seller_name_snapshot || lb('Seller', 'Vendeur', 'البائع')}
              </Text>
              {seller?.isVerified ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(3) }}>
                  <MaterialIcons name="verified" size={scale(12)} color={colors.verified} />
                  <Text style={{ fontSize: scale(10), color: colors.verified, fontFamily: 'Cairo-Regular' }}>
                    {lb('Verified', 'Vérifié', 'موثوق')}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* Action buttons */}
        <View style={sStyles.actionsRow}>
          {/* View Product */}
          <Pressable
            onPress={() => !isProductDeleted && router.push(`/product/${productId}` as any)}
            disabled={isProductDeleted}
            style={({ pressed }) => [
              sStyles.actionBtn,
              { backgroundColor: isProductDeleted ? colors.backgroundSecondary : colors.primary, opacity: isProductDeleted ? 0.5 : pressed ? 0.88 : 1 }
            ]}
          >
            <MaterialIcons name="visibility" size={scale(16)} color={isProductDeleted ? colors.textTertiary : '#FFF'} />
            <Text style={[sStyles.actionBtnText, { color: isProductDeleted ? colors.textTertiary : '#FFF', fontFamily: 'Cairo-SemiBold' }]}>
              {isProductDeleted
                ? lb('Unavailable', 'Indisponible', 'غير متاح')
                : lb('View Product', 'Voir le produit', 'عرض المنتج')}
            </Text>
          </Pressable>

          {/* Visit Store */}
          <Pressable
            onPress={() => router.push(`/seller/${sellerId}` as any)}
            style={({ pressed }) => [sStyles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.primary, borderWidth: 1, opacity: pressed ? 0.88 : 1 }]}
          >
            <MaterialIcons name="store" size={scale(16)} color={colors.primary} />
            <Text style={[sStyles.actionBtnText, { color: colors.primary, fontFamily: 'Cairo-SemiBold' }]}>
              {lb('Visit Store', 'Visiter la boutique', 'زيارة متجر البائع')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const sStyles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: scale(16), paddingVertical: scale(12), borderBottomWidth: 0.5,
  },
  headerTitle: { fontSize: scale(16), fontWeight: '700' },

  card: {
    borderRadius: scale(14), borderWidth: 0.5, padding: scale(14),
    marginTop: scale(12), gap: scale(10),
  },
  sectionTitle: { fontSize: scale(12), fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  orderNumRow: { flexDirection: 'row', alignItems: 'center', gap: scale(10) },
  label: { fontSize: scale(11), fontWeight: '500' },
  orderNumValue: { fontSize: scale(16), marginTop: scale(2) },
  copyBtn: { padding: scale(8), borderRadius: scale(10), backgroundColor: 'rgba(0,0,0,0.05)' },
  copiedMsg: { fontSize: scale(11), marginTop: scale(6) },

  productRow: { flexDirection: 'row', gap: scale(12), alignItems: 'center' },
  productImage: { width: scale(64), height: scale(64), borderRadius: scale(10) },
  productImagePlaceholder: {
    width: scale(64), height: scale(64), borderRadius: scale(10), alignItems: 'center', justifyContent: 'center',
  },
  productName: { fontSize: scale(14), fontWeight: '600', flexShrink: 1 },
  productPrice: { fontSize: scale(14), fontWeight: '700' },
  deletedMsg: { fontSize: scale(12), marginTop: scale(4) },

  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: scale(6) },
  detailLabel: { fontSize: scale(13), fontWeight: '500' },
  detailValue: { fontSize: scale(13), fontWeight: '500' },
  statusBadge: { paddingHorizontal: scale(10), paddingVertical: scale(4), borderRadius: scale(10) },
  statusText: { fontSize: scale(11), fontWeight: '600' },
  totalValue: { fontSize: scale(16), fontWeight: '800' },

  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: scale(10) },
  sellerAvatar: { width: scale(40), height: scale(40), borderRadius: scale(20) },
  sellerAvatarPlaceholder: {
    width: scale(40), height: scale(40), borderRadius: scale(20), alignItems: 'center', justifyContent: 'center',
  },
  sellerName: { fontSize: scale(14), fontWeight: '600' },

  actionsRow: { flexDirection: 'row', gap: scale(10), marginTop: scale(16) },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scale(6),
    paddingVertical: scale(12), borderRadius: scale(12),
  },
  actionBtnText: { fontSize: scale(13), fontWeight: '600' },
});