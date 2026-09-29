import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ProductCard from '@/components/ProductCard';
import { useApp } from '@/contexts/AppContext';
import { Seller, getSellerById } from '@/services/mockData';
import { blockSeller } from '@/services/blockedSellers';
import { impactMedium, notifySuccess } from '@/services/haptics';
import { BOTTOM_NAV_CONTENT_GAP, scale } from '@/constants/responsive';

const PURPLE = '#5B48D9';
const COVER_HEIGHT = scale(140);
const AVATAR_SIZE = scale(84);
type StoreTab = 'products' | 'reviews' | 'about';
type Filter = 'all' | 'new' | 'used';

export default function SellerStoreScreen() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, language, isDark, products, getReviewsForSeller, isLoggedIn, startConversation, user,
    getSellerById: contextSellerById, fetchFollowStatus, toggleFollow, fetchSellerStats, followStats } = useApp();
  const isAr = language === 'ar';
  const lb = (en: string, fr: string, ar: string) => language === 'fr' ? fr : isAr ? ar : en;
  const rtl = isAr ? styles.rtl : undefined;
  const aligned = isAr ? styles.right : styles.left;
  const [activeTab, setActiveTab] = useState<StoreTab>(tab === 'reviews' ? 'reviews' : tab === 'about' ? 'about' : 'products');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [following, setFollowing] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [coverFailed, setCoverFailed] = useState(false);

  const sellerProducts = useMemo(() => products.filter(p => !p.isHidden && String(p.sellerId) === String(id)), [products, id]);
  const own = Boolean(user && String(user.id) === String(id));
  const fallback: Seller = { id, sellerId: id, name: (own && user?.name) || profile?.name || sellerProducts[0]?.sellerName || 'Seller',
    avatar: profile?.avatar || (own && user?.avatar) || (sellerProducts[0] as any)?.sellerAvatar || '',
    storeBg: profile?.storeBg || (own && (user as any)?.coverImage) || '',
    isVerified: Boolean((own && user?.isVerified) || sellerProducts[0]?.sellerVerified), isBanned: false,
    location: sellerProducts[0]?.location || "N'Djamena", rating: 0, totalSales: 0,
    joinedDate: new Date().toISOString().slice(0, 10), phone: '', isOnline: false, paymentMethods: [] };
  const seller = contextSellerById(id) || getSellerById(id) || fallback;
  const reviews = useMemo(() => getReviewsForSeller(id), [getReviewsForSeller, id]);
  const rating = useMemo(() => reviews.length ? reviews.reduce((n, r) => n + r.rating, 0) / reviews.length : seller.rating || 0, [reviews, seller.rating]);
  const merged = useMemo(() => ({ ...(stats || {}), ...(followStats[id] || {}) }), [stats, followStats, id]);
  const sales = merged.completed_orders ?? seller.totalSales ?? 0;
  const followers = merged.followers_count ?? seller.followersCount ?? 0;

  React.useEffect(() => {
    if (!id) return;
    AsyncStorage.getItem(`sokchad_seller_profile_${id}`).then(v => { if (v) setProfile(JSON.parse(v)); }).catch(() => undefined);
  }, [id]);
  React.useEffect(() => {
    fetchSellerStats(String(seller.id)).then(v => v && setStats(v));
    if (isLoggedIn) fetchFollowStatus(String(seller.id)).then(v => setFollowing(v.following));
  }, [seller.id, isLoggedIn, fetchSellerStats, fetchFollowStatus]);

  const productName = (p: any) => (typeof p.title === 'object' ? (p.title?.[language] || p.title?.en || '') : typeof p.name === 'string' ? p.name : p.name?.[language] || p.name?.en || '');
  const filtered = useMemo(() => sellerProducts.filter(p => {
    const condition = filter === 'all' || (filter === 'new' ? p.condition === 'new' : p.condition === 'used' || p.condition === 'like_new');
    return condition && (!query.trim() || productName(p).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  }), [sellerProducts, filter, query, language]);
  const displayRating = rating.toFixed(1).replace('.', language === 'fr' ? ',' : '.');

  const share = async () => {
    impactMedium();
    const url = `https://souktchad.shop/seller/${seller.id}`;
    await Share.share({ message: `${seller.name}\n${url}`, url }).catch(() => undefined);
  };
  const contact = () => {
    impactMedium();
    if (!isLoggedIn) return router.push('/(tabs)' as any);
    const greeting = lb(`Hi, I'd like to chat with your store "${seller.name}"`, `Bonjour, je souhaite discuter avec votre boutique « ${seller.name} »`, `مرحباً، أريد التحدث مع متجركم «${seller.name}»`);
    const conversation = startConversation(seller.id, sellerProducts[0]?.id || '', greeting);
    if (conversation) router.push(`/conversation/${conversation}` as any);
  };
  const follow = async () => {
    impactMedium();
    if (!isLoggedIn) return router.push('/(tabs)' as any);
    if (!own) setFollowing(await toggleFollow(String(seller.id)));
  };
  const block = () => {
    if (!isLoggedIn || !user || own) return;
    Alert.alert(lb('Block seller', 'Bloquer le vendeur', 'حظر البائع'),
      lb("You will no longer see this seller's products and they cannot contact you. Continue?", "Vous ne verrez plus les produits de ce vendeur et il ne pourra plus vous contacter. Continuer ?", 'لن ترى منتجات هذا البائع ولن يتمكن من التواصل معك. هل تريد المتابعة؟'), [
        { text: lb('Cancel', 'Annuler', 'إلغاء'), style: 'cancel' },
        { text: lb('Block', 'Bloquer', 'حظر'), style: 'destructive', onPress: async () => {
          if (await blockSeller(String(seller.id))) { notifySuccess(); router.back(); }
          else Alert.alert(lb('Unable to block seller', 'Impossible de bloquer le vendeur', 'تعذر حظر البائع'));
        } },
      ]);
  };
  const report = () => Alert.alert(lb('Report seller', 'Signaler le vendeur', 'الإبلاغ عن البائع'), lb('Thank you. Our team will review this seller.', 'Merci. Notre équipe examinera ce vendeur.', 'شكرًا لك. سيراجع فريقنا هذا البائع.'));
  const more = () => Alert.alert(lb('Seller options', 'Options du vendeur', 'خيارات البائع'), undefined, [
    ...(isLoggedIn && !own ? [{ text: lb('Block seller', 'Bloquer le vendeur', 'حظر البائع'), style: 'destructive' as const, onPress: block }] : []),
    { text: lb('Report', 'Signaler', 'إبلاغ'), onPress: report },
    { text: lb('Cancel', 'Annuler', 'إلغاء'), style: 'cancel' },
  ]);

  const Empty = ({ icon, title }: { icon: React.ComponentProps<typeof MaterialIcons>['name']; title: string }) => (
    <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
      <MaterialIcons name={icon} size={scale(42)} color={colors.textTertiary} />
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{title}</Text>
    </View>
  );
  const Info = ({ icon, label, value, color }: { icon: React.ComponentProps<typeof MaterialIcons>['name']; label: string; value: string; color: string }) => (
    <View style={[styles.info, { backgroundColor: isDark ? colors.surfaceElevated : colors.background }, rtl]}>
      <View style={[styles.infoIcon, { backgroundColor: `${color}18` }]}><MaterialIcons name={icon} size={scale(15)} color={color} /></View>
      <View style={[styles.infoCopy, isAr && styles.end]}><Text style={[styles.infoLabel, { color: colors.textSecondary }, aligned]}>{label}</Text><Text numberOfLines={1} style={[styles.infoValue, { color: colors.textPrimary }, aligned]}>{value}</Text></View>
    </View>
  );

  const Header = () => <>
    <View style={styles.cover}>
      {seller.storeBg && !coverFailed ? <Image source={{ uri: seller.storeBg }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" onError={() => setCoverFailed(true)} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: PURPLE }]} />}
      <View style={styles.scrim} />
      <View style={[styles.coverActions, rtl]}>
        <Pressable accessibilityRole="button" accessibilityLabel={lb('Back', 'Retour', 'رجوع')} onPress={() => router.back()} style={styles.circle}><MaterialIcons name={isAr ? 'arrow-forward' : 'arrow-back'} size={scale(23)} color="#1F2937" /></Pressable>
        <View style={[styles.shortcuts, rtl]}>
          <Pressable accessibilityRole="button" accessibilityLabel={lb('Share store', 'Partager la boutique', 'مشاركة المتجر')} onPress={share} style={styles.circle}><MaterialIcons name="share" size={scale(21)} color="#1F2937" /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={lb('More options', "Plus d'options", 'خيارات إضافية')} onPress={more} style={styles.circle}><MaterialIcons name="more-vert" size={scale(23)} color="#1F2937" /></Pressable>
        </View>
      </View>
    </View>
    <View style={[styles.identity, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
      <View style={[styles.identityTop, rtl]}>
        <View style={styles.avatarWrap}>
          {seller.avatar ? <Image source={{ uri: seller.avatar }} style={[styles.avatar, { borderColor: colors.surface }]} contentFit="cover" /> : <View style={[styles.avatar, styles.avatarFallback, { borderColor: colors.surface }]}><Text style={styles.avatarLetter}>{seller.name.charAt(0).toUpperCase()}</Text></View>}
          {seller.isVerified ? <View style={[styles.verified, { borderColor: colors.surface }]}><MaterialIcons name="check" size={scale(13)} color="#FFF" /></View> : null}
        </View>
        <View style={[styles.identityCopy, isAr && styles.end]}>
          <Text numberOfLines={2} style={[styles.storeName, { color: colors.textPrimary }, aligned]}>{seller.name}</Text>
          <View style={[styles.meta, rtl]}><MaterialIcons name="location-on" size={scale(16)} color={colors.textSecondary} /><Text numberOfLines={1} style={[styles.metaText, { color: colors.textSecondary }]}>{seller.location}</Text><Text style={{ color: seller.isOnline ? colors.success : colors.textTertiary }}>●</Text><Text style={[styles.metaText, { color: seller.isOnline ? colors.success : colors.textTertiary }]}>{seller.isOnline ? lb('Online', 'En ligne', 'متصل') : lb('Offline', 'Hors ligne', 'غير متصل')}</Text></View>
        </View>
      </View>
      <View style={[styles.stats, { borderTopColor: colors.borderLight }, rtl]}>
        <Text style={[styles.stat, { color: colors.textPrimary }]}>★ {displayRating} <Text style={[styles.statHint, { color: colors.textSecondary }]}>({reviews.length} {lb('reviews', 'avis', 'تقييم')})</Text></Text><View style={[styles.divider, { backgroundColor: colors.border }]} /><Text style={[styles.stat, { color: colors.textPrimary }]}>{sales} <Text style={[styles.statHint, { color: colors.textSecondary }]}>{lb('sales', 'ventes', 'مبيعات')}</Text></Text><View style={[styles.divider, { backgroundColor: colors.border }]} /><Text style={[styles.stat, { color: colors.textPrimary }]}>{followers} <Text style={[styles.statHint, { color: colors.textSecondary }]}>{lb('followers', 'abonnés', 'متابع')}</Text></Text>
      </View>
      <View style={[styles.actions, rtl]}>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: following }} onPress={follow} style={({ pressed }) => [styles.button, { borderColor: PURPLE, opacity: pressed ? .8 : 1 }]}><MaterialIcons name={following ? 'person-remove' : 'person-add-alt-1'} size={scale(19)} color={PURPLE} /><Text style={styles.followText}>{following ? lb('Following', 'Suivi', 'متابَع') : lb('Follow', 'Suivre', 'متابعة')}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={contact} style={({ pressed }) => [styles.button, styles.contact, { opacity: pressed ? .86 : 1 }]}><MaterialIcons name="chat-bubble-outline" size={scale(19)} color="#FFF" /><Text style={styles.contactText}>{lb('Contact', 'Contacter', 'تواصل')}</Text></Pressable>
      </View>
    </View>
    <View style={[styles.tabs, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }, rtl]}>
      {([['products', lb('Products', 'Produits', 'المنتجات')], ['reviews', lb('Reviews', 'Avis', 'التقييمات')], ['about', lb('About', 'À propos', 'عن المتجر')]] as [StoreTab, string][]).map(([key, label]) => <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: activeTab === key }} onPress={() => setActiveTab(key)} style={styles.tab}><Text style={[styles.tabText, { color: activeTab === key ? PURPLE : colors.textSecondary }]}>{label}</Text>{activeTab === key && <View style={styles.underline} />}</Pressable>)}
    </View>
    {activeTab === 'products' ? <View style={styles.controls}>
      <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }, rtl]}><MaterialIcons name="search" size={scale(21)} color={colors.textSecondary} /><TextInput value={query} onChangeText={setQuery} returnKeyType="search" placeholder={lb('Search in store...', 'Rechercher dans la boutique...', 'البحث داخل المتجر...')} placeholderTextColor={colors.textTertiary} accessibilityLabel={lb('Search in store', 'Rechercher dans la boutique', 'البحث داخل المتجر')} style={[styles.input, { color: colors.textPrimary }, aligned]} /></View>
      <View style={[styles.chips, rtl]}>{([['all', lb('All', 'Tout', 'الكل')], ['new', lb('New', 'Neuf', 'جديد')], ['used', lb('Used', 'Occasion', 'مستعمل')]] as [Filter, string][]).map(([key, label]) => <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: filter === key }} onPress={() => setFilter(key)} style={[styles.chip, { borderColor: filter === key ? PURPLE : colors.border, backgroundColor: filter === key ? PURPLE : colors.surface }]}><Text style={[styles.chipText, { color: filter === key ? '#FFF' : colors.textPrimary }]}>{label}</Text></Pressable>)}</View>
      {!filtered.length && <Empty icon="inventory-2" title={query ? lb('No matching products', 'Aucun produit correspondant', 'لا توجد منتجات مطابقة') : lb('No products yet', 'Pas encore de produits', 'لا توجد منتجات بعد')} />}
    </View> : activeTab === 'reviews' ? <View style={styles.tabContent}>{reviews.length ? reviews.map(review => <View key={review.id} style={[styles.review, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}><View style={[styles.reviewHead, rtl]}><View style={styles.reviewAvatar}><Text style={styles.reviewInitial}>{review.buyerName.charAt(0).toUpperCase()}</Text></View><View style={[styles.reviewCopy, isAr && styles.end]}><Text style={[styles.reviewName, { color: colors.textPrimary }, aligned]}>{review.buyerName}</Text><Text style={styles.stars}>{'★'.repeat(Math.round(review.rating))}<Text style={{ color: colors.border }}>{'★'.repeat(5 - Math.round(review.rating))}</Text></Text></View><Text style={[styles.reviewDate, { color: colors.textTertiary }]}>{new Date(review.createdAt).toLocaleDateString(language)}</Text></View><Text style={[styles.reviewText, { color: colors.textSecondary }, aligned]}>{review.text}</Text></View>) : <Empty icon="rate-review" title={lb('No reviews yet', "Pas d'avis pour le moment", 'لا توجد تقييمات بعد')} />}</View> :
      <View style={styles.tabContent}><View style={[styles.infoGrid, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
        <Info icon="event" label={lb('Joined', 'Inscrit', 'تاريخ الانضمام')} value={seller.joinedDate ? new Date(seller.joinedDate).toLocaleDateString(language) : '—'} color={PURPLE} />
        <Info icon="star" label={lb('Rating', 'Note', 'التقييم')} value={`${displayRating} (${reviews.length})`} color="#F59E0B" />
        <Info icon="shopping-bag" label={lb('Total sales', 'Ventes totales', 'إجمالي المبيعات')} value={String(sales)} color={colors.success} />
        <Info icon="verified" label={lb('Success rate', 'Taux de réussite', 'نسبة النجاح')} value={`${Number(merged.success_rate || 0).toFixed(0)}%`} color={colors.success} />
        <Info icon="cancel" label={lb('Failed orders', 'Commandes échouées', 'طلبات فاشلة')} value={String(merged.failed_orders || 0)} color={colors.error} />
        <Info icon="inventory-2" label={lb('Products', 'Produits', 'المنتجات')} value={String(sellerProducts.length)} color={PURPLE} />
        <Info icon="trending-up" label={lb('Last 30 days', '30 derniers jours', 'آخر 30 يومًا')} value={String(merged.orders_last_30d || 0)} color={colors.pinned} />
        <Info icon="people" label={lb('Followers', 'Abonnés', 'المتابعون')} value={String(followers)} color="#8B5CF6" />
      </View></View>}
  </>;

  return <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors.background }]}><FlatList data={activeTab === 'products' ? filtered : []} keyExtractor={item => item.id} renderItem={({ item }) => <ProductCard product={item} />} numColumns={2} columnWrapperStyle={activeTab === 'products' && filtered.length ? [styles.gridRow, rtl] : undefined} ListHeaderComponent={Header} contentContainerStyle={{ paddingBottom: insets.bottom + BOTTOM_NAV_CONTENT_GAP + scale(16) }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" /></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, rtl: { flexDirection: 'row-reverse' }, right: { textAlign: 'right' }, left: { textAlign: 'left' }, end: { alignItems: 'flex-end' },
  cover: { height: COVER_HEIGHT, overflow: 'hidden', position: 'relative' }, scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,.12)' }, coverActions: { position: 'absolute', top: scale(10), left: scale(14), right: scale(14), flexDirection: 'row', justifyContent: 'space-between' }, shortcuts: { flexDirection: 'row', gap: scale(8) }, circle: { width: scale(48), height: scale(48), borderRadius: scale(24), backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  identity: { marginHorizontal: scale(14), marginTop: -scale(22), padding: scale(14), borderRadius: scale(16), borderWidth: 1 }, identityTop: { flexDirection: 'row', gap: scale(13), alignItems: 'center' }, avatarWrap: { width: AVATAR_SIZE, height: AVATAR_SIZE, position: 'relative' }, avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, borderWidth: scale(4) }, avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: PURPLE }, avatarLetter: { color: '#FFF', fontFamily: 'Cairo-Bold', fontSize: scale(30) }, verified: { position: 'absolute', right: 0, bottom: scale(2), width: scale(23), height: scale(23), borderRadius: scale(12), borderWidth: scale(2), backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' }, identityCopy: { flex: 1, gap: scale(5) }, storeName: { fontFamily: 'Cairo-Bold', fontSize: scale(19), lineHeight: scale(27) }, meta: { flexDirection: 'row', alignItems: 'center', gap: scale(4), flexWrap: 'wrap' }, metaText: { fontFamily: 'Cairo-Regular', fontSize: scale(12), flexShrink: 1 },
  stats: { flexDirection: 'row', alignItems: 'center', marginTop: scale(14), paddingTop: scale(12), borderTopWidth: StyleSheet.hairlineWidth }, stat: { flex: 1, fontFamily: 'Cairo-Bold', fontSize: scale(11), textAlign: 'center' }, statHint: { fontFamily: 'Cairo-Regular', fontSize: scale(9) }, divider: { width: StyleSheet.hairlineWidth, height: scale(24) }, actions: { flexDirection: 'row', gap: scale(10), marginTop: scale(14) }, button: { flex: 1, minHeight: scale(48), borderRadius: scale(12), borderWidth: 1.5, flexDirection: 'row', gap: scale(7), alignItems: 'center', justifyContent: 'center' }, contact: { backgroundColor: PURPLE, borderColor: PURPLE }, followText: { color: PURPLE, fontFamily: 'Cairo-Bold', fontSize: scale(14) }, contactText: { color: '#FFF', fontFamily: 'Cairo-Bold', fontSize: scale(14) },
  tabs: { flexDirection: 'row', marginTop: scale(12), borderBottomWidth: 1 }, tab: { flex: 1, minHeight: scale(48), alignItems: 'center', justifyContent: 'center', position: 'relative' }, tabText: { fontFamily: 'Cairo-Bold', fontSize: scale(14) }, underline: { position: 'absolute', bottom: 0, height: scale(3), width: '64%', borderRadius: scale(3), backgroundColor: PURPLE }, controls: { paddingHorizontal: scale(16), paddingTop: scale(12) }, search: { minHeight: scale(48), borderRadius: scale(12), borderWidth: 1, paddingHorizontal: scale(13), flexDirection: 'row', alignItems: 'center', gap: scale(8) }, input: { flex: 1, fontFamily: 'Cairo-Regular', fontSize: scale(13), paddingVertical: 0 }, chips: { flexDirection: 'row', gap: scale(8), marginTop: scale(10), marginBottom: scale(12) }, chip: { minHeight: scale(48), minWidth: scale(72), paddingHorizontal: scale(17), borderRadius: scale(24), borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, chipText: { fontFamily: 'Cairo-Bold', fontSize: scale(12) }, gridRow: { paddingHorizontal: scale(16), justifyContent: 'space-between', alignItems: 'stretch', marginBottom: scale(12) },
  tabContent: { padding: scale(16), gap: scale(12) }, empty: { marginBottom: scale(16), minHeight: scale(150), borderRadius: scale(16), borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: scale(8), padding: scale(20) }, emptyText: { fontFamily: 'Cairo-Bold', fontSize: scale(14), textAlign: 'center' }, review: { borderRadius: scale(16), borderWidth: 1, padding: scale(14), gap: scale(10) }, reviewHead: { flexDirection: 'row', alignItems: 'center', gap: scale(10) }, reviewAvatar: { width: scale(42), height: scale(42), borderRadius: scale(21), backgroundColor: '#5B48D918', alignItems: 'center', justifyContent: 'center' }, reviewInitial: { color: PURPLE, fontFamily: 'Cairo-Bold', fontSize: scale(17) }, reviewCopy: { flex: 1 }, reviewName: { fontFamily: 'Cairo-Bold', fontSize: scale(14) }, stars: { color: '#F59E0B', fontSize: scale(13) }, reviewDate: { fontFamily: 'Cairo-Regular', fontSize: scale(10) }, reviewText: { fontFamily: 'Cairo-Regular', fontSize: scale(13), lineHeight: scale(21) },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', borderRadius: scale(16), borderWidth: 1, overflow: 'hidden' }, info: { width: '50%', minHeight: scale(70), padding: scale(10), flexDirection: 'row', alignItems: 'center', gap: scale(8) }, infoIcon: { width: scale(30), height: scale(30), borderRadius: scale(15), alignItems: 'center', justifyContent: 'center' }, infoCopy: { flex: 1, gap: scale(2) }, infoLabel: { fontFamily: 'Cairo-Regular', fontSize: scale(9) }, infoValue: { fontFamily: 'Cairo-Bold', fontSize: scale(12) },
});
