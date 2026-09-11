import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { shadows } from '@/constants/theme';
import { scale, usePhoneLayout } from '@/constants/responsive';


export default function CategoriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const layout = usePhoneLayout();
  // Reactive 3-column card size from the canonical engine (was module-eval SCREEN_WIDTH)
  const CARD_SIZE = Math.floor((layout.contentWidth - scale(24)) / 3);
  const { colors, language, products, setSelectedCategory, categories, navigateToCategory, subCategories, currentCategoryPath, goBackCategory, resetCategoryNavigation } = useApp();

  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const lb = (en: string, fr: string, ar: string) => isFr ? fr : isAr ? ar : en;

  // Show subcategories if navigating into a parent, otherwise show root categories
  const displayCategories = useMemo(() => {
    const list = subCategories.length > 0 ? subCategories : categories;
    return list.filter(c => c.id !== 'all');
  }, [categories, subCategories]);

  const handleCategoryPress = async (cat: any) => {
    await navigateToCategory(cat);
    // If the category has no subcategories, navigate to Home to show products
    if (!cat.hasChildren) {
      router.navigate('/(tabs)' as any);
    }
  };

  const getCategoryCount = (catId: string) => {
    return products.filter(p => p?.categoryId === catId).length;
  };

  const renderCategory = ({ item: cat }: { item: any }) => {
    const count = getCategoryCount(cat.id);
    const name = (cat.name as Record<string, string>)[language] || (cat.name as Record<string, string>).en || cat.id;
    const icon = cat.icon || 'category';
    const color = cat.color || '#FF7A00';
    return (
      <Pressable
        onPress={() => handleCategoryPress(cat)}
        style={({ pressed }) => [
          styles.categoryCard, { width: CARD_SIZE, backgroundColor: colors.surface, borderColor: colors.borderLight, opacity: pressed ? 0.9 : 1 }, shadows.card,
        ]}
      >
        <View style={[styles.categoryIconWrap, { width: CARD_SIZE - scale(24), height: CARD_SIZE - scale(24), backgroundColor: color + '15' }]}>
          <MaterialIcons name={icon as any} size={scale(28)} color={color} />
        </View>
        <Text style={[styles.categoryName, { color: colors.textPrimary }]} numberOfLines={2}>{name}</Text>
        <View style={[styles.categoryCount, { backgroundColor: color + '12' }]}>
          <Text style={[styles.categoryCountText, { color }]}>{count}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingBottom: scale(14), borderBottomColor: colors.border }, isAr && { alignItems: 'flex-end' }]}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary, textAlign: isAr ? 'right' : 'left' }]}>{lb('Categories', 'Catégories', 'الأقسام')}</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textTertiary, textAlign: isAr ? 'right' : 'left' }]}>{displayCategories.length} {lb('categories', 'catégories', 'قسم')}</Text>
      </View>
      <FlatList
        data={displayCategories}
        renderItem={renderCategory}
        keyExtractor={(item) => item.id}
        numColumns={3}
        columnWrapperStyle={[styles.row, isAr && { flexDirection: 'row-reverse' }]}
        contentContainerStyle={{ padding: scale(16), paddingBottom: insets.bottom + scale(20) }}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: scale(20), paddingTop: scale(8), borderBottomWidth: 1 },
  headerTitle: { fontSize: scale(26), fontWeight: '800', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: scale(13), fontWeight: '500', marginTop: scale(2) },
  row: { gap: scale(12), marginBottom: scale(12) },
  categoryCard: { borderRadius: scale(16), borderWidth: 1, padding: scale(12), alignItems: 'center', gap: scale(8) },
  categoryIconWrap: { borderRadius: scale(14), alignItems: 'center', justifyContent: 'center' },
  categoryName: { fontSize: scale(12), fontWeight: '600', textAlign: 'center', lineHeight: 15 },
  categoryCount: { paddingHorizontal: scale(8), paddingVertical: scale(2), borderRadius: scale(10) },
  categoryCountText: { fontSize: scale(10), fontWeight: '700' },
});