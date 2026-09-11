import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, RefreshControl,
  ActivityIndicator, Share, FlatList, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useApp } from '@/contexts/AppContext';
import { formatPrice } from '@/constants/config';
import { shadows } from '@/constants/theme';
import * as ImagePicker from "expo-image-picker";
import { selection, impactLight, notifySuccess } from '@/services/haptics';
import { scale, usePhoneLayout } from '@/constants/responsive';
import { fetchSellerStats as apiFetchSellerStats, StatsFromAPI } from '@/services/ordersService';

const CARD_GAP = scale(10);
const BANNER_H = scale(140);

export default function StoreProfileScreen() {
  const layoutSP = usePhoneLayout();
  const CARD_GAP_SP = scale(10);
  const CARD_W = Math.floor((layoutSP.contentWidth - CARD_GAP_SP) / 2);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    colors, t, language, user, isLoggedIn, products, isReady, refreshProducts,
    updateStoreLogo, updateStoreBanner, fetchSellerPaymentMethods,
  } = useApp();

  const [sellerPayments, setSellerPayments] = useState<any[]>([]);
  const [followerCount, setFollowerCount] = useState(0);

  const [refreshing, setRefreshing] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<StatsFromAPI | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const lb = useCallback((en: string, fr: string, ar: string) => isFr ? fr : isAr ? ar : en, [isFr, isAr]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const { data, error } = await apiFetchSellerStats();
      if (data && !error) setStats(data);
    } catch (e) { console.log('Seller stats error:', e); }
    setStatsLoading(false);
  }, []);

  useEffect(() => { if (isLoggedIn) loadStats(); }, [isLoggedIn, loadStats]);

  useEffect(() => {
    if (isLoggedIn && user?.id) {
      fetchSellerPaymentMethods(Number(user.id)).then(data => setSellerPayments(data || [])).catch(() => {});
      apiFetchSellerStats().then(({ data }) => {
        if ((data as any)?.followers_count != null) setFollowerCount((data as any).followers_count);
      }).catch(() => {});
    }
  }, [isLoggedIn, user?.id, fetchSellerPaymentMethods]);

  const userListings = useMemo(() => (products || []).filter(p => {
    if (!p?.sellerId || !user?.id) return false;
    return p.sellerId === user.id
      || String(p.sellerId) === String(user.numericId ?? '')
      || String(p.sellerId) === String(user.sellerId ?? '');
  }), [products, user?.id, user?.numericId, user?.sellerId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshProducts(), loadStats()]);
    setTimeout(() => setRefreshing(false), 600);
  }, [refreshProducts, loadStats]);

  const storeUrl = `https://souktchad.shop/seller/${user?.sellerId || user?.numericId || user?.id || ''}`;

  const handleShareStore = useCallback(async () => {
    impactLight();
    const storeName = user?.username || user?.name || '';
    try { await Share.share({ message: `${storeName}\n${storeUrl}` }); } catch (e) {}
  }, [user, storeUrl]);

  const handleCopyLink = useCallback(async () => {
    impactLight();
    try {
      await Clipboard.setStringAsync(storeUrl);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch (e) {}
  }, [storeUrl]);

  const handleLogoUpload = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setUploadingLogo(true); await updateStoreLogo(result.assets[0].uri); notifySuccess();
      }
    } catch (e) { Alert.alert('Error', 'Failed to upload logo'); }
    setUploadingLogo(false);
  }, [updateStoreLogo]);

  const handleBannerUpload = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [16, 9], quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setUploadingBanner(true); await updateStoreBanner(result.assets[0].uri); notifySuccess();
      }
    } catch (e) { Alert.alert('Error', 'Failed to upload banner'); }
    setUploadingBanner(false);
  }, [updateStoreBanner]);

  // Compute stats from API
  const orderStatus = stats?.order_status || {};
  const totalOrders = stats?.total_orders || 0;
  const completedOrders = orderStatus['completed'] || 0;
  const pendingOrders = (orderStatus['pending'] || 0) + (orderStatus['confirmed'] || 0);
  const cancelledOrders = (orderStatus['cancelled'] || 0) + (orderStatus['disputed'] || 0);
  const successRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;
  const totalRevenue = stats?.total_revenue || 0;
  const activeProducts = stats?.total_products || userListings.length;
  const avgRating = stats?.avg_rating || 0;
  const reviewCount = stats?.review_count || 0;
  const productCount = userListings.length;

  const renderProductItem = useCallback(({ item, index }: any) => (
    <Pressable
      onPress={() => router.push(`/product/${item.id}` as any)}
      style={({ pressed }) => [styles.productCard, { width: CARD_W, backgroundColor: colors.surface, borderColor: colors.borderLight, opacity: pressed ? 0.9 : 1 }, shadows.card]}
    >
      <View style={[styles.productImageFrame, { height: Math.round(CARD_W * 0.78), padding: Math.min(Math.max(Math.round(CARD_W * 0.04), 6), 12) }]}>
        <Image source={{ uri: item?.images?.[0] || '' }} style={styles.productImage} contentFit="contain" contentPosition="center" transition={150} />
      </View>
      <Text style={[styles.productTitle, { color: colors.textPrimary }]} numberOfLines={2}>
        {item?.title?.[language] || item?.title?.en || ''}
      </Text>
      <Text style={[styles.productPrice, { color: colors.primary }]}>{formatPrice(item?.price || 0)}</Text>
    </Pressable>
  ), [colors, language, router]);

  if (!isReady) {
    return <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + scale(100) }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}>
        
        {/* ===== STORE HEADER ===== */}
        <View style={styles.headerWrap}>
          <Pressable onPress={handleBannerUpload} style={[styles.bannerContainer, { width: '100%' }]}>
            {user?.coverImage ? (
              <Image source={{ uri: user?.coverImage }} style={styles.bannerImage} contentFit="cover" transition={200} />
            ) : (
              <View style={[styles.bannerPlaceholder, { backgroundColor: colors.primary + '20' }]}>
                <MaterialIcons name="storefront" size={scale(40)} color={colors.primary} />
                <View style={[styles.bannerHint, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
                  <MaterialIcons name="photo-camera" size={scale(16)} color="#FFF" />
                  <Text style={styles.bannerHintText}>{lb('Add Banner', 'Ajouter bannière', 'إضافة بانر')}</Text>
                </View>
              </View>
            )}
            {user?.coverImage ? (
              <View style={[styles.bannerEditBadge, { backgroundColor: colors.primary }]}>
                <MaterialIcons name="photo-camera" size={scale(14)} color="#FFF" />
              </View>
            ) : null}
            {uploadingBanner ? <View style={styles.bannerOverlay}><ActivityIndicator size="small" color="#FFF" /></View> : null}
          </Pressable>

          {/* Top-right icons: edit store (👤) + general settings (⚙️) */}
          <View style={styles.headerButtons}>
            <Pressable onPress={() => { selection(); router.push('/seller-settings' as any); }} hitSlop={12} style={styles.headerBtn}>
              <View style={styles.gearWrap}>
                <MaterialIcons name="person" size={scale(16)} color="#FFF" />
              </View>
            </Pressable>
            <Pressable onPress={() => { selection(); router.push('/settings' as any); }} hitSlop={12} style={styles.headerBtn}>
              <View style={styles.gearWrap}>
                <MaterialIcons name="settings" size={scale(16)} color="#FFF" />
              </View>
            </Pressable>
          </View>

          {/* Logo + Store info */}
          <View style={styles.storeInfoRow}>
            <Pressable onPress={handleLogoUpload} style={styles.logoContainer}>
              {user?.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.logoImage} contentFit="cover" transition={200} />
              ) : (
                <View style={[styles.logoPlaceholder, { backgroundColor: colors.primary }]}>
                  <Text style={styles.logoText}>{(user?.name || 'S').charAt(0).toUpperCase()}</Text>
                </View>
              )}
              {/* Camera badge on logo */}
              <View style={[styles.logoCameraBadge, { backgroundColor: colors.primary }]}>
                <MaterialIcons name="photo-camera" size={scale(12)} color="#FFF" />
              </View>
              {uploadingLogo ? <View style={styles.logoOverlay}><ActivityIndicator size="small" color="#FFF" /></View> : null}
            </Pressable>

            <View style={styles.storeMeta}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(6) }}>
                <Text style={[styles.storeName, { color: '#FFF' }]} numberOfLines={1}>{user?.username || user?.name || ''}</Text>
                {user?.isVerified && <MaterialIcons name="verified" size={scale(16)} color="#FFF" />}
              </View>
              {user?.sellerId ? <Text style={[styles.storeId, { color: '#FFFFFFCC' }]}>{user?.sellerId || ''}</Text> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(12), marginTop: scale(4) }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(4) }}>
                  <MaterialIcons name="inventory-2" size={scale(14)} color="#FFFFFFCC" />
                  <Text style={[styles.metaText, { color: '#FFFFFFCC' }]}>{productCount}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(4) }}>
                  <MaterialIcons name="people-alt" size={scale(14)} color="#FFFFFFCC" />
                  <Text style={[styles.metaText, { color: '#FFFFFFCC' }]}>{followerCount}</Text>
                </View>
                <Pressable onPress={handleShareStore} hitSlop={8}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(4) }}>
                    <MaterialIcons name="share" size={scale(14)} color="#FFFFFFCC" />
                    <Text style={[styles.metaText, { color: '#FFFFFFCC' }]}>{lb('Share', 'Partager', 'مشاركة')}</Text>
                  </View>
                </Pressable>
                <Pressable onPress={handleCopyLink} hitSlop={8}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(4) }}>
                    <MaterialIcons name="content-copy" size={scale(14)} color={copied ? colors.primary : '#FFFFFFCC'} />
                    <Text style={[styles.metaText, { color: copied ? colors.primary : '#FFFFFFCC' }]} numberOfLines={1}>
                      {copied ? lb('Copied', 'Copie', 'منسوخ') : lb('Copy', 'Copier', 'نسخ')}
                    </Text>
                  </View>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* ===== PRODUCTS ===== */}
        {userListings.length > 0 && (
          <View style={[styles.sectionWrap, { marginTop: scale(16) }]}>
            <View style={[styles.sectionHeader, isAr && { flexDirection: 'row-reverse' }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary, flex: 1 }]}>{lb('My Products', 'Mes produits', 'منتجاتي')}</Text>
              <Pressable onPress={() => router.push('/seller-analytics' as any)} style={{ flexDirection: 'row', alignItems: 'center', gap: scale(4) }}>
                <Text style={[styles.seeAllText, { color: colors.primary }]}>{lb('See All', 'Voir tout', 'عرض الكل')}</Text>
                <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={scale(16)} color={colors.primary} />
              </Pressable>
            </View>
            <FlatList data={userListings.slice(0, 6)} renderItem={renderProductItem} keyExtractor={(item) => item.id} numColumns={2}
              columnWrapperStyle={{ gap: CARD_GAP, marginBottom: CARD_GAP }} scrollEnabled={false} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const HEADER_BG = '#6366F1';

const styles = StyleSheet.create({
  container: { flex: 1 },
  settingsGear: { position: 'absolute', top: scale(12), right: scale(16), zIndex: 10 },
  headerButtons: { position: 'absolute', top: scale(12), right: scale(16), flexDirection: 'row', gap: scale(8), zIndex: 10 },
  headerBtn: {},
  gearWrap: { width: scale(32), height: scale(32), borderRadius: scale(16), alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 3 },
  headerWrap: { backgroundColor: HEADER_BG, paddingBottom: scale(20), borderBottomLeftRadius: scale(24), borderBottomRightRadius: scale(24) },
  bannerContainer: { height: BANNER_H, position: 'relative' },
  bannerImage: { width: '100%', height: '100%' },
  bannerPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  bannerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  bannerHint: { flexDirection: 'row', alignItems: 'center', gap: scale(4), paddingHorizontal: scale(10), paddingVertical: scale(5), borderRadius: scale(16), marginTop: scale(8) },
  bannerHintText: { fontSize: scale(11), fontWeight: '600', color: '#FFF', fontFamily: 'Cairo-Medium' },
  bannerEditBadge: { position: 'absolute', bottom: scale(8), right: scale(8), width: scale(28), height: scale(28), borderRadius: scale(14), alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  storeInfoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(16), marginTop: scale(-30), gap: scale(14) },
  logoContainer: { position: 'relative' },
  logoImage: { width: scale(72), height: scale(72), borderRadius: scale(36), borderWidth: 3, borderColor: '#FFF' },
  logoPlaceholder: { width: scale(72), height: scale(72), borderRadius: scale(36), alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFF' },
  logoText: { fontSize: scale(28), fontWeight: '800', color: '#FFF', fontFamily: 'Cairo-Bold' },
  logoOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: scale(36), backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  logoCameraBadge: { position: 'absolute', bottom: -scale(2), right: -scale(2), width: scale(24), height: scale(24), borderRadius: scale(12), alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  storeMeta: { flex: 1, gap: scale(2) },
  storeName: { fontSize: scale(20), fontWeight: '800', fontFamily: 'Cairo-Bold' },
  storeId: { fontSize: scale(12), fontWeight: '600', fontFamily: 'Cairo-Medium' },
  metaText: { fontSize: scale(12), fontWeight: '600', fontFamily: 'Cairo-Medium' },
  sectionWrap: { paddingHorizontal: scale(16), marginTop: scale(20) },
  sectionTitle: { fontSize: scale(18), fontWeight: '700', marginBottom: scale(12), fontFamily: 'Cairo-Bold' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: scale(12) },
  seeAllText: { fontSize: scale(13), fontWeight: '600', fontFamily: 'Cairo-Medium' },
  productCard: { borderRadius: scale(14), borderWidth: 1, overflow: 'hidden' },
  productImage: { width: '100%', height: '100%' },
  productImageFrame: { width: '100%', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  productTitle: { fontSize: scale(13), fontWeight: '600', padding: scale(8), paddingBottom: scale(2), fontFamily: 'Cairo-Medium' },
  productPrice: { fontSize: scale(15), fontWeight: '800', paddingHorizontal: scale(8), paddingBottom: scale(8), fontFamily: 'Cairo-Bold' },
});