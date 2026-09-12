import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable,
  RefreshControl, Modal, Platform, FlatList, ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useTabBarLayout } from './_layout';
import { useNavigation } from '@react-navigation/native';
import {
  useApp, DEFAULT_FILTERS, CHAD_CITIES, FilterState, SortOption,
} from '@/contexts/AppContext';
import { categories, sellers, Product } from '@/services/mockData';
import { formatPrice } from '@/constants/config';
import ProductCard from '@/components/ProductCard';
import { AppText, AppTextInput } from '@/components/AppText';
import { shadows } from '@/constants/theme';
import { selection, notifySuccess } from '@/services/haptics';

import {
  scale,
  CATEGORY_CIRCLE, AVATAR_SIZE, AVATAR_RADIUS, AVATAR_BORDER,
  VERIFIED_STORE_ITEM_W, VERIFIED_BADGE, PINNED_CARD_W,
  EMPTY_IMG,
  NOTIF_BTN, LOGO_IMG, IS_VERY_SHORT_SCREEN, PhoneLayoutMetrics,
  PRODUCT_IMAGE_RATIO, usePhoneLayout, LIST_TOP_PULL, BOTTOM_NAV_CONTENT_GAP,
} from '@/constants/responsive';

const PAGE_SIZE = 10;

const SORT_OPTIONS: { key: SortOption; en: string; fr: string; ar: string; icon: string }[] = [
  { key: 'newest', en: 'Newest', fr: 'Récents', ar: 'الأحدث', icon: 'schedule' },
  { key: 'cheapest', en: 'Cheapest', fr: 'Moins cher', ar: 'الأرخص', icon: 'arrow-downward' },
  { key: 'expensive', en: 'Expensive', fr: 'Plus cher', ar: 'الأغلى', icon: 'arrow-upward' },
  { key: 'most_viewed', en: 'Most Viewed', fr: 'Plus vus', ar: 'الأكثر مشاهدة', icon: 'visibility' },
];

// Memoized ProductCard for FlatList — recently added section
const MemoProductCard = React.memo(({ product, index }: { product: Product; index: number }) => (
  <ProductCard product={product} index={index} imageHeightRatio={PRODUCT_IMAGE_RATIO} />
));
MemoProductCard.displayName = 'MemoProductCard';

