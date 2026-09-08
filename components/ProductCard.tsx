import React from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { Product, getSellerById } from '@/services/mockData';
import { formatPrice } from '@/constants/config';
import { shadows, borderRadius } from '@/constants/theme';
import { impactLight } from '@/services/haptics';

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

interface ProductCardProps {
  product: Product;
  index?: number;
  imageHeightRatio?: number;
  width?: number;
}

function ProductCardInner({ product, index, imageHeightRatio = 0.49, width }: ProductCardProps) {
  const router = useRouter();
  const { colors, language, isFavorite, toggleFavorite } = useApp();
  const isAr = language === 'ar';
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cardWidth = width ?? (window.width - insets.left - insets.right) * 0.45;
  

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
      testID={`product-card-${product.id}`}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.container,
        {
          width: cardWidth,
          backgroundColor: colors.surface,
          borderColor: colors.borderLight,
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        shadows.card,
      ]}
    >
      <View testID={`product-image-${product.id}`} style={[styles.imageContainer, { aspectRatio: 1 / imageHeightRatio }]}>
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
            <MaterialIcons name="push-pin" size={9} color="#FFF" />
          </View>
        ) : null}
        {seller?.isVerified ? (
          <View style={[styles.verifiedBadge, { backgroundColor: colors.verified }]}>
            <MaterialIcons name="verified" size={9} color="#FFF" />
          </View>
        ) : null}
        <Pressable
          onPress={handleFavorite}
          style={[styles.favoriteBtn, { backgroundColor: colors.overlay }]}
          hitSlop={8}
        >
          <MaterialIcons
            name={isFavorite(product.id) ? 'favorite' : 'favorite-border'}
            size={16}
            color={isFavorite(product.id) ? '#EF4444' : '#FFF'}
          />
        </Pressable>
      </View>

      <View style={styles.info}>
        {isDiscountActive(product) ? (
          <View style={[styles.discountRow, isAr && { flexDirection: 'row-reverse' }]}>
            <Text style={[styles.price, { color: colors.primary, textAlign: isAr ? 'right' : 'left', fontSize: 14 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {formatPrice(getDiscountedPrice(product))}
            </Text>
            <View style={[styles.discountBadge, { backgroundColor: '#EF4444' }]}>
              <Text style={[styles.discountBadgeText, { fontSize: 9 }]}>-{Math.min(30, product.discountPercent || 0)}%</Text>
            </View>
          </View>
        ) : (
          <Text style={[styles.price, { color: colors.primary, textAlign: isAr ? 'right' : 'left', fontSize: 14 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {formatPrice(product.price)}
          </Text>
        )}
        {isDiscountActive(product) ? (
          <Text style={[styles.oldPrice, { color: colors.textTertiary, textAlign: isAr ? 'right' : 'left', fontSize: 11 }]}>
            {formatPrice(product.price)}
          </Text>
        ) : null}
        <Text style={[styles.title, { color: colors.textPrimary, textAlign: isAr ? 'right' : 'left', fontSize: 11, lineHeight: 15 }]} numberOfLines={2}>
          {title}
        </Text>
        <View style={[styles.meta, isAr && { flexDirection: 'row-reverse' }]}>
          <MaterialIcons name="location-on" size={10} color={colors.textSecondary} />
          <Text style={[styles.location, { color: colors.textTertiary, fontSize: 10, textAlign: isAr ? 'right' : 'left' }]} numberOfLines={1}>
            {product?.location || ''}
          </Text>
        </View>
        {(product.stock ?? 0) > 0 ? (
          <View style={[styles.stockRow, isAr && { flexDirection: 'row-reverse' }]}>
            <MaterialIcons name="inventory" size={9} color={colors.success} />
            <Text style={[styles.stockText, { color: colors.success, fontSize: 9, textAlign: isAr ? 'right' : 'left' }]}>
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
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 10,
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
    top: 6,
    left: 6,
    width: 20,
    height: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedBadge: {
    position: 'absolute',
    top: 6,
    right: 34,
    width: 20,
    height: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 2,
  },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  discountBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  discountBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
  },
  oldPrice: {
    fontSize: 11,
    textDecorationLine: 'line-through',
    marginTop: -1,
    fontFamily: 'Cairo-Regular',
  },
  price: {
    fontSize: 14,
    flexShrink: 1,
    fontWeight: '800',
    fontFamily: 'Cairo-Bold',
    letterSpacing: -0.3,
  },
  title: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 1,
  },
  location: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: '400',
    fontFamily: 'Cairo-Regular',
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 1,
  },
  stockText: {
    flexShrink: 1,
    fontSize: 9,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
});
