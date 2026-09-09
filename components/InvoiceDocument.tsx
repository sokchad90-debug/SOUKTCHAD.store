import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { formatPrice, DISCLAIMER_TEXT } from '@/constants/config';
import { scale, SCREEN_WIDTH } from '@/constants/responsive';

// Fixed professional palette — the invoice is always light/print-friendly,
// independent of the app's dark mode.
const INK = {
  brand: '#6366F1',
  brandDark: '#4F46E5',
  text: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#64748B',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  bg: '#FFFFFF',
  bgSoft: '#F8FAFC',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  verified: '#3B82F6',
};

export interface InvoiceDocumentProps {
  transactionNumber: string;
  dateLabel: string;
  productTitle: string;
  productImage: string;
  price: number;
  quantity: number;
  shippingLabel: string;
  total: number;
  sellerName: string;
  sellerVerified: boolean;
  sellerAvatar?: string;
  storeBg?: string;
  buyerName: string;
  statusLabel: string;
  statusColor: string;
  isAr: boolean;
  isFr: boolean;
}

const L = {
  invoice: { en: 'INVOICE', fr: 'FACTURE', ar: 'فاتورة' },
  marketplace: { en: 'Marketplace', fr: 'Place de marché', ar: 'سوق إلكتروني' },
  invoiceNo: { en: 'Invoice #', fr: 'Facture n°', ar: 'رقم الفاتورة' },
  date: { en: 'Date', fr: 'Date', ar: 'التاريخ' },
  status: { en: 'Status', fr: 'Statut', ar: 'الحالة' },
  product: { en: 'Product', fr: 'Produit', ar: 'المنتج' },
  quantity: { en: 'Quantity', fr: 'Quantité', ar: 'الكمية' },
  shipping: { en: 'Shipping', fr: 'Livraison', ar: 'التوصيل' },
  total: { en: 'Total', fr: 'Total', ar: 'الإجمالي' },
  seller: { en: 'Seller', fr: 'Vendeur', ar: 'البائع' },
  buyer: { en: 'Buyer', fr: 'Acheteur', ar: 'المشتري' },
  verified: { en: 'Verified', fr: 'Vérifié', ar: 'موثوق' },
  thankYou: { en: 'Thank you for shopping with Sokchad!', fr: 'Merci pour votre achat sur Sokchad !', ar: 'شكراً لتسوقك مع سوكشاد!' },
  disclaimer: {
    en: 'Sokchad is a display platform only. Payments are handled directly between buyer and seller.',
    fr: 'Sokchad est uniquement une plateforme d\'affichage. Les paiements se font directement entre acheteur et vendeur.',
    ar: 'سوكشاد منصة عرض فقط. تتم المدفوعات مباشرة بين المشتري والبائع.',
  },
};

