import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { Product, getSellerById } from '@/services/mockData';
import { formatPrice } from '@/constants/config';
import { shadows, borderRadius } from '@/constants/theme';
import { impactLight } from '@/services/haptics';
import { scale, normalize, CARD_WIDTH } from '@/constants/responsive';

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

function useCardDimensions(imageHeightRatio: number = 0.65) {
  const cardWidth = CARD_WIDTH;
  const imageHeight = cardWidth * imageHeightRatio;
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
  const { cardWidth: CARD_WIDTH, imageHeight: IMAGE_HEIGHT, scale: cardScale, normalize: cardFont } = useCardDimensions(imageHeightRatio);
  

  // Guard: if product is undefined/null, render nothing to prevent white screen crashes
  if (!product || !product.id) return null;

  const seller = getSellerById(product?.sellerId) || (product?.sellerName ? { id: product.sellerId, name: product.sellerName, isVerified: product.sellerVerified || false } : null);

  const title = product?.title?.[language] || product?.title?.en || '';

  const handlePress = () => {
    router.push(`/product/${product.id}`);
  };

  const handleFavorite = () => {
    impactLight();
    toggleFavorite(product.id);
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
          contentFit="cover"
          transition={200}
          placeholder={colors.backgroundSecondary}
          recyclingKey={product?.id}
        />
        {product.isPinned ? (
          <View style={[styles.pinnedBadge, { backgroundColor: colors.pinned }]}>
            <MaterialIcons name="push-pin" size={scale(9)} color="#FFF" />
          </View>
        ) : null}
        {seller?.isVerified ? (
          <View style={[styles.verifiedBadge, { backgroundColor: colors.verified }]}>
            <MaterialIcons name="verified" size={scale(9)} color="#FFF" />
          </View>
        ) : null}
        <Pressable
          onPress={handleFavorite}
          style={[styles.favoriteBtn, { backgroundColor: colors.overlay }]}
          hitSlop={8}
        >
          <MaterialIcons
            name={isFavorite(product.id) ? 'favorite' : 'favorite-border'}
            size={scale(16)}
            color={isFavorite(product.id) ? '#EF4444' : '#FFF'}
          />
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
        <Text style={[styles.title, { color: colors.textPrimary, textAlign: isAr ? 'right' : 'left', fontSize: cardFont(11), lineHeight: cardFont(15) }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={[styles.meta, isAr && { flexDirection: 'row-reverse' }]}>
          <MaterialIcons name="location-on" size={cardScale(10)} color={colors.textSecondary} />
          <Text style={[styles.location, { color: colors.textTertiary, fontSize: cardFont(10), textAlign: isAr ? 'right' : 'left' }]} numberOfLines={1}>
            {product?.location || ''}
          </Text>
        </View>
        {(product.stock ?? 0) > 0 ? (
          <View style={[styles.stockRow, isAr && { flexDirection: 'row-reverse' }]}>
            <MaterialIcons name="inventory" size={cardScale(9)} color={colors.success} />
            <Text style={[styles.stockText, { color: colors.success, fontSize: cardFont(9), textAlign: isAr ? 'right' : 'left' }]}>
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
  container: {
    borderRadius: scale(16),
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: scale(10),
  },
  imageContainer: {
    width: '100%',
    position: 'relative',
  },
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
