import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { CATEGORY_IMAGE_BY_ID } from '@/services/categoryTree';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { selection } from '@/services/haptics';
import { shadows } from '@/constants/theme';
import { scale } from '@/constants/responsive';

export default function CategoriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const { colors, language, products, setSelectedCategory, categories, navigateToCategory, subCategories, currentCategoryPath, goBackCategory } = useApp();

  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const lb = (en: string, fr: string, ar: string) => isFr ? fr : isAr ? ar : en;

  // Container-measured card width keeps four equal columns on normal phones.
  const [gridW, setGridW] = useState(winW);
  const COLS = 4;
  const SIDE = scale(12);
  const GAP = scale(8);
  const CARD_W = Math.floor((gridW - SIDE * 2 - GAP * (COLS - 1)) / COLS);

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

  const renderCategory = ({ item: cat }: { item: any }) => {
    const name = (cat.name as Record<string, string>)?.[language] || (cat.name as Record<string, string>)?.en || cat.id;
    const icon = (cat.icon || 'category') as any;
    const color = cat.color || colors.primary;
    // Photo per category: local asset by id (roots + known leaves), fallback icon
    const photo = (cat as any).image || CATEGORY_IMAGE_BY_ID[cat.id];
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
        <View style={[styles.categoryImageWrap, { backgroundColor: colors.backgroundSecondary || '#F6F6FB' }]}>
          {photo ? (
            <Image
              source={photo}
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
      </Pressable>
    );
  };

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
              <Text key={p.id}>{`${i > 0 ? (isAr ? ' ← ' : ' → ') : ''}${p.name}`}</Text>
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
        numColumns={4}
        columnWrapperStyle={[styles.row, isAr && { flexDirection: 'row-reverse' }]}
        contentContainerStyle={{ paddingHorizontal: SIDE, paddingTop: scale(8), paddingBottom: insets.bottom + scale(90) }}
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
  row: { gap: scale(8), marginBottom: scale(10) },
  categoryCard: { minHeight: scale(90), borderRadius: scale(14), borderWidth: scale(1), padding: scale(6), alignItems: 'center', gap: scale(5) },
  categoryImageWrap: { width: '100%', aspectRatio: 1, borderRadius: scale(12), overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  categoryImage: { width: '100%', height: '100%' },
  categoryName: { width: '100%', minHeight: scale(32), fontSize: scale(12), lineHeight: scale(16), fontWeight: '600', textAlign: 'center' },
  crumbRow: { flexDirection: 'row', alignItems: 'center', gap: scale(8), paddingHorizontal: scale(16), paddingTop: scale(12), paddingBottom: scale(4) },
  crumbText: { fontSize: scale(13), fontWeight: '600', flex: 1 },
  seeAllBtn: { borderWidth: scale(1), borderRadius: scale(14), paddingHorizontal: scale(12), paddingVertical: scale(6) },
  seeAllText: { fontSize: scale(12), fontWeight: '700' },
});
