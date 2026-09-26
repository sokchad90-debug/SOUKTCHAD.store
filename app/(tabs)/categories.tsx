import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { selection } from '@/services/haptics';
import { shadows } from '@/constants/theme';
import { BOTTOM_NAV_CONTENT_GAP, scale, usePhoneLayout } from '@/constants/responsive';
import { AppText } from '@/components/AppText';
import { DS } from '@/ui/designSystem';
import { CATEGORY_TREE, descendantsOf, CATEGORY_IMAGE_BY_ID } from '@/services/categoryTree';

// Static per-category images (managed data source) — mapped by category id family.
const CATEGORY_IMAGES: Record<string, any> = {
  electronics: require('@/assets/images/categories/electronics.png'),
  electronics_phones: require('@/assets/images/categories/electronics.png'),
  electronics_laptops: require('@/assets/images/categories/electronics.png'),
  electronics_audio: require('@/assets/images/categories/electronics.png'),
  electronics_tv: require('@/assets/images/categories/electronics.png'),
  fashion: require('@/assets/images/categories/fashion.png'),
  fashion_men: require('@/assets/images/categories/fashion.png'),
  fashion_women: require('@/assets/images/categories/fashion.png'),
  fashion_kids: require('@/assets/images/categories/fashion.png'),
  shoes: require('@/assets/images/categories/shoes.png'),
  shoes_sneakers: require('@/assets/images/categories/shoes.png'),
  shoes_formal: require('@/assets/images/categories/shoes.png'),
  home: require('@/assets/images/categories/home_garden.png'),
  home_garden: require('@/assets/images/categories/home_garden.png'),
  vehicles: require('@/assets/images/categories/vehicles.png'),
  vehicles_sedans: require('@/assets/images/categories/vehicles.png'),
  vehicles_suvs: require('@/assets/images/categories/vehicles.png'),
  agriculture: require('@/assets/images/categories/agriculture.png'),
  services: require('@/assets/images/categories/services.png'),
  real_estate: require('@/assets/images/categories/real_estate.png'),
  immobilier: require('@/assets/images/categories/real_estate.png'),
};

// Pastel frame background per category color (light tint of the brand color)
const pastel = (color?: string) => `${color || '#E2E8F0'}1A`;

