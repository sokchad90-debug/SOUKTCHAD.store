import React from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { Product, getSellerById } from '@/services/mockData';
import { formatPrice } from '@/constants/config';
import { shadows, borderRadius } from '@/constants/theme';
import { impactLight } from '@/services/haptics';
import { scale, normalize } from '@/constants/responsive';
import { DT } from '@/constants/designTokens';
const SHIELD_ICON = require('@/assets/images/icons/shield.png');
import { Animated } from 'react-native';

function isDiscountActive(product: Product): boolean {
  if (!product.discountPercent || product.discountPercent <= 0) return false;
  if (!product.discountUntil) return false;
  return new Date(product.discountUntil).getTime() > Date.now();
}

function getDiscountedPrice(product: Product): number {
  if (!isDiscountActive(product)) return product.price;
  const discount = Math.min(30, product.discountPercent || 0);
  return Math.round(product.price * (1 - discount / 100));
}

function useCardDimensions(imageHeightRatio: number = 1.0) {
  // CONTAINER-DERIVED width: (screen - 2*16 padding - 10 gap) / 2 — recomputed on rotation/resize
  const { width: winW } = useWindowDimensions();
  const pad = scale(16);
  const gap = scale(10);
  const cardWidth = Math.floor((winW - pad * 2 - gap) / 2);
  // SQUARE frame (owner rule): 1:1 uploads fill edge-to-edge with the ENTIRE product visible
  const imageHeight = Math.round(cardWidth * imageHeightRatio);
  return { cardWidth, imageHeight, scale, normalize };
}

interface ProductCardProps {
  product: Product;
  index?: number;
  imageHeightRatio?: number;
}

