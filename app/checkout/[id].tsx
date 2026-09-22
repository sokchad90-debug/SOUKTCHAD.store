import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Alert, Platform, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { getSellerById } from '@/services/mockData';
import { formatPrice } from '@/constants/config';
import { COUNTRY_CITIES } from '@/constants/countries';
import { borderRadius, shadows } from '@/constants/theme';
import DisclaimerBanner from '@/components/DisclaimerBanner';
import { notifySuccess, notifyError, selection, impactLight, impactMedium } from '@/services/haptics';
import * as Clipboard from 'expo-clipboard';
import { scale } from '@/constants/responsive';

const TIMER_DURATION = 60 * 60;

export default function CheckoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    colors, t, language, placeOrder, user, paymentMethodsList, shippingCompanies,
    getProductById, getPaymentMethodsForCountry,
  } = useApp();

  const product = getProductById(id);
  // Fallback seller: construct from product data if not in mock DB
  // This handles products added by sellers not in the mock database (e.g. demo_seller)
  const seller = product
    ? (getSellerById(product.sellerId) || {
        id: product.sellerId || '',
        name: (product as any).sellerName || product.sellerId || 'Seller',
        avatar: (product as any).sellerAvatar || '',
        storeBg: '',
        sellerId: product.sellerId || '',
        isVerified: false,
        isBanned: false,
        location: product.location || "N'Djamena",
        rating: 0,
        totalSales: 0,
        joinedDate: new Date().toISOString().split('T')[0],
        phone: '',
        isOnline: false,
        paymentMethods: [],
      })
    : undefined;

  const [step, setStep] = useState<'shipping' | 'payment' | 'transfer' | 'done'>('shipping');
  const [selectedCity, setSelectedCity] = useState('');
  const selectedCountry = 'TD'; // Chad only — no country selection
  const [selectedShipping, setSelectedShipping] = useState('');
  const [selectedPayment, setSelectedPayment] = useState('');
  const [transferMessage, setTransferMessage] = useState('');
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
  const [timerActive, setTimerActive] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const lb = useCallback((en: string, fr: string, ar: string) => isFr ? fr : isAr ? ar : en, [isFr, isAr]);

  const activeShipping = useMemo(() => shippingCompanies.filter(s => s.isActive), [shippingCompanies]);

  // Fallback payment methods when seller is not in mock DB or has none configured.
  // Uses Chad's default methods so buyers can always pay.
  const sellerPayments = seller?.paymentMethods?.length
    ? seller.paymentMethods
    : [
        { methodId: 'airtel', receivingNumber: '66 12 34 56' },
        { methodId: 'moov', receivingNumber: '99 78 90 12' },
        { methodId: 'cod', receivingNumber: 'N/A' },
      ];
  // Payment methods available in the selected country (country-based filtering).
  const countryMethods = useMemo(() => getPaymentMethodsForCountry(selectedCountry), [getPaymentMethodsForCountry, selectedCountry]);
  const availableMethods = useMemo(() =>
    sellerPayments.map(sp => {
      const method = countryMethods.find(m => m.id === sp.methodId);
      return method ? { ...method, receivingNumber: sp.receivingNumber } : null;
    }).filter(Boolean) as (typeof paymentMethodsList[0] & { receivingNumber: string })[],
    [sellerPayments, countryMethods, paymentMethodsList]
  );
  const selectedMethod = availableMethods.find(m => m.id === selectedPayment);

  const hasDiscount = (product?.discountPercent ?? 0) > 0 && product?.discountUntil && new Date(product.discountUntil).getTime() > Date.now();
  const discountPercent = hasDiscount ? Math.min(30, product?.discountPercent || 0) : 0;
  const unitPrice = hasDiscount ? Math.round((product?.price || 0) * (1 - discountPercent / 100)) : (product?.price || 0);
  const totalPrice = unitPrice * quantity;

  // Max order quantity
  const maxQty = useMemo(() => {
    if (!product) return 1;
    const stockLimit = (product.stock ?? 0) > 0 ? product.stock! : 999;
    const sellerLimit = (product.maxOrderQty ?? 0) > 0 ? product.maxOrderQty! : 999;
    return Math.min(stockLimit, sellerLimit, 999);
  }, [product]);

  const incrementQty = useCallback(() => {
    if (quantity < maxQty) { impactLight(); setQuantity(prev => prev + 1); }
  }, [quantity, maxQty]);

  const decrementQty = useCallback(() => {
    if (quantity > 1) { impactLight(); setQuantity(prev => prev - 1); }
  }, [quantity]);

  useEffect(() => {
    if (!timerActive) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setTimerActive(false);
          Alert.alert(
            lb('Time Expired', 'Temps expiré', 'انتهى الوقت'),
            lb('The 1-hour payment window has expired.', 'La fenêtre de paiement a expiré.', 'انتهت فترة الدفع.'),
            [{ text: 'OK', onPress: () => router.back() }]
          );
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerActive]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const timerColor = timeLeft <= 300 ? colors.error : timeLeft <= 900 ? colors.warning : colors.success;

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await Clipboard.setStringAsync(text);
      impactLight();
      Alert.alert(lb('Copied!', 'Copié !', 'تم النسخ!'), `${label}: ${text}`);
    } catch { Alert.alert('Error', 'Could not copy'); }
  }, [lb]);

  if (user?.role === 'seller') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.blockContainer, { paddingTop: insets.top + scale(80) }]}>
          <View style={[styles.blockIcon, { backgroundColor: colors.errorLight }]}>
            <MaterialIcons name="block" size={scale(64)} color={colors.error} />
          </View>
          <Text style={[styles.blockTitle, { color: colors.textPrimary }]}>{lb('Seller Account', 'Compte Vendeur', 'حساب بائع')}</Text>
          <Text style={[styles.blockMsg, { color: colors.textSecondary }]}>{lb('Seller accounts cannot purchase items.', 'Les comptes vendeurs ne peuvent pas acheter.', 'حسابات البائعين لا يمكنها الشراء.')}</Text>
          <Pressable onPress={() => router.back()} style={[styles.doneBtn, { backgroundColor: colors.primary }]}><Text style={styles.doneBtnText}>{t('back')}</Text></Pressable>
        </View>
      </View>
    );
  }

  if (!product || !seller) {
    return (<View style={[styles.container, { backgroundColor: colors.background }]}><Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: scale(100) }}>Product not found</Text></View>);
  }

  if (orderPlaced) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.blockContainer, { paddingTop: insets.top + scale(60) }]}>
          <View style={[styles.blockIcon, { backgroundColor: colors.successLight }]}>
            <MaterialIcons name="check-circle" size={scale(64)} color={colors.success} />
          </View>
          <Text style={[styles.blockTitle, { color: colors.textPrimary }]}>{t('orderPlaced')}</Text>
          <Text style={[styles.blockMsg, { color: colors.textSecondary }]}>{lb('Your order has been sent to the seller.', 'Votre commande a été envoyée au vendeur.', 'تم إرسال طلبك إلى البائع.')}</Text>
          <View style={[styles.receipt, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.receiptRow}><Text style={[styles.receiptLabel, { color: colors.textSecondary }]}>{lb('Quantity', 'Quantité', 'الكمية')}</Text><Text style={[styles.receiptValue, { color: colors.textPrimary }]}>{quantity}</Text></View>
            <View style={styles.receiptRow}><Text style={[styles.receiptLabel, { color: colors.textSecondary }]}>{t('total')}</Text><Text style={[styles.receiptValue, { color: colors.primary }]}>{formatPrice(totalPrice)}</Text></View>
            <View style={styles.receiptRow}><Text style={[styles.receiptLabel, { color: colors.textSecondary }]}>{t('paymentMethod')}</Text><Text style={[styles.receiptValue, { color: colors.textPrimary }]}>{selectedMethod?.name || ''}</Text></View>
            <View style={styles.receiptRow}><Text style={[styles.receiptLabel, { color: colors.textSecondary }]}>{lb('Shipping', 'Livraison', 'الشحن')}</Text><Text style={[styles.receiptValue, { color: colors.textPrimary }]}>{activeShipping.find(s => s.id === selectedShipping)?.name || ''}</Text></View>
            <View style={styles.receiptRow}><Text style={[styles.receiptLabel, { color: colors.textSecondary }]}>Status</Text><View style={[styles.statusBadge, { backgroundColor: colors.warningLight }]}><Text style={[styles.statusText, { color: colors.warning }]}>{t('pending')}</Text></View></View>
          </View>
          <Pressable onPress={() => router.back()} style={[styles.doneBtn, { backgroundColor: colors.primary }]}><Text style={styles.doneBtnText}>{t('ok')}</Text></Pressable>
        </View>
      </View>
    );
  }

  const handleConfirmShipping = () => {
    if (!selectedCity.trim()) { Alert.alert(lb('City Required', 'Ville requise', 'المدينة مطلوبة')); return; }
    if (!selectedShipping) { Alert.alert(lb('Shipping Required', 'Livraison requise', 'الشحن مطلوب')); return; }
    selection(); setStep('payment');
  };

  const handleConfirmPayment = () => {
    if (!selectedPayment) { Alert.alert(lb('Payment Required', 'Paiement requis', 'الدفع مطلوب')); return; }
    selection(); setTimerActive(true); setTimeLeft(TIMER_DURATION); setStep('transfer');
  };

  const handleSubmitOrder = () => {
    if (!transferMessage.trim()) { Alert.alert(lb('Transfer message required', 'Message de transfert requis', 'رسالة التحويل مطلوبة')); return; }
    const result = placeOrder(product.id, selectedPayment, transferMessage, selectedCity, selectedShipping, quantity);
    if (!result.success) { notifyError(); Alert.alert('Error', result.error || 'Unknown error'); return; }
    notifySuccess(); setTimerActive(false); setOrderPlaced(true);
  };

  const productTitle = product.title[language] || product.title.en;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + scale(8), backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}><MaterialIcons name="close" size={scale(24)} color={colors.textPrimary} /></Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('checkout')}</Text>
        <View style={styles.stepIndicator}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[styles.stepDot, {
              backgroundColor: (i === 0) ? colors.primary : (i === 1 && (step === 'payment' || step === 'transfer')) ? colors.primary : (i === 2 && step === 'transfer') ? colors.primary : colors.border,
              width: (i === 0 && step === 'shipping') || (i === 1 && step === 'payment') || (i === 2 && step === 'transfer') ? 20 : 8,
            }]} />
          ))}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: scale(16), paddingBottom: insets.bottom + scale(120) }} showsVerticalScrollIndicator={false}>
        <DisclaimerBanner />

        {/* Product Summary */}
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }, shadows.card]}>
          <Image source={{ uri: product.images[0] }} style={styles.summaryImage} contentFit="cover" transition={200} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.summaryTitle, { color: colors.textPrimary }]} numberOfLines={2}>{productTitle}</Text>
            <Text style={[styles.summaryLocation, { color: colors.textSecondary }]}>{product.location}</Text>
            {hasDiscount ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(6), marginTop: scale(4) }}>
                <Text style={[styles.summaryPrice, { color: colors.primary }]}>{formatPrice(unitPrice)}</Text>
                <Text style={{ fontSize: scale(12), color: colors.textTertiary, textDecorationLine: 'line-through' }}>{formatPrice(product.price)}</Text>
                <View style={[styles.discountTag, { backgroundColor: '#EF4444' }]}><Text style={styles.discountTagText}>-{discountPercent}%</Text></View>
              </View>
            ) : (
              <Text style={[styles.summaryPrice, { color: colors.primary, marginTop: scale(4) }]}>{formatPrice(product.price)}</Text>
            )}
          </View>
        </View>

        {/* Quantity Selector */}
        <View style={[styles.qtyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.qtyLabel, { color: colors.textPrimary }]}>{lb('Quantity', 'Quantité', 'الكمية')}</Text>
            {maxQty < 999 ? (
              <Text style={[styles.qtyLimit, { color: colors.textTertiary }]}>
                {lb(`Max ${maxQty} per order`, `Max ${maxQty} par commande`, `الحد الأقصى ${maxQty} لكل طلب`)}
              </Text>
            ) : null}
          </View>
          <View style={styles.qtyControls}>
            <Pressable onPress={decrementQty} style={({ pressed }) => [styles.qtyBtn, { backgroundColor: quantity <= 1 ? colors.borderLight : colors.primary + '15', opacity: pressed ? 0.7 : 1 }]} disabled={quantity <= 1}>
              <MaterialIcons name="remove" size={scale(22)} color={quantity <= 1 ? colors.textTertiary : colors.primary} />
            </Pressable>
            <View style={[styles.qtyDisplay, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <Text style={[styles.qtyValue, { color: colors.textPrimary }]}>{quantity}</Text>
            </View>
            <Pressable onPress={incrementQty} style={({ pressed }) => [styles.qtyBtn, { backgroundColor: quantity >= maxQty ? colors.borderLight : colors.primary + '15', opacity: pressed ? 0.7 : 1 }]} disabled={quantity >= maxQty}>
              <MaterialIcons name="add" size={scale(22)} color={quantity >= maxQty ? colors.textTertiary : colors.primary} />
            </Pressable>
          </View>
        </View>

        {/* Timer */}
        {step === 'transfer' ? (
          <View style={[styles.timerCard, { backgroundColor: timerColor + '08', borderColor: timerColor + '30' }]}>
            <MaterialIcons name="timer" size={scale(22)} color={timerColor} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.timerLabel, { color: timerColor }]}>{lb('Complete transfer within:', 'Complétez le transfert :', 'أكمل التحويل خلال:')}</Text>
              <Text style={[styles.timerValue, { color: timerColor }]}>{formatTime(timeLeft)}</Text>
            </View>
          </View>
        ) : null}

        {/* STEP 1: Shipping */}
        {step === 'shipping' ? (
          <View>
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>{lb('DELIVERY CITY', 'VILLE DE LIVRAISON', 'مدينة التوصيل')}</Text>
            <View style={styles.cityGrid}>
              {COUNTRY_CITIES['TD'].map(city => (
                <Pressable key={city} onPress={() => { selection(); setSelectedCity(city); }}
                  style={[styles.cityChip, { backgroundColor: selectedCity === city ? colors.primary : colors.surface, borderColor: selectedCity === city ? colors.primary : colors.border }]}>
                  <Text style={[styles.cityChipText, { color: selectedCity === city ? '#FFF' : colors.textPrimary }]}>{city}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={[styles.sectionLabel, { color: colors.textTertiary, marginTop: scale(20) }]}>{lb('SHIPPING COMPANY', 'TRANSPORTEUR', 'شركة الشحن')}</Text>
            {activeShipping.length === 0 ? (
              <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <MaterialIcons name="local-shipping" size={scale(36)} color={colors.textTertiary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{lb('No shipping available', 'Aucun transporteur', 'لا يوجد شحن')}</Text>
              </View>
            ) : activeShipping.map(ship => (
              <Pressable key={ship.id} onPress={() => { selection(); setSelectedShipping(ship.id); }}
                style={[styles.shippingCard, { backgroundColor: colors.surface, borderColor: selectedShipping === ship.id ? colors.primary : colors.border, borderWidth: selectedShipping === ship.id ? 2 : 1 }]}>
                {ship.logoUrl || ship.logo_url ? (
                  <Image source={{ uri: (ship.logoUrl || ship.logo_url) as string }} style={{ width: scale(40), height: scale(40), borderRadius: scale(8) }} contentFit="cover" transition={200} />
                ) : (
                  <View style={[styles.shippingIcon, { backgroundColor: colors.primary + '12' }]}>
                    <MaterialIcons name="local-shipping" size={scale(24)} color={colors.primary} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.shippingName, { color: colors.textPrimary }]}>{ship.name}</Text>
                  <Text style={[styles.shippingPhone, { color: colors.textSecondary }]}>{ship.phone}</Text>
                  {ship.description ? <Text style={[styles.shippingDesc, { color: colors.textTertiary }]}>{ship.description}</Text> : null}
                </View>
                <View style={[styles.radio, { borderColor: selectedShipping === ship.id ? colors.primary : colors.border, backgroundColor: selectedShipping === ship.id ? colors.primary : 'transparent' }]}>
                  {selectedShipping === ship.id ? <MaterialIcons name="check" size={scale(14)} color="#FFF" /> : null}
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* STEP 2: Payment */}
        {step === 'payment' ? (
          <View>
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>{lb('SELECT PAYMENT METHOD', 'MODE DE PAIEMENT', 'طريقة الدفع')}</Text>
            {availableMethods.length === 0 ? (
              <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <MaterialIcons name="account-balance-wallet" size={scale(36)} color={colors.textTertiary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{lb('No payment methods', 'Aucun mode de paiement', 'لا توجد طرق دفع')}</Text>
              </View>
            ) : availableMethods.map(method => (
              <Pressable key={method.id} onPress={() => { selection(); setSelectedPayment(method.id); }}
                style={[styles.paymentCard, { backgroundColor: colors.surface, borderColor: selectedPayment === method.id ? colors.primary : colors.border, borderWidth: selectedPayment === method.id ? 2 : 1 }]}>
                {method.logo ? (
                  <Image source={{ uri: method.logo }} style={{ width: scale(48), height: scale(48), borderRadius: scale(12) }} contentFit="cover" />
                ) : (
                  <View style={[styles.paymentIconCircle, { backgroundColor: method.color + '15' }]}><MaterialIcons name="account-balance-wallet" size={scale(24)} color={method.color} /></View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.paymentName, { color: colors.textPrimary }]}>{method.name}</Text>
                  {method.instructions ? <Text style={[styles.paymentInstructions, { color: colors.textTertiary }]} numberOfLines={2}>{method.instructions}</Text> : null}
                </View>
                <View style={[styles.radio, { borderColor: selectedPayment === method.id ? colors.primary : colors.border, backgroundColor: selectedPayment === method.id ? colors.primary : 'transparent' }]}>
                  {selectedPayment === method.id ? <MaterialIcons name="check" size={scale(14)} color="#FFF" /> : null}
                </View>
              </Pressable>
            ))}
            <Pressable onPress={() => setStep('shipping')} style={styles.backLink}>
              <MaterialIcons name={isAr ? "arrow-forward" : "arrow-back"} size={scale(16)} color={colors.textSecondary} />
              <Text style={[styles.backLinkText, { color: colors.textSecondary }]}>{lb('Back to shipping', 'Retour', 'العودة')}</Text>
            </Pressable>
          </View>
        ) : null}

        {/* STEP 3: Transfer */}
        {step === 'transfer' ? (
          <View>
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>{lb('TOTAL AMOUNT', 'MONTANT TOTAL', 'المبلغ الإجمالي')}</Text>
            <Pressable onPress={() => copyToClipboard(String(totalPrice), lb('Amount', 'Montant', 'المبلغ'))}
              style={[styles.copyCard, { backgroundColor: colors.primary + '06', borderColor: colors.primary + '25' }]}>
              <View>
                <Text style={[styles.copyAmount, { color: colors.primary }]}>{formatPrice(totalPrice)}</Text>
                {quantity > 1 ? <Text style={{ fontSize: scale(12), color: colors.textTertiary, marginTop: scale(2) }}>{quantity} x {formatPrice(unitPrice)}</Text> : null}
              </View>
              <View style={[styles.copyBtn, { backgroundColor: colors.primary }]}><MaterialIcons name="content-copy" size={scale(18)} color="#FFF" /></View>
            </Pressable>

            <Text style={[styles.sectionLabel, { color: colors.textTertiary, marginTop: scale(16) }]}>{lb('SEND TO (SELLER NUMBER)', 'ENVOYER À', 'أرسل إلى')}</Text>
            <Pressable onPress={() => copyToClipboard(selectedMethod?.receivingNumber || '', lb('Number', 'Numéro', 'الرقم'))}
              style={[styles.copyCard, { backgroundColor: colors.verified + '06', borderColor: colors.verified + '25' }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.copyMethodName, { color: colors.textSecondary }]}>{selectedMethod?.name}</Text>
                <Text style={[styles.copyNumber, { color: colors.verified }]}>{selectedMethod?.receivingNumber}</Text>
              </View>
              <View style={[styles.copyBtn, { backgroundColor: colors.verified }]}><MaterialIcons name="content-copy" size={scale(18)} color="#FFF" /></View>
            </Pressable>

            {selectedMethod?.instructions ? (
              <View style={[styles.instructionsBox, { backgroundColor: colors.warning + '08', borderColor: colors.warning + '25' }]}>
                <MaterialIcons name="info" size={scale(16)} color={colors.warning} />
                <Text style={[styles.instructionsText, { color: colors.textSecondary }]}>{selectedMethod.instructions}</Text>
              </View>
            ) : null}

            <Text style={[styles.sectionLabel, { color: colors.textTertiary, marginTop: scale(20) }]}>{lb('PASTE TRANSFER MESSAGE', 'COLLER LE MESSAGE', 'الصق رسالة التحويل')}</Text>
            <View style={[styles.messageInputWrap, { backgroundColor: colors.surface, borderColor: transferMessage.trim() ? colors.success : colors.border, borderWidth: transferMessage.trim() ? 1.5 : 1 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(6), marginBottom: scale(6) }}>
                <MaterialIcons name="message" size={scale(16)} color={colors.primary} />
                <Text style={{ fontSize: scale(12), fontWeight: '700', color: colors.textSecondary }}>{lb('Transfer confirmation message', 'Message de confirmation', 'رسالة تأكيد التحويل')}</Text>
              </View>
              <TextInput
                value={transferMessage}
                onChangeText={setTransferMessage}
                placeholder={lb('e.g. Transfert de 450000 FCFA depuis +235 66 12 34 56, ref: TRX12345678', 'ex: Transfert de 450000 FCFA depuis +235 66 12 34 56, ref: TRX12345678', 'مثال: تحويل 450000 فرنك من +235 66 12 34 56، مرجع: TRX12345678')}
                placeholderTextColor={colors.textTertiary}
                multiline
                style={[styles.messageInput, { color: colors.textPrimary }]}
                numberOfLines={3}
              />
            </View>
            <Pressable onPress={() => { setTimerActive(false); setStep('payment'); }} style={styles.backLink}>
              <MaterialIcons name={isAr ? "arrow-forward" : "arrow-back"} size={scale(16)} color={colors.textSecondary} />
              <Text style={[styles.backLinkText, { color: colors.textSecondary }]}>{lb('Change payment', 'Changer de paiement', 'تغيير الدفع')}</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.bottomCta, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + scale(12) }, shadows.modal]}>
        <View style={styles.totalRow}>
          <View>
            <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>{t('total')} ({quantity} {lb('item', 'article', 'قطعة')}{quantity > 1 ? 's' : ''})</Text>
          </View>
          <Text style={[styles.totalAmount, { color: colors.primary }]}>{formatPrice(totalPrice)}</Text>
        </View>
        {step === 'shipping' ? (
          <Pressable onPress={handleConfirmShipping} style={({ pressed }) => [styles.ctaBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 }]}>
            <Text style={[styles.ctaBtnText]}>{lb('Continue to Payment', 'Continuer', 'المتابعة إلى الدفع')}</Text>
            <MaterialIcons name={isAr ? "arrow-back" : "arrow-forward"} size={scale(20)} color="#FFF" />
          </Pressable>
        ) : null}
        {step === 'payment' ? (
          <Pressable onPress={handleConfirmPayment} style={({ pressed }) => [styles.ctaBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 }]}>
            <Text style={styles.ctaBtnText}>{lb('Start Transfer', 'Commencer', 'بدء التحويل')}</Text>
            <MaterialIcons name={isAr ? "arrow-back" : "arrow-forward"} size={scale(20)} color="#FFF" />
          </Pressable>
        ) : null}
        {step === 'transfer' ? (
          <Pressable onPress={handleSubmitOrder} style={({ pressed }) => [styles.ctaBtn, { backgroundColor: transferMessage.trim() ? colors.success : colors.textTertiary, opacity: pressed ? 0.9 : 1 }]}>
            <MaterialIcons name="check-circle" size={scale(20)} color="#FFF" />
            <Text style={styles.ctaBtnText}>{lb('Submit Order', 'Envoyer', 'إرسال الطلب')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: scale(16), paddingBottom: scale(14), borderBottomWidth: 1 },
  headerTitle: { fontSize: scale(18), fontWeight: '700' },
  stepIndicator: { flexDirection: 'row', gap: scale(4), alignItems: 'center' },
  stepDot: { height: scale(8), borderRadius: scale(4) },
  summaryCard: { flexDirection: 'row', padding: scale(12), borderRadius: scale(14), borderWidth: 1, gap: scale(12), marginBottom: scale(8) },
  summaryImage: { width: scale(68), height: scale(68), borderRadius: scale(10) },
  summaryTitle: { fontSize: scale(14), fontWeight: '600', lineHeight: 18 },
  summaryLocation: { fontSize: scale(12), marginTop: scale(2) },
  summaryPrice: { fontSize: scale(18), fontWeight: '800' },
  discountTag: { paddingHorizontal: scale(5), paddingVertical: scale(2), borderRadius: scale(4) },
  discountTagText: { color: '#FFF', fontSize: scale(10), fontWeight: '800' },
  // Quantity
  qtyCard: { flexDirection: 'row', alignItems: 'center', padding: scale(16), borderRadius: scale(14), borderWidth: 1, marginBottom: scale(12) },
  qtyLabel: { fontSize: scale(16), fontWeight: '700' },
  qtyLimit: { fontSize: scale(12), marginTop: scale(2) },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: scale(4) },
  qtyBtn: { width: scale(44), height: scale(44), borderRadius: scale(22), alignItems: 'center', justifyContent: 'center' },
  qtyDisplay: { minWidth: scale(56), height: scale(44), borderRadius: scale(12), borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: scale(12) },
  qtyValue: { fontSize: scale(20), fontWeight: '800' },
  sectionLabel: { fontSize: scale(11), fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: scale(10), marginTop: scale(8) },
  timerCard: { flexDirection: 'row', alignItems: 'center', padding: scale(14), borderRadius: scale(14), borderWidth: 1.5, gap: scale(12), marginBottom: scale(12) },
  timerLabel: { fontSize: scale(12), fontWeight: '600' },
  timerValue: { fontSize: scale(28), fontWeight: '800', letterSpacing: 2 },
  cityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(8) },
  cityChip: { paddingHorizontal: scale(14), paddingVertical: scale(10), borderRadius: scale(10), borderWidth: 1 },
  cityChipText: { fontSize: scale(13), fontWeight: '600' },
  shippingCard: { flexDirection: 'row', alignItems: 'center', padding: scale(14), borderRadius: scale(14), marginBottom: scale(10), gap: scale(12) },
  shippingIcon: { width: scale(48), height: scale(48), borderRadius: scale(24), alignItems: 'center', justifyContent: 'center' },
  shippingName: { fontSize: scale(16), fontWeight: '700' },
  shippingPhone: { fontSize: scale(13), marginTop: scale(2) },
  shippingDesc: { fontSize: scale(12), marginTop: scale(2), lineHeight: 16 },
  paymentCard: { flexDirection: 'row', alignItems: 'center', padding: scale(14), borderRadius: scale(14), marginBottom: scale(10), gap: scale(12) },
  paymentIconCircle: { width: scale(48), height: scale(48), borderRadius: scale(24), alignItems: 'center', justifyContent: 'center' },
  paymentName: { fontSize: scale(16), fontWeight: '700' },
  paymentInstructions: { fontSize: scale(12), marginTop: scale(2), lineHeight: 16 },
  radio: { width: scale(24), height: scale(24), borderRadius: scale(12), borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  copyCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: scale(16), borderRadius: scale(14), borderWidth: 1.5 },
  copyAmount: { fontSize: scale(28), fontWeight: '800' },
  copyMethodName: { fontSize: scale(12), fontWeight: '600' },
  copyNumber: { fontSize: scale(22), fontWeight: '800', marginTop: scale(2) },
  copyBtn: { width: scale(40), height: scale(40), borderRadius: scale(20), alignItems: 'center', justifyContent: 'center' },
  instructionsBox: { flexDirection: 'row', alignItems: 'flex-start', gap: scale(8), padding: scale(12), borderRadius: scale(12), borderWidth: 1, marginTop: scale(12) },
  instructionsText: { flex: 1, fontSize: scale(12), lineHeight: 18 },
  messageInputWrap: { borderRadius: scale(12), borderWidth: 1, padding: scale(12) },
  messageInput: { fontSize: scale(14), lineHeight: 20, minHeight: scale(72), maxHeight: scale(140), textAlignVertical: 'top', padding: 0 },
  emptyBox: { alignItems: 'center', padding: scale(32), borderRadius: scale(14), borderWidth: 1, gap: scale(8) },
  emptyText: { fontSize: scale(14), textAlign: 'center' },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: scale(4), marginTop: scale(16), alignSelf: 'center' },
  backLinkText: { fontSize: scale(14), fontWeight: '500' },
  bottomCta: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: scale(16), paddingTop: scale(12), borderTopWidth: 1 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: scale(10) },
  totalLabel: { fontSize: scale(14), fontWeight: '600' },
  totalAmount: { fontSize: scale(24), fontWeight: '800' },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: scale(54), borderRadius: scale(14), gap: scale(8) },
  ctaBtnText: { color: '#FFF', fontSize: scale(17), fontWeight: '700' },
  blockContainer: { flex: 1, alignItems: 'center', paddingHorizontal: scale(24) },
  blockIcon: { width: scale(100), height: scale(100), borderRadius: scale(50), alignItems: 'center', justifyContent: 'center', marginBottom: scale(20) },
  blockTitle: { fontSize: scale(28), fontWeight: '800', marginBottom: scale(8) },
  blockMsg: { fontSize: scale(16), textAlign: 'center', lineHeight: 24, marginBottom: scale(28) },
  receipt: { width: '100%', padding: scale(12), borderRadius: scale(12), borderWidth: 1, gap: scale(8) },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  receiptLabel: { fontSize: scale(13) },
  receiptValue: { fontSize: scale(13), fontWeight: '600' },
  statusBadge: { paddingHorizontal: scale(10), paddingVertical: scale(4), borderRadius: scale(6) },
  statusText: { fontSize: scale(11), fontWeight: '700', textTransform: 'uppercase' },
  doneBtn: { width: '100%', height: scale(54), borderRadius: scale(14), alignItems: 'center', justifyContent: 'center', marginTop: scale(24) },
  doneBtnText: { color: '#FFF', fontSize: scale(17), fontWeight: '700' },
});