export default function InvoiceDocument(props: InvoiceDocumentProps) {
  const { isAr, isFr } = props;
  const t = (key: keyof typeof L) => {
    // Disclaimer comes from central config — admin can update it in one place
    if (key === 'disclaimer') {
      const lang = isFr ? 'fr' : isAr ? 'ar' : 'en';
      return DISCLAIMER_TEXT[lang];
    }
    const v = L[key];
    return isFr ? v.fr : isAr ? v.ar : v.en;
  };
  const align = isAr ? 'right' : 'left';
  const rowDir = isAr ? 'row-reverse' : 'row';

  return (
    <View style={[styles.doc, { width: SCREEN_WIDTH }]}>
      {/* ─── Brand header ─── */}
      <View style={styles.header}>
        <View style={[styles.headerRow, { flexDirection: rowDir }]}>
          <View style={[styles.brandBlock, { flexDirection: rowDir, alignItems: 'center' }]}>
            <View style={styles.logoBadge}>
              <MaterialIcons name="storefront" size={scale(22)} color="#FFFFFF" />
            </View>
            <View style={{ alignItems: isAr ? 'flex-end' : 'flex-start' }}>
              <Text style={styles.brand}>Sokchad</Text>
              <Text style={styles.brandSub}>{t('marketplace')}</Text>
            </View>
          </View>
          <View style={styles.invoiceBadge}>
            <Text style={styles.invoiceBadgeText}>{t('invoice')}</Text>
          </View>
        </View>
      </View>

      {/* ─── Store banner ─── */}
      {props.storeBg ? (
        <View style={styles.storeBanner}>
          <Image source={{ uri: props.storeBg }} style={styles.storeBannerImage} contentFit="cover" />
          <View style={styles.storeBannerOverlay} />
          <View style={[styles.storeBannerLabel, { flexDirection: rowDir, alignItems: 'center' }]}>
            <MaterialIcons name="store" size={scale(14)} color="#FFFFFF" />
            <Text style={styles.storeBannerText} numberOfLines={1}>{props.sellerName}</Text>
          </View>
        </View>
      ) : null}

      {/* ─── Meta: invoice #, date, status ─── */}
      <View style={styles.metaBlock}>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>{t('invoiceNo')}</Text>
          <Text style={styles.metaValue} numberOfLines={1}>{props.transactionNumber}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>{t('date')}</Text>
          <Text style={styles.metaValue}>{props.dateLabel}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>{t('status')}</Text>
          <View style={[styles.statusPill, { backgroundColor: props.statusColor + '1A' }]}>
            <View style={[styles.statusDot, { backgroundColor: props.statusColor }]} />
            <Text style={[styles.statusText, { color: props.statusColor }]}>{props.statusLabel}</Text>
          </View>
        </View>
      </View>

      {/* ─── Product ─── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('product')}</Text>
        <View style={[styles.productRow, { flexDirection: rowDir }]}>
          {props.productImage ? (
            <Image source={{ uri: props.productImage }} style={styles.productImage} contentFit="cover" />
          ) : (
            <View style={[styles.productImage, styles.productImagePlaceholder]}>
              <MaterialIcons name="inventory" size={scale(24)} color={INK.textTertiary} />
            </View>
          )}
          <View style={{ flex: 1, alignItems: isAr ? 'flex-end' : 'flex-start' }}>
            <Text style={[styles.productName, { textAlign: align }]} numberOfLines={2}>{props.productTitle}</Text>
            <Text style={styles.productPrice}>{formatPrice(props.price)}</Text>
          </View>
        </View>
      </View>

      {/* ─── Totals ─── */}
      <View style={styles.section}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t('quantity')}</Text>
          <Text style={styles.totalValue}>{props.quantity}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t('shipping')}</Text>
          <Text style={styles.totalValue}>{props.shippingLabel}</Text>
        </View>
        <View style={[styles.totalRow, styles.grandTotalRow]}>
          <Text style={styles.grandTotalLabel}>{t('total')}</Text>
          <Text style={styles.grandTotalValue}>{formatPrice(props.total)}</Text>
        </View>
      </View>

      {/* ─── Parties: seller + buyer ─── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('seller')}</Text>
        <View style={[styles.partyRow, { flexDirection: rowDir }]}>
          {props.sellerAvatar ? (
            <Image source={{ uri: props.sellerAvatar }} style={styles.partyAvatarImg} contentFit="cover" />
          ) : (
            <View style={styles.partyAvatar}>
              <MaterialIcons name="store" size={scale(18)} color={INK.brand} />
            </View>
          )}
          <View style={{ flex: 1, alignItems: isAr ? 'flex-end' : 'flex-start' }}>
            <Text style={styles.partyName}>{props.sellerName}</Text>
            {props.sellerVerified ? (
              <View style={[styles.verifiedRow, { flexDirection: rowDir }]}>
                <MaterialIcons name="verified" size={scale(12)} color={INK.verified} />
                <Text style={styles.verifiedText}>{t('verified')}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {props.buyerName ? (
          <>
            <Text style={[styles.sectionTitle, { marginTop: scale(12) }]}>{t('buyer')}</Text>
            <View style={[styles.partyRow, { flexDirection: rowDir }]}>
              <View style={styles.partyAvatar}>
                <MaterialIcons name="person" size={scale(18)} color={INK.brand} />
              </View>
              <View style={{ flex: 1, alignItems: isAr ? 'flex-end' : 'flex-start' }}>
                <Text style={styles.partyName}>{props.buyerName}</Text>
              </View>
            </View>
          </>
        ) : null}
      </View>

      {/* ─── Footer ─── */}
      <View style={styles.footer}>
        <Text style={styles.thankYou}>{t('thankYou')}</Text>
        <Text style={styles.disclaimer}>{t('disclaimer')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  doc: {
    backgroundColor: INK.bg,
    paddingBottom: scale(24),
  },
  header: {
    backgroundColor: INK.brand,
    paddingHorizontal: scale(20),
    paddingVertical: scale(20),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandBlock: {
    gap: scale(10),
  },
  logoBadge: {
    width: scale(42),
    height: scale(42),
    borderRadius: scale(12),
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeBanner: {
    position: 'relative',
    height: scale(72),
    overflow: 'hidden',
  },
  storeBannerImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  storeBannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  storeBannerLabel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: scale(20),
    gap: scale(6),
  },
  storeBannerText: {
    fontSize: scale(14),
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Cairo-Bold',
    flexShrink: 1,
  },
  brand: {
    fontSize: scale(26),
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Cairo-Bold',
  },
  brandSub: {
    fontSize: scale(12),
    fontWeight: '600',
    color: '#FFFFFFCC',
    fontFamily: 'Cairo-Medium',
    marginTop: scale(2),
  },
  invoiceBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: scale(14),
    paddingVertical: scale(8),
    borderRadius: scale(10),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  invoiceBadgeText: {
    fontSize: scale(14),
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.5,
    fontFamily: 'Cairo-Bold',
  },
  metaBlock: {
    paddingHorizontal: scale(20),
    paddingVertical: scale(16),
    borderBottomWidth: 1,
    borderBottomColor: INK.border,
    gap: scale(10),
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaLabel: {
    fontSize: scale(12),
    fontWeight: '600',
    color: INK.textTertiary,
    fontFamily: 'Cairo-SemiBold',
  },
  metaValue: {
    fontSize: scale(13),
    fontWeight: '700',
    color: INK.text,
    fontFamily: 'Cairo-SemiBold',
    flexShrink: 1,
    marginLeft: scale(12),
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
    borderRadius: 9999,
    gap: scale(5),
  },
  statusDot: {
    width: scale(7),
    height: scale(7),
    borderRadius: scale(4),
  },
  statusText: {
    fontSize: scale(11),
    fontWeight: '800',
    fontFamily: 'Cairo-Bold',
  },
  section: {
    paddingHorizontal: scale(20),
    paddingTop: scale(16),
  },
  sectionTitle: {
    fontSize: scale(11),
    fontWeight: '700',
    color: INK.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: scale(10),
    fontFamily: 'Cairo-SemiBold',
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  productImage: {
    width: scale(60),
    height: scale(60),
    borderRadius: scale(10),
  },
  productImagePlaceholder: {
    backgroundColor: INK.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productName: {
    fontSize: scale(14),
    fontWeight: '600',
    color: INK.text,
    fontFamily: 'Cairo-SemiBold',
  },
  productPrice: {
    fontSize: scale(14),
    fontWeight: '800',
    color: INK.brand,
    marginTop: scale(4),
    fontFamily: 'Cairo-Bold',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: scale(7),
  },
  totalLabel: {
    fontSize: scale(13),
    fontWeight: '500',
    color: INK.textSecondary,
    fontFamily: 'Cairo-Regular',
  },
  totalValue: {
    fontSize: scale(13),
    fontWeight: '600',
    color: INK.text,
    fontFamily: 'Cairo-SemiBold',
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: INK.border,
    marginTop: scale(6),
    paddingTop: scale(12),
  },
  grandTotalLabel: {
    fontSize: scale(15),
    fontWeight: '800',
    color: INK.text,
    fontFamily: 'Cairo-Bold',
  },
  grandTotalValue: {
    fontSize: scale(17),
    fontWeight: '800',
    color: INK.brand,
    fontFamily: 'Cairo-Bold',
  },
  partyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
  },
  partyAvatar: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(19),
    backgroundColor: INK.brand + '1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  partyAvatarImg: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(19),
    borderWidth: 1,
    borderColor: INK.border,
  },
  partyName: {
    fontSize: scale(14),
    fontWeight: '600',
    color: INK.text,
    fontFamily: 'Cairo-SemiBold',
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(3),
    marginTop: scale(2),
  },
  verifiedText: {
    fontSize: scale(10),
    fontWeight: '600',
    color: INK.verified,
    fontFamily: 'Cairo-Regular',
  },
  footer: {
    marginTop: scale(20),
    paddingTop: scale(16),
    paddingHorizontal: scale(20),
    borderTopWidth: 1,
    borderTopColor: INK.border,
    alignItems: 'center',
    gap: scale(6),
  },
  thankYou: {
    fontSize: scale(13),
    fontWeight: '700',
    color: INK.text,
    textAlign: 'center',
    fontFamily: 'Cairo-SemiBold',
  },
  disclaimer: {
    fontSize: scale(10),
    fontWeight: '400',
    color: INK.textTertiary,
    textAlign: 'center',
    fontFamily: 'Cairo-Regular',
  },
});