function ProductCardInner({ product, index, imageHeightRatio = 0.49 }: ProductCardProps) {
  const router = useRouter();
  const { colors, language, isFavorite, toggleFavorite } = useApp();
  const isAr = language === 'ar';
  const isDark = (colors as any).background === '#0B1120' || (colors as any).surface === '#161E2E';
  const { cardWidth: CARD_WIDTH, imageHeight: IMAGE_HEIGHT, scale: cardScale, normalize: cardFont } = useCardDimensions(imageHeightRatio);
  

  // Guard: if product is undefined/null, render nothing to prevent white screen crashes
  if (!product || !product.id) return null;

  const seller = getSellerById(product?.sellerId) || (product?.sellerName ? { id: product.sellerId, name: product.sellerName, isVerified: product.sellerVerified || false } : null);

  const title = product?.title?.[language] || product?.title?.en || '';

  const handlePress = () => {
    router.push(`/product/${product.id}`);
  };

  const [imgFailed, setImgFailed] = React.useState(false);
  const heartScale = React.useRef(new Animated.Value(1)).current;
  const handleFavorite = () => {
    impactLight();
    toggleFavorite(product.id);
    Animated.sequence([
      Animated.timing(heartScale, { toValue: 1.25, duration: 110, useNativeDriver: true }),
      Animated.spring(heartScale, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.container,
        {
          width: CARD_WIDTH,
          backgroundColor: colors.surface,
          borderColor: colors.borderLight,
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        shadows.card,
      ]}
    >
      <View style={[styles.imageContainer, { height: IMAGE_HEIGHT }]}>
        <Image
          source={{ uri: product?.images?.[0] || '' }}
          style={styles.image}
          contentFit="contain"
          transition={200}
          placeholder={colors.backgroundSecondary}
          recyclingKey={product?.id}
          onError={() => setImgFailed(true)}
        />
        {imgFailed ? (
          <View style={styles.imgFallback}>
            <MaterialIcons name="image-not-supported" size={scale(28)} color={colors.textTertiary} />
            <Text style={[styles.imgFallbackText, { color: colors.textTertiary }]}>
              {language === 'fr' ? 'Image indisponible' : language === 'ar' ? 'الصورة غير متوفرة' : 'Image unavailable'}
            </Text>
          </View>
        ) : null}
        {product.isPinned ? (
          <View style={[styles.pinnedBadge, { backgroundColor: colors.pinned }]}>
            <MaterialIcons name="push-pin" size={scale(9)} color="#FFF" />
          </View>
        ) : null}
        {seller?.isVerified ? (
          <View style={[styles.verifiedBadge, { backgroundColor: isDark ? DT.dark.verified : DT.color.verified }]}>
            <MaterialIcons name="verified" size={scale(9)} color="#FFF" />
          </View>
        ) : null}
        <Pressable
          onPress={handleFavorite}
          style={[styles.favoriteBtn, { backgroundColor: colors.overlay }]}
          hitSlop={8}
        >
          <Animated.View style={{ transform: [{ scale: heartScale }] }}>
            <MaterialIcons
              name={isFavorite(product.id) ? 'favorite' : 'favorite-border'}
              size={scale(16)}
              color={isFavorite(product.id) ? DT.color.danger : '#FFF'}
            />
          </Animated.View>
        </Pressable>
      </View>

      <View style={styles.info}>
        {isDiscountActive(product) ? (
          <View style={styles.discountRow}>
            <Text style={[styles.price, { color: colors.primary, textAlign: isAr ? 'right' : 'left', fontSize: cardFont(14) }]} numberOfLines={1}>
              {formatPrice(getDiscountedPrice(product))}
            </Text>
            <View style={[styles.discountBadge, { backgroundColor: '#EF4444' }]}>
              <Text style={[styles.discountBadgeText, { fontSize: cardFont(9) }]}>-{Math.min(30, product.discountPercent || 0)}%</Text>
            </View>
          </View>
        ) : (
          <Text style={[styles.price, { color: colors.primary, textAlign: isAr ? 'right' : 'left', fontSize: cardFont(14) }]} numberOfLines={1}>
            {formatPrice(product.price)}
          </Text>
        )}
        {isDiscountActive(product) ? (
          <Text style={[styles.oldPrice, { color: colors.textTertiary, textAlign: isAr ? 'right' : 'left', fontSize: cardFont(11) }]}>
            {formatPrice(product.price)}
          </Text>
        ) : null}
        {(product?.tagLabel || ((product?.rating ?? 0) >= 4.5 && (product?.soldCount ?? 0) >= 100)) ? (
          <View style={[styles.tagBadge, isAr && { alignSelf: 'flex-end' }]}>
            <MaterialIcons name="workspace-premium" size={scale(12)} color="#B8860B" />
            <Text style={styles.tagBadgeText}>{product.tagLabel || (language === 'fr' ? 'Top' : language === 'ar' ? 'الأكثر رواجاً' : 'Top')}</Text>
          </View>
        ) : null}
        {(product?.soldCount != null || product?.rating != null) ? (
          <View style={[styles.soldRatingRow, isAr && { flexDirection: 'row-reverse' }]}>
            {product?.soldCount != null ? (
              <Text style={[styles.soldText, { color: colors.textTertiary, fontSize: cardFont(10) }]} numberOfLines={1}>
                {product.soldCount >= 1000 ? `${(product.soldCount / 1000).toFixed(0)}K+` : product.soldCount} {language === 'fr' ? 'vendus' : language === 'ar' ? 'مبيع' : 'sold'}
              </Text>
            ) : null}
            {product?.soldCount != null && product?.rating != null ? (
              <Text style={{ color: colors.textTertiary, fontSize: cardFont(10) }}> | </Text>
            ) : null}
            {product?.rating != null ? (
              <View style={[styles.ratingInline, isAr && { flexDirection: 'row-reverse' }]}>
                <MaterialIcons name="star" size={cardScale(11)} color="#FFB400" />
                <Text style={{ color: colors.textTertiary, fontSize: cardFont(10) }}>
                  {product.rating}{product?.reviewsCount != null ? ` (${product.reviewsCount})` : ''}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
        <Text style={[styles.title, { color: colors.textPrimary, textAlign: isAr ? 'right' : 'left', fontSize: cardFont(11), lineHeight: cardFont(15) }]} numberOfLines={1} adjustsFontSizeToFit={true} minimumFontScale={0.7}>
          {title}
        </Text>
        <View style={[styles.meta, isAr && { flexDirection: 'row-reverse' }]}>
          <MaterialIcons name="location-on" size={cardScale(10)} color={colors.textSecondary} />
          <Text style={[styles.location, { color: colors.textTertiary, fontSize: cardFont(12), textAlign: isAr ? 'right' : 'left' }]} numberOfLines={1}>
            {product?.location || ''}
          </Text>
        </View>
        {product?.warrantyDays ? (
          <View style={[styles.warrantyRow, isAr && { flexDirection: 'row-reverse' }]}>
            <Image source={SHIELD_ICON} style={styles.shieldIcon} contentFit="contain" />
            <Text style={[styles.warrantyText, { color: colors.textSecondary, fontSize: cardFont(10) }]}>
              {language === 'fr' ? 'Garantie de retour' : language === 'ar' ? 'ضمان استرجاع' : 'Return guarantee'} {product.warrantyDays}{language === 'fr' ? 'j' : language === 'ar' ? 'ي' : 'd'}
            </Text>
          </View>
        ) : null}
        {product?.deliveryType === 'free' || product?.freeShipping ? (
          <View style={[styles.freeShipRow, isAr && { flexDirection: 'row-reverse' }]}>
            <MaterialIcons name="local-shipping" size={cardScale(10)} color={DT.color.success} />
            <Text style={[styles.freeShipText, { color: DT.color.success, fontSize: cardFont(10), fontWeight: '600' }]}>
              {language === 'fr' ? 'Livraison gratuite' : language === 'ar' ? 'توصيل مجاني' : 'Free delivery'}
            </Text>
          </View>
        ) : null}
        {product?.deliveryType === 'paid' && product?.deliveryFee ? (
          <View style={[styles.freeShipRow, isAr && { flexDirection: 'row-reverse' }]}>
            <MaterialIcons name="local-shipping" size={cardScale(10)} color={colors.textSecondary} />
            <Text style={{ color: colors.textTertiary, fontSize: cardFont(10) }}>
              {language === 'fr' ? 'Livraison' : language === 'ar' ? 'التوصيل' : 'Delivery'}: {formatPrice(product.deliveryFee)}
            </Text>
          </View>
        ) : null}
        {(product.stock ?? 0) > 0 ? (
          <View style={[styles.stockRow, isAr && { flexDirection: 'row-reverse' }]}>
            <MaterialIcons name="inventory" size={cardScale(9)} color={DT.color.success} />
            <Text style={[styles.stockText, { color: isDark ? DT.dark.success : DT.color.success, fontSize: cardFont(9), textAlign: isAr ? 'right' : 'left' }]}>
              {language === 'fr' ? 'En stock' : language === 'ar' ? 'متوفر' : 'In Stock'}: {product.stock}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const ProductCard = React.memo(ProductCardInner);
export default ProductCard;

const styles = StyleSheet.create({
  tagBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,180,0,0.15)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginBottom: 4 },
  tagBadgeText: { fontSize: 10, fontWeight: '700', color: '#B8860B', fontFamily: 'Cairo-Bold' },
  crownIcon: { width: 12, height: 12 },
  shieldIcon: { width: 11, height: 11 },
  soldRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 },
  soldText: { fontFamily: 'Cairo-Regular' },
  ratingInline: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  warrantyRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  warrantyText: { fontFamily: 'Cairo-Regular' },
  freeShipRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  freeShipText: { fontFamily: 'Cairo-SemiBold' },
  container: {
    borderRadius: DT.card.radius,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: scale(10),
  },
  imageContainer: {
    width: '100%',
    position: 'relative',
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imgFallback: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#F1F5F9' },
  imgFallbackText: { fontSize: scale(10), fontFamily: 'Cairo-Regular' },
  image: {
    width: '100%',
    height: '100%',
  },
  pinnedBadge: {
    position: 'absolute',
    top: scale(6),
    left: scale(6),
    width: scale(20),
    height: scale(20),
    borderRadius: scale(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedBadge: {
    position: 'absolute',
    top: scale(6),
    right: scale(34),
    width: scale(20),
    height: scale(20),
    borderRadius: scale(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteBtn: {
    position: 'absolute',
    top: scale(6),
    right: scale(6),
    width: scale(26),
    height: scale(26),
    borderRadius: scale(13),
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    paddingVertical: scale(6),
    paddingHorizontal: scale(8),
    gap: scale(2),
  },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  discountBadge: {
    paddingHorizontal: scale(4),
    paddingVertical: scale(1),
    borderRadius: scale(4),
  },
  discountBadgeText: {
    color: '#FFF',
    fontSize: scale(9),
    fontWeight: '800',
  },
  oldPrice: {
    fontSize: scale(11),
    textDecorationLine: 'line-through',
    marginTop: -1,
    fontFamily: 'Cairo-Regular',
  },
  price: {
    fontSize: scale(14),
    fontWeight: '800',
    fontFamily: 'Cairo-Bold',
    letterSpacing: -0.3,
  },
  title: {
    fontSize: scale(11),
    fontWeight: '500',
    lineHeight: 15,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(2),
    marginTop: 1,
  },
  location: {
    fontSize: scale(10),
    fontWeight: '400',
    fontFamily: 'Cairo-Regular',
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(2),
    marginTop: 1,
  },
  stockText: {
    fontSize: scale(9),
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
});
