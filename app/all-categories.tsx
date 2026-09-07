import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { selection } from '@/services/haptics';
import { scale } from '@/constants/responsive';

export default function AllCategoriesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, language, categories, setSelectedCategory, t, navigateToCategory, subCategories, currentCategoryPath, goBackCategory, resetCategoryNavigation } = useApp();
  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const lb = useCallback((en: string, fr: string, ar: string) => isFr ? fr : isAr ? ar : en, [isFr, isAr]);

  const getCategoryName = (cat: any) => cat?.name?.[language] || cat?.name?.en || '';

  const displayCategories = subCategories.length > 0 ? subCategories : categories;

  const handleSelect = async (cat: any) => {
    selection();
    await navigateToCategory(cat);
    // If no subcategories, go to home to show products
    if (!cat.hasChildren) {
      router.navigate('/(tabs)' as any);
    }
  };

  const renderCategory = ({ item }: { item: any }) => (
    <Pressable
      onPress={() => handleSelect(item)}
      style={({ pressed }) => [
        styles.categoryCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.borderLight,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      <View style={[styles.categoryIconWrap, item.image ? null : { backgroundColor: item.color + '22' }]}>
        {item.image ? (
          <Image
            source={item.image}
            style={{ width: '100%', height: '100%', borderRadius: 10 }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <MaterialIcons name={item.icon} size={scale(28)} color={item.color} />
        )}
      </View>
      <Text style={[styles.categoryName, { color: colors.textPrimary }]} numberOfLines={2}>
        {getCategoryName(item)}
      </Text>
      <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={scale(20)} color={colors.textTertiary} style={{ marginLeft: 'auto' }} />
    </Pressable>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={scale(22)} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {lb('All Categories', 'Toutes les catégories', 'كل الأقسام')}
        </Text>
        <View style={{ width: scale(28) }} />
      </View>

      <FlatList
        data={displayCategories}
        keyExtractor={(item) => item.id}
        renderItem={renderCategory}
        contentContainerStyle={{ paddingTop: scale(8), paddingBottom: insets.bottom + scale(16), paddingHorizontal: scale(16) }}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: scale(8) }} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(12),
    paddingVertical: scale(10),
    borderBottomWidth: 1,
  },
  backBtn: { padding: scale(4) },
  headerTitle: { fontSize: scale(18), fontWeight: '700' },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: scale(12),
    borderRadius: scale(12),
    borderWidth: 1,
    gap: scale(12),
  },
  categoryIconWrap: {
    width: scale(52),
    height: scale(52),
    borderRadius: scale(12),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  categoryName: {
    fontSize: scale(15),
    fontWeight: '600',
    flex: 1,
  },
});