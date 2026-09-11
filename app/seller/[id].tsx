import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Share, Platform, Animated, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { getSellerById, Seller } from '@/services/mockData';
import { formatPrice } from '@/constants/config';
import { borderRadius, shadows } from '@/constants/theme';
import { impactMedium, notifySuccess } from '@/services/haptics';
import { blockSeller } from '@/services/blockedSellers';
import { scale, usePhoneLayout } from '@/constants/responsive';
import AsyncStorage from '@react-native-async-storage/async-storage';

const COVER_HEIGHT = scale(160);
const AVATAR_SIZE = scale(96);

// Cover gradient colors (orange brand palette)
const COVER_GRADIENT: [string, string, string] = ['#F97316', '#EA580C', '#7C2D12'];

// Product image with fallback placeholder for missing/failed images
const ProductCardImage = ({ uri, colors }: { uri: string; colors: any }) => {
  const [failed, setFailed] = React.useState(false);
  if (failed || !uri) {
    return (
      <View style={[styles.productImage, styles.productImagePlaceholder, { backgroundColor: colors.surfaceElevated }]}>
        <MaterialIcons name="storefront" size={scale(40)} color={colors.textTertiary} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={styles.productImage}
      contentFit="cover"
      transition={200}
      onError={() => setFailed(true)}
    />
  );
};

// Review item with Read More toggle for long text
const ReviewItem = ({
  rev,
  colors,
  renderStars,
  lb,
}: {
  rev: any;
  colors: any;
  renderStars: (rating: number, size?: number) => React.ReactNode;
  lb: (en: string, fr: string, ar: string) => string;
}) => {
  const [expanded, setExpanded] = React.useState(false);
  const [photoFailed, setPhotoFailed] = React.useState(false);
  const isLong = rev.text.length > 150;
  const displayText = expanded || !isLong ? rev.text : rev.text.slice(0, 150) + '...';
  const showPhoto = rev.photoUri && !photoFailed;
  return (
    <View style={[styles.reviewCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }, shadows.card]}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewAvatarWrap}>
          <View style={[styles.reviewAvatar, { backgroundColor: colors.primary + '30' }]}>
            <Text style={[styles.reviewAvatarText, { color: colors.primary }]}>
              {rev.buyerName.charAt(0).toUpperCase()}
            </Text>
          </View>
        </View>
        <View style={styles.reviewHeaderInfo}>
          <Text style={[styles.reviewName, { color: colors.textPrimary }]} selectable={false}>{rev.buyerName}</Text>
          {renderStars(rev.rating, scale(14))}
        </View>
        <View style={[styles.reviewRatingPill, { backgroundColor: '#F59E0B' + '20' }]}>
          <MaterialIcons name="star" size={scale(12)} color="#F59E0B" />
          <Text style={styles.reviewRatingText}>{rev.rating.toFixed(1)}</Text>
        </View>
      </View>
      <Text style={[styles.reviewText, { color: colors.textSecondary }]}>{displayText}</Text>
      {isLong ? (
        <Pressable onPress={() => setExpanded(!expanded)} hitSlop={8}>
          <Text style={[styles.readMoreText, { color: colors.primary }]}>
            {expanded ? lb('Read Less', 'Lire moins', 'قراءة أقل') : lb('Read More', 'Lire plus', 'قراءة المزيد')}
          </Text>
        </Pressable>
      ) : null}
      {showPhoto ? (
        <Image
          source={{ uri: rev.photoUri }}
          style={styles.reviewPhoto}
          contentFit="cover"
          transition={200}
          onError={() => setPhotoFailed(true)}
        />
      ) : null}
      <View style={styles.reviewFooter}>
        <MaterialIcons name="access-time" size={scale(12)} color={colors.textTertiary} />
        <Text style={[styles.reviewDate, { color: colors.textTertiary }]}>
          {new Date(rev.createdAt).toLocaleDateString()}
        </Text>
      </View>
    </View>
  );
};

