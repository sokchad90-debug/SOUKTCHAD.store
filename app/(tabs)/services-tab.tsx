import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { shadows } from '@/constants/theme';
import { BOTTOM_NAV_CONTENT_GAP, scale, usePhoneLayout } from '@/constants/responsive';
import ConnectionStateView from '@/components/ConnectionStateView';

/**
 * Services — dedicated tab for الخدمات category (and future service offers).
 * Same visual language as the approved Categories screen: 3 equal columns,
 * pastel frames, contain images, real product counts, RTL/FR/AR, grows with font.
 * Products in category 'services' (and its children) surface here directly.
 */
const SERVICE_IMAGES: Record<string, any> = {
  services: require('@/assets/images/categories/services.png'),
};

export default function ServicesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const layout = usePhoneLayout();
  const { width: winW } = useWindowDimensions();
  const { colors, language, products, categories, subCategories, setSelectedCategory } = useApp();

  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const lb = (en: string, fr: string, ar: string) => isFr ? fr : isAr ? ar : en;

  // Container-measured card width (same rule as Categories)
  const [gridW, setGridW] = useState(() => winW);
  const COLS = 3;
  const CARD_W = Math.floor((gridW - scale(16) * 2 - scale(12) * (COLS - 1)) / COLS);

  // Real DB categories that BELONG to services family (id === 'services' or parentId chain)
  const serviceCats = useMemo(() => {
    const all = [...categories, ...subCategories];
    const isServiceFamily = (id: string) => id === 'services' || id.startsWith('services_');
    const direct = all.filter(c => isServiceFamily(c.id));
    return direct.length > 0 ? direct : all.filter(c => c.id === 'services');
  }, [categories, subCategories]);

  const countFor = (id: string): number | null => {
    if (!products || products.length === 0) return null;
    const kids = (categories || []).filter(c => c.parentId === id).map(c => c.id);
    const direct = products.filter(p => p?.categoryId === id).length;
    const viaKids = products.filter(p => p?.categoryId && kids.includes(p.categoryId)).length;
    return direct + viaKids;
  };

  const renderItem = ({ item: cat }: { item: any }) => {
    const count = countFor(cat.id);
    const name = (cat.name as Record<string, string>)?.[language] || (cat.name as Record<string, string>)?.en || cat.id;
    const color = cat.color || '#8B5CF6';
    const image = SERVICE_IMAGES[cat.id];
    return (
      <Pressable
        onPress={() => {
          setSelectedCategory(cat.id);
          router.navigate('/(tabs)' as any);
        }}
        testID={`service-card-${cat.id}`}
        style={({ pressed }) => [
          styles.card,
          { width: CARD_W, backgroundColor: colors.surface, borderColor: colors.borderLight, opacity: pressed ? 0.92 : 1 },
          shadows.card,
        ]}
      >
        <View style={[styles.imgFrame, { height: Math.round(CARD_W * 0.86), backgroundColor: `${color}1A` }]}>
          {SERVICE_IMAGES[cat.id] ? (
            <Image source={SERVICE_IMAGES[cat.id]} style={styles.img} contentFit="contain" contentPosition="center" transition={120} />
          ) : (
            <MaterialIcons name={(cat.icon as any) || 'handyman'} size={scale(30)} color={color} />
          )}
        </View>
        <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={2}>{name}</Text>
        <View style={{ height: scale(20), justifyContent: 'center' }}>
          {count != null && count > 0 ? (
            <View style={[styles.count, { backgroundColor: `${color}1A` }]}>
              <Text style={[styles.countText, { color }]}>{count}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={serviceCats}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={3}
        columnWrapperStyle={[styles.row, isAr && { flexDirection: 'row-reverse' }]}
        contentContainerStyle={{ paddingHorizontal: scale(16), paddingTop: scale(16), paddingBottom: insets.bottom + BOTTOM_NAV_CONTENT_GAP + layout.smallGap }}
        onLayout={(e) => setGridW(e.nativeEvent.layout.width)}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <ConnectionStateView state="empty" compact />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: { gap: scale(12), marginBottom: scale(16) },
  card: { borderRadius: scale(16), borderWidth: 1, borderColor: '#EEF2F7', padding: scale(8), alignItems: 'center', gap: scale(6) },
  imgFrame: { width: '100%', borderRadius: scale(14), alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  name: { fontSize: scale(13), fontWeight: '600', textAlign: 'center', minHeight: scale(32), lineHeight: scale(16) },
  count: { paddingHorizontal: scale(10), paddingVertical: scale(2), borderRadius: scale(10) },
  countText: { fontSize: scale(11), fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: scale(60), gap: scale(12) },
  emptyText: { fontSize: scale(14), fontWeight: '600' },
});
