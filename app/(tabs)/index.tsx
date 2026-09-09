import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable,
  RefreshControl, Modal, Platform, FlatList, ActivityIndicator,
  Animated, InteractionManager,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { getMeasuredTabBarBottom, getMeasuredTabBarHeight, useTabBarLayout } from './_layout';
import { useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '@/contexts/AppContext';
import {
  DEFAULT_FILTERS, CHAD_CITIES, FilterState, SortOption, ConditionFilter,
} from '@/contexts/AppContext';
import { categories, sellers, Product } from '@/services/mockData';
import { formatPrice } from '@/constants/config';
import ProductCard from '@/components/ProductCard';
import { ProductGridSkeleton, CategorySkeleton } from '@/components/Skeleton';
import { borderRadius, shadows } from '@/constants/theme';
import { selection, impactLight, notifySuccess } from '@/services/haptics';
import { getAdBanners, getStoreLogo, getMoreArrowSetting, AdBanner } from '@/services/branding';

import {
  SCREEN_WIDTH, SCREEN_HEIGHT, scale, BANNER_HEIGHT, STICKY_HEADER_OFFSET,
  CATEGORY_CIRCLE, AVATAR_SIZE, AVATAR_RADIUS, AVATAR_BORDER,
  VERIFIED_STORE_ITEM_W, VERIFIED_BADGE, PINNED_CARD_W, PINNED_IMG_H,
  SEARCH_BAR_H, SEARCH_BTN_W, EMPTY_IMG, PINNED_DISCOUNT_BADGE,
  NOTIF_BTN, LOGO_IMG, CARD_WIDTH, IS_VERY_SHORT_SCREEN,
} from '@/constants/responsive';

const PAGE_SIZE = 10;

const SORT_OPTIONS: { key: SortOption; en: string; fr: string; ar: string; icon: string }[] = [
  { key: 'newest', en: 'Newest', fr: 'Récents', ar: 'الأحدث', icon: 'schedule' },
  { key: 'cheapest', en: 'Cheapest', fr: 'Moins cher', ar: 'الأرخص', icon: 'arrow-downward' },
  { key: 'expensive', en: 'Expensive', fr: 'Plus cher', ar: 'الأغلى', icon: 'arrow-upward' },
  { key: 'most_viewed', en: 'Most Viewed', fr: 'Plus vus', ar: 'الأكثر مشاهدة', icon: 'visibility' },
];

const CONDITION_OPTIONS: { key: ConditionFilter; en: string; fr: string; ar: string }[] = [
  { key: 'all', en: 'All', fr: 'Tout', ar: 'الكل' },
  { key: 'new', en: 'Brand New', fr: 'Neuf', ar: 'جديد' },
  { key: 'like_new', en: 'Like New', fr: 'Comme neuf', ar: 'كالجديد' },
  { key: 'used', en: 'Used', fr: 'Occasion', ar: 'مستعمل' },
];

const PRICE_PRESETS = [
  { min: 0, max: 50000, label: '< 50K' },
  { min: 50000, max: 200000, label: '50K - 200K' },
  { min: 200000, max: 1000000, label: '200K - 1M' },
  { min: 1000000, max: 10000000, label: '1M - 10M' },
  { min: 10000000, max: 50000000, label: '> 10M' },
];

const BANNER_WIDTH = SCREEN_WIDTH - 32;

// Memoized ProductCard for FlatList — recently added section
// imageHeightRatio: 0.67571 * 0.95 = 0.64192 (5% smaller as requested)
// On very short screens, compress image height further so 2 cards fit above the fold.
const RECENTLY_ADDED_IMG_RATIO = 0.64192;
const RECENTLY_ADDED_IMG_RATIO_VERY_SHORT = 0.45;
const MemoProductCard = React.memo(({ product, index }: { product: Product; index: number }) => (
  <ProductCard product={product} index={index} imageHeightRatio={1.0} />
));

// Extracted ListHeader as a proper component to avoid useMemo JSX blob
function HomeListHeader({
  storeLogo, colors, t, searchQuery, setSearchQuery, openFilters, activeFilterCount,
  filters, setFilters, resetFilters, language, showHeaderContent, dynamicBanners,
  activeBannerIndex, bannerScrollRef, setActiveBannerIndex, selectedCategory,
  setSelectedCategory, pinnedProducts, filteredProductsLength, router, verifiedSellers,
  products, moreArrow, selectedCity, setSelectedCity, safeAreaTop,
  subCategories, currentCategoryPath, navigateToCategory, goBackCategory, resetCategoryNavigation,
}: any) {
  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const lb = (en: string, fr: string, ar: string) => isFr ? fr : isAr ? ar : en;
  const getCategoryName = (cat: typeof categories[0]) => (cat?.name as Record<string, string>)?.[language] || cat?.name?.en || '';
  const pinnedScrollRef = useRef<ScrollView>(null);

  // City picker dropdown state (local to HomeListHeader)
  const [showCityDropdown, setShowCityDropdown] = useState(false);

  // Reset pinned scroll to start when language changes or products load
  useEffect(() => {
    const timer = setTimeout(() => {
      pinnedScrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
    }, 100);
    return () => clearTimeout(timer);
  }, [language, pinnedProducts.length]);

  return (
    <View>
      {/* City Picker in HomeScreen sticky area. Banner below in HomeListHeader. */}


      {/* Categories - Grid (only show when "all" is selected, hidden when a category is chosen) */}
      {selectedCategory === 'all' ? (
      <View style={[styles.categoryGrid, isAr && { flexDirection: 'row-reverse', flexWrap: 'wrap-reverse' }]}>
        {categories.map(cat => {
          const isSelected = selectedCategory === cat.id;
          return (
            <Pressable
              key={cat.id}
              onPress={() => { selection(); setSelectedCategory(cat.id); }}
              style={styles.categoryGridItem}
            >
              <View
                style={[
                  styles.categoryCircle,
                  {
                    borderColor: isSelected ? cat.color : 'transparent',
                  },
                ]}
              >
                {cat.image ? (
                  <Image
                    source={cat.image}
                    style={{ width: '100%', height: '100%', borderRadius: 10 }}
                    contentFit="cover"
                    transition={150}
                  />
                ) : (
                  <MaterialIcons
                    name={cat.icon as any}
                    size={24}
                    color={cat.color}
                  />
                )}
              </View>
              <Text
                style={[
                  styles.categoryCircleLabel,
                  { color: isSelected ? cat.color : colors.textSecondary, fontWeight: isSelected ? '700' : '600', textAlign: 'center' },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.5}
              >
                {getCategoryName(cat)}
              </Text>
            </Pressable>
          );
        })}
        {/* Tiny red arrow — opens all categories page (controllable from admin) */}
        {moreArrow.show ? (
          <Pressable
            onPress={() => { selection(); router.push('/(tabs)/categories' as any); }}
            hitSlop={20}
            style={[styles.moreArrowBtn, isAr && styles.moreArrowBtnRTL, { backgroundColor: moreArrow.color + '15', borderRadius: scale(16) }]}
          >
            <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={24} color={moreArrow.color} />
          </Pressable>
        ) : null}
      </View>
      ) : null}

      {/* Verified Stores — horizontal scroll (only when All category is active).
          Hidden entirely on very short screens to make room for product cards. */}
      {verifiedSellers.length > 0 && showHeaderContent && !IS_VERY_SHORT_SCREEN ? (
        <View style={{ marginBottom: 4 }}>
          <View style={[styles.sectionHeaderRow, isAr && { flexDirection: 'row-reverse' }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, textAlign: isAr ? 'right' : 'left', flex: 1 }]}>
              {lb('Verified Stores', 'Boutiques vérifiées', 'متاجر موثّقة')}
            </Text>
            <Pressable onPress={() => router.push('/verified-stores' as any)} style={[styles.seeAllRow, isAr && { flexDirection: 'row-reverse' }]}>
              <Text style={[styles.seeAllText, { color: colors.verified }]}>{lb('See All', 'Voir tout', 'عرض الكل')}</Text>
              <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={18} color={colors.verified} />
            </Pressable>
          </View>
          <View style={[styles.verifiedStoresRow, isAr && { flexDirection: 'row-reverse' }]}>
            {verifiedSellers.map((seller: any) => (
              <Pressable
                key={seller.id}
                onPress={() => router.push(`/seller/${seller.id}` as any)}
                style={styles.verifiedStoreItemFlex}
              >
                <View style={styles.verifiedStoreAvatarWrap}>
                  {seller.avatar ? (
                    <Image
                      source={{ uri: seller.avatar }}
                      style={[styles.verifiedStoreAvatar, { borderColor: colors.verified }]}
                      contentFit="cover"
                      transition={150}
                    />
                  ) : (
                    <View style={[styles.verifiedStoreAvatar, styles.verifiedStorePlaceholder, { backgroundColor: colors.verified, borderColor: colors.verified }]}>
                      <Text style={styles.verifiedStorePlaceholderText}>
                        {seller.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  {seller.isVerified ? (
                    <View style={[styles.verifiedStoreBadge, { backgroundColor: colors.verified, borderColor: colors.surface }]}>
                      <MaterialIcons name="verified" size={10} color="#FFF" />
                    </View>
                  ) : null}
                </View>
                <Text
                  style={[styles.verifiedStoreName, { color: colors.textPrimary }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit={true}
                  minimumFontScale={0.6}
                  ellipsizeMode="tail"
                >
                  {seller.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* Pinned Products */}
      {pinnedProducts.length > 0 && showHeaderContent ? (
        <View>
          <Pressable onPress={() => router.push('/promoted')} style={[styles.sectionHeaderRow, isAr && { flexDirection: 'row-reverse' }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, textAlign: isAr ? 'right' : 'left', flex: 1 }]}>{t('pinnedProducts')}</Text>
            <View style={[styles.seeAllRow, isAr && { flexDirection: 'row-reverse' }]}>
              <Text style={[styles.seeAllText, { color: colors.primary }]}>{lb('See All', 'Voir tout', 'عرض الكل')}</Text>
              <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={18} color={colors.primary} />
            </View>
          </Pressable>
          <ScrollView
            key={`pinned-${language}`}
            ref={pinnedScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.pinnedScroll, isAr && { flexDirection: 'row-reverse' }]}
            snapToInterval={150}
            decelerationRate="fast"
            onLayout={() => {
              setTimeout(() => {
                if (isAr) {
                  pinnedScrollRef.current?.scrollToEnd({ animated: false });
                } else {
                  pinnedScrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
                }
              }, 50);
            }}
            onContentSizeChange={() => {
              if (isAr) {
                setTimeout(() => {
                  pinnedScrollRef.current?.scrollToEnd({ animated: false });
                }, 30);
              }
            }}
          >
            {pinnedProducts.map((product: any) => {
              const title = product?.title?.[language] || product?.title?.en || '';
              const hasDiscount = (product?.discountPercent ?? 0) > 0 && product?.discountUntil && new Date(product.discountUntil).getTime() > Date.now();
              const discountPercent = hasDiscount ? Math.min(30, product?.discountPercent || 0) : 0;
              const discountedPrice = hasDiscount ? Math.round((product?.price || 0) * (1 - discountPercent / 100)) : (product?.price || 0);
              return (
                <Pressable
                  key={product.id}
                  onPress={() => router.push(`/product/${product.id}`)}
                  style={({ pressed }) => [styles.pinnedCard, { backgroundColor: colors.surface, borderColor: colors.pinnedLight, opacity: pressed ? 0.92 : 1 }, shadows.card]}
                >
                  <View style={{ position: 'relative' }}>
                    <Image source={{ uri: product?.images?.[0] || '' }} style={styles.pinnedImage} contentFit="cover" />
                    {hasDiscount ? (
                      <View style={styles.pinnedDiscountBadge}>
                        <Text style={styles.pinnedDiscountText}>-{discountPercent}%</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.pinnedInfo}>
                    <Text style={[styles.pinnedPrice, { color: colors.primary, textAlign: isAr ? 'right' : 'left' }]}>{formatPrice(hasDiscount ? discountedPrice : (product?.price || 0))}</Text>
                    {hasDiscount ? (
                      <Text style={[styles.pinnedOldPrice, { color: colors.textTertiary, textAlign: isAr ? 'right' : 'left' }]}>{formatPrice(product?.price || 0)}</Text>
                    ) : null}
                    <Text style={[styles.pinnedTitle, { color: colors.textPrimary, textAlign: isAr ? 'right' : 'left' }]} numberOfLines={1} adjustsFontSizeToFit={true} minimumFontScale={0.7} ellipsizeMode="tail">{title}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* Products Grid Title */}
      <View style={[styles.sectionHeaderRow, isAr && { flexDirection: 'row-reverse' }]}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary, textAlign: isAr ? 'right' : 'left', flex: 1 }]}>
          {searchQuery || activeFilterCount > 0
            ? `${filteredProductsLength} ${lb('results', 'résultats', 'نتائج')}`
            : t('recentlyAdded')}
        </Text>
        {!(searchQuery || activeFilterCount > 0) ? (
          <Pressable onPress={() => router.push('/all-products' as any)} style={[styles.seeAllRow, isAr && { flexDirection: 'row-reverse' }]}>
            <Text style={[styles.seeAllText, { color: colors.verified }]}>{lb('See All', 'Tout voir', 'عرض الكل')}</Text>
            <MaterialIcons name={isAr ? 'chevron-left' : 'chevron-right'} size={18} color={colors.verified} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { fontScale, width: winW } = useWindowDimensions();
  const searchBarH = Math.round(Math.max(48, 38 * Math.min(fontScale, 1.6)));
  const numCols = winW >= 500 ? 3 : 2;
  const { user, isReady, authLoading, userChecked } = useApp();
  const isSeller = user?.role === 'seller' || user?.role === 'super_admin' || user?.role === 'staff' || user?.isSeller === true;
  const router = useRouter();

  // Seller guard: if seller opens Home, redirect to store-profile
  useEffect(() => {
    if (isReady && !authLoading && userChecked && isSeller) {
      router.replace('/(tabs)/store-profile');
    }
  }, [isReady, authLoading, userChecked, isSeller, router]);

  // Use ACTUAL measured tab bar bounds from onLayout in _layout.tsx
  // measuredY = y position of tab bar wrapper top from screen top
  // Content must end at measuredY - gap, so paddingBottom = measuredY + scale(8) - topOffset
  // But simpler: paddingBottom = (windowHeight - measuredY) + scale(8)
  // because FlatList content starts at paddingTop (stickyHeight), and we want
  // content to end scale(8)dp before tab bar top.
  const rawTabHeight = useBottomTabBarHeight();
  const tabBarLayout = useTabBarLayout();
  const windowHeight = useWindowDimensions().height;

  const measuredY = tabBarLayout.y;
  // actualOccupiedBottom = space from tab bar wrapper top to screen bottom
  const actualOccupiedBottom = measuredY > 0 ? (windowHeight - measuredY) : (rawTabHeight || scale(56)) + insets.bottom;
  // tabBarHeight = actualOccupiedBottom (no double counting insets.bottom)
  const tabBarHeight = actualOccupiedBottom;

  const {
    colors, t, language, searchQuery, setSearchQuery,
    selectedCategory, setSelectedCategory, getFilteredProducts, products,
    filters, setFilters, resetFilters, activeFilterCount,
    refreshProducts, selectedCity, setSelectedCity,
    subCategories, currentCategoryPath, navigateToCategory, goBackCategory, resetCategoryNavigation,
  } = useApp();

  // Collapsible header animation
  const scrollY = useRef(new Animated.Value(0)).current;
  const HEADER_HEIGHT = Math.round(SCREEN_HEIGHT * 0.025); // ~2.5% of screen height — compact, closer to status bar
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const headerHeight = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT],
    outputRange: [HEADER_HEIGHT, 0],
    extrapolate: 'clamp',
  });

  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);

  // Pagination state
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  // Dynamic branding from database
  const [dynamicBanners, setDynamicBanners] = useState<AdBanner[]>([]);
  const [storeLogo, setStoreLogo] = useState('');
  const [moreArrow, setMoreArrow] = useState({ show: true, color: '#EF4444' });
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const bannerScrollRef = useRef<ScrollView>(null);

  // Local filter state for the modal
  const [tempFilters, setTempFilters] = useState<FilterState>(filters);
  const [stickyHeight, setStickyHeight] = useState(0);

  const filteredProducts = useMemo(() => getFilteredProducts(), [getFilteredProducts]);
  // Stable pinnedProducts — only re-creates when pinned IDs actually change (NOT on every products change)
  // This prevents FlatList ListHeader re-render shift when seller adds a non-pinned product
  const pinnedProducts = useMemo(() => products.filter(p => p.isPinned), [products]);
  const pinnedProductsKey = useMemo(() => pinnedProducts.map(p => p.id).join(','), [pinnedProducts]);
  const stablePinnedProducts = useMemo(() => pinnedProducts, [pinnedProductsKey]);

  // Verified sellers for "Verified Stores" section — only real verified sellers, no duplicates
  const verifiedSellers = useMemo(() => {
    return sellers.filter(s => s.isVerified);
  }, []);

  // Paginated products
  const paginatedProducts = useMemo(() =>
    filteredProducts.slice(0, displayCount),
    [filteredProducts, displayCount]
  );
  const hasMore = displayCount < filteredProducts.length;

  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const lb = useCallback((en: string, fr: string, ar: string) => isFr ? fr : isAr ? ar : en, [isFr, isAr]);

  // Reset pagination when filters change
  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [selectedCategory, searchQuery, filters]);

  // Reset to "all" ONLY when user taps the Home tab button (not when navigating from categories)
  const navigation = useNavigation();
  useEffect(() => {
    const unsub = navigation.addListener('tabPress' as any, () => {
      setSelectedCategory('all');
    });
    return unsub;
  }, [navigation, setSelectedCategory]);

  // Branding loaded in AppContext before isReady — no re-render needed

  // Auto-scroll banners every 4 seconds
  useEffect(() => {
    if (dynamicBanners.length <= 1) return;
    const interval = setInterval(() => {
      setActiveBannerIndex(prev => {
        const next = (prev + 1) % dynamicBanners.length;
        bannerScrollRef.current?.scrollTo({ x: next * BANNER_WIDTH, animated: true });
        return next;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [dynamicBanners.length]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshProducts();
    setDisplayCount(PAGE_SIZE);
    setTimeout(() => setRefreshing(false), 400);
  }, [refreshProducts]);

  const loadMore = useCallback(() => {
    if (hasMore) {
      setDisplayCount(prev => prev + PAGE_SIZE);
    }
  }, [hasMore]);

  const openFilters = useCallback(() => {
    setTempFilters(filters);
    setShowFilters(true);
  }, [filters]);

  const applyFilters = useCallback(() => {
    notifySuccess();
    setFilters(tempFilters);
    setShowFilters(false);
  }, [tempFilters, setFilters]);

  const handleResetFilters = useCallback(() => {
    selection();
    setTempFilters(DEFAULT_FILTERS);
  }, []);

  const tempFilterCount = useMemo(() => {
    let c = 0;
    if (tempFilters.priceMin > 0) c++;
    if (tempFilters.priceMax < 50000000) c++;
    if (tempFilters.condition !== 'all') c++;
    if (tempFilters.location !== 'all') c++;
    if (tempFilters.sortBy !== 'newest') c++;
    return c;
  }, [tempFilters]);

  const showHeaderContent = !searchQuery && selectedCategory === 'all' && activeFilterCount === 0;

  // FlatList key extractor
  const keyExtractor = useCallback((item: Product) => item.id, []);

  // FlatList render item - 2 column grid
  const renderProductItem = useCallback(({ item, index }: { item: Product; index: number }) => (
    <MemoProductCard product={item} index={index} />
  ), []);

  // Render ListHeader as a proper component call
  const renderListHeader = useCallback(() => (
    <HomeListHeader
      storeLogo={storeLogo}
      colors={colors}
      t={t}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      openFilters={openFilters}
      activeFilterCount={activeFilterCount}
      filters={filters}
      setFilters={setFilters}
      resetFilters={resetFilters}
      language={language}
      showHeaderContent={showHeaderContent}
      dynamicBanners={dynamicBanners}
      activeBannerIndex={activeBannerIndex}
      bannerScrollRef={bannerScrollRef}
      setActiveBannerIndex={setActiveBannerIndex}
      selectedCategory={selectedCategory}
      setSelectedCategory={setSelectedCategory}
      pinnedProducts={stablePinnedProducts}
      filteredProductsLength={searchQuery || activeFilterCount > 0 ? filteredProducts.length : 0}
      router={router}
      verifiedSellers={verifiedSellers}
      products={products}
      moreArrow={moreArrow}
      selectedCity={selectedCity}
      setSelectedCity={setSelectedCity}
      safeAreaTop={insets.top}
      subCategories={subCategories}
      currentCategoryPath={currentCategoryPath}
      navigateToCategory={navigateToCategory}
      goBackCategory={goBackCategory}
      resetCategoryNavigation={resetCategoryNavigation}
    />
  ), [storeLogo, colors, t, searchQuery, setSearchQuery, openFilters, activeFilterCount, filters,
      setFilters, resetFilters, language, showHeaderContent, dynamicBanners, activeBannerIndex,
      selectedCategory, setSelectedCategory, stablePinnedProducts, router, verifiedSellers, moreArrow,
      selectedCity, setSelectedCity, insets.top, subCategories, currentCategoryPath, navigateToCategory, goBackCategory, resetCategoryNavigation]);

  // FlatList footer — removed, padding is handled by contentContainerStyle
  const ListFooter = useMemo(() => null, []);

  // Empty state
  const ListEmpty = useMemo(() => (
    <View style={styles.emptyState}>
      <Image
        source={require('@/assets/images/empty-products.png')}
        style={styles.emptyImage}
        contentFit="cover"
      />
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
        {lb('No products found', 'Aucun produit trouvé', 'لم يتم العثور على منتجات')}
      </Text>
      {activeFilterCount > 0 ? (
        <Pressable
          onPress={() => resetFilters()}
          style={[styles.clearFiltersBtn, { backgroundColor: colors.primary }]}
        >
          <MaterialIcons name="filter-list-off" size={16} color="#FFF" />
          <Text style={[styles.clearFiltersBtnText]}>{lb('Clear Filters', 'Effacer les filtres', 'مسح الفلاتر')}</Text>
        </Pressable>
      ) : null}
    </View>
  ), [colors, lb, activeFilterCount, resetFilters]);

  // Splash is now hidden from _layout.tsx after 500ms — no need to wait for isReady here.
  // The loading screen below (ActivityIndicator) shows while data loads.

  // ---- isReady check: show loading screen while data loads ----
  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: '#4C1CEA' }]}>
      <StatusBar style="light" backgroundColor="#4C1CEA" />
      <View style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Sticky Search Bar — always visible at top */}
          <View
            style={[styles.stickySearchWrap, { backgroundColor: '#4C1CEA', paddingTop: 2 }]}
            onLayout={(e) => setStickyHeight(e.nativeEvent.layout.height)}
          >
            {/* Collapsible Sokchad header row */}
            <View style={[styles.headerRow, { height: Math.max(52, Math.min(56, 54 * Math.min(fontScale, 1.15))), position: 'relative', justifyContent: 'center', alignItems: 'center' }]}>
              {/* TipTob-style side icons: bell + cart LEFT, hamburger RIGHT, logo centered */}
              <View style={[styles.headerSideIcons, isAr && { flexDirection: 'row-reverse' }]}>
                <Pressable hitSlop={10} onPress={() => router.push('/settings' as any)}>
                  <MaterialIcons name="notifications-none" size={26} color="#FFFFFF" />
                </Pressable>
                <Pressable hitSlop={10} onPress={() => router.push('/checkout' as any)}>
                  <MaterialIcons name="shopping-cart" size={26} color="#FFFFFF" />
                </Pressable>
              </View>
              <Image
                source={require('../../assets/branding/sokchad-logo-white.png')}
                style={styles.logoHeaderImage}
                contentFit="contain"
                transition={150}
              />
              <View style={[styles.headerSideIcons, styles.headerSideRight, isAr && { flexDirection: 'row-reverse' }]}>
                {/* Location pin — ICON ONLY, big like cart, opens city dropdown */}
                <Pressable hitSlop={12} onPress={() => { selection(); setShowCityDropdown(true); }}>
                  <MaterialIcons name="location-on" size={26} color="#FFFFFF" />
                </Pressable>
                {/* Menu (3 lines) opens the filter sheet directly */}
                <Pressable hitSlop={12} onPress={() => { selection(); openFilters(); }}>
                  <MaterialIcons name="menu" size={28} color="#FFFFFF" />
                  {activeFilterCount > 0 ? (
                    <View style={styles.filterBadge}>
                      <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                    </View>
                  ) : null}
                </Pressable>
              </View>
            </View>
            {/* Search bar — stays sticky */}
            <View style={styles.searchContainer}>
              <View style={[styles.searchWrapper, isAr && { flexDirection: 'row-reverse' }]}>
              <View style={[styles.searchBar, { backgroundColor: '#FFFFFF', height: searchBarH, borderRadius: 16, marginHorizontal: 14 }, isAr && { flexDirection: 'row-reverse' }]}>
                <MaterialIcons name="search" size={22} color={colors.textTertiary} />
                <TextInput
                  style={[styles.searchInput, { color: colors.textPrimary, textAlign: isAr ? 'right' : 'left' }]}
                  placeholder={isAr ? 'ابحث عن منتج…' : 'Rechercher un produit…'}
                  placeholderTextColor={colors.textTertiary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 ? (
                  <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                    <MaterialIcons name="close" size={18} color={colors.textTertiary} />
                  </Pressable>
                ) : null}
              </View>

              </View>
            </View>
          </View>

          {/* City Picker Dropdown Modal — outside sticky so it overlays full screen */}
          <Modal
            visible={showCityDropdown}
            transparent
            animationType="fade"
            onRequestClose={() => setShowCityDropdown(false)}
          >
            <Pressable style={styles.cityDropdownOverlay} onPress={() => setShowCityDropdown(false)}>
              <View style={[styles.cityDropdownSheet, { backgroundColor: colors.surface }]}>
                <View style={[styles.cityDropdownHeader, { borderBottomColor: colors.border }]}>
                  <MaterialIcons name="location-on" size={18} color="#8B5CF6" />
                  <Text style={[styles.cityDropdownTitle, { color: colors.textPrimary }]}>
                    {lb('Select City', 'Choisir la ville', 'اختر المدينة')}
                  </Text>
                  <Pressable onPress={() => setShowCityDropdown(false)} hitSlop={12} style={styles.cityDropdownCloseBtn}>
                    <MaterialIcons name="close" size={20} color={colors.textSecondary} />
                  </Pressable>
                </View>
                <ScrollView
                  style={styles.cityDropdownScroll}
                  contentContainerStyle={styles.cityDropdownList}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <Pressable
                    onPress={() => { selection(); setSelectedCity('all'); setShowCityDropdown(false); }}
                    style={({ pressed }) => [styles.cityDropdownItem, { backgroundColor: selectedCity === 'all' ? '#8B5CF615' : 'transparent', opacity: pressed ? 0.7 : 1 }]}
                  >
                    <MaterialIcons name="public" size={18} color={selectedCity === 'all' ? '#8B5CF6' : colors.textTertiary} />
                    <Text style={[styles.cityDropdownItemText, { color: selectedCity === 'all' ? '#8B5CF6' : colors.textPrimary, flex: 1 }]}>
                      {lb('All Cities', 'Toutes les villes', 'كل المدن')}
                    </Text>
                    {selectedCity === 'all' ? (
                      <MaterialIcons name="check" size={18} color="#8B5CF6" />
                    ) : null}
                  </Pressable>
                  {CHAD_CITIES.map(city => {
                    const isActive = selectedCity === city;
                    return (
                      <Pressable
                        key={city}
                        onPress={() => { selection(); setSelectedCity(city); setShowCityDropdown(false); }}
                        style={({ pressed }) => [styles.cityDropdownItem, { backgroundColor: isActive ? '#8B5CF615' : 'transparent', opacity: pressed ? 0.7 : 1 }]}
                      >
                        <MaterialIcons name="location-on" size={18} color={isActive ? '#8B5CF6' : colors.textTertiary} />
                        <Text style={[styles.cityDropdownItemText, { color: isActive ? '#8B5CF6' : colors.textPrimary, flex: 1 }]}>
                          {city}
                        </Text>
                        {isActive ? (
                          <MaterialIcons name="check" size={18} color="#8B5CF6" />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </Pressable>
          </Modal>

          <FlatList
            key={`grid-${numCols}`}
            style={{ backgroundColor: colors.background }}
            data={paginatedProducts}
            keyExtractor={keyExtractor}
            renderItem={renderProductItem}
            numColumns={numCols}
            columnWrapperStyle={[styles.grid, isAr && { flexDirection: 'row-reverse' }]}
            contentContainerStyle={{ paddingTop: stickyHeight > 0 ? stickyHeight : insets.top + 54 + searchBarH, paddingBottom: tabBarHeight + scale(20) }}
            ListHeaderComponent={renderListHeader}
            ListFooterComponent={ListFooter}
            ListEmptyComponent={ListEmpty}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={Platform.OS !== 'web'}
            maxToRenderPerBatch={2}
            initialNumToRender={2}
            windowSize={2}
            updateCellsBatchingPeriod={50}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            scrollEventThrottle={16}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: false }
            )}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
                progressBackgroundColor={colors.surface}
              />
            }
          />
        </View>

      {/* ===== FILTER BOTTOM SHEET MODAL ===== */}
      <Modal
        visible={showFilters}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <View style={styles.sheetHeader}>
              <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            </View>
            <View style={styles.sheetTitleRow}>
              <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
                {lb('Filters', 'Filtres', 'الفلاتر')}
              </Text>
              {tempFilterCount > 0 ? (
                <Pressable onPress={handleResetFilters} hitSlop={8}>
                  <Text style={[styles.resetText, { color: colors.error }]}>
                    {lb('Reset', 'Réinitialiser', 'إعادة تعيين')}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => setShowFilters(false)} hitSlop={12} style={styles.closeModalBtn}>
                <MaterialIcons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetScroll}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.filterSectionTitle, { color: colors.textTertiary }]}>
                {lb('LOCATION / CITY', 'LOCALISATION / VILLE', 'الموقع / المدينة')}
              </Text>
              <Pressable
                onPress={() => { selection(); setShowCityDropdown(true); }}
                style={({ pressed }) => [styles.sortChip, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, opacity: pressed ? 0.88 : 1, justifyContent: 'space-between' }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(6) }}>
                  <MaterialIcons name="location-on" size={16} color={colors.primary} />
                  <Text style={[styles.sortChipText, { color: colors.textPrimary }]}>
                    {selectedCity === 'all'
                      ? lb('All Cities', 'Toutes les villes', 'كل المدن')
                      : selectedCity}
                  </Text>
                </View>
                <MaterialIcons name="expand-more" size={18} color={colors.textTertiary} />
              </Pressable>

              <Text style={[styles.filterSectionTitle, { color: colors.textTertiary }]}>
                {lb('SORT BY', 'TRIER PAR', 'ترتيب حسب')}
              </Text>
              <View style={styles.sortGrid}>
                {SORT_OPTIONS.map(opt => {
                  const isActive = tempFilters.sortBy === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => { selection(); setTempFilters(p => ({ ...p, sortBy: opt.key })); }}
                      style={[
                        styles.sortChip,
                        {
                          backgroundColor: isActive ? colors.primary + '15' : colors.backgroundSecondary,
                          borderColor: isActive ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <MaterialIcons name={opt.icon as any} size={16} color={isActive ? colors.primary : colors.textTertiary} />
                      <Text style={[styles.sortChipText, { color: isActive ? colors.primary : colors.textPrimary }]}>
                        {opt[language]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.filterSectionTitle, { color: colors.textTertiary }]}>
                {lb('PRICE RANGE (FCFA)', 'FOURCHETTE DE PRIX (FCFA)', 'نطاق السعر (FCFA)')}
              </Text>
              <View style={styles.priceInputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.priceInputLabel, { color: colors.textTertiary }]}>Min</Text>
                  <TextInput
                    style={[styles.priceInput, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: colors.border }]}
                    placeholder="0"
                    placeholderTextColor={colors.textTertiary}
                    value={tempFilters.priceMin > 0 ? String(tempFilters.priceMin) : ''}
                    onChangeText={(v) => {
                      const num = parseInt(v.replace(/\D/g, '')) || 0;
                      setTempFilters(p => ({ ...p, priceMin: num }));
                    }}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.priceSeparator}>
                  <MaterialIcons name="remove" size={20} color={colors.textTertiary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.priceInputLabel, { color: colors.textTertiary }]}>Max</Text>
                  <TextInput
                    style={[styles.priceInput, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: colors.border }]}
                    placeholder="50,000,000"
                    placeholderTextColor={colors.textTertiary}
                    value={tempFilters.priceMax < 50000000 ? String(tempFilters.priceMax) : ''}
                    onChangeText={(v) => {
                      const num = parseInt(v.replace(/\D/g, '')) || 50000000;
                      setTempFilters(p => ({ ...p, priceMax: num }));
                    }}
                    keyboardType="numeric"
                  />
                </View>
              </View>



            </ScrollView>

            <View style={[styles.sheetBottom, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 16) }]}>
              <Pressable
                onPress={() => setShowFilters(false)}
                style={[styles.cancelBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>{lb('Cancel', 'Annuler', 'إلغاء')}</Text>
              </Pressable>
              <Pressable
                onPress={applyFilters}
                style={({ pressed }) => [styles.applyBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 }]}
              >
                <MaterialIcons name="check" size={18} color="#FFF" />
                <Text style={styles.applyBtnText}>
                  {lb('Apply', 'Appliquer', 'تطبيق')}
                  {tempFilterCount > 0 ? ` (${tempFilterCount})` : ''}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1 },
  cleanLoadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cleanLoadingLogo: { width: scale(80), height: scale(80), borderRadius: scale(16) },
  stickySearchWrap: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
  },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: scale(16),
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: scale(16), paddingTop: scale(2), paddingBottom: scale(2),
  },
  logo: { fontSize: scale(18), fontWeight: '800', letterSpacing: -0.3, fontFamily: 'Cairo-Bold' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: scale(6) },
  headerSideIcons: { position: 'absolute', left: 12, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: scale(14) },
  headerSideRight: { left: undefined, right: 12 },
  headerLocationChip: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 999, maxWidth: 86 },
  headerLocationChipText: { fontSize: 11, fontWeight: '700', maxWidth: 58, fontFamily: 'Cairo-Bold' },
  logoImage: { width: LOGO_IMG, height: LOGO_IMG, borderRadius: scale(6) },
  logoHeaderImage: { width: 68, height: 34, resizeMode: 'contain' },
  notifBtn: { width: NOTIF_BTN, height: NOTIF_BTN, borderRadius: Math.round(NOTIF_BTN / 2), alignItems: 'center', justifyContent: 'center' },
  searchContainer: {
    flexDirection: 'row', paddingHorizontal: scale(16), marginBottom: scale(6), gap: 0,
  },
  searchWrapper: {
    flexDirection: 'row', alignItems: 'center', width: '100%', gap: scale(8),
  },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', height: SEARCH_BAR_H,
    borderRadius: 999, paddingHorizontal: scale(14),
    borderWidth: 0,
    gap: scale(8),
  },
  searchInput: { flex: 1, fontSize: scale(15), height: '100%' },
  searchBtn: {
    width: SEARCH_BAR_H, height: SEARCH_BAR_H,
    borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
  },
  searchBtnRTL: {
    borderRadius: 0,
  },
  filterBadge: {
    position: 'absolute', top: -scale(4), right: -scale(4), width: scale(18), height: scale(18), borderRadius: scale(9),
    backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center',
  },
  filterBadgeText: { color: '#FFF', fontSize: scale(10), fontWeight: '800', fontFamily: 'Cairo-Bold' },
  activeFiltersScroll: { paddingHorizontal: scale(16), gap: scale(6), paddingBottom: scale(6) },
  activeFilterPill: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(10), paddingVertical: scale(5),
    borderRadius: scale(20), borderWidth: 1, gap: scale(4),
  },
  activeFilterText: { fontSize: scale(11), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },
  bannerContainer: {
    marginHorizontal: scale(16), height: BANNER_HEIGHT, borderRadius: scale(22), overflow: 'hidden', marginBottom: 0,
    marginTop: scale(2), position: 'relative',
  },
  banner: { width: '100%', height: '100%' },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center', paddingHorizontal: scale(20),
  },
  bannerTextContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'flex-start', maxWidth: '75%',
  },
  bannerTitle: { color: '#FFF', fontSize: scale(14), fontWeight: '800', lineHeight: 18, fontFamily: 'Cairo-Bold' },
  bannerSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: scale(10), fontWeight: '600', marginTop: scale(1), fontFamily: 'Cairo-SemiBold' },
  bannerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: scale(3), marginTop: scale(4),
    paddingHorizontal: scale(8), paddingVertical: scale(4), borderRadius: scale(10),
    backgroundColor: '#FFF',
  },
  bannerBtnText: { color: '#FF7A00', fontSize: scale(8), fontWeight: '700', fontFamily: 'Cairo-Bold' },
  bannerDots: {
    position: 'absolute', bottom: scale(10), left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: scale(6),
  },
  bannerDot: { width: scale(7), height: scale(7), borderRadius: scale(4) },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: scale(16), paddingVertical: IS_VERY_SHORT_SCREEN ? scale(1) : scale(4), gap: 0, marginTop: IS_VERY_SHORT_SCREEN ? scale(0) : scale(2) },
  categoryGridItem: { alignItems: 'center', width: '25%', marginBottom: IS_VERY_SHORT_SCREEN ? scale(1) : scale(4) },
  categoryCircleScroll: { paddingHorizontal: scale(16), gap: scale(10), paddingBottom: scale(2), marginBottom: 0, paddingTop: scale(2) },
  categoryCircleItem: { alignItems: 'center', width: scale(68) },
  categoryCircle: {
    width: CATEGORY_CIRCLE, height: CATEGORY_CIRCLE, borderRadius: scale(12),
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
    overflow: 'hidden',
  },
  categoryCircleLabel: { fontSize: scale(10), marginTop: IS_VERY_SHORT_SCREEN ? scale(1) : scale(4), textAlign: 'center', fontFamily: 'Cairo-Regular' },
  moreArrowBtn: { position: 'absolute', right: scale(4), top: '50%', marginTop: -scale(18), padding: scale(8), zIndex: 10, width: scale(36), height: scale(36), alignItems: 'center', justifyContent: 'center' },
  moreArrowBtnRTL: { right: 'auto', left: scale(4) },

  // Verified Stores section
  verifiedStoresRow: { flexDirection: 'row', paddingHorizontal: scale(16), paddingBottom: scale(2), paddingTop: 0 },
  verifiedStoreItemFlex: { alignItems: 'center', flex: 1 },
  verifiedStoresScroll: { paddingHorizontal: scale(16), gap: scale(8), paddingBottom: scale(4), paddingTop: scale(2) },
  verifiedStoreItem: { alignItems: 'center', width: VERIFIED_STORE_ITEM_W },
  verifiedStoreAvatarWrap: { position: 'relative' },
  verifiedStoreAvatar: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_RADIUS, borderWidth: AVATAR_BORDER,
  },
  verifiedStorePlaceholder: {
    alignItems: 'center', justifyContent: 'center',
  },
  verifiedStorePlaceholderText: {
    color: '#FFF', fontSize: scale(22), fontWeight: '800', fontFamily: 'Cairo-Bold',
  },
  verifiedStoreBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: VERIFIED_BADGE, height: VERIFIED_BADGE, borderRadius: Math.round(VERIFIED_BADGE / 2),
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  verifiedStoreName: { fontSize: scale(9), fontWeight: '600', marginTop: scale(4), textAlign: 'center', width: VERIFIED_STORE_ITEM_W, overflow: 'hidden', lineHeight: 12, fontFamily: 'Cairo-SemiBold' },

  sectionHeader: { paddingHorizontal: scale(16), paddingTop: IS_VERY_SHORT_SCREEN ? scale(1) : scale(3), paddingBottom: IS_VERY_SHORT_SCREEN ? scale(1) : scale(2) },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch', width: '100%', paddingHorizontal: scale(16), paddingTop: 0, paddingBottom: IS_VERY_SHORT_SCREEN ? scale(1) : scale(2) },
  seeAllRow: { flexDirection: 'row', alignItems: 'center', gap: scale(2) },
  seeAllText: { fontSize: scale(13), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },
  sectionTitle: { fontSize: scale(15), fontWeight: '700', fontFamily: 'Cairo-SemiBold' },
  pinnedScroll: { paddingHorizontal: scale(16), gap: scale(6), paddingBottom: 0 },
  pinnedCard: { width: PINNED_CARD_W, borderRadius: scale(8), overflow: 'hidden', borderWidth: 1 },
  pinnedImage: { width: PINNED_CARD_W, height: PINNED_CARD_W },
  pinnedInfo: { padding: scale(5) },
  pinnedPrice: { fontSize: scale(10), fontWeight: '700', fontFamily: 'Cairo-Bold' },
  pinnedOldPrice: { fontSize: scale(9), textDecorationLine: 'line-through' as const, marginTop: -1, fontFamily: 'Cairo-Regular' },
  pinnedTitle: { fontSize: scale(10), fontWeight: '500', marginTop: scale(1), fontFamily: 'Cairo-Regular' },
  pinnedDiscountBadge: { position: 'absolute', top: scale(4), right: scale(4), backgroundColor: '#EF4444', paddingHorizontal: scale(5), paddingVertical: scale(2), borderRadius: scale(4) },
  pinnedDiscountText: { color: '#FFF', fontSize: scale(9), fontWeight: '800', fontFamily: 'Cairo-Bold' },
  grid: {
    paddingHorizontal: scale(16), justifyContent: 'space-between', alignItems: 'flex-start',
    paddingBottom: scale(2),
  },
  emptyState: { alignItems: 'center', paddingVertical: scale(48), paddingHorizontal: scale(32) },
  emptyImage: { width: EMPTY_IMG, height: EMPTY_IMG, marginBottom: scale(12) },
  emptyText: { fontSize: scale(15), fontWeight: '500', textAlign: 'center', fontFamily: 'Cairo-Regular' },
  clearFiltersBtn: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(20), paddingVertical: scale(10),
    borderRadius: scale(20), gap: scale(6), marginTop: scale(12),
  },
  clearFiltersBtnText: { color: '#FFF', fontSize: scale(14), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },
  loadMoreBtn: {
    marginHorizontal: scale(16), marginVertical: scale(12), paddingVertical: scale(12), borderRadius: scale(10),
    borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
  },
  loadMoreText: { fontSize: scale(14), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: {
    maxHeight: '88%', borderTopLeftRadius: scale(24), borderTopRightRadius: scale(24),
  },
  sheetHeader: { alignItems: 'center', paddingTop: scale(8) },
  sheetHandle: { width: scale(40), height: scale(4), borderRadius: scale(2) },
  sheetTitleRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(20),
    paddingTop: scale(8), paddingBottom: scale(6), gap: scale(12),
  },
  sheetTitle: { fontSize: scale(20), fontWeight: '800', flex: 1, fontFamily: 'Cairo-Bold' },
  resetText: { fontSize: scale(13), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },
  closeModalBtn: { padding: scale(4) },
  sheetScroll: { paddingHorizontal: scale(20), paddingBottom: scale(20) },
  filterSectionTitle: {
    fontSize: scale(11), fontWeight: '700', letterSpacing: 1, marginTop: scale(12), marginBottom: scale(8), fontFamily: 'Cairo-Bold',
  },
  sortGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(8) },
  sortChip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(14), paddingVertical: scale(10),
    borderRadius: scale(10), borderWidth: 1, gap: scale(6),
  },
  sortChipText: { fontSize: scale(13), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },
  priceInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 0 },
  priceInputLabel: { fontSize: scale(11), fontWeight: '600', marginBottom: scale(4), fontFamily: 'Cairo-SemiBold' },
  priceInput: {
    height: scale(48), borderRadius: scale(10), borderWidth: 1, paddingHorizontal: scale(14), fontSize: scale(15), fontWeight: '600', fontFamily: 'Cairo-SemiBold',
  },
  priceSeparator: { paddingHorizontal: scale(8), paddingBottom: scale(12) },
  pricePresetsRow: { gap: scale(6), marginTop: scale(10) },
  pricePresetChip: {
    paddingHorizontal: scale(14), paddingVertical: scale(8), borderRadius: scale(20), borderWidth: 1,
  },
  pricePresetText: { fontSize: scale(12), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },
  conditionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(8) },
  conditionChip: {
    paddingHorizontal: scale(16), paddingVertical: scale(10), borderRadius: scale(10), borderWidth: 1,
  },
  conditionText: { fontSize: scale(13), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },
  locationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(8) },
  locationChip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(12), paddingVertical: scale(8),
    borderRadius: scale(10), borderWidth: 1, gap: scale(4),
  },
  locationText: { fontSize: scale(13), fontWeight: '500', fontFamily: 'Cairo-Regular' },
  sheetBottom: {
    flexDirection: 'row', paddingHorizontal: scale(20), paddingTop: scale(12), borderTopWidth: 1, gap: scale(10),
  },
  cancelBtn: {
    flex: 1, height: scale(46), borderRadius: scale(12), borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: { fontSize: scale(14), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },
  applyBtn: {
    flex: 2, height: scale(46), borderRadius: scale(12), flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: scale(6),
  },
  applyBtnText: { color: '#FFF', fontSize: scale(14), fontWeight: '700', fontFamily: 'Cairo-Bold' },

  // ===== City Picker ===== (v1.0.3: visible between search and banner, compact)
  cityPickerRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(16),
    paddingTop: scale(4), paddingBottom: scale(7),
  },
  cityPickerPill: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(9), paddingVertical: scale(3),
    borderRadius: scale(14), borderWidth: 1, gap: scale(4),
  },
  cityPickerText: {
    fontSize: scale(11), fontWeight: '600', fontFamily: 'Cairo-SemiBold', flexShrink: 1,
  },
  // City dropdown modal
  cityDropdownOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: scale(24), paddingVertical: scale(80),
  },
  cityDropdownSheet: {
    width: '100%', maxWidth: scale(360), borderRadius: scale(16), overflow: 'hidden', maxHeight: '70%',
    ...shadows.card,
  },
  cityDropdownHeader: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(16), paddingVertical: scale(12),
    borderBottomWidth: 1, gap: scale(8),
  },
  cityDropdownTitle: {
    fontSize: scale(15), fontWeight: '700', flex: 1, fontFamily: 'Cairo-Bold',
  },
  cityDropdownCloseBtn: { padding: scale(4) },
  cityDropdownScroll: { maxHeight: '100%' },
  cityDropdownList: { paddingVertical: scale(6) },
  cityDropdownItem: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(16), paddingVertical: scale(12), gap: scale(10),
  },
  cityDropdownItemText: {
    fontSize: scale(13), fontWeight: '600', fontFamily: 'Cairo-SemiBold',
  },
});