export default function SellerStoreScreen() {
  const layoutSL = usePhoneLayout();
  const CARD_WIDTH = Math.floor((layoutSL.contentWidth - scale(24)) / 2);
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, language, isDark, products, getReviewsForSeller, isLoggedIn, startConversation, user, getSellerById: ctxGetSellerById, fetchFollowStatus, toggleFollow, toggleFollowNotifications, fetchSellerStats, followStats } = useApp();

  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const lb = (en: string, fr: string, ar: string) => isFr ? fr : isAr ? ar : en;

  // Follow state
  const [isFollowing, setIsFollowing] = React.useState(false);
  const [notifEnabled, setNotifEnabled] = React.useState(false);
  const [sellerStats, setSellerStats] = React.useState<any>(null);
  const [coverBgFailed, setCoverBgFailed] = React.useState(false);

  // Search AppContext sellers (from DB) first, then fallback to mockData
  const sellerProducts = useMemo(() => products.filter(p => p.sellerId === id), [products, id]);
  const seller = ctxGetSellerById(id) || getSellerById(id);

  // Load per-seller profile from AsyncStorage (shared across logins on this device)
  // This is where updateStoreLogo/updateStoreBanner save their data
  const [savedProfile, setSavedProfile] = React.useState<any>(null);
  React.useEffect(() => {
    if (id) {
      AsyncStorage.getItem(`sokchad_seller_profile_${id}`).then(data => {
        if (data) {
          try { setSavedProfile(JSON.parse(data)); } catch (e) {}
        }
      }).catch(() => {});
    }
  }, [id]);

  // Fallback seller for unknown seller IDs (e.g. demo_seller). Build a minimal
  // Seller object from the seller's products so the profile still renders.
  // Priority: savedProfile (uploaded logo/banner) > user data > product data
  const isOwnProfile = user && String(user.id) === String(id);
  const fallbackSeller: Seller = {
    id: id,
    name: (isOwnProfile && user?.name) || savedProfile?.name || sellerProducts[0]?.sellerName || 'Seller',
    avatar: savedProfile?.avatar || (isOwnProfile && user?.avatar) || (sellerProducts[0] as any)?.sellerAvatar || '',
    storeBg: savedProfile?.storeBg || (isOwnProfile && (user as any)?.coverImage) || '',
    sellerId: id,
    isVerified: (isOwnProfile && user?.isVerified) || sellerProducts[0]?.sellerVerified || false,
    isBanned: false,
    location: sellerProducts[0]?.location || "N'Djamena",
    rating: 0,
    totalSales: 0,
    joinedDate: new Date().toISOString().split('T')[0],
    phone: '',
    isOnline: false,
    paymentMethods: [],
  };
  const effectiveSeller = seller || fallbackSeller;

  // Fetch follow status and seller stats on mount
  React.useEffect(() => {
    if (isLoggedIn && effectiveSeller?.id) {
      fetchFollowStatus(String(effectiveSeller.id)).then(status => {
        setIsFollowing(status.following);
        setNotifEnabled(status.notifications_enabled);
      });
      fetchSellerStats(String(effectiveSeller?.id)).then(stats => {
        if (stats) setSellerStats(stats);
      });
    }
  }, [effectiveSeller?.id, isLoggedIn]);

  // Merge API/local sellerStats with context followStats (which updates
  // immediately on follow/unfollow) so the count reflects the latest state.
  const mergedStats = useMemo(() => ({
    ...(sellerStats || {}),
    ...(followStats[id] || {}),
  }), [sellerStats, followStats, id]);
  const sellerReviews = useMemo(() => getReviewsForSeller(id), [id, getReviewsForSeller]);
  const avgRating = useMemo(() => {
    if (sellerReviews.length === 0) return effectiveSeller?.rating || 0;
    return sellerReviews.reduce((s, r) => s + r.rating, 0) / sellerReviews.length;
  }, [sellerReviews, effectiveSeller]);

  // Rating distribution (1-5 stars)
  const ratingDist = useMemo(() => {
    const dist = [0, 0, 0, 0, 0];
    sellerReviews.forEach(r => {
      if (r.rating >= 1 && r.rating <= 5) dist[r.rating - 1] += 1;
    });
    return dist;
  }, [sellerReviews]);

  const [activeTab, setActiveTab] = React.useState<'products' | 'reviews'>(tab === 'reviews' ? 'reviews' : 'products');
  const [fabVisible, setFabVisible] = React.useState(true);
  const lastScrollY = React.useRef(0);

  const handleShare = async () => {
    try {
      impactMedium();
      const msg = isFr
        ? `Découvrez la boutique "${effectiveSeller?.name}" sur Sokchad App - Le marché P2P du Tchad !\n\n${effectiveSeller?.sellerId} • ${effectiveSeller?.location} • ⭐ ${avgRating.toFixed(1)}`
        : isAr
        ? `اكتشف متجر "${effectiveSeller?.name}" على تطبيق سوق تشاد - سوق تشاد للتجارة!\n\n${effectiveSeller?.sellerId} • ${effectiveSeller?.location} • ⭐ ${avgRating.toFixed(1)}`
        : `Check out "${effectiveSeller?.name}" store on Sokchad App - Chad's P2P Marketplace!\n\n${effectiveSeller?.sellerId} • ${effectiveSeller?.location} • ⭐ ${avgRating.toFixed(1)}`;
      const sellerUrl = `https://souktchad.shop/seller/${effectiveSeller?.id}`;
      await Share.share({ message: `${msg}\n${sellerUrl}` });
    } catch (_e) { /* cancelled */ }
  };

  const handleContactSeller = () => {
    impactMedium();
    if (!isLoggedIn) {
      // Not logged in: navigate to login tab (auth handled there)
      router.push('/(tabs)' as any);
      return;
    }
    const greeting = isFr
      ? `Bonjour, je souhaite discuter avec votre boutique "${effectiveSeller?.name}"`
      : isAr
      ? `مرحباً، أريد التحدث مع متجركم "${effectiveSeller?.name}"`
      : `Hi, I'd like to chat with your store "${effectiveSeller?.name}"`;
    const convId = startConversation(effectiveSeller?.id, sellerProducts[0]?.id ?? '', greeting);
    if (convId) router.push(`/conversation/${convId}` as any);
  };

  const handleCall = () => {
    impactMedium();
    notifySuccess();
    // Phone number display only; in production this could trigger a tel: link
  };

  const handleBlockSeller = () => {
    if (!isLoggedIn || !user) return;
    Alert.alert(
      lb('Block Seller', 'Bloquer le vendeur', 'حظر البائع'),
      isAr
        ? 'لن تظهر لك منتجات هذا البائع ولن يستطيع التواصل معك. هل تريد المتابعة؟'
        : isFr
        ? "Les produits de ce vendeur ne s'afficheront plus et il ne pourra plus vous contacter. Voulez-vous continuer ?"
        : "You won't see this seller's products and they won't be able to contact you. Continue?",
      [
        { text: lb('Cancel', 'Annuler', 'إلغاء'), style: 'cancel' },
        {
          text: lb('Block', 'Bloquer', 'حظر'),
          style: 'destructive',
          onPress: async () => {
            const ok = await blockSeller(String(effectiveSeller.id));
            if (ok) {
              notifySuccess();
              router.back();
            } else {
              Alert.alert(lb('Failed to block seller', 'Échec du blocage', 'فشل الحظر'));
            }
          },
        },
      ],
    );
  };

  const renderStars = (rating: number, size = 14) => {
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map(s => (
          <MaterialIcons
            key={s}
            name={s <= Math.round(rating) ? 'star' : 'star-border'}
            size={size}
            color="#F59E0B"
          />
        ))}
      </View>
    );
  };

  const renderProduct = ({ item: product }: { item: typeof sellerProducts[0] }) => {
    const title = product.title[language] || product.title.en;
    return (
      <Pressable
        onPress={() => router.push(`/product/${product.id}` as any)}
        style={({ pressed }) => [
          styles.productCard,
          { width: CARD_WIDTH, backgroundColor: colors.surface, borderColor: colors.borderLight, opacity: pressed ? 0.92 : 1 },
          shadows.card,
        ]}
      >
        <ProductCardImage uri={product.images[0]} colors={colors} />
        <View style={styles.productInfo}>
          <Text style={[styles.productPrice, { color: colors.primary }]}>{formatPrice(product.price)}</Text>
          <Text style={[styles.productTitle, { color: colors.textPrimary }]} numberOfLines={2}>{title}</Text>
        </View>
      </Pressable>
    );
  };

  // Seller info row item helper
  const InfoItem = ({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) => (
    <View style={[styles.infoItem, { backgroundColor: isDark ? colors.surfaceElevated : colors.background }, isAr && { flexDirection: 'row-reverse' }]}>
      <View style={[styles.infoIconWrap, { backgroundColor: color + '20' }]}>
        <MaterialIcons name={icon as any} size={scale(14)} color={color} />
      </View>
      <View style={[styles.infoTextWrap, isAr && { alignItems: 'flex-end' }]}>
        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );

  // Format phone as +235 66••••12
  const formatMaskedPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 4) return phone;
    const prefix = digits.slice(0, 2);
    const suffix = digits.slice(-2);
    const masked = '•'.repeat(Math.max(0, digits.length - 4));
    return '+235 ' + prefix + masked + suffix;
  };

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <FlatList
        data={sellerProducts}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={sellerProducts.length > 0 ? styles.row : undefined}
        contentContainerStyle={{ paddingBottom: insets.bottom + scale(100) }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* ============ COVER + HEADER ============ */}
            <View style={[styles.coverWrap, { height: COVER_HEIGHT + (insets?.top || 0) }]}>
              {effectiveSeller.storeBg && !coverBgFailed ? (
                <Image
                  source={{ uri: effectiveSeller.storeBg }} cachePolicy="memory-disk"
                  style={styles.coverImage}
                  contentFit="cover"
                  transition={200}
                  onError={() => setCoverBgFailed(true)}
                />
              ) : (
                <LinearGradient
                  colors={COVER_GRADIENT}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.coverGradient}
                />
              )}
              <View style={styles.coverOverlay} pointerEvents="none" />
              <View style={[styles.topBar, { marginTop: insets.top }, isAr && { flexDirection: 'row-reverse' }]}>
                <Pressable onPress={() => router.back()} hitSlop={12} style={styles.topBarBtn}>
                  <MaterialIcons name={isAr ? "arrow-forward" : "arrow-back"} size={scale(24)} color="#FFF" />
                </Pressable>
                <Pressable onPress={handleShare} hitSlop={12} style={[styles.topBarBtn, styles.shareBtnHighlight]}>
                  <MaterialIcons name="ios-share" size={scale(22)} color="#FFF" />
                </Pressable>
              </View>
            </View>

            {/* Avatar + identity */}
            <View style={styles.identitySection}>
              <View style={[styles.avatarRow, isAr && { flexDirection: 'row-reverse' }]}>
                <View style={styles.avatarWrap}>
                  {effectiveSeller.avatar ? (
                    <Image source={{ uri: effectiveSeller.avatar }} style={[styles.avatar, { borderColor: colors.surface }]} contentFit="cover" transition={200} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: colors.primary, borderColor: colors.surface }]}>
                      <Text style={styles.avatarPlaceholderText}>{effectiveSeller.name.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  {effectiveSeller.isOnline ? <View style={[styles.onlineDot, { borderColor: colors.surface }]} /> : null}
                  {effectiveSeller.isVerified ? (
                    <View style={[styles.verifiedChip, { backgroundColor: colors.verified, borderColor: colors.surface }]}>
                      <MaterialIcons name="verified" size={scale(14)} color="#FFF" />
                    </View>
                  ) : null}
                </View>

                <View style={styles.identityInfo}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.profileName, { color: colors.textPrimary }]} numberOfLines={2}>{effectiveSeller.name}</Text>
                    {effectiveSeller.isVerified ? (
                      <View style={[styles.verifiedBadge, { backgroundColor: colors.verified }]}>
                        <MaterialIcons name="verified" size={scale(12)} color="#FFF" />
                        <Text style={styles.verifiedText}>{lb('Verified', 'Vérifié', 'موثق')}</Text>
                      </View>
                    ) : (
                      <View style={[styles.verifiedBadge, { backgroundColor: colors.textTertiary }]}>
                        <MaterialIcons name="info" size={scale(12)} color="#FFF" />
                        <Text style={styles.verifiedText}>{lb('Unverified', 'Non vérifié', 'غير موثق')}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.locationRow}>
                    <MaterialIcons name="location-on" size={scale(15)} color={colors.primary} />
                    <Text style={[styles.locationText, { color: colors.textSecondary }]} numberOfLines={1}>{effectiveSeller.location}</Text>
                    <View style={[styles.onlinePill, { backgroundColor: effectiveSeller.isOnline ? colors.success + '20' : colors.textTertiary + '20' }]}>
                      <View style={[styles.onlinePillDot, { backgroundColor: effectiveSeller.isOnline ? colors.success : colors.textTertiary }]} />
                      <Text style={[styles.onlinePillText, { color: effectiveSeller.isOnline ? colors.success : colors.textTertiary }]}>
                        {effectiveSeller.isOnline ? lb('Online', 'En ligne', 'متصل') : lb('Offline', 'Hors ligne', 'غير متصل')}
                      </Text>
                    </View>
                  </View>

                </View>
              </View>

              {/* ============ STORE DETAILS ============ */}
              <View style={styles.infoSection}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  {lb('Store Details', 'Détails de la boutique', 'تفاصيل المتجر')}
                </Text>
                <View style={[styles.infoGrid, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
                  <InfoItem
                    icon="event"
                    label={lb('Joined', 'Inscrit', 'انضم')}
                    value={effectiveSeller.joinedDate ? new Date(effectiveSeller.joinedDate).toLocaleDateString() : '—'}
                    color={colors.primary}
                  />
                  <InfoItem
                    icon="shopping-bag"
                    label={lb('Total Sales', 'Ventes totales', 'إجمالي المبيعات')}
                    value={String(mergedStats?.completed_orders || effectiveSeller.totalSales || 0)}
                    color={colors.success}
                  />
                  <InfoItem
                    icon="star"
                    label={lb('Rating', 'Note', 'التقييم')}
                    value={`${avgRating.toFixed(1)} (${sellerReviews.length})`}
                    color="#F59E0B"
                  />
                  <InfoItem
                    icon="verified"
                    label={lb('Success Rate', 'Taux de réussite', 'نسبة النجاح')}
                    value={`${(mergedStats?.success_rate || 0).toFixed(0)}%`}
                    color={colors.success}
                  />
                  <InfoItem
                    icon="cancel"
                    label={lb('Failed Orders', 'Commandes échouées', 'طلبات فاشلة')}
                    value={String(mergedStats?.failed_orders || 0)}
                    color={colors.error}
                  />
                  <InfoItem
                    icon="inventory-2"
                    label={lb('Products', 'Produits', 'المنتجات')}
                    value={String(sellerProducts.length)}
                    color={colors.primary}
                  />
                  <InfoItem
                    icon="trending-up"
                    label={lb('Last 30 Days', '30 derniers jours', 'آخر 30 يوم')}
                    value={String(mergedStats?.orders_last_30d || 0)}
                    color={colors.pinned}
                  />
                  <InfoItem
                    icon="people"
                    label={lb('Followers', 'Abonnés', 'المتابعون')}
                    value={String(mergedStats?.followers_count || effectiveSeller.followersCount || 0)}
                    color="#8B5CF6"
                  />
                </View>
              </View>

              {/* Action buttons — Contact + Share only */}
              <View style={[styles.actionRow, isAr && { flexDirection: 'row-reverse' }]}>
                <Pressable
                  onPress={handleContactSeller}
                  style={({ pressed }) => [styles.primaryAction, { backgroundColor: colors.primary, opacity: pressed ? 0.88 : 1 }, shadows.card]}
                >
                  <MaterialIcons name="chat-bubble-outline" size={scale(20)} color="#FFF" />
                  <Text style={styles.primaryActionText}>{lb('Contact', 'Contacter', 'تواصل')}</Text>
                </Pressable>
                <Pressable
                  onPress={handleShare}
                  style={({ pressed }) => [styles.secondaryAction, { backgroundColor: colors.surface, borderColor: colors.primary, opacity: pressed ? 0.88 : 1 }]}
                >
                  <MaterialIcons name="share" size={scale(20)} color={colors.primary} />
                  <Text style={[styles.secondaryActionText, { color: colors.primary }]}>{lb('Share', 'Partager', 'مشاركة')}</Text>
                </Pressable>
              </View>

              {/* Follow + Notifications */}
              {isLoggedIn && user && !user?.isSeller && effectiveSeller.id !== user?.id ? (
                <View style={{ flexDirection: isAr ? 'row-reverse' : 'row', alignItems: 'center', gap: scale(8), marginTop: scale(8) }}>
                  {!isFollowing ? (
                    <Pressable
                      onPress={async () => { impactMedium(); const f = await toggleFollow(String(effectiveSeller.id)); setIsFollowing(f); if (!f) setNotifEnabled(false); }}
                      style={({ pressed }) => [styles.secondaryAction, { flex: 1, backgroundColor: colors.primary, borderColor: colors.primary, opacity: pressed ? 0.88 : 1 }]}
                    >
                      <MaterialIcons name="person-add" size={scale(18)} color="#FFF" />
                      <Text style={[styles.secondaryActionText, { color: '#FFF' }]}>
                        {lb('Follow', 'Suivre', 'متابعة')}
                      </Text>
                    </Pressable>
                  ) : (
                    <>
                      <Pressable
                        onPress={async () => { impactMedium(); const ok = await toggleFollowNotifications(String(effectiveSeller.id), !notifEnabled); if (ok) setNotifEnabled(!notifEnabled); }}
                        style={({ pressed }) => [styles.secondaryAction, { flex: 1, backgroundColor: notifEnabled ? colors.primary + '15' : colors.surface, borderColor: notifEnabled ? colors.primary : colors.border, opacity: pressed ? 0.88 : 1 }]}
                      >
                        <MaterialIcons name={notifEnabled ? 'notifications' : 'notifications-off'} size={scale(18)} color={notifEnabled ? colors.primary : colors.textSecondary} />
                        <Text style={[styles.secondaryActionText, { color: notifEnabled ? colors.primary : colors.textSecondary }]}>
                          {notifEnabled ? lb('Notifications On', 'Notifs activées', 'إشعارات مفعّلة') : lb('Notifications Off', 'Notifs désactivées', 'إشعارات معطّلة')}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={async () => { impactMedium(); const f = await toggleFollow(String(effectiveSeller.id)); setIsFollowing(f); if (!f) setNotifEnabled(false); }}
                        style={({ pressed }) => [styles.iconAction, { backgroundColor: colors.error + '12', borderColor: colors.error + '30', opacity: pressed ? 0.88 : 1 }]}
                      >
                        <MaterialIcons name="person-remove" size={scale(20)} color={colors.error} />
                      </Pressable>
                    </>
                  )}
                </View>
              ) : null}

              {/* Block Seller */}
              {isLoggedIn && user && !user?.isSeller ? (
                <Pressable onPress={handleBlockSeller} style={({ pressed }) => [styles.blockSellerBtn, { opacity: pressed ? 0.85 : 1 }]}>
                  <MaterialIcons name="block" size={scale(16)} color={colors.error} />
                  <Text style={[styles.blockSellerText, { color: colors.error }]}>{lb('Block Seller', 'Bloquer', 'حظر البائع')}</Text>
                </Pressable>
              ) : null}
            </View>

            {/* ============ REVIEWS MODAL (when tab=reviews) ============ */}
            {activeTab === 'reviews' ? (
              <View style={styles.reviewsSection}>
                {sellerReviews.length > 0 ? (
                  <View style={[styles.ratingSummary, { backgroundColor: colors.surface, borderColor: colors.borderLight }, shadows.card]}>
                    <View style={styles.ratingSummaryTop}>
                      <View style={styles.ratingBigWrap}>
                        <Text style={[styles.ratingBig, { color: colors.textPrimary }]}>{avgRating.toFixed(1)}</Text>
                        {renderStars(avgRating, scale(18))}
                        <Text style={[styles.ratingCount, { color: colors.textTertiary }]}>
                          {sellerReviews.length} {sellerReviews.length === 1 ? lb('Review', 'avis', 'تقييم') : lb('Reviews', 'avis', 'تقييمات')}
                        </Text>
                      </View>
                      <View style={styles.ratingBars}>
                        {[5, 4, 3, 2, 1].map((star) => {
                          const count = ratingDist[star - 1];
                          const pct = sellerReviews.length > 0 ? (count / sellerReviews.length) * 100 : 0;
                          return (
                            <View key={star} style={styles.ratingBarRow}>
                              <Text style={[styles.ratingBarStar, { color: colors.textSecondary }]}>{star}</Text>
                              <MaterialIcons name="star" size={scale(12)} color="#F59E0B" />
                              <View style={[styles.ratingBarTrack, { backgroundColor: colors.border }]}>
                                <View style={[styles.ratingBarFill, { width: `${pct}%`, backgroundColor: '#F59E0B' }]} />
                              </View>
                              <Text style={[styles.ratingBarCount, { color: colors.textTertiary }]}>{count}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={[styles.emptyReviews, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
                    <MaterialIcons name="rate-review" size={scale(48)} color={colors.textTertiary} />
                    <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>{lb('No reviews yet', 'Aucun avis', 'لا توجد تقييمات')}</Text>
                    <Text style={[styles.emptySub, { color: colors.textTertiary }]}>{lb('Be the first to review', 'Soyez le premier', 'كن أول من يقيّم')}</Text>
                  </View>
                )}
                {sellerReviews.map(rev => <ReviewItem key={rev.id} rev={rev} colors={colors} renderStars={renderStars} lb={lb} />)}
                <Pressable onPress={() => setActiveTab('products')} style={[styles.backToProductsBtn, { backgroundColor: colors.primary }]}>
                  <MaterialIcons name={isAr ? "arrow-forward" : "arrow-back"} size={scale(18)} color="#FFF" />
                  <Text style={styles.backToProductsText}>{lb('Back to Products', 'Retour aux produits', 'العودة للمنتجات')}</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {/* Products section title */}
                <View style={[styles.productsSectionHeader, isAr && { flexDirection: 'row-reverse' }]}>
                  <Text style={[styles.productsSectionTitle, { color: colors.textPrimary }]}>
                    {lb('Products', 'Produits', 'المنتجات')} ({sellerProducts.length})
                  </Text>
                </View>

                {sellerProducts.length === 0 ? (
                  <View style={[styles.emptyReviews, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
                    <MaterialIcons name="storefront" size={scale(48)} color={colors.textTertiary} />
                    <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>{lb('No products listed', 'Aucun produit', 'لا توجد منتجات')}</Text>
                    <Text style={[styles.emptySub, { color: colors.textTertiary }]}>{lb('No products yet', 'Pas encore de produits', 'لا توجد منتجات بعد')}</Text>
                  </View>
                ) : null}
              </>
            )}
          </>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: scale(24) },
  notFoundBtn: { marginTop: scale(20), paddingHorizontal: scale(28), paddingVertical: scale(12), borderRadius: scale(12) },
  notFoundBtnText: { color: '#FFF', fontWeight: '700', fontSize: scale(15) },

  // Products section header
  productsSectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(16), paddingTop: scale(10), paddingBottom: scale(6) },
  productsSectionTitle: { fontSize: scale(15), fontWeight: '700', fontFamily: 'Cairo-Bold' },

  // Back to products button
  backToProductsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scale(6), marginHorizontal: scale(16), marginTop: scale(12), paddingVertical: scale(12), borderRadius: scale(12) },
  backToProductsText: { color: '#FFF', fontSize: scale(14), fontWeight: '700', fontFamily: 'Cairo-Bold' },

  // Cover
  coverWrap: { position: 'relative', height: COVER_HEIGHT, overflow: 'hidden' },
  coverGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  coverImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  coverOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.10)',
  },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: scale(14), paddingVertical: scale(10),
  },
  topBarBtn: {
    width: scale(40), height: scale(40), borderRadius: scale(20), alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  shareBtnHighlight: { backgroundColor: 'rgba(255,255,255,0.22)' },

  // Identity section
  identitySection: { paddingHorizontal: scale(16), marginTop: -AVATAR_SIZE / 2 + scale(8) },
  avatarRow: { flexDirection: 'row', alignItems: 'flex-start', gap: scale(14) },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
    borderWidth: 4,
  },
  avatarPlaceholder: {
    alignItems: 'center', justifyContent: 'center',
  },
  avatarPlaceholderText: {
    color: '#FFF', fontSize: scale(40), fontWeight: '800',
  },
  onlineDot: {
    position: 'absolute', bottom: scale(4), right: scale(4),
    width: scale(16), height: scale(16), borderRadius: scale(8),
    backgroundColor: '#22C55E', borderWidth: 3,
  },
  verifiedChip: {
    position: 'absolute', top: -scale(4), right: -scale(4),
    width: scale(26), height: scale(26), borderRadius: scale(13),
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  identityInfo: { flex: 1, gap: scale(5), paddingTop: AVATAR_SIZE / 2 - scale(8) },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: scale(8), flexWrap: 'wrap' },
  profileName: { fontSize: scale(20), fontWeight: '800', flexShrink: 1 },
  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(8), paddingVertical: scale(3), borderRadius: scale(6), gap: scale(4),
  },
  verifiedText: { color: '#FFF', fontSize: scale(11), fontWeight: '700' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: scale(4), flexWrap: 'wrap' },
  locationText: { fontSize: scale(13), fontWeight: '500' },
  onlinePill: {
    flexDirection: 'row', alignItems: 'center', gap: scale(4),
    paddingHorizontal: scale(8), paddingVertical: scale(2), borderRadius: scale(10), marginLeft: scale(4),
  },
  onlinePillDot: { width: scale(6), height: scale(6), borderRadius: scale(3) },
  onlinePillText: { fontSize: scale(11), fontWeight: '700' },
  verifiedUntil: { fontSize: scale(10), fontWeight: '500', marginTop: scale(2) },

  // Action buttons
  actionRow: { flexDirection: 'row', gap: scale(10), marginTop: scale(16) },
  primaryAction: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: scale(11), borderRadius: borderRadius.lg, gap: scale(8),
  },
  primaryActionText: { color: '#FFF', fontSize: scale(15), fontWeight: '700' },
  secondaryAction: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: scale(11), borderRadius: borderRadius.lg, gap: scale(8), borderWidth: 1.5,
  },
  secondaryActionText: { fontSize: scale(15), fontWeight: '700' },
  iconAction: {
    width: scale(48), height: scale(48), alignItems: 'center', justifyContent: 'center',
    borderRadius: borderRadius.lg, borderWidth: 1.5,
  },

  // Block seller button
  blockSellerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: scale(6), marginTop: scale(12), paddingVertical: scale(10), borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(239, 68, 68, 0.08)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  blockSellerText: { fontSize: scale(14), fontWeight: '600' },

  // Stats
  statsRow: { flexDirection: 'row', paddingHorizontal: scale(16), gap: scale(10), marginTop: scale(20), marginBottom: scale(16) },
  statCard: {
    flex: 1, alignItems: 'center', paddingVertical: scale(14), borderRadius: borderRadius.lg, borderWidth: 1, gap: scale(6),
  },
  statIconWrap: {
    width: scale(40), height: scale(40), borderRadius: scale(20), alignItems: 'center', justifyContent: 'center', marginBottom: scale(2),
  },
  statValue: { fontSize: scale(22), fontWeight: '800' },
  statLabel: { fontSize: scale(9), fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Info section
  infoSection: { marginTop: scale(10), marginBottom: scale(2) },
  sectionTitle: { fontSize: scale(13), fontWeight: '800', marginBottom: scale(6), marginLeft: scale(2) },
  infoGrid: {
    flexDirection: 'row', flexWrap: 'wrap', borderRadius: borderRadius.lg, borderWidth: 1, overflow: 'hidden',
  },
  infoItem: {
    width: '50%', paddingVertical: scale(8), paddingHorizontal: scale(10),
    flexDirection: 'row', alignItems: 'center', gap: scale(8),
  },
  infoIconWrap: {
    width: scale(24), height: scale(24), borderRadius: scale(12), alignItems: 'center', justifyContent: 'center',
  },
  infoTextWrap: { flex: 1, gap: scale(1) },
  infoLabel: { fontSize: scale(9), fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: scale(12), fontWeight: '600' },

  // Tabs
  tabRow: {
    flexDirection: 'row', marginHorizontal: scale(16), marginBottom: scale(14),
    borderRadius: borderRadius.lg, borderWidth: 1, overflow: 'hidden',
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: scale(11), gap: scale(6),
  },
  tabText: { fontSize: scale(14), fontWeight: '700' },
  tabIndicator: {
    position: 'absolute', bottom: 0, left: '25%', right: '25%', height: scale(3), borderRadius: scale(2),
  },

  // Products grid
  row: { justifyContent: 'space-between', paddingHorizontal: scale(16), marginBottom: scale(12) },
  productCard: {
    borderRadius: borderRadius.md, borderWidth: 1, overflow: 'hidden',
  },
  productImage: { width: '100%' },
  productImagePlaceholder: {
    alignItems: 'center', justifyContent: 'center',
  },
  productInfo: { padding: scale(10), gap: scale(2) },
  productPrice: { fontSize: scale(14), fontWeight: '800' },
  productTitle: { fontSize: scale(12), fontWeight: '500' },

  // Reviews
  reviewsSection: { paddingHorizontal: scale(16), gap: scale(12) },
  ratingSummary: {
    borderRadius: borderRadius.lg, borderWidth: 1, padding: scale(16), marginBottom: scale(4),
  },
  ratingSummaryTop: { flexDirection: 'row', alignItems: 'center', gap: scale(16) },
  ratingBigWrap: { alignItems: 'center', gap: scale(4) },
  ratingBig: { fontSize: scale(36), fontWeight: '800' },
  ratingCount: { fontSize: scale(11), fontWeight: '600' },
  ratingBars: { flex: 1, gap: scale(4) },
  ratingBarRow: { flexDirection: 'row', alignItems: 'center', gap: scale(6) },
  ratingBarStar: { fontSize: scale(12), fontWeight: '700', width: scale(10) },
  ratingBarTrack: { flex: 1, height: scale(6), borderRadius: scale(3), overflow: 'hidden' },
  ratingBarFill: { height: scale(6), borderRadius: scale(3) },
  ratingBarCount: { fontSize: scale(11), fontWeight: '600', width: scale(24), textAlign: 'right' },

  reviewCard: {
    padding: scale(14), borderRadius: borderRadius.lg, borderWidth: 1, gap: scale(10), marginBottom: scale(4),
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: scale(10) },
  reviewAvatarWrap: {},
  reviewAvatar: {
    width: scale(40), height: scale(40), borderRadius: scale(20), alignItems: 'center', justifyContent: 'center',
  },
  reviewAvatarText: { fontSize: scale(18), fontWeight: '800' },
  reviewHeaderInfo: { flex: 1, gap: scale(2) },
  reviewName: { fontSize: scale(15), fontWeight: '700' },
  reviewRatingPill: {
    flexDirection: 'row', alignItems: 'center', gap: scale(3),
    paddingHorizontal: scale(8), paddingVertical: scale(4), borderRadius: scale(10),
  },
  reviewRatingText: { fontSize: scale(12), fontWeight: '700', color: '#F59E0B' },
  reviewText: { fontSize: scale(14), lineHeight: 20 },
  readMoreText: { fontSize: scale(13), fontWeight: '700', marginTop: scale(2) },
  reviewPhoto: { width: '100%', height: scale(100), borderRadius: borderRadius.md, marginTop: scale(4) },
  reviewFooter: { flexDirection: 'row', alignItems: 'center', gap: scale(4) },
  reviewDate: { fontSize: scale(11), fontWeight: '500' },

  // Empty states
  emptyReviews: {
    alignItems: 'center', paddingVertical: scale(48), paddingHorizontal: scale(24), gap: scale(8),
    borderRadius: borderRadius.lg, borderWidth: 1,
  },
  emptyTitle: { fontSize: scale(16), fontWeight: '700', textAlign: 'center' },
  emptySub: { fontSize: scale(13), fontWeight: '500', textAlign: 'center' },

  // Stars
  starsRow: { flexDirection: 'row' },

  // FAB
  fabWrap: {
    position: 'absolute', right: scale(16),
  },
  fab: {
    width: scale(46), height: scale(46), borderRadius: scale(23),
    alignItems: 'center', justifyContent: 'center',
  },
});
