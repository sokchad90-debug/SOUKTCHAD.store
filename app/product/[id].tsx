import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal, Alert, Share } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import TopBadge from '@/components/TopBadge';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { getSellerById } from '@/services/mockData';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatPrice } from '@/constants/config';
import { borderRadius, shadows } from '@/constants/theme';
import DisclaimerBanner from '@/components/DisclaimerBanner';
import { setPendingVariantSelection, peekPendingVariantSelection, specValue } from '@/services/mockData';
import type { ProductVariant } from '@/services/mockData';
import LoginModal from '@/components/LoginModal';
import { impactLight, impactMedium, notifySuccess, selection } from '@/services/haptics';
import * as ImagePicker from 'expo-image-picker';
import { scale, usePhoneLayout } from '@/constants/responsive';

// Placeholder image shown when a similar product's image fails to load,
// so we never render a blank white card. Uses a soft brand-tinted box.
const FALLBACK_IMAGE = 'https://souktchad.shop/dl/products/photo-1560248989-489534d70e6f.jpg';

interface SimilarCardProps {
  product: any;
  language: 'en' | 'fr' | 'ar';
  colors: any;
  onPress: () => void;
}

function SimilarProductCard({ product, language, colors, onPress }: SimilarCardProps) {
  const [imgState, setImgState] = useState<'loading' | 'ok' | 'error'>('loading');
  const imgUri = product?.images?.[0];
  const title = product?.title?.[language] || product?.title?.en || '';
  const price = product?.price ?? 0;

  // If there's no image URI at all, skip loading state — go straight to fallback.
  React.useEffect(() => {
    if (!imgUri) setImgState('error');
  }, [imgUri]);

  const showSkeleton = imgState === 'loading';
  const showFallback = imgState === 'error';
  const sourceUri = showFallback ? FALLBACK_IMAGE : imgUri;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.similarCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.similarImage}>
        {showSkeleton ? (
          // Skeleton placeholder — same size as the image, shimmering background
          <View style={{
            width: '100%',
            height: '100%',
            backgroundColor: colors.border + '40',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <MaterialIcons name="image" size={scale(28)} color={colors.border} />
          </View>
        ) : (
          <Image
            source={{ uri: sourceUri }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={200}
            onLoad={() => setImgState('ok')}
            onError={() => setImgState('error')}
          />
        )}
      </View>
      <View style={styles.similarInfo}>
        <Text style={[styles.similarPrice, { color: colors.primary }]}>{formatPrice(price)}</Text>
        <Text style={[styles.similarTitle, { color: colors.textPrimary }]} numberOfLines={1}>{title}</Text>
      </View>
    </Pressable>
  );
}

export default function ProductDetailScreen() {
  const layoutD = usePhoneLayout();
  const heroW = layoutD.windowWidth; // hero full-bleed to window (surface capped by parent on wide screens)
  const { id, orderId, showReview } = useLocalSearchParams<{ id: string; orderId?: string; showReview?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, t, language, isLoggedIn, user, isFavorite, toggleFavorite, startConversation, getReviewsForProduct, markItemReceived, addReview, getProductById, getCategoryById, getProductsByCategory, getSellerById: ctxGetSellerById } = useApp();
  const [showLogin, setShowLogin] = useState(false);

  // Review form state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showReviewsSheet, setShowReviewsSheet] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<number | 'all'>('all');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewPhoto, setReviewPhoto] = useState('');
  const [reviewPhotos, setReviewPhotos] = useState<string[]>([]);
  const [reviewOrderId, setReviewOrderId] = useState('');

  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const lb = (en: string, fr: string, ar: string) => isFr ? fr : isAr ? ar : en;

  const product = getProductById(id);

  // ─── Product variants (seller-optional) ───
  const variants: ProductVariant[] = (product?.variants as ProductVariant[]) || [];
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [variantQty, setVariantQty] = useState(1);
  // Auto-select first in-stock variant when the product changes
  React.useEffect(() => {
    const vs = (getProductById(String(id))?.variants as ProductVariant[]) || [];
    const first = vs.find(v => v.stock > 0) || null;
    setSelectedVariantId(first ? first.id : null);
    setVariantQty(1);
  }, [id, getProductById]);
  const selectedVariant = variants.find(v => v.id === selectedVariantId) || null;
  const heroUri = selectedVariant ? selectedVariant.image : product?.images?.[0] || '';
  const variantStock = selectedVariant ? selectedVariant.stock : (product?.stock ?? 0);
  const wholesale: { minQty: number; unitPrice: number; unitLabel?: { en: string; fr: string; ar: string } } | null = (product as any)?.wholesale || null;
  const productReviews = useMemo(() => product ? getReviewsForProduct(id) : [], [id, product, getReviewsForProduct]);
  const [savedSellerProfile, setSavedSellerProfile] = React.useState<any>(null);

  React.useEffect(() => {
    if (product?.sellerId) {
      AsyncStorage.getItem(`sokchad_seller_profile_${product.sellerId}`).then(data => {
        if (data) { try { setSavedSellerProfile(JSON.parse(data)); } catch {} }
      }).catch(() => {});
    }
  }, [product?.sellerId]);

  const similar = useMemo(
    () => product ? getProductsByCategory(product.categoryId).filter(p => p.id !== product.id).slice(0, 8) : [],
    [product, getProductsByCategory],
  );

  const avgRating = useMemo(() => {
    if (productReviews.length === 0) return 0;
    return productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length;
  }, [productReviews]);

  // Handle "Item Received" flow from profile
  React.useEffect(() => {
    if (showReview === 'true' && orderId) {
      markItemReceived(orderId);
      setReviewOrderId(orderId);
      setTimeout(() => setShowReviewModal(true), 500);
    }
  }, [showReview, orderId, markItemReceived]);

  const pickReviewPhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission required'); return; }
    const remaining = 4 - reviewPhotos.length;
    if (remaining <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.8,
      allowsMultipleSelection: true, selectionLimit: remaining,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets.length > 0) {
      const uris = result.assets.map(a => a.uri).slice(0, remaining);
      const next = [...reviewPhotos, ...uris];
      setReviewPhotos(next);
      setReviewPhoto(next[0]);
    }
  }, [reviewPhotos]);

  const handleSubmitReview = useCallback(() => {
    if (!reviewText.trim()) {
      Alert.alert(lb('Review Required', 'Avis requis', 'التقييم مطلوب'), lb('Please write a review.', 'Veuillez écrire un avis.', 'يرجى كتابة تقييم.'));
      return;
    }
    if (!product) return;
    notifySuccess();
    addReview(reviewOrderId, product.id, product.sellerId, reviewRating, reviewText.trim(), reviewPhotos[0] || undefined, reviewPhotos);
    setShowReviewModal(false);
    setReviewText('');
    setReviewPhoto('');
    setReviewPhotos([]);
    setReviewRating(5);
  }, [reviewText, reviewRating, reviewPhotos, reviewOrderId, product, addReview, lb]);

  if (!product) {
    return (
      <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={styles.notFound}><Text style={{ color: colors.textSecondary }}>Product not found</Text></View>
      </SafeAreaView>
    );
  }

  // Use seller from AppContext (real DB data) first, then fallback to mockData
  const seller = ctxGetSellerById(product.sellerId) || getSellerById(product.sellerId) || {
    id: product.sellerId,
    name: product.sellerName || lb('Seller', 'Vendeur', 'البائع'),
    avatar: (product as any).sellerAvatar || 'https://souktchad.shop/dl/products/photo-1599566150163-29194dcabd9c.jpg',
    sellerId: product.sellerId,
    isVerified: product.sellerVerified || false,
    location: product.location || '',
    rating: 0,
    totalSales: 0,
    email: '',
    phone: '',
    isOnline: false,
    coverImage: '',
    bio: '',
  };
  // Merge locally saved seller branding over the latest seller record.
  // Merge saved profile into seller
  const effectiveSeller = seller && savedSellerProfile
    ? { ...seller, avatar: savedSellerProfile.avatar || seller.avatar }
    : seller;
  const category = getCategoryById(product.categoryId);
  const title = product.title[language] || product.title.en;
  const description = product.description[language] || product.description.en;
  const conditionLabel = product.condition === 'new' ? t('brandNew') : product.condition === 'like_new' ? t('likeNew') : t('used');
  const isRealEstate = product.categoryId === 'real_estate';

  const topEarned = (product?.rating ?? 0) >= 4.5 && (product?.soldCount ?? 0) >= 100;
  const hasDiscount = (product.discountPercent ?? 0) > 0 && product.discountUntil && new Date(product.discountUntil).getTime() > Date.now();
  const discountPercent = hasDiscount ? Math.min(30, product.discountPercent || 0) : 0;
  const discountedPrice = hasDiscount ? Math.round(product.price * (1 - discountPercent / 100)) : product.price;

  // ─── Variant price/qty (AFTER hasDiscount/discountedPrice are defined) ───
  const qtyLimit = Math.max(1, Math.min(variantStock || 999, (product.maxOrderQty ?? 0) > 0 ? product.maxOrderQty! : 999));
  const effectiveUnit = selectedVariant
    ? (wholesale && variantQty >= wholesale.minQty ? wholesale.unitPrice : selectedVariant.price)
    : discountedPrice;
  const variantTotal = effectiveUnit * Math.max(1, Math.min(variantQty, qtyLimit));

  const isSeller = user?.role === 'seller';

  const handleShare = async () => {
    try {
      const shareMsg = language === 'fr'
        ? `Découvrez "${title}" à ${formatPrice(product.price)} sur Sokchad App — Le marché P2P du Tchad !`
        : language === 'ar'
        ? `اكتشف "${title}" بسعر ${formatPrice(product.price)} على تطبيق سوق تشاد - سوق تشاد للتجارة!`
        : `Check out "${title}" for ${formatPrice(product.price)} on Sokchad App - Chad's P2P Marketplace!`;
      await Share.share({ message: shareMsg });
    } catch (_e) { /* cancelled */ }
  };

  const handleChatWithSeller = () => {
    if (!isLoggedIn) { setShowLogin(true); return; }
    impactMedium();
    const greeting = language === 'fr' ? `Bonjour, je suis intéressé par "${title}"` : language === 'ar' ? `مرحباً، أنا مهتم بـ "${title}"` : `Hi, I am interested in "${title}"`;
    const convId = startConversation(product.sellerId, product.id, greeting);
    if (convId) router.push(`/conversation/${convId}`);
  };

  const handleLoginSuccess = () => {
    setShowLogin(false);
    const greeting = `Hi, I am interested in "${title}"`;
    const convId = startConversation(product.sellerId, product.id, greeting);
    if (convId) setTimeout(() => router.push(`/conversation/${convId}`), 300);
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 50 + 12 + 16 + 16 }} showsVerticalScrollIndicator={false}>
        {/* Hero Image */}
        <View style={[styles.imageContainer, { width: heroW, height: heroW }]}>
          <Image source={{ uri: heroUri }} style={styles.heroImage} contentFit="contain" transition={200} />
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { top: scale(8) }, isAr && { left: 'auto', right: scale(16) }]}>
            <MaterialIcons name={isAr ? "arrow-forward" : "arrow-back"} size={scale(24)} color="#FFF" />
          </Pressable>
          <View style={[styles.topRightBtns, { top: scale(8) }, isAr && { right: 'auto', left: scale(16) }]}>
            <Pressable onPress={handleShare} style={styles.topRightBtn}>
              <MaterialIcons name="share" size={scale(22)} color="#FFF" />
            </Pressable>
            <Pressable onPress={() => { impactLight(); toggleFavorite(product.id); }} style={styles.topRightBtn}>
              <MaterialIcons name={isFavorite(product.id) ? 'favorite' : 'favorite-border'} size={scale(24)} color={isFavorite(product.id) ? '#EF4444' : '#FFF'} />
            </Pressable>
          </View>
          <View style={[styles.badges, { bottom: scale(12) }]}>
            {product.isPinned ? (
              <View style={[styles.badge, { backgroundColor: '#8B5CF6' }]}>
                <MaterialIcons name="push-pin" size={scale(12)} color="#FFF" />
                <Text style={styles.badgeText}>{lb('PROMOTED', 'SPONSORISÉ', 'مميز')}</Text>
              </View>
            ) : null}
            <View style={[styles.badge, { backgroundColor: product.condition === 'new' ? '#10B981' : '#F59E0B' }]}>
              <Text style={styles.badgeText}>{conditionLabel.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          {hasDiscount && !selectedVariant ? (
            <View style={styles.discountPriceRow}>
              <Text style={[styles.price, { color: colors.primary }]}>{formatPrice(discountedPrice)}</Text>
              <View style={[styles.discountBadgeLarge, { backgroundColor: '#EF4444' }]}>
                <Text style={styles.discountBadgeLargeText}>-{discountPercent}%</Text>
              </View>
              <TopBadge earned={topEarned} />
            </View>
          ) : (
            <View style={styles.discountPriceRow}>
              <Text style={[styles.price, { color: colors.primary }]}>{formatPrice(effectiveUnit)}</Text>
              <TopBadge earned={topEarned} />
            </View>
          )}
          {hasDiscount && !selectedVariant ? (
            <Text style={[styles.oldPriceDetail, { color: colors.textTertiary }]}>{formatPrice(product.price)}</Text>
          ) : null}
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>{title}</Text>

          <View style={styles.metaRow}>
            <Pressable
              onPress={() => { impactLight(); setShowReviewsSheet(true); }}
              style={({ pressed }) => [styles.metaItem, { opacity: pressed ? 0.7 : 1 }]}
              hitSlop={8}
            >
              <MaterialIcons
                name={productReviews.length > 0 ? 'star' : 'star-border'}
                size={scale(14)}
                color={productReviews.length > 0 ? '#F59E0B' : colors.textTertiary}
              />
              <Text style={[styles.metaText, { color: (productReviews.length > 0 || (product.rating ?? 0) > 0) ? '#F59E0B' : colors.textTertiary, fontWeight: '600' }]}>
                {(productReviews.length > 0 || (product.rating ?? 0) > 0)
                  ? `${(productReviews.length > 0 ? avgRating : (product.rating ?? 0)).toFixed(1)} (${productReviews.length > 0 ? productReviews.length : (product.reviewsCount ?? 0)})`
                  : lb('No reviews', 'Aucun avis', 'لا تقييمات')}
              </Text>
            </Pressable>
            {(product.soldCount ?? 0) > 0 ? (
              <View style={[styles.metaItem]}>
                <MaterialIcons name="sell" size={scale(14)} color={colors.textTertiary} />
                <Text style={[styles.metaText, { color: colors.textSecondary, fontWeight: '600' }]}>
                  {lb(`${product.soldCount} sold`, `${product.soldCount} vendus`, `${product.soldCount} مبيع`)}
                </Text>
              </View>
            ) : null}
            <View style={styles.metaItem}>
              <MaterialIcons name="location-on" size={scale(16)} color={colors.textTertiary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>{product.location}</Text>
            </View>
            {category ? (
              <View style={[styles.catBadge, { backgroundColor: category.color + '15' }]}>
                <MaterialIcons name={category.icon as any} size={scale(14)} color={category.color} />
                <Text style={[styles.catBadgeText, { color: category.color }]}>{category.name[language] || category.name.en}</Text>
              </View>
            ) : null}
            {!isRealEstate ? (
              <View style={[styles.catBadge, { backgroundColor: product.condition === 'new' ? '#10B98115' : '#F59E0B15' }]}>
                <Text style={[styles.catBadgeText, { color: product.condition === 'new' ? '#10B981' : '#F59E0B' }]}>{conditionLabel}</Text>
              </View>
            ) : null}
            {(product.freeShipping || product.deliveryType === 'free') ? (
              <View style={[styles.catBadge, { backgroundColor: '#10B98115' }]}>
                <MaterialIcons name="local-shipping" size={scale(14)} color="#10B981" />
                <Text style={[styles.catBadgeText, { color: '#10B981' }]}>{lb('Free delivery', 'Livraison offerte', 'توصيل مجاني')}</Text>
              </View>
            ) : product.deliveryType === 'paid' && (product.deliveryFee ?? 0) > 0 ? (
              <View style={[styles.catBadge, { backgroundColor: '#F59E0B15' }]}>
                <MaterialIcons name="local-shipping" size={scale(14)} color="#F59E0B" />
                <Text style={[styles.catBadgeText, { color: '#F59E0B' }]}>{lb('Delivery', 'Livraison', 'توصيل')}: {formatPrice(product.deliveryFee ?? 0)}</Text>
              </View>
            ) : null}
          </View>

          {/* Stock / Quantity — zero stock = out of stock (real state, not missing) */}
          {(product.stock ?? 0) > 0 ? (
            <View style={[styles.stockBadge, { backgroundColor: colors.success + '10', borderColor: colors.success + '30' }]}>
              <MaterialIcons name="inventory" size={scale(16)} color={colors.success} />
              <Text style={[styles.stockBadgeText, { color: colors.success }]}>
                {lb('In Stock', 'En stock', 'متوفر')}: {product.stock}
              </Text>
              {(product.maxOrderQty ?? 0) > 0 ? (
                <Text style={{ fontSize: scale(12), color: colors.textTertiary, marginLeft: scale(8) }}>
                  {lb(`Max ${product.maxOrderQty}/order`, `Max ${product.maxOrderQty}/commande`, `الحد الأقصى ${product.maxOrderQty}/طلب`)}
                </Text>
              ) : null}
            </View>
          ) : (product.stock ?? -1) === 0 ? (
            <View style={[styles.stockBadge, { backgroundColor: colors.error + '10', borderColor: colors.error + '30' }]}>
              <MaterialIcons name="remove-shopping-cart" size={scale(16)} color={colors.error} />
              <Text style={[styles.stockBadgeText, { color: colors.error }]}>
                {lb('Out of stock', 'Rupture de stock', 'نفد المخزون')}
              </Text>
            </View>
          ) : null}

          {/* Warranty (seller-declared, when present) */}
          {(product.warrantyDays ?? 0) > 0 ? (
            <View style={[styles.stockBadge, { backgroundColor: colors.verified + '10', borderColor: colors.verified + '30' }]}>
              <MaterialIcons name="verified-user" size={scale(16)} color={colors.verified} />
              <Text style={[styles.stockBadgeText, { color: colors.verified }]}>
                {lb(`Seller warranty: ${product.warrantyDays} days`, `Garantie vendeur: ${product.warrantyDays}j`, `ضمان البائع: ${product.warrantyDays} أيام`)}
              </Text>
            </View>
          ) : null}


          {/* ─── Options disponibles (seller-enabled variants) — crash-safe: every string a single <Text> expression ─── */}
          {variants.length > 0 ? (
            <>
              <Text style={[styles.sectionLabel, { color: colors.textPrimary, textTransform: 'none', fontSize: scale(15), letterSpacing: 0 }]}>
                {lb('Available options', 'Options disponibles', 'الخيارات المتاحة')}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={scale(132) + scale(10)}
                decelerationRate="fast"
                disableIntervalMomentum={true}
                contentContainerStyle={{ gap: scale(10), paddingRight: scale(16), paddingBottom: scale(2) }}
              >
                {(isAr ? [...variants].reverse() : variants).map(v => {
                  const active = v.id === selectedVariantId;
                  const out = v.stock <= 0;
                  const specLine = v.specs.map(sp => (sp.label[language] || sp.label.en) + ' ' + specValue(sp.value, language)).join(' · ');
                  return (
                    <Pressable
                      key={v.id}
                      onPress={() => { if (!out) { selection(); setSelectedVariantId(v.id); setVariantQty(1); } }}
                      disabled={out}
                      style={({ pressed }) => [styles.variantCard, {
                        backgroundColor: colors.surface,
                        borderColor: active ? colors.primary : colors.border,
                        borderWidth: active ? 2 : 1,
                        opacity: out ? 0.4 : 1,
                      }]}
                    >
                      {active ? (
                        <View style={[styles.variantCheck, { backgroundColor: colors.primary }]}>
                          <MaterialIcons name="check" size={scale(12)} color="#FFF" />
                        </View>
                      ) : null}
                      <Image source={{ uri: v.image }} style={styles.variantImage} contentFit="contain" transition={150} />
                      <View style={styles.variantInfo}>
                        {v.specs.map((sp, idx) => (
                          <Text key={'s' + idx} style={[styles.variantSpecText, { color: idx === 0 ? colors.textPrimary : colors.textSecondary }]} numberOfLines={1}>
                            {(sp.label[language] || sp.label.en) + ' ' + specValue(sp.value, language)}
                          </Text>
                        ))}
                        <Text style={[styles.variantPrice, { color: colors.primary }]}>{formatPrice(v.price)}</Text>
                        <View style={[styles.variantStockChip, { backgroundColor: out ? colors.error + '18' : colors.success + '18' }]}>
                          <Text style={[styles.variantStockText, { color: out ? colors.error : colors.success }]}>
                            {lb('Stock', 'Stock', 'المتاح') + ' : ' + v.stock}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Selected variant summary + quantity + total */}
              <View style={[styles.variantSelCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                {selectedVariant ? (
                  <View style={styles.variantSelRow}>
                    <Image source={{ uri: selectedVariant.image }} style={styles.variantSelThumb} contentFit="contain" />
                    <View style={{ flex: 1 }}>
                      {selectedVariant.specs.map((sp, idx) => (
                        <Text key={'ss' + idx} style={[styles.variantSelSpec, { color: colors.textSecondary }]} numberOfLines={1}>
                          {(sp.label[language] || sp.label.en) + ' : ' + specValue(sp.value, language)}
                        </Text>
                      ))}
                      <Text style={[styles.variantSelPrice, { color: colors.primary }]}>{formatPrice(effectiveUnit)}</Text>
                      <Text style={{ fontSize: scale(12), color: colors.textTertiary }}>
                        {lb('Available stock', 'Stock disponible', 'المخزون المتاح') + ' : ' + variantStock}
                      </Text>
                    </View>
                    <View style={{ alignItems: isAr ? 'flex-start' : 'flex-end', gap: scale(6) }}>
                      <View style={styles.variantQtyRow}>
                        <Pressable onPress={() => { if (variantQty > 1) { impactLight(); setVariantQty(variantQty - 1); } }} disabled={variantQty <= 1} style={[styles.variantQtyBtn, { backgroundColor: variantQty <= 1 ? colors.borderLight : colors.primary + '15' }]}>
                          <MaterialIcons name="remove" size={scale(16)} color={variantQty <= 1 ? colors.textTertiary : colors.primary} />
                        </Pressable>
                        <View style={[styles.variantQtyVal, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                          <Text style={{ fontSize: scale(14), fontWeight: '700', color: colors.textPrimary }}>{variantQty}</Text>
                        </View>
                        <Pressable onPress={() => { if (variantQty < qtyLimit) { impactLight(); setVariantQty(variantQty + 1); } }} disabled={variantQty >= qtyLimit} style={[styles.variantQtyBtn, { backgroundColor: variantQty >= qtyLimit ? colors.borderLight : colors.primary + '15' }]}>
                          <MaterialIcons name="add" size={scale(16)} color={variantQty >= qtyLimit ? colors.textTertiary : colors.primary} />
                        </Pressable>
                      </View>
                      <View>
                        <Text style={{ fontSize: scale(11), color: colors.textTertiary }}>{lb('Total', 'Total', 'المجموع')}</Text>
                        <Text style={{ fontSize: scale(16), fontWeight: '800', color: colors.primary }}>{formatPrice(variantTotal)}</Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <Text style={{ fontSize: scale(13), color: colors.textTertiary }}>
                    {lb('Choose an available option', 'Choisissez une option disponible', 'اختر خيارًا متاحًا')}
                  </Text>
                )}
              </View>

              {/* Wholesale deal (seller-optional) */}
              {wholesale ? (
                <View style={[styles.wholesaleBanner, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
                  <MaterialIcons name="sell" size={scale(18)} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: scale(13), fontWeight: '700', color: colors.primary }}>
                      {lb(
                        'Bulk price from ' + wholesale.minQty + ' ' + (wholesale.unitLabel?.[language] || wholesale.unitLabel?.en || 'pcs'),
                        'Tarif de gros dès ' + wholesale.minQty + ' ' + (wholesale.unitLabel?.fr || 'pièces'),
                        'سعر الجملة من ' + wholesale.minQty + ' ' + (wholesale.unitLabel?.ar || 'قطعة')
                      )}
                    </Text>
                    <Text style={{ fontSize: scale(13), color: colors.primary }}>
                      {formatPrice(wholesale.unitPrice) + ' / ' + (wholesale.unitLabel?.[language] || wholesale.unitLabel?.en || '')}
                    </Text>
                  </View>
                </View>
              ) : null}
            </>
          ) : null}

          <DisclaimerBanner compact />

          {description && description.trim() ? (
            <>
              <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>{t('description')}</Text>
              <Text style={[styles.description, { color: colors.textPrimary }]} numberOfLines={6}>{description}</Text>
            </>
          ) : (
            <Text style={{ fontSize: scale(13), color: colors.textTertiary, fontStyle: 'italic', marginTop: scale(12), marginBottom: scale(4), textAlign: isAr ? 'right' : 'left' }}>
              {lb('No description available', 'Aucune description disponible', 'لا يوجد وصف متاح')}
            </Text>
          )}

          {seller ? (
            <>
              <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>{t('sellerInfo')}</Text>
              <Pressable
                onPress={() => router.push(`/seller/${effectiveSeller.id}`)}
                style={({ pressed }) => [styles.sellerCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.92 : 1 }, shadows.card]}
              >
                <Image source={{ uri: effectiveSeller.avatar }} style={styles.sellerAvatar} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <View style={styles.sellerNameRow}>
                    <Text style={[styles.sellerName, { color: colors.textPrimary }]}>{effectiveSeller.name}</Text>
                    {effectiveSeller.isVerified ? (
                      <View style={[styles.verifiedBadge, { backgroundColor: colors.verified }]}>
                        <MaterialIcons name="verified" size={scale(12)} color="#FFF" />
                        <Text style={styles.verifiedText}>{t('verified')}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.sellerMeta}>
                    <MaterialIcons name="location-on" size={scale(13)} color={colors.textTertiary} />
                    <Text style={[styles.sellerMetaText, { color: colors.textSecondary }]}>{effectiveSeller.location}</Text>
                    <Pressable onPress={() => router.push(`/seller/${effectiveSeller.id}?tab=reviews`)} style={styles.ratingTouchable} hitSlop={8}>
                      <MaterialIcons name="star" size={scale(13)} color="#F59E0B" />
                      <Text style={[styles.sellerMetaText, { color: '#F59E0B', fontWeight: '700' }]}>{effectiveSeller.rating}</Text>
                      <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={scale(14)} color="#F59E0B" />
                    </Pressable>
                  </View>
                  <Text style={[styles.sellerSales, { color: colors.textTertiary }]}>
                    {isAr ? `\u202A${effectiveSeller.totalSales}\u202C عملية بيع` : `${effectiveSeller.totalSales} ventes`}
                  </Text>
                </View>
                <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={scale(22)} color={colors.textTertiary} />
              </Pressable>
            </>
          ) : null}

          {/* Reviews Bottom Sheet — triggered by rating button in meta row */}
          <Modal visible={showReviewsSheet} transparent animationType="slide" onRequestClose={() => setShowReviewsSheet(false)}>
            <Pressable style={{ flex: 1, justifyContent: 'flex-end' }} onPress={() => setShowReviewsSheet(false)}>
              <Pressable style={{ backgroundColor: colors.surface, borderTopLeftRadius: scale(24), borderTopRightRadius: scale(24), maxHeight: '80%', paddingBottom: scale(24) }} onPress={e => e.stopPropagation()}>
                <View style={{ alignItems: 'center', paddingTop: scale(12), paddingBottom: scale(8) }}>
                  <View style={{ width: scale(40), height: scale(4), borderRadius: scale(2), backgroundColor: colors.border }} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: scale(20), paddingBottom: scale(12) }}>
                  <Text style={{ fontSize: scale(18), fontWeight: '700', color: colors.textPrimary }}>
                    {lb('Reviews', 'Avis', 'التقييمات')} ({Math.max(productReviews.length, (product.reviewsCount ?? 0))})
                  </Text>
                  <Pressable onPress={() => setShowReviewsSheet(false)} hitSlop={12}>
                    <MaterialIcons name="close" size={scale(24)} color={colors.textSecondary} />
                  </Pressable>
                </View>
                <ScrollView style={{ paddingHorizontal: scale(20) }} showsVerticalScrollIndicator={false}>
                  {productReviews.length > 0 ? (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(8), marginBottom: scale(12) }}>
                        <Text style={{ fontSize: scale(28), fontWeight: '800', color: colors.textPrimary }}>{avgRating.toFixed(1)}</Text>
                        <View style={{ flexDirection: 'row' }}>
                          {[1, 2, 3, 4, 5].map(s => (
                            <MaterialIcons key={s} name={s <= Math.round(avgRating) ? 'star' : 'star-border'} size={scale(18)} color="#F59E0B" />
                          ))}
                        </View>
                        <Text style={{ fontSize: scale(13), color: colors.textTertiary }}>
                          {productReviews.length} {lb('reviews', 'avis', 'تقييم')}
                        </Text>
                      </View>

                      {/* Star distribution 5 → 1 */}
                      <View style={{ marginBottom: scale(16), gap: scale(6) }}>
                        {[5, 4, 3, 2, 1].map(star => {
                          const count = productReviews.filter(r => r.rating === star).length;
                          const pct = productReviews.length > 0 ? (count / productReviews.length) * 100 : 0;
                          return (
                            <View key={star} style={{ flexDirection: 'row', alignItems: 'center', gap: scale(8) }}>
                              <Text style={{ fontSize: scale(12), color: colors.textSecondary, width: scale(20) }}>{star}★</Text>
                              <View style={{ flex: 1, height: scale(6), borderRadius: scale(3), backgroundColor: colors.border + '40' }}>
                                <View style={{ width: `${pct}%`, height: '100%', borderRadius: scale(3), backgroundColor: '#F59E0B' }} />
                              </View>
                              <Text style={{ fontSize: scale(12), color: colors.textTertiary, width: scale(24), textAlign: 'right' }}>{count}</Text>
                            </View>
                          );
                        })}
                      </View>

                      {/* Filter chips: All / 5 / 4 / 3 / 2 / 1 (like Google) */}
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: scale(8), marginBottom: scale(12) }}>
                        {([['all', lb('All', 'Tout', 'الكل')], ['5', '5'], ['4', '4'], ['3', '3'], ['2', '2'], ['1', '1']] as const).map(([key, label]) => {
                          const active = reviewFilter === (key === 'all' ? 'all' : Number(key));
                          const count = key === 'all' ? productReviews.length : productReviews.filter(r => r.rating === Number(key)).length;
                          return (
                            <Pressable
                              key={key}
                              onPress={() => setReviewFilter(key === 'all' ? 'all' : Number(key))}
                              style={{
                                flexDirection: 'row', alignItems: 'center', gap: scale(4),
                                paddingHorizontal: scale(12), paddingVertical: scale(6), borderRadius: scale(18),
                                borderWidth: 1,
                                backgroundColor: active ? colors.primary : colors.surface,
                                borderColor: active ? colors.primary : colors.border,
                              }}
                            >
                              {key !== 'all' ? <MaterialIcons name="star" size={scale(12)} color={active ? '#FFF' : '#F59E0B'} /> : null}
                              <Text style={{ fontSize: scale(12), fontWeight: '600', color: active ? '#FFF' : colors.textPrimary }}>
                                {key === 'all' ? lb('All', 'Tout', 'الكل') : key}{' '}{count}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      {(() => {
                        const filtered = reviewFilter === 'all' ? productReviews : productReviews.filter(r => r.rating === reviewFilter);
                        if (filtered.length === 0) {
                          return (
                            <View style={{ alignItems: 'center', paddingVertical: scale(24), gap: scale(6) }}>
                              <MaterialIcons name="star-border" size={scale(28)} color={colors.textTertiary} />
                              <Text style={{ fontSize: scale(13), color: colors.textTertiary }}>{lb('No reviews with this rating', 'Aucun avis pour cette note', 'لا توجد تقييمات بهذا العدد من النجوم')}</Text>
                            </View>
                          );
                        }
                        return filtered.map(rev => {
                          const photos = (rev.photoUris && rev.photoUris.length > 0) ? rev.photoUris : (rev.photoUri ? [rev.photoUri] : []);
                          const initial = (rev.buyerName || '?').trim().charAt(0).toUpperCase();
                          return (
                            <View key={rev.id} style={{ paddingVertical: scale(14), borderTopWidth: 0.5, borderTopColor: colors.border, gap: scale(6) }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(10) }}>
                                {rev.buyerAvatar ? (
                                  <Image source={{ uri: rev.buyerAvatar }} style={{ width: scale(38), height: scale(38), borderRadius: scale(19) }} contentFit="cover" transition={150} />
                                ) : (
                                  <View style={{ width: scale(38), height: scale(38), borderRadius: scale(19), backgroundColor: colors.primary + '26', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ fontSize: scale(16), fontWeight: '700', color: colors.primary, fontFamily: 'Cairo-Bold' }}>{initial}</Text>
                                  </View>
                                )}
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontSize: scale(14), fontWeight: '700', color: colors.textPrimary, fontFamily: 'Cairo-SemiBold' }} selectable={false}>{rev.buyerName}</Text>
                                  <Text style={{ fontSize: scale(11), color: colors.textTertiary }}>{new Date(rev.createdAt).toLocaleDateString(isAr ? 'ar' : isFr ? 'fr-FR' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</Text>
                                </View>
                                <View style={{ flexDirection: 'row' }}>
                                  {[1, 2, 3, 4, 5].map(s => (
                                    <MaterialIcons key={s} name={s <= rev.rating ? 'star' : 'star-border'} size={scale(14)} color="#F59E0B" />
                                  ))}
                                </View>
                              </View>
                              {rev.text ? <Text style={{ fontSize: scale(13), color: colors.textSecondary, lineHeight: 19 }}>{rev.text}</Text> : null}
                              {photos.length > 0 ? (
                                <View style={{ marginTop: scale(4) }}>
                                  <Text style={{ fontSize: scale(11), fontWeight: '600', color: colors.textTertiary, marginBottom: scale(4) }}>
                                    {lb('Purchased products', 'Produits achetés', 'المنتجات المشتراة')}
                                  </Text>
                                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: scale(8) }}>
                                    {photos.map((p, i) => (
                                      <Image key={`${p}-${i}`} source={{ uri: p }} style={{ width: scale(72), height: scale(72), borderRadius: scale(8), backgroundColor: colors.backgroundSecondary }} contentFit="cover" transition={150} />
                                    ))}
                                  </ScrollView>
                                </View>
                              ) : null}
                            </View>
                          );
                        });
                      })()}
                    </>
                  ) : (
                    <View style={{ alignItems: 'center', paddingVertical: scale(32), gap: scale(8) }}>
                      <MaterialIcons name="rate-review" size={scale(32)} color={colors.textTertiary} />
                      <Text style={{ fontSize: scale(14), color: colors.textTertiary }}>
                        {(product.rating ?? 0) > 0
                          ? lb(`Catalog rating ${product.rating} from ${product.reviewsCount ?? 0} buyers`, `Note catalogue ${product.rating} sur ${product.reviewsCount ?? 0} acheteurs`, `تقييم المنتج ${product.rating} من ${product.reviewsCount ?? 0} مشتري`)
                          : lb('No reviews yet', 'Aucun avis pour le moment', 'لا توجد تقييمات بعد')}
                      </Text>
                    </View>
                  )}
                </ScrollView>
                <Pressable onPress={() => setShowReviewsSheet(false)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: scale(20), marginTop: scale(12), paddingVertical: scale(12), borderRadius: scale(10), backgroundColor: colors.primary + '15', gap: scale(6) }}>
                  <MaterialIcons name="expand-more" size={scale(20)} color={colors.primary} />
                  <Text style={{ fontSize: scale(14), fontWeight: '700', color: colors.primary }}>
                    {lb('Hide Reviews', 'Masquer les avis', 'إخفاء التقييمات')}
                  </Text>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>

          {/* Similar Products — same category only, never render blank cards */}
          {similar.length > 0 ? (
            <>
              <Text style={[styles.sectionLabel, { color: colors.textTertiary, marginTop: scale(16), textAlign: isAr ? 'right' : 'left' }]}>{t('similarProducts')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.similarScroll}>
                {similar.map(sp => (
                  <SimilarProductCard
                    key={sp.id}
                    product={sp}
                    language={language}
                    colors={colors}
                    onPress={() => router.push(`/product/${sp.id}`)}
                  />
                ))}
              </ScrollView>
            </>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + scale(12) }, shadows.modal]}>
        <Pressable onPress={() => { impactLight(); toggleFavorite(product.id); }} style={({ pressed }) => [styles.ctaFavBtn, { borderColor: isFavorite(product.id) ? '#EF4444' : colors.border, opacity: pressed ? 0.8 : 1 }]}>
          <MaterialIcons name={isFavorite(product.id) ? 'favorite' : 'favorite-border'} size={scale(22)} color={isFavorite(product.id) ? '#EF4444' : colors.textSecondary} />
        </Pressable>
        <Pressable onPress={handleChatWithSeller} style={({ pressed }) => [styles.ctaSecondary, { borderColor: colors.primary, opacity: pressed ? 0.9 : 1 }]}>
          <MaterialIcons name="chat" size={scale(18)} color={colors.primary} />
          <Text style={[styles.ctaSecondaryText, { color: colors.primary }]}>{lb('Chat', 'Contacter', 'تواصل')}</Text>
        </Pressable>
        {!isSeller ? (
          <Pressable onPress={() => {
            if (!isLoggedIn) { setShowLogin(true); return; }
            if (variants.length > 0) {
              if (!selectedVariant) { Alert.alert(lb('Option required', 'Option requise', 'اختيار الخيار مطلوب'), lb('Please choose an available option.', 'Veuillez choisir une option disponible.', 'يرجى اختيار خيار متاح.')); return; }
              if (selectedVariant.stock <= 0) { Alert.alert(lb('Out of stock', 'Rupture de stock', 'نفد المخزون')); return; }
              if (variantQty > selectedVariant.stock) { Alert.alert(lb('Quantity exceeds stock', 'La quantité dépasse le stock', 'الكمية تتجاوز المخزون')); return; }
              setPendingVariantSelection({
                productId: product.id,
                variantId: selectedVariant.id,
                specs: selectedVariant.specs.map(sp => ({ label: sp.label[language] || sp.label.en, value: specValue(sp.value, language) })),
                image: selectedVariant.image,
                unitPrice: effectiveUnit,
                stock: selectedVariant.stock,
              });
            }
            impactMedium();
            router.push(`/checkout/${product.id}`);
          }} style={({ pressed }) => [styles.ctaPrimary, { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 }]}>
            <MaterialIcons name="shopping-cart" size={scale(18)} color="#FFF" />
            <Text style={styles.ctaPrimaryText}>{t('buyNow')}</Text>
          </Pressable>
        ) : null}
      </View>

      <LoginModal visible={showLogin} onClose={() => setShowLogin(false)} onSuccess={handleLoginSuccess} />

      {/* Review Modal */}
      <Modal visible={showReviewModal} transparent animationType="slide" onRequestClose={() => setShowReviewModal(false)}>
        <View style={[styles.reviewModalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.reviewModalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.reviewModalHeader}>
              <Text style={[styles.reviewModalTitle, { color: colors.textPrimary }]}>
                {lb('Leave a Review', 'Laisser un avis', 'اترك تقييماً')}
              </Text>
              <Pressable onPress={() => setShowReviewModal(false)} hitSlop={12}>
                <MaterialIcons name="close" size={scale(22)} color={colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={[styles.reviewModalSub, { color: colors.textSecondary }]}>
              {lb('Rate your experience and help other buyers.', 'Évaluez votre expérience et aidez les autres acheteurs.', 'قيّم تجربتك وساعد المشترين الآخرين.')}
            </Text>

            <Text style={[styles.reviewFieldLabel, { color: colors.textSecondary }]}>
              {lb('RATING', 'NOTE', 'التقييم')}
            </Text>
            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map(s => (
                <Pressable key={s} onPress={() => setReviewRating(s)} hitSlop={6}>
                  <MaterialIcons name={s <= reviewRating ? 'star' : 'star-border'} size={scale(36)} color="#F59E0B" />
                </Pressable>
              ))}
            </View>

            <Text style={[styles.reviewFieldLabel, { color: colors.textSecondary }]}>
              {lb('YOUR REVIEW', 'VOTRE AVIS', 'تقييمك')}
            </Text>
            <TextInput
              style={[styles.reviewInput, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: colors.border }]}
              placeholder={lb('Write about your experience...', 'Écrivez votre expérience...', 'اكتب عن تجربتك...')}
              placeholderTextColor={colors.textTertiary}
              value={reviewText}
              onChangeText={setReviewText}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <Text style={[styles.reviewFieldLabel, { color: colors.textSecondary }]}>
              {lb('PHOTO PROOF (Optional)', 'PHOTO (Optionnel)', 'صورة إثبات (اختياري)')}
            </Text>
            {reviewPhotos.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: scale(8) }}>
                {reviewPhotos.map((uri, i) => (
                  <View key={`${uri}-${i}`} style={styles.reviewPhotoPreview}>
                    <Image source={{ uri }} style={{ width: scale(84), height: scale(84), borderRadius: scale(10) }} contentFit="cover" transition={200} />
                    <Pressable
                      onPress={() => {
                        const next = reviewPhotos.filter((_, j) => j !== i);
                        setReviewPhotos(next);
                        setReviewPhoto(next[0] || '');
                      }}
                      style={[styles.removePhotoBtn, { backgroundColor: colors.errorLight, position: 'absolute', top: scale(4), right: scale(4) }]}
                    >
                      <MaterialIcons name="close" size={scale(14)} color={colors.error} />
                    </Pressable>
                  </View>
                ))}
                {reviewPhotos.length < 4 ? (
                  <Pressable onPress={pickReviewPhoto} style={[styles.addPhotoBtnSmall, { borderColor: colors.border }]}>
                    <MaterialIcons name="add-a-photo" size={scale(22)} color={colors.textTertiary} />
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <Pressable onPress={pickReviewPhoto} style={[styles.addPhotoBtn, { borderColor: colors.border }]}>
                <MaterialIcons name="add-a-photo" size={scale(24)} color={colors.textTertiary} />
                <Text style={[styles.addPhotoText, { color: colors.textTertiary }]}>{lb('Add Photos (up to 4)', 'Ajouter des photos (max 4)', 'أضف صوراً (حتى 4)')}</Text>
              </Pressable>
            )}

            <Pressable onPress={handleSubmitReview} style={({ pressed }) => [styles.submitReviewBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 }]}>
              <MaterialIcons name="send" size={scale(18)} color="#FFF" />
              <Text style={styles.submitReviewText}>{lb('Submit Review', 'Envoyer', 'إرسال التقييم')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  imageContainer: { position: 'relative' },
  heroImage: { width: '100%', height: '100%', backgroundColor: '#FFFFFF' },
  backBtn: { position: 'absolute', left: scale(16), width: scale(40), height: scale(40), borderRadius: scale(20), backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  topRightBtns: { position: 'absolute', right: scale(16), flexDirection: 'row', gap: scale(8) },
  topRightBtn: { width: scale(40), height: scale(40), borderRadius: scale(20), backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  badges: { position: 'absolute', left: scale(12), flexDirection: 'row', gap: scale(6) },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(8), paddingVertical: scale(4), borderRadius: scale(6), gap: scale(4) },
  badgeText: { color: '#FFF', fontSize: scale(10), fontWeight: '700', letterSpacing: 0.5 },
  content: { padding: scale(16) },
  discountPriceRow: { flexDirection: 'row', alignItems: 'center', gap: scale(10), marginBottom: scale(4) },
  discountBadgeLarge: { paddingHorizontal: scale(8), paddingVertical: scale(4), borderRadius: scale(6) },
  discountBadgeLargeText: { color: '#FFF', fontSize: scale(14), fontWeight: '800' },
  oldPriceDetail: { fontSize: scale(18), textDecorationLine: 'line-through', marginBottom: scale(4) },
  price: { fontSize: scale(32), fontWeight: '800', marginBottom: scale(4) },
  title: { fontSize: scale(20), fontWeight: '600', lineHeight: 26, marginBottom: scale(10) },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: scale(12), marginBottom: scale(16) },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: scale(4) },
  metaText: { fontSize: scale(13) },
  catBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(8), paddingVertical: scale(4), borderRadius: scale(6), gap: scale(4) },
  catBadgeText: { fontSize: scale(12), fontWeight: '600' },
  sectionLabel: { fontSize: scale(12), fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: scale(8), marginTop: scale(16) },
  description: { fontSize: scale(15), lineHeight: 23 },
  sellerCard: { flexDirection: 'row', padding: scale(9), borderRadius: borderRadius.md, borderWidth: 1, gap: scale(10), alignItems: 'center' } as any,
  sellerAvatar: { width: scale(45), height: scale(45), borderRadius: scale(23) },
  sellerNameRow: { flexDirection: 'row', alignItems: 'center', gap: scale(6), flexWrap: 'wrap' },
  sellerName: { fontSize: scale(16), fontWeight: '700', flexShrink: 1 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(6), paddingVertical: scale(2), borderRadius: scale(4), gap: scale(3) },
  verifiedText: { color: '#FFF', fontSize: scale(10), fontWeight: '700' },
  sellerMeta: { flexDirection: 'row', alignItems: 'center', marginTop: scale(3) },
  sellerMetaText: { fontSize: scale(13), marginLeft: scale(2) },
  sellerSales: { fontSize: scale(12), marginTop: scale(1) },
  ratingTouchable: { flexDirection: 'row', alignItems: 'center', marginLeft: scale(8), gap: scale(2) },
  reviewsSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  seeAllReviews: { flexDirection: 'row', alignItems: 'center', gap: scale(2), paddingBottom: scale(2) },
  seeAllReviewsText: { fontSize: scale(13), fontWeight: '600' },
  // Reviews
  reviewsSummary: { gap: scale(10) },
  avgRatingRow: { flexDirection: 'row', alignItems: 'center', gap: scale(10), marginBottom: scale(4) },
  avgRatingValue: { fontSize: scale(28), fontWeight: '800' },
  starsRow: { flexDirection: 'row' },
  reviewItem: { borderBottomWidth: 1, paddingBottom: scale(12), gap: scale(4) },
  reviewItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewItemName: { fontSize: scale(14), fontWeight: '600' },
  starsRowSmall: { flexDirection: 'row' },
  reviewItemText: { fontSize: scale(14), lineHeight: 20 },
  reviewItemPhoto: { width: '100%', height: scale(140), borderRadius: scale(8), marginTop: scale(4) },
  reviewItemDate: { fontSize: scale(11) },
  noReviewsBox: { alignItems: 'center', paddingVertical: scale(16), gap: scale(6), height: scale(110), justifyContent: 'center' },
  noReviewsText: { fontSize: scale(14) },
  // Similar
  similarScroll: { gap: scale(12), paddingRight: scale(16) },
  similarCard: { width: scale(150), borderRadius: borderRadius.md, overflow: 'hidden', borderWidth: 1 },
  similarImage: { width: scale(150), height: scale(110) },
  similarInfo: { padding: scale(8) },
  similarPrice: { fontSize: scale(14), fontWeight: '700' },
  similarTitle: { fontSize: scale(12), marginTop: scale(2) },
  // Variants
  variantCard: { width: scale(150), borderRadius: scale(12), borderWidth: 1, overflow: 'hidden' },
  variantCheck: { position: 'absolute', top: scale(6), right: scale(6), width: scale(20), height: scale(20), borderRadius: scale(10), alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  variantImage: { width: '100%', height: scale(92), backgroundColor: '#F6F6FB' },
  variantInfo: { padding: scale(8), gap: scale(2) },
  variantSpecText: { fontSize: scale(12) },
  variantPrice: { fontSize: scale(13), fontWeight: '800', marginTop: scale(2) },
  variantStockChip: { alignSelf: 'flex-start', paddingHorizontal: scale(8), paddingVertical: scale(3), borderRadius: scale(6), marginTop: scale(3) },
  variantStockText: { fontSize: scale(11), fontWeight: '700' },
  variantSelCard: { borderRadius: scale(12), borderWidth: 1, padding: scale(12), marginTop: scale(12) },
  variantSelRow: { flexDirection: 'row', alignItems: 'center', gap: scale(10) },
  variantSelThumb: { width: scale(56), height: scale(56), borderRadius: scale(8), backgroundColor: '#F6F6FB' },
  variantSelSpec: { fontSize: scale(12) },
  variantSelPrice: { fontSize: scale(15), fontWeight: '800', marginTop: scale(2) },
  variantQtyRow: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
  variantQtyBtn: { width: scale(30), height: scale(30), borderRadius: scale(8), alignItems: 'center', justifyContent: 'center' },
  variantQtyVal: { minWidth: scale(36), height: scale(30), borderRadius: scale(8), borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: scale(6) },
  wholesaleBanner: { flexDirection: 'row', alignItems: 'center', gap: scale(10), padding: scale(12), borderRadius: scale(12), borderWidth: 1, marginTop: scale(10) },
  // Bottom bar
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', paddingHorizontal: scale(16), paddingTop: scale(12), borderTopWidth: 1, gap: scale(10) },
  ctaFavBtn: { width: scale(50), height: scale(50), borderRadius: borderRadius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  ctaSecondary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: scale(50), borderRadius: borderRadius.md, borderWidth: 1.5, gap: scale(4) },
  ctaSecondaryText: { fontSize: scale(14), fontWeight: '700' },
  ctaPrimary: { flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: scale(50), borderRadius: borderRadius.md, gap: scale(6) },
  stockBadge: { flexDirection: 'row', alignItems: 'center', gap: scale(8), paddingHorizontal: scale(14), paddingVertical: scale(10), borderRadius: borderRadius.md, borderWidth: 1, marginBottom: scale(8) },
  stockBadgeText: { fontSize: scale(14), fontWeight: '700' },
  ctaPrimaryText: { color: '#FFF', fontSize: scale(15), fontWeight: '700' },
  // Review Modal
  reviewModalOverlay: { flex: 1, justifyContent: 'flex-end' },
  reviewModalContent: { borderTopLeftRadius: scale(24), borderTopRightRadius: scale(24), padding: scale(24), maxHeight: '85%' },
  reviewModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: scale(4) },
  reviewModalTitle: { fontSize: scale(20), fontWeight: '700' },
  reviewModalSub: { fontSize: scale(14), lineHeight: 20, marginBottom: scale(16) },
  reviewFieldLabel: { fontSize: scale(11), fontWeight: '700', letterSpacing: 0.8, marginBottom: scale(6), marginTop: scale(10) },
  ratingRow: { flexDirection: 'row', gap: scale(8), marginBottom: scale(8) },
  reviewInput: { height: scale(100), borderRadius: scale(12), borderWidth: 1, paddingHorizontal: scale(16), paddingTop: scale(14), fontSize: scale(15), textAlignVertical: 'top' },
  reviewPhotoPreview: { position: 'relative', marginTop: scale(4) },
  addPhotoBtnSmall: { width: scale(84), height: scale(84), borderRadius: scale(10), borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginTop: scale(4) },
  reviewPhotoImg: { width: '100%', height: scale(160), borderRadius: scale(12) },
  removePhotoBtn: { position: 'absolute', top: scale(8), right: scale(8), width: scale(28), height: scale(28), borderRadius: scale(14), alignItems: 'center', justifyContent: 'center' },
  addPhotoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: scale(56), borderRadius: scale(12), borderWidth: 2, borderStyle: 'dashed', gap: scale(8), marginTop: scale(4) },
  addPhotoText: { fontSize: scale(14), fontWeight: '500' },
  submitReviewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: scale(52), borderRadius: scale(12), gap: scale(8), marginTop: scale(16) },
  submitReviewText: { color: '#FFF', fontSize: scale(16), fontWeight: '700' },
});
