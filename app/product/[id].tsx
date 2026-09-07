import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal, Alert, Share } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { getSellerById } from '@/services/mockData';
import { formatPrice } from '@/constants/config';
import { borderRadius, shadows } from '@/constants/theme';
import DisclaimerBanner from '@/components/DisclaimerBanner';
import LoginModal from '@/components/LoginModal';
import { impactLight, impactMedium, notifySuccess } from '@/services/haptics';
import * as ImagePicker from 'expo-image-picker';
import { scale, SCREEN_WIDTH } from '@/constants/responsive';

// Placeholder image shown when a similar product's image fails to load,
// so we never render a blank white card. Uses a soft brand-tinted box.
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1560248989-489534d70e6f?w=400&q=60';

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
  const { id, orderId, showReview } = useLocalSearchParams<{ id: string; orderId?: string; showReview?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, t, language, isLoggedIn, user, isFavorite, toggleFavorite, startConversation, getReviewsForProduct, markItemReceived, addReview, getProductById, getCategoryById, getProductsByCategory, getSellerById: ctxGetSellerById } = useApp();
  const [showLogin, setShowLogin] = useState(false);

  // Review form state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showReviewsSheet, setShowReviewsSheet] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewPhoto, setReviewPhoto] = useState('');
  const [reviewOrderId, setReviewOrderId] = useState('');

  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const lb = (en: string, fr: string, ar: string) => isFr ? fr : isAr ? ar : en;

  const product = getProductById(id);
  const productReviews = useMemo(() => product ? getReviewsForProduct(id) : [], [id, product, getReviewsForProduct]);

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
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [4, 3] });
    if (!result.canceled && result.assets[0]) {
      setReviewPhoto(result.assets[0].uri);
    }
  }, []);

  const handleSubmitReview = useCallback(() => {
    if (!reviewText.trim()) {
      Alert.alert(lb('Review Required', 'Avis requis', 'التقييم مطلوب'), lb('Please write a review.', 'Veuillez écrire un avis.', 'يرجى كتابة تقييم.'));
      return;
    }
    if (!product) return;
    notifySuccess();
    addReview(reviewOrderId, product.id, product.sellerId, reviewRating, reviewText.trim(), reviewPhoto || undefined);
    setShowReviewModal(false);
    setReviewText('');
    setReviewPhoto('');
    setReviewRating(5);
  }, [reviewText, reviewRating, reviewPhoto, reviewOrderId, product, addReview, lb]);

  if (!product) {
    return (
      <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={styles.notFound}><Text style={{ color: colors.textSecondary }}>Product not found</Text></View>
      </SafeAreaView>
    );
  }

  // Use seller from AppContext (real DB data) first, then fallback to mockData
  const seller = ctxGetSellerById(product.sellerId) || getSellerById(product.sellerId) || (product.sellerName ? {
    id: product.sellerId,
    name: product.sellerName,
    avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcabd9c?w=200',
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
  } : null);
  const category = getCategoryById(product.categoryId);
  const title = product.title[language] || product.title.en;
  const description = product.description[language] || product.description.en;
  // Similar products — same category only (no random cross-category items).
  const similar = useMemo(
    () => getProductsByCategory(product.categoryId).filter(p => p.id !== product.id).slice(0, 8),
    [product, getProductsByCategory],
  );
  const conditionLabel = product.condition === 'new' ? t('brandNew') : product.condition === 'like_new' ? t('likeNew') : t('used');
  const isRealEstate = product.categoryId === 'real_estate';

  const hasDiscount = (product.discountPercent ?? 0) > 0 && product.discountUntil && new Date(product.discountUntil).getTime() > Date.now();
  const discountPercent = hasDiscount ? Math.min(30, product.discountPercent || 0) : 0;
  const discountedPrice = hasDiscount ? Math.round(product.price * (1 - discountPercent / 100)) : product.price;

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
        <View style={styles.imageContainer}>
          <Image source={{ uri: product.images[0] }} style={styles.heroImage} contentFit="cover" transition={200} />
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { top: scale(8) }]}>
            <MaterialIcons name={isAr ? "arrow-forward" : "arrow-back"} size={scale(24)} color="#FFF" />
          </Pressable>
          <View style={[styles.topRightBtns, { top: scale(8) }]}>
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
          {hasDiscount ? (
            <View style={styles.discountPriceRow}>
              <Text style={[styles.price, { color: colors.primary }]}>{formatPrice(discountedPrice)}</Text>
              <View style={[styles.discountBadgeLarge, { backgroundColor: '#EF4444' }]}>
                <Text style={styles.discountBadgeLargeText}>-{discountPercent}%</Text>
              </View>
            </View>
          ) : (
            <Text style={[styles.price, { color: colors.primary }]}>{formatPrice(product.price)}</Text>
          )}
          {hasDiscount ? (
            <Text style={[styles.oldPriceDetail, { color: colors.textTertiary }]}>{formatPrice(product.price)}</Text>
          ) : null}
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>{title}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <MaterialIcons name="location-on" size={scale(16)} color={colors.textTertiary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>{product.location}</Text>
            </View>
            {/* Product rating button — replaces views, opens reviews bottom sheet */}
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
              <Text style={[styles.metaText, { color: productReviews.length > 0 ? '#F59E0B' : colors.textTertiary, fontWeight: '600' }]}>
                {productReviews.length > 0
                  ? `${avgRating.toFixed(1)} (${productReviews.length})`
                  : lb('No reviews', 'Aucun avis', 'لا تقييمات')}
              </Text>
            </Pressable>
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
          </View>

          {/* Stock / Quantity */}
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
                onPress={() => router.push(`/seller/${seller.id}`)}
                style={({ pressed }) => [styles.sellerCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.92 : 1 }, shadows.card]}
              >
                <Image source={{ uri: seller.avatar }} style={styles.sellerAvatar} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <View style={styles.sellerNameRow}>
                    <Text style={[styles.sellerName, { color: colors.textPrimary }]}>{seller.name}</Text>
                    {seller.isVerified ? (
                      <View style={[styles.verifiedBadge, { backgroundColor: colors.verified }]}>
                        <MaterialIcons name="verified" size={scale(12)} color="#FFF" />
                        <Text style={styles.verifiedText}>{t('verified')}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.sellerMeta}>
                    <MaterialIcons name="location-on" size={scale(13)} color={colors.textTertiary} />
                    <Text style={[styles.sellerMetaText, { color: colors.textSecondary }]}>{seller.location}</Text>
                    <Pressable onPress={() => router.push(`/seller/${seller.id}?tab=reviews`)} style={styles.ratingTouchable} hitSlop={8}>
                      <MaterialIcons name="star" size={scale(13)} color="#F59E0B" />
                      <Text style={[styles.sellerMetaText, { color: '#F59E0B', fontWeight: '700' }]}>{seller.rating}</Text>
                      <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={scale(14)} color="#F59E0B" />
                    </Pressable>
                  </View>
                  <Text style={[styles.sellerSales, { color: colors.textTertiary }]}>
                    {isAr ? `\u202A${seller.totalSales}\u202C عملية بيع` : `${seller.totalSales} ventes`}
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
                    {lb('Reviews', 'Avis', 'التقييمات')} ({productReviews.length})
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

                      {productReviews.map(rev => (
                        <View key={rev.id} style={{ paddingVertical: scale(12), borderTopWidth: 0.5, borderTopColor: colors.border, gap: scale(4) }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ fontSize: scale(14), fontWeight: '600', color: colors.textPrimary }} selectable={false}>{rev.buyerName}</Text>
                            <View style={{ flexDirection: 'row' }}>
                              {[1, 2, 3, 4, 5].map(s => (
                                <MaterialIcons key={s} name={s <= rev.rating ? 'star' : 'star-border'} size={scale(12)} color="#F59E0B" />
                              ))}
                            </View>
                          </View>
                          {rev.text ? <Text style={{ fontSize: scale(13), color: colors.textSecondary, lineHeight: 18 }}>{rev.text}</Text> : null}
                          {rev.photoUri ? <Image source={{ uri: rev.photoUri }} style={{ width: '100%', height: scale(120), borderRadius: scale(8), marginTop: scale(4) }} contentFit="cover" transition={200} /> : null}
                          <Text style={{ fontSize: scale(11), color: colors.textTertiary }}>{new Date(rev.createdAt).toLocaleDateString()}</Text>
                        </View>
                      ))}
                    </>
                  ) : (
                    <View style={{ alignItems: 'center', paddingVertical: scale(32), gap: scale(8) }}>
                      <MaterialIcons name="rate-review" size={scale(32)} color={colors.textTertiary} />
                      <Text style={{ fontSize: scale(14), color: colors.textTertiary }}>
                        {lb('No reviews yet', 'Aucun avis pour le moment', 'لا توجد تقييمات بعد')}
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
            {reviewPhoto ? (
              <View style={styles.reviewPhotoPreview}>
                <Image source={{ uri: reviewPhoto }} style={styles.reviewPhotoImg} contentFit="cover" transition={200} />
                <Pressable onPress={() => setReviewPhoto('')} style={[styles.removePhotoBtn, { backgroundColor: colors.errorLight }]}>
                  <MaterialIcons name="close" size={scale(16)} color={colors.error} />
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={pickReviewPhoto} style={[styles.addPhotoBtn, { borderColor: colors.border }]}>
                <MaterialIcons name="add-a-photo" size={scale(24)} color={colors.textTertiary} />
                <Text style={[styles.addPhotoText, { color: colors.textTertiary }]}>{lb('Add Photo', 'Ajouter une photo', 'إضافة صورة')}</Text>
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
  imageContainer: { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 0.85, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
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
  reviewPhotoImg: { width: '100%', height: scale(160), borderRadius: scale(12) },
  removePhotoBtn: { position: 'absolute', top: scale(8), right: scale(8), width: scale(28), height: scale(28), borderRadius: scale(14), alignItems: 'center', justifyContent: 'center' },
  addPhotoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: scale(56), borderRadius: scale(12), borderWidth: 2, borderStyle: 'dashed', gap: scale(8), marginTop: scale(4) },
  addPhotoText: { fontSize: scale(14), fontWeight: '500' },
  submitReviewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: scale(52), borderRadius: scale(12), gap: scale(8), marginTop: scale(16) },
  submitReviewText: { color: '#FFF', fontSize: scale(16), fontWeight: '700' },
});