export default function CategoriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const layout = usePhoneLayout();
  const { width: winW } = useWindowDimensions();
  const { colors, language, products, setSelectedCategory, categories, navigateToCategory, subCategories, currentCategoryPath, goBackCategory, resetCategoryNavigation } = useApp();

  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const lb = (en: string, fr: string, ar: string) => isFr ? fr : isAr ? ar : en;

  // Container-measured card width: (container - side margins 32 - 2 column gaps 24) / 3
  const [gridW, setGridW] = useState(() => winW);
  const COLS = 3;
  const SIDE = scale(16);
  const GAP = scale(12);
  const ROW_GAP = scale(16);
  const CARD_W = Math.floor((gridW - SIDE * 2 - GAP * (COLS - 1)) / COLS);
  const IMG_H = Math.round(CARD_W * 0.86); // square-ish pastel frame per reference

  // Show subcategories when navigating into one, otherwise root categories.
  // Buyer-side: hide categories with no products AND no children (empty branches);
  // families with children stay visible as browse hubs even with 0 direct products.
  const displayCategories = useMemo(() => {
    // Root view = top-level families only (children appear when a family is opened)
    const list = subCategories.length > 0
      ? subCategories
      : (categories || []).filter(c => !c.parentId);
    const visible = list.filter(c => c.id !== 'all');
    // Count including descendants
    const countAll = (catId: string): number => {
      const kids = (categories || []).filter(c => c.parentId === catId).map(c => c.id);
      const direct = (products || []).filter(p => p?.categoryId === catId).length;
      const viaKids = (products || []).filter(p => p?.categoryId && kids.includes(p.categoryId)).length;
      return direct + viaKids;
    };
    const hasKids = (catId: string): boolean => (categories || []).some(c => c.parentId === catId);
    return visible.filter(c => {
      // Only filter EMPTY LEAVES out of the buyer view (parents stay as hubs);
      // when products haven't loaded yet (count source empty) show everything honestly
      if (!products || products.length === 0) return true;
      if (hasKids(c.id)) return true;
      return countAll(c.id) > 0;
    });
  }, [categories, subCategories, products]);

  // "عرض الكل" — navigation action for the CURRENT level scope (not a sellable category)
  const showAllForCurrent = () => {
    selection();
    const parent = currentCategoryPath.length > 0
      ? currentCategoryPath[currentCategoryPath.length - 1].id
      : 'all';
    setSelectedCategory(parent as any);
    router.navigate('/(tabs)' as any);
  };

  const handleCategoryPress = async (cat: any) => {
    await navigateToCategory(cat);
    // If the category has no subcategories, navigate to Home to show products
    if (!cat.hasChildren) {
      router.navigate('/(tabs)' as any);
    }
  };

  // Real count from loaded products. null = not loaded yet (no fake zeros)
  const getCategoryCount = (catId: string): number | null => {
    if (!products || products.length === 0) return null;
    // Direct + ALL descendants counting (no duplicates: each ad has one leaf)
    const scope = [catId, ...descendantsOf(CATEGORY_TREE, catId)];
    return products.filter(p => p?.categoryId && scope.includes(p.categoryId)).length;
  };

  const renderCategory = ({ item: cat }: { item: any }) => {
    const count = getCategoryCount(cat.id);
    const name = (cat.name as Record<string, string>)?.[language] || (cat.name as Record<string, string>)?.en || cat.id;
    const icon = (cat.icon || 'category') as any;
    const color = cat.color || '#FF7A00';
    const image = CATEGORY_IMAGES[cat.id] || CATEGORY_IMAGE_BY_ID[cat.id];
    return (
      <Pressable
        onPress={() => handleCategoryPress(cat)}
        testID={`category-card-${cat.id}`}
        style={({ pressed }) => [
          styles.categoryCard,
          { width: CARD_W, backgroundColor: colors.surface, borderColor: colors.borderLight, opacity: pressed ? 0.92 : 1 },
          shadows.card,
        ]}
      >
        <View style={[styles.categoryIconWrap, { height: IMG_H, backgroundColor: pastel(color) }]}>
          {image ? (
            <Image
              source={image}
              style={styles.categoryImage}
              contentFit="contain"
              contentPosition="center"
              transition={120}
            />
          ) : (
            <MaterialIcons name={icon} size={scale(30)} color={color} />
          )}
        </View>
        <Text style={[styles.categoryName, { color: colors.textPrimary }]} numberOfLines={2}>
          {name}
        </Text>
        <View style={styles.categoryCountWrap}>
          {count != null && count > 0 ? (
            <View style={[styles.categoryCount, { backgroundColor: pastel(color) }]}>
              <Text style={[styles.categoryCountText, { color }]}>{count}</Text>
            </View>
          ) : count == null ? (
            // products not loaded yet — show nothing rather than a fake 0
            <View style={{ height: scale(16) }} />
          ) : null}
        </View>
      </Pressable>
    );
  };

  const categoryNameOf = (c: { id: string; name: any }) => (c.name as Record<string, string>)?.[language] || c.name?.en || c.id;
  const inSubMode = subCategories.length > 0;

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Breadcrumb path + back — restores level and scroll state (path kept in context) */}
      {currentCategoryPath.length > 0 && (
        <View style={[styles.crumbRow, isAr && { flexDirection: 'row-reverse' }]}>
          <Pressable onPress={() => { selection(); goBackCategory(); }} hitSlop={scale(10)}
            accessibilityRole="button" accessibilityLabel={lb('Back', 'Retour', 'رجوع')}>
            <MaterialIcons name={isAr ? 'arrow-forward' : 'arrow-back'} size={scale(22)} color={colors.textPrimary} />
          </Pressable>
          <Text style={[styles.crumbText, { color: colors.textTertiary }]} numberOfLines={1}>
            {currentCategoryPath.map((p, i) => (
              <Text key={p.id}>{i > 0 ? (isAr ? ' ← ' : ' → ') : ''}{p.name}</Text>
            ))}
          </Text>
          {/* عرض الكل for the current level scope */}
          <Pressable onPress={showAllForCurrent} hitSlop={scale(8)}
            style={[styles.seeAllBtn, { borderColor: colors.primary }]}
            accessibilityRole="button" accessibilityLabel={lb('View all', 'Tout voir', 'عرض الكل')}>
            <Text style={[styles.seeAllText, { color: colors.primary }]}>
              {lb('View all', 'Tout voir', 'عرض الكل')}
            </Text>
          </Pressable>
        </View>
      )}
      <FlatList
        data={displayCategories}
        renderItem={renderCategory}
        keyExtractor={(item) => item.id}
        numColumns={3}
        columnWrapperStyle={[styles.row, isAr && { flexDirection: 'row-reverse' }]}
        contentContainerStyle={{ paddingHorizontal: scale(16), paddingTop: scale(16), paddingBottom: layout.safeBottom + BOTTOM_NAV_CONTENT_GAP + layout.smallGap }}
        onLayout={(e) => setGridW(e.nativeEvent.layout.width)}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: scale(40), gap: scale(8) }}>
            <MaterialIcons name="category" size={scale(44)} color={colors.textTertiary} />
            <Text style={{ fontSize: scale(14), fontWeight: '600', color: colors.textSecondary, textAlign: 'center' }}>
              {lb('No products in this branch yet', 'Aucun produit dans cette branche', 'لا توجد منتجات في هذا الفرع بعد')}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: { gap: scale(12), marginBottom: scale(16) },
  categoryCard: { borderRadius: scale(16), borderWidth: 1, borderColor: '#EEF2F7', padding: scale(8), alignItems: 'center', gap: scale(6) },
  categoryIconWrap: { width: '100%', borderRadius: scale(14), alignItems: 'center', justifyContent: 'center' },
  categoryImage: { width: '100%', height: '100%' },
  categoryName: { fontSize: scale(13), fontWeight: '600', textAlign: 'center', minHeight: scale(32), lineHeight: scale(16) },
  crumbRow: { flexDirection: 'row', alignItems: 'center', gap: scale(8), paddingHorizontal: scale(16), paddingTop: scale(12), paddingBottom: scale(4) },
  crumbText: { fontSize: scale(13), fontWeight: '600', flex: 1 },
  seeAllBtn: { borderWidth: 1, borderRadius: scale(14), paddingHorizontal: scale(12), paddingVertical: scale(6) },
  seeAllText: { fontSize: scale(12), fontWeight: '700' },
  categoryCountWrap: { height: scale(20), justifyContent: 'center' },
  categoryCount: { paddingHorizontal: scale(10), paddingVertical: scale(2), borderRadius: scale(10) },
  categoryCountText: { fontSize: scale(11), fontWeight: '700' },
});