// Extracted ListHeader as a proper component to avoid useMemo JSX blob
function HomeListHeader({
  colors, t, searchQuery, activeFilterCount, language, showHeaderContent, selectedCategory,
  setSelectedCategory, pinnedProducts, filteredProductsLength, router, verifiedSellers,
  layout, setShowCityDropdown, openFilters, selection, subCategories, lastCategory,
}: { [key: string]: any; layout: PhoneLayoutMetrics }) {
  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const lb = (en: string, fr: string, ar: string) => isFr ? fr : isAr ? ar : en;
  const getCategoryName = (cat: typeof categories[0]) => (cat?.name as Record<string, string>)?.[language] || cat?.name?.en || '';
  const pinnedScrollRef = useRef<ScrollView>(null);

  // Reset pinned scroll to start when language changes or products load
  useEffect(() => {
    const timer = setTimeout(() => {
      pinnedScrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
    }, 100);
    return () => clearTimeout(timer);
  }, [language, pinnedProducts.length]);

  return (
    <View>
      {/* Categories - Grid (only show when "all" is selected, hidden when a category is chosen) */}
            {selectedCategory === 'all' ? (
      <View style={[styles.categoryGrid, { paddingHorizontal: layout.horizontalPadding }, isAr && { flexDirection: 'row-reverse' }]}
        testID="home-categories"
      >
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
                    width: layout.categoryCircleSize,
                    height: layout.categoryCircleSize,
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
      </View>
      ) : null}

      {/* Verified Stores — horizontal scroll (only when All category is active).
          Hidden entirely on very short screens to make room for product cards. */}
      {verifiedSellers.length > 0 && showHeaderContent && !IS_VERY_SHORT_SCREEN ? (
        <View style={{ marginBottom: 4 }}>
          <View style={[styles.sectionHeaderRow, { paddingHorizontal: layout.horizontalPadding }, isAr && { flexDirection: 'row-reverse' }]}>
            <AppText weight={700} style={[styles.sectionTitle, { color: colors.textPrimary, textAlign: isAr ? 'right' : 'left', flex: 1 }]}>
              {lb('Verified Stores', 'Boutiques vérifiées', 'متاجر موثّقة')}
            </AppText>
            <Pressable onPress={() => router.push('/verified-stores' as any)} style={[styles.seeAllRow, isAr && { flexDirection: 'row-reverse' }]}>
              <Text style={[styles.seeAllText, { color: colors.verified }]}>{lb('See All', 'Voir tout', 'عرض الكل')}</Text>
              <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={18} color={colors.verified} />
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[{ paddingHorizontal: layout.horizontalPadding, gap: scale(8) }, isAr && { flexDirection: 'row-reverse' }]}
            testID="home-verified-stores"
          >
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
                      style={[styles.verifiedStoreAvatar, { width: layout.storeAvatarSize, height: layout.storeAvatarSize, borderRadius: layout.storeAvatarSize / 2, borderColor: colors.verified }]}
                      contentFit="cover"
                      transition={150}
                    />
                  ) : (
                    <View style={[styles.verifiedStoreAvatar, styles.verifiedStorePlaceholder, { width: layout.storeAvatarSize, height: layout.storeAvatarSize, borderRadius: layout.storeAvatarSize / 2, backgroundColor: colors.verified, borderColor: colors.verified }]}>
                      <Text style={styles.verifiedStorePlaceholderText}>
                        {seller.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  {seller.isVerified ? (
                    <View style={[styles.verifiedStoreBadge, { width: Math.min(22, layout.storeAvatarSize * 0.36), height: Math.min(22, layout.storeAvatarSize * 0.36), borderRadius: 11, backgroundColor: colors.verified, borderColor: colors.surface }]}>
                      <MaterialIcons name="verified" size={10} color="#FFF" />
                    </View>
                  ) : null}
                </View>
                <Text
                  style={[styles.verifiedStoreName, { width: layout.storeItemWidth - 4, color: colors.textPrimary }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit={true}
                  minimumFontScale={0.6}
                  ellipsizeMode="tail"
                >
                  {seller.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Pinned Products */}
      {pinnedProducts.length > 0 && showHeaderContent ? (
        <View>
          <Pressable onPress={() => router.push('/promoted')} style={[styles.sectionHeaderRow, { paddingHorizontal: layout.horizontalPadding }, isAr && { flexDirection: 'row-reverse' }]}>
            <AppText weight={700} style={[styles.sectionTitle, { color: colors.textPrimary, textAlign: isAr ? 'right' : 'left', flex: 1 }]}>{t('pinnedProducts')}</AppText>
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
            contentContainerStyle={[styles.pinnedScroll, { paddingHorizontal: layout.horizontalPadding, gap: layout.smallGap }, isAr && { flexDirection: 'row-reverse' }]}
            snapToInterval={layout.sponsoredCardWidth + layout.smallGap}
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
                  style={({ pressed }) => [styles.pinnedCard, { width: layout.sponsoredCardWidth, backgroundColor: colors.surface, borderColor: colors.pinnedLight, opacity: pressed ? 0.92 : 1 }, shadows.card]}
                >
                  <View style={{ position: 'relative' }}>
                    <Image source={{ uri: product?.images?.[0] || '' }} style={[styles.pinnedImage, { width: layout.sponsoredCardWidth, height: layout.sponsoredImageHeight }]} contentFit="cover" />
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
      <View style={[styles.sectionHeaderRow, { paddingHorizontal: layout.horizontalPadding }, isAr && { flexDirection: 'row-reverse' }]}>
        <AppText weight={700} style={[styles.sectionTitle, { color: colors.textPrimary, textAlign: isAr ? 'right' : 'left', flex: 1 }]}>
          {searchQuery || activeFilterCount > 0
            ? `${filteredProductsLength} ${lb('results', 'résultats', 'نتائج')}`
            : selectedCategory !== 'all'
              ? `${(() => {
                  const cat = (categories as any[]).find(c => c.id === selectedCategory)
                    || (subCategories as any[]).find(c => c.id === selectedCategory)
                    || (lastCategory as any);
                  const catName = (cat?.name as Record<string, string>)?.[language] || (cat?.name as Record<string, string>)?.en || selectedCategory;
                  return `${catName} (${filteredProductsLength})`;
                })()}`
              : t('recentlyAdded')}
        </AppText>
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
  const layout = usePhoneLayout();
  const searchBarH = layout.searchHeight;
  const numCols = 2;
  const { user, isReady, authLoading, userChecked } = useApp();
  const isSeller = user?.role === 'seller' || user?.role === 'super_admin' || user?.role === 'staff' || user?.isSeller === true;
  const router = useRouter();

  // Seller guard: if seller opens Home, redirect to store-profile
  useEffect(() => {
    if (isReady && !authLoading && userChecked && isSeller) {
      router.replace('/(tabs)/store-profile');
    }
  }, [isReady, authLoading, userChecked, isSeller, router]);

  // Navigator RESERVES the tab bar height (MeasuredTabBar is in normal layout flow,
  // not absolute) — the scrollable area already ends above the bar (verified by
  // uiautomator bounds: list bottom 377dp < bar top 395dp on 320x427dp).
  // So the list needs ONLY the approved design gap below its last card:
  // paddingBottom = BOTTOM_NAV_CONTENT_GAP (+ smallGap). Do NOT re-add tabBarHeight.
  const rawTabHeight = useBottomTabBarHeight();
  const tabBarLayout = useTabBarLayout();
  const tabBarHeight = tabBarLayout.height > 0
    ? tabBarLayout.height
    : (rawTabHeight || scale(56) + insets.bottom);

  const {
    colors, t, language, searchQuery, setSearchQuery,
    selectedCategory, setSelectedCategory, getFilteredProducts, products, subCategories, lastCategory,
    filters, setFilters, resetFilters, activeFilterCount,
    refreshProducts, selectedCity, setSelectedCity,
  } = useApp();

  // Scroll position is retained for smooth native list updates.
  const scrollY = useRef(new Animated.Value(0)).current;

  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);

  // Pagination state
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  // Local filter state for the modal
  const [tempFilters, setTempFilters] = useState<FilterState>(filters);
  const [stickyHeight, setStickyHeight] = useState(0);

  const filteredProducts = useMemo(() => getFilteredProducts(), [getFilteredProducts]);
  // Stable pinnedProducts — only re-creates when pinned IDs actually change (NOT on every products change)
  // This prevents FlatList ListHeader re-render shift when seller adds a non-pinned product
  const pinnedProducts = useMemo(() => products.filter(p => p.isPinned), [products]);
  const stablePinnedProducts = pinnedProducts;

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
      colors={colors}
      t={t}
      searchQuery={searchQuery}
      activeFilterCount={activeFilterCount}
      language={language}
      showHeaderContent={showHeaderContent}
      selectedCategory={selectedCategory}
      setSelectedCategory={setSelectedCategory}
      pinnedProducts={stablePinnedProducts}
      subCategories={subCategories}
      lastCategory={lastCategory}
      filteredProductsLength={searchQuery || activeFilterCount > 0 ? filteredProducts.length : 0}
      router={router}
      verifiedSellers={verifiedSellers}
      layout={layout}
      setShowCityDropdown={setShowCityDropdown}
      openFilters={openFilters}
      selection={selection}
    />
  ), [colors, t, searchQuery, activeFilterCount, language, showHeaderContent,
      selectedCategory, setSelectedCategory, stablePinnedProducts, filteredProducts.length,
      router, verifiedSellers, layout]);

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
      <View style={[styles.homeBackdrop, { backgroundColor: colors.background }]}>
        <View style={[styles.homeSurface, { width: layout.surfaceWidth, backgroundColor: colors.background }]}>
          {/* Sticky Search Bar — always visible at top */}
          <View
            style={[styles.stickySearchWrap, { backgroundColor: '#4C1CEA', paddingTop: 0 }]}
            onLayout={(e) => setStickyHeight(e.nativeEvent.layout.height)}
          >
                        {/* Mockup header — order swapped per language; groups are equal flex, sides fixed */}
            <View style={styles.headerRow}>
              {isAr ? (
                <View style={styles.headerFlexGroup}>
                  <Pressable hitSlop={12} onPress={() => { selection(); openFilters(); }} style={styles.headerTouch44}>
                    <MaterialIcons name="menu" size={28} color="#FFFFFF" />
                    {activeFilterCount > 0 ? (
                      <View style={styles.filterBadge}>
                        <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                  <Pressable hitSlop={12} onPress={() => { selection(); setShowCityDropdown(true); }} style={styles.headerTouch44}>
                    <MaterialIcons name="location-on" size={26} color="#FFFFFF" />
                  </Pressable>
                </View>
              ) : (
                <View style={styles.headerFlexGroup}>
                  <Pressable hitSlop={10} onPress={() => router.push('/settings' as any)} style={styles.headerTouch44}>
                    <MaterialIcons name="notifications-none" size={26} color="#FFFFFF" />
                  </Pressable>
                  <Pressable hitSlop={10} onPress={() => router.push('/checkout' as any)} style={styles.headerTouch44}>
                    <MaterialIcons name="shopping-cart" size={26} color="#FFFFFF" />
                  </Pressable>
                </View>
              )}
              <Image
                source={require('../../assets/branding/sokchad-logo-white.png')}
                style={styles.logoHeaderImage}
                contentFit="contain"
                transition={150}
              />
              {isAr ? (
                <View style={[styles.headerFlexGroup, { justifyContent: 'flex-end' }]}>
                  <Pressable hitSlop={10} onPress={() => router.push('/settings' as any)} style={styles.headerTouch44}>
                    <MaterialIcons name="notifications-none" size={26} color="#FFFFFF" />
                  </Pressable>
                  <Pressable hitSlop={10} onPress={() => router.push('/checkout' as any)} style={styles.headerTouch44}>
                    <MaterialIcons name="shopping-cart" size={26} color="#FFFFFF" />
                  </Pressable>
                </View>
              ) : (
                <View style={[styles.headerFlexGroup, { justifyContent: 'flex-end' }]}>
                  <Pressable hitSlop={12} onPress={() => { selection(); setShowCityDropdown(true); }} style={styles.headerTouch44}>
                    <MaterialIcons name="location-on" size={26} color="#FFFFFF" />
                  </Pressable>
                  <Pressable hitSlop={12} onPress={() => { selection(); openFilters(); }} style={styles.headerTouch44}>
                    <MaterialIcons name="menu" size={28} color="#FFFFFF" />
                    {activeFilterCount > 0 ? (
                      <View style={styles.filterBadge}>
                        <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                </View>
              )}
            </View>
{/* Search bar — stays sticky */}
            <View style={[styles.searchContainer, { paddingHorizontal: layout.horizontalPadding, marginBottom: 2 }]}>
              <View style={[styles.searchWrapper, isAr && { flexDirection: 'row-reverse' }]}>
              <View style={[styles.searchBar, { backgroundColor: '#FFFFFF', height: searchBarH, borderRadius: 16 }, isAr && { flexDirection: 'row-reverse' }]}>
                <MaterialIcons name="search" size={18} color={colors.textTertiary} />
                <AppTextInput
                  testID="home-search-input"
                  weight={400}
                  maxScale={1.2}
                  style={[styles.searchInput, { color: colors.textPrimary, textAlign: isAr ? 'right' : 'left' }]}
                  placeholder={isAr ? 'ما المنتج الذي تبحث عنه؟' : 'Quel produit recherchez-vous ?'}
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
            key="home-grid-2"
            testID="home-products-list"
            style={{ backgroundColor: colors.background }}
            data={paginatedProducts}
            keyExtractor={keyExtractor}
            renderItem={renderProductItem}
            numColumns={numCols}
            columnWrapperStyle={[styles.grid, { paddingHorizontal: layout.horizontalPadding }, isAr && { flexDirection: 'row-reverse' }]}
            contentContainerStyle={{ paddingTop: stickyHeight > 0 ? Math.max(stickyHeight - LIST_TOP_PULL, 0) : layout.headerHeight + layout.searchHeight + layout.searchGap, paddingBottom: layout.smallGap + BOTTOM_NAV_CONTENT_GAP }}
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
  homeBackdrop: { flex: 1, alignItems: 'center' },
  homeSurface: { flex: 1, alignSelf: 'center' },
  loadingContainer: { flex: 1 },
  cleanLoadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cleanLoadingLogo: { width: scale(80), height: scale(80), borderRadius: scale(16) },
  stickySearchWrap: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: scale(16), paddingTop: scale(2), paddingBottom: scale(2),
  },
  logo: { fontSize: scale(18), fontWeight: '800', letterSpacing: -0.3, fontFamily: 'Cairo-Bold' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: scale(6) },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  headerFlexGroup: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: scale(10) },
  headerTouch44: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center' },
  headerSideIcons: { position: 'absolute', left: 12, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: scale(14) },
  actionIconsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: scale(16), paddingTop: scale(10), paddingBottom: scale(8) },
  actionIconsGroup: { flexDirection: 'row', alignItems: 'center', gap: scale(18) },
  headerSideRight: { left: undefined, right: 12 },
  headerLocationChip: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 999, maxWidth: 86 },
  headerLocationChipText: { fontSize: 11, fontWeight: '700', maxWidth: 58, fontFamily: 'Cairo-Bold' },
  logoImage: { width: LOGO_IMG, height: LOGO_IMG, borderRadius: scale(6) },
  logoHeaderImage: { width: 68, height: 34, resizeMode: 'contain' },
  notifBtn: { width: NOTIF_BTN, height: NOTIF_BTN, borderRadius: Math.round(NOTIF_BTN / 2), alignItems: 'center', justifyContent: 'center' },
  searchContainer: { flexDirection: 'row', paddingHorizontal: scale(16), marginBottom: 0, gap: 0 },
  searchWrapper: {
    flexDirection: 'row', alignItems: 'center', width: '100%', gap: scale(8),
  },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    borderRadius: 999, paddingHorizontal: scale(14),
    borderWidth: 0,
    gap: scale(8),
  },
  searchInput: { flex: 1, fontSize: scale(15), height: '100%' },
  searchBtn: {
    width: NOTIF_BTN, height: NOTIF_BTN,
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
  catChipsRow: { flexDirection: 'row', alignItems: 'center', gap: scale(8), paddingVertical: scale(6) },
  catChip: { borderWidth: 1, borderRadius: scale(999), paddingHorizontal: scale(14), paddingVertical: scale(6), },
  catChipText: { fontSize: scale(13), fontWeight: '700', fontFamily: 'Cairo-Bold' },

  activeFilterText: { fontSize: scale(11), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: scale(16), paddingTop: scale(14), paddingBottom: scale(4), gap: 0 },
  categoryGridItem: { alignItems: 'center', width: '25%', marginBottom: IS_VERY_SHORT_SCREEN ? scale(1) : scale(4) },
  categoryCircleScroll: { paddingHorizontal: scale(16), gap: scale(10), paddingBottom: scale(2), marginBottom: 0, paddingTop: scale(10) },
  categoryCircleItem: { alignItems: 'center', width: scale(68) },
  categoryCircle: {
    width: CATEGORY_CIRCLE, height: CATEGORY_CIRCLE, borderRadius: scale(12),
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
    overflow: 'hidden',
  },
  categoryCircleLabel: { fontSize: scale(10), marginTop: IS_VERY_SHORT_SCREEN ? scale(1) : scale(4), textAlign: 'center', fontFamily: 'Cairo-Regular' },
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
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch', width: '100%', paddingHorizontal: scale(16), paddingTop: scale(6), marginTop: scale(8), paddingBottom: IS_VERY_SHORT_SCREEN ? scale(1) : scale(2) },
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
    paddingHorizontal: scale(16), justifyContent: 'space-between', alignItems: 'stretch',
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

  // ===== City Picker =====
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
