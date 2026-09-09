import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert, Modal, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { SUPPORTED_LANGUAGES } from '@/constants/config';
import { formatPrice } from '@/constants/config';
import { borderRadius, shadows } from '@/constants/theme';
import LoginModal from '@/components/LoginModal';
import ReportButton from '@/components/ReportButton';
import { BuyerStatsContent } from '@/components/BuyerStatsContent';
import { selection, notifyWarning, notifySuccess, impactLight } from '@/services/haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Constants from 'expo-constants';
import { changePassword, updateProfile } from '@/services/supabaseStats';
import { getBlockedSellers, unblockSeller } from '@/services/blockedSellers';
import { scale, SCREEN_WIDTH } from '@/constants/responsive';

const CARD_WIDTH = (SCREEN_WIDTH - scale(48)) / 2;

// Extracted sub-components

function VerificationStatusCard({ verifyStatus, colors, lb, onApply }: {
  verifyStatus: 'none' | 'pending' | 'approved' | 'rejected';
  colors: any; lb: (en: string, fr: string, ar: string) => string;
  onApply: () => void;
}) {
  if (verifyStatus === 'approved') {
    return (
      <View style={[pStyles.verifyProgressCard, { backgroundColor: colors.verified + '10', borderColor: colors.verified + '40' }]}>
        <View style={pStyles.verifyProgressHeader}>
          <MaterialIcons name="verified" size={scale(18)} color={colors.verified} />
          <Text style={[pStyles.verifyProgressTitle, { color: colors.verified }]}>
            {lb('Verified Account', 'Compte vérifié', 'حساب موثق')}
          </Text>
        </View>
        <Text style={[pStyles.verifyProgressText, { color: colors.textSecondary }]}>
          {lb('Your Blue Badge is active!', 'Votre Badge Bleu est actif!', 'شارتك الزرقاء مفعلة!')}
        </Text>
      </View>
    );
  }

  const hasPending = verifyStatus === 'pending';
  const isRejected = verifyStatus === 'rejected';

  return (
    <View style={[pStyles.verifyProgressCard, { backgroundColor: colors.surface, borderColor: hasPending ? colors.warning + '40' : isRejected ? colors.error + '40' : colors.primary + '30' }]}>
      <View style={pStyles.verifyProgressHeader}>
        <MaterialIcons name={hasPending ? 'hourglass-top' : isRejected ? 'cancel' : 'verified'} size={scale(18)} color={hasPending ? colors.warning : isRejected ? colors.error : colors.primary} />
        <Text style={[pStyles.verifyProgressTitle, { color: colors.textPrimary }]}>
          {hasPending ? lb('Verification Pending', 'Vérification en cours', 'التوثيق قيد المراجعة')
            : isRejected ? lb('Verification Rejected', 'Vérification refusée', 'تم رفض التوثيق')
            : lb('Get Verified', 'Obtenir la vérification', 'احصل على التوثيق')}
        </Text>
      </View>
      {hasPending ? (
        <Text style={[pStyles.verifyProgressText, { color: colors.warning }]}>
          {lb('Your subscription is being reviewed by admin.', "Votre abonnement est en cours d'examen.", 'اشتراكك قيد المراجعة.')}
        </Text>
      ) : isRejected ? (
        <View>
          <Text style={[pStyles.verifyProgressText, { color: colors.error }]}>
            {lb('Your request was rejected. You can re-apply.', 'Votre demande a été refusée. Vous pouvez refaire la demande.', 'تم رفض طلبك. يمكنك إعادة التقديم.')}
          </Text>
          <Pressable onPress={onApply} style={[pStyles.verifyApplyBtn, { backgroundColor: colors.primary }]}>
            <MaterialIcons name="refresh" size={scale(16)} color="#FFF" />
            <Text style={pStyles.verifyApplyBtnText}>{lb('Re-apply', 'Refaire la demande', 'إعادة التقديم')}</Text>
          </Pressable>
        </View>
      ) : (
        <View>
          <Text style={[pStyles.verifyProgressText, { color: colors.textSecondary }]}>
            {lb('Subscribe for a Blue Badge by selecting a plan and uploading your payment receipt.', 'Abonnez-vous pour un Badge Bleu en choisissant un plan.', 'اشترك للحصول على الشارة الزرقاء باختيار خطة ورفع إيصال الدفع.')}
          </Text>
          <Pressable onPress={onApply} style={[pStyles.verifyApplyBtn, { backgroundColor: colors.primary }]}>
            <MaterialIcons name="verified" size={scale(16)} color="#FFF" />
            <Text style={pStyles.verifyApplyBtnText}>{lb('Subscribe for Blue Badge', 'Abonnement Badge Bleu', 'اشتراك الشارة الزرقاء')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function VerifyEligibilityBox({ canUserRequestVerification, colors, lb }: {
  canUserRequestVerification: () => { eligible: boolean; reason?: string }; colors: any;
  lb: (en: string, fr: string, ar: string) => string;
}) {
  const eligibility = canUserRequestVerification();
  if (eligibility.eligible) return null;
  return (
    <View style={[pStyles.verifyInfoBox, { backgroundColor: colors.warning + '10', borderColor: colors.warning + '30' }]}>
      <MaterialIcons name="lock" size={scale(16)} color={colors.warning} />
      <Text style={[pStyles.verifyInfoText, { color: colors.warning }]}>
        {eligibility.reason || lb('Not eligible yet', 'Pas encore éligible', 'غير مؤهل بعد')}
      </Text>
    </View>
  );
}

function BuyerTrustProgress({ completedOrders, totalOrders, uniqueSellers, colors, lb, isAr }: {
  completedOrders: number;
  totalOrders: number;
  uniqueSellers: number;
  colors: any;
  lb: (en: string, fr: string, ar: string) => string;
  isAr: boolean;
}) {
  const TARGET = 50;
  const SELLERS_TARGET = 50;
  const finalOrders = totalOrders;
  const rate = finalOrders > 0 ? Math.round((completedOrders / finalOrders) * 100) : 0;
  const isTrusted = completedOrders >= TARGET && uniqueSellers >= SELLERS_TARGET && rate >= 75;
  const progress = Math.min(100, (completedOrders / TARGET) * 100);

  if (isTrusted) {
    return (
      <View style={[pStyles.verifyProgressCard, { backgroundColor: colors.verified + '10', borderColor: colors.verified + '40' }]}>
        <View style={pStyles.verifyProgressHeader}>
          <MaterialIcons name="verified" size={scale(18)} color={colors.verified} />
          <Text style={[pStyles.verifyProgressTitle, { color: colors.verified }]}>
            {lb('Verified Buyer', 'Acheteur vérifié', 'مشتري موثوق')}
          </Text>
        </View>
        <Text style={[pStyles.verifyProgressText, { color: colors.textSecondary }]}>
          {lb('Your account is verified, you have obtained the Trusted Buyer badge.', 'Votre compte est vérifié, vous avez obtenu le badge Acheteur vérifié.', 'حسابك موثوق، وقد حصلت على علامة المشتري الموثوق.')}
        </Text>
      </View>
    );
  }

  return (
    <View style={[pStyles.verifyProgressCard, { backgroundColor: colors.surface, borderColor: colors.primary + '30' }]}>
      <View style={pStyles.verifyProgressHeader}>
        <MaterialIcons name="shield" size={scale(18)} color={colors.primary} />
        <Text style={[pStyles.verifyProgressTitle, { color: colors.textPrimary }]}>
          {lb('Buyer Trust Progress', 'Progrès de confiance', 'تقدم ثقة المشتري')}
        </Text>
      </View>
      <Text style={[pStyles.verifyProgressText, { color: colors.textSecondary, marginBottom: scale(8) }]}>
        {completedOrders} {lb('of', 'sur', 'من')} {TARGET} {lb('successful purchases', 'achats réussis', 'عملية ناجحة')}
        {' · '}
        {uniqueSellers} {lb('of', 'sur', 'من')} {SELLERS_TARGET} {lb('different sellers', 'vendeurs différents', 'متجرًا مختلفًا')}
      </Text>
      {/* Progress bar */}
      <View style={{ height: scale(6), borderRadius: scale(3), backgroundColor: colors.border + '40', marginBottom: scale(8) }}>
        <View style={{ width: `${progress}%`, height: '100%', borderRadius: scale(3), backgroundColor: colors.primary }} />
      </View>
      <Text style={{ fontSize: scale(11), color: colors.textTertiary, textAlign: isAr ? 'right' : 'left' }}>
        {lb(
          `You have completed ${completedOrders} successful purchases with ${uniqueSellers} different sellers. Complete 50 purchases with 50 different sellers and maintain a success rate of at least 75% to get the Trusted Buyer badge.`,
          `Vous avez complété ${completedOrders} achats réussis auprès de ${uniqueSellers} vendeurs différents. Complétez 50 achats auprès de 50 vendeurs différents et maintenez un taux de réussite d'au moins 75% pour obtenir le badge Acheteur vérifié.`,
          `أكملت ${completedOrders} عملية ناجحة مع ${uniqueSellers} متجرًا مختلفًا. أكمل 50 عملية مع 50 متجرًا مختلفًا وحافظ على معدل نجاح لا يقل عن 75% للحصول على علامة المشتري الموثوق.`,
        )}
      </Text>
    </View>
  );
}

function SellerVerificationCard({ user, canSellerRequestVerification, colors, lb }: {
  user: any; canSellerRequestVerification: (id: string) => { eligible: boolean; reason?: string };
  colors: any; lb: (en: string, fr: string, ar: string) => string;
}) {
  if (!user?.isSeller || user?.isVerified) return null;
  const eligibility = canSellerRequestVerification(user.id);
  return (
    <View style={[pStyles.verifyProgressCard, { backgroundColor: colors.surface, borderColor: eligibility.eligible ? colors.verified : colors.border }]}>
      <View style={pStyles.verifyProgressHeader}>
        <MaterialIcons name="verified-user" size={scale(18)} color={eligibility.eligible ? colors.verified : colors.textTertiary} />
        <Text style={[pStyles.verifyProgressTitle, { color: colors.textPrimary }]}>
          {lb('Seller Verification', 'Vérification vendeur', 'توثيق البائع')}
        </Text>
      </View>
      {eligibility.eligible ? (
        <Text style={[pStyles.verifyProgressText, { color: colors.verified }]}>
          {lb('You are eligible for verification! Contact admin.', "Vous êtes éligible ! Contactez l'administrateur.", 'أنت مؤهل للتوثيق! تواصل مع المشرف.')}
        </Text>
      ) : (
        <Text style={[pStyles.verifyProgressText, { color: colors.textSecondary }]}>
          {eligibility.reason || ''}
        </Text>
      )}
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    colors, t, language, setLanguage, isDark, toggleDarkMode,
    isLoggedIn, user, logout, orders, favorites, products, reviews, sellers, followedSellers, fetchFollowedSellers, toggleFollowNotifications, toggleFollow,
    updateUserAvatar, updateUserCover, getReviewsForSeller,
    canSellerRequestVerification, shippingCompanies, confirmOrderReceived,
    enabledLanguages,
    verificationPlans, verificationSubscriptions, submitVerificationSubscription,
    canUserRequestVerification, adminPaymentNumber, isReady, getProductById,
    categories: appCategories,
    buyerOrders: apiBuyerOrders, buyerCompletedOrders: apiBuyerCompletedOrders,
  } = useApp();
  const [showLogin, setShowLogin] = useState(false);
  const [sellerTab, setSellerTab] = useState<'products' | 'orders' | 'stats' | 'reviews'>('products');
  const [buyerTab, setBuyerTab] = useState<'orders' | 'stats' | 'favorites'>('orders');
  const [followTab, setFollowTab] = useState<'favorites' | 'following'>('favorites');

  // Derived booleans - safe with optional chaining (moved up — used in useEffect below)
  const isSeller = user?.isSeller === true;

  useEffect(() => {
    if (isLoggedIn && !isSeller) {
      fetchFollowedSellers();
    }
  }, [isLoggedIn, isSeller, fetchFollowedSellers]);
  const [statsPeriod, setStatsPeriod] = useState<'all' | '30d' | '7d' | 'custom'>('all');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');

  // Verification subscription state
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [receipt, setReceipt] = useState('');

  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const lb = useCallback((en: string, fr: string, ar: string) => isFr ? fr : isAr ? ar : en, [isFr, isAr]);

  useEffect(() => {
    if (isLoggedIn && isReady && (user?.role === 'super_admin' || user?.role === 'staff')) {
      router.replace('/admin/dashboard');
    }
  }, [isLoggedIn, user?.role, router, isReady]);

  const userVerifyStatus = useMemo(() => {
    if (!user) return 'none' as const;
    if (user.isVerified || user.isVerifiedBuyer) return 'approved' as const;
    const mySubs = (verificationSubscriptions || []).filter(s => s.userId === user.id);
    const pending = mySubs.find(s => s.status === 'pending');
    if (pending) return 'pending' as const;
    const rejected = mySubs.find(s => s.status === 'rejected');
    if (rejected) return 'rejected' as const;
    return 'none' as const;
  }, [user, verificationSubscriptions]);

  const pickVerifyImage = useCallback(async (setter: (uri: string) => void) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission required'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [4, 3] });
    if (!result.canceled && result.assets[0]) {
      impactLight();
      setter(result.assets[0].uri);
    }
  }, []);

  const handleSubmitVerification = useCallback(async () => {
    if (!selectedPlanId) {
      Alert.alert(lb('Select a Plan', 'Choisissez un plan', 'اختر خطة'));
      return;
    }
    if (!receipt) {
      Alert.alert(lb('Receipt Required', 'Reçu requis', 'الإيصال مطلوب'));
      return;
    }
    if (!user?.id) return;
    setVerifyLoading(true);
    const result2 = submitVerificationSubscription(selectedPlanId, receipt);
    setVerifyLoading(false);
    if (result2.success) {
      notifySuccess();
      setShowVerifyModal(false);
      setSelectedPlanId(''); setReceipt('');
      Alert.alert(lb('Submitted!', 'Soumis !', 'تم الإرسال!'), lb('Your verification subscription has been submitted.', 'Votre demande de vérification a été soumise.', 'تم إرسال طلب التوثيق.'));
    } else {
      Alert.alert('Error', result2.error || 'Failed to submit');
    }
  }, [selectedPlanId, receipt, user?.id, lb, submitVerificationSubscription]);

  const openVerifyModal = useCallback(() => {
    setSelectedPlanId(''); setReceipt('');
    setShowVerifyModal(true);
  }, []);

  const userListings = useMemo(() => (products || []).filter(p => p?.sellerId === user?.id), [products, user?.id]);
  const userOrders = useMemo(() => (orders || []).filter(o => o?.buyerId === user?.id || o?.sellerId === user?.id), [orders, user?.id]);
  const sellerOrders = useMemo(() => (orders || []).filter(o => o?.sellerId === user?.id), [orders, user?.id]);
  const buyerOrders = useMemo(() => {
    // Use API orders if available, otherwise fall back to mock orders
    if (apiBuyerOrders && apiBuyerOrders.length > 0) return apiBuyerOrders;
    return (orders || []).filter(o => o?.buyerId === user?.id);
  }, [apiBuyerOrders, orders, user?.id]);
  const sellerReviews = useMemo(() => user?.isSeller ? getReviewsForSeller(user.id) : [], [user?.id, user?.isSeller, reviews]);

  const buyerCompletedOrders = useMemo(() => {
    if (apiBuyerCompletedOrders && apiBuyerCompletedOrders.length > 0) return apiBuyerCompletedOrders;
    return buyerOrders.filter(o => o?.status === 'completed');
  }, [apiBuyerCompletedOrders, buyerOrders]);
  const buyerPendingOrders = useMemo(() => buyerOrders.filter(o => o?.status === 'pending'), [buyerOrders]);
  const buyerDisputedOrders = useMemo(() => buyerOrders.filter(o => o?.status === 'disputed'), [buyerOrders]);
  const sellersInteracted = useMemo(() => {
    const sellerMap: Record<string, { count: number; totalSpent: number }> = {};
    buyerOrders.forEach(o => {
      if (!o?.sellerId) return;
      if (!sellerMap[o.sellerId]) sellerMap[o.sellerId] = { count: 0, totalSpent: 0 };
      sellerMap[o.sellerId].count++;
      sellerMap[o.sellerId].totalSpent += (o?.amount || 0);
    });
    return Object.entries(sellerMap).map(([sId, info]) => {
      const s = (sellers || []).find((se: any) => se?.id === sId);
      return { id: sId, name: s?.name || sId, avatar: s?.avatar || '', isOnline: s?.isOnline || false, ...info };
    }).sort((a, b) => b.count - a.count);
  }, [buyerOrders, sellers]);

  const totalRevenue = useMemo(() =>
    sellerOrders.filter(o => o?.status === 'confirmed' || o?.status === 'completed').reduce((sum, o) => sum + (o?.amount || 0), 0),
    [sellerOrders]
  );
  const pendingOrders = useMemo(() => sellerOrders.filter(o => o?.status === 'pending').length, [sellerOrders]);
  const confirmedOrders = useMemo(() => sellerOrders.filter(o => o?.status === 'confirmed' || o?.status === 'completed').length, [sellerOrders]);

  // Comprehensive seller stats
  const totalProductViews = useMemo(() => userListings.reduce((sum, p) => sum + (p?.views || 0), 0), [userListings]);
  const avgOrderValue = useMemo(() => sellerOrders.length > 0 ? Math.round(totalRevenue / sellerOrders.length) : 0, [totalRevenue, sellerOrders.length]);
  const uniqueBuyers = useMemo(() => new Set(sellerOrders.map(o => o?.buyerId)).size, [sellerOrders]);
  const totalStock = useMemo(() => userListings.reduce((sum, p) => sum + (p?.stock || 0), 0), [userListings]);

  // Comprehensive buyer stats
  const totalSpent = useMemo(() => buyerOrders.filter(o => o?.status === 'completed' || o?.status === 'confirmed').reduce((sum, o) => sum + (o?.amount || 0), 0), [buyerOrders]);
  const avgSpentPerOrder = useMemo(() => buyerOrders.length > 0 ? Math.round(totalSpent / buyerOrders.length) : 0, [totalSpent, buyerOrders.length]);
  const uniqueSellersCount = useMemo(() => new Set(buyerOrders.map(o => o?.sellerId)).size, [buyerOrders]);

  const categoryStats = useMemo(() => {
    const catMap: Record<string, number> = {};
    userListings.forEach(p => { if (p?.categoryId) catMap[p.categoryId] = (catMap[p.categoryId] || 0) + 1; });
    return Object.entries(catMap).map(([catId, count]) => {
      const cat = appCategories.find(c => c.id === catId);
      return { id: catId, name: cat ? (cat.name[language] || cat.name.en) : catId, count, color: cat?.color || '#888' };
    }).sort((a, b) => b.count - a.count);
  }, [userListings, language, appCategories]);

  const pickAvatar = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission required'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled && result.assets[0]) {
      updateUserAvatar(result.assets[0].uri);
    }
  }, [updateUserAvatar]);

  const pickCover = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission required'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [16, 9] });
    if (!result.canceled && result.assets[0]) {
      updateUserCover(result.assets[0].uri);
    }
  }, [updateUserCover]);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'confirmed': case 'completed': return colors.success;
      case 'pending': return colors.warning;
      case 'disputed': return colors.error;
      case 'delivered': return colors.verified;
      default: return colors.textTertiary;
    }
  }, [colors]);

  // Localized order status label (no English words in FR/AR UI)
  const getStatusLabel = useCallback((status: string) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'pending': return lb('PENDING', 'EN ATTENTE', 'قيد الانتظار');
      case 'confirmed': return lb('CONFIRMED', 'CONFIRMÉ', 'مؤكد');
      case 'shipped': return lb('SHIPPED', 'EXPÉDIÉ', 'تم الشحن');
      case 'delivered': return lb('DELIVERED', 'LIVRÉ', 'تم التسليم');
      case 'completed': return lb('COMPLETED', 'TERMINÉ', 'مكتمل');
      case 'disputed': return lb('DISPUTED', 'CONTESTÉ', 'متنازع');
      case 'cancelled': return lb('CANCELLED', 'ANNULÉ', 'ملغى');
      default: return (status || '').toUpperCase();
    }
  }, [lb]);

  // isSeller moved up — used in useEffect above
  const isBuyer = user?.role === 'buyer' || (!user?.isSeller);

  const roleBadge = useMemo(() => {
    const role = user?.role ?? 'buyer';
    return role === 'seller'
      ? { icon: 'storefront' as const, label: lb('Seller', 'Vendeur', 'بائع'), color: colors.primary }
      : { icon: 'shopping-bag' as const, label: lb('Buyer', 'Acheteur', 'مشتري'), color: colors.secondary };
  }, [user?.role, colors.primary, colors.secondary, lb]);

  // Determine what content to show - but ALWAYS use a single return path
  // SELLERS should NEVER see this page — redirect to store-profile
  const showGuest = isReady && !isLoggedIn;
  const showUserLoading = isReady && isLoggedIn && (!user || !user.id);
  const showAdminRedirect = isReady && isLoggedIn && user && (user.role === 'super_admin' || user.role === 'staff');
  // Exclude sellers from seeing profile page — they have store-profile instead
  const showProfile = isReady && isLoggedIn && user && user.id && user.role !== 'super_admin' && user.role !== 'staff' && !user?.isSeller;

  // ---- SETTINGS (shared between guest and logged-in views) ----
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editName, setEditName] = useState(user?.name || user?.username || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [editAvatar, setEditAvatar] = useState(user?.avatar || '');
  const [editCover, setEditCover] = useState(user?.coverImage || '');

  const [notifOrders, setNotifOrders] = useState(true);
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifVerification, setNotifVerification] = useState(true);

  // ─── New settings state ───
  const [showEmail, setShowEmail] = useState(true);
  const [showPhone, setShowPhone] = useState(false);
  const [showLocation, setShowLocation] = useState(true);
  const [twoFactor, setTwoFactor] = useState(false);
  const [saveCart, setSaveCart] = useState(true);
  const [stockAlerts, setStockAlerts] = useState(true);
  const [autoAcceptOrders, setAutoAcceptOrders] = useState(false);
  const [emailNotif, setEmailNotif] = useState(true);
  const [smsNotif, setSmsNotif] = useState(false);
  const [allowDirectCall, setAllowDirectCall] = useState(true);

  const [dataSaver, setDataSaver] = useState(false);
  const [checkUpdates, setCheckUpdates] = useState(true);
  const [showLangModal, setShowLangModal] = useState(false);

  // ─── Blocked Sellers ───
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [blockedSellersList, setBlockedSellersList] = useState<any[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);

  const handleChangePassword = useCallback(async () => {
    if (!curPw || !newPw || !confirmPw) {
      Alert.alert(lb('All fields required', 'Tous les champs sont requis', 'جميع الحقول مطلوبة'));
      return;
    }
    if (newPw.length < 6) {
      Alert.alert(lb('Password too short', 'Mot de passe trop court', 'كلمة المرور قصيرة جدا'), lb('Use at least 6 characters', 'Au moins 6 caractères', '6 أحرف على الأقل'));
      return;
    }
    if (newPw !== confirmPw) {
      Alert.alert(lb('Passwords do not match', 'Mots de passe differents', 'كلمات المرور غير متطابقة'));
      return;
    }
    setPwLoading(true);
    try {
      // Re-authenticate by attempting password change via Supabase.
      // Note: Supabase changePassword does not verify the old password server-side;
      // we rely on the user being currently signed in (their session is the re-auth).
      const result = await changePassword(newPw);
      if (result?.error) {
        Alert.alert(lb('Failed to change password', 'Échec du changement de mot de passe', 'فشل تغيير كلمة المرور'), String(result.error));
        setPwLoading(false);
        return;
      }
      notifySuccess();
      setShowPasswordModal(false);
      setCurPw(''); setNewPw(''); setConfirmPw('');
      Alert.alert(lb('Password changed', 'Mot de passe modifié', 'تم تغيير كلمة المرور'), lb('Your password has been updated successfully.', 'Votre mot de passe a été mis à jour.', 'تم تحديث كلمة المرور بنجاح.'));
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to change password');
    }
    setPwLoading(false);
  }, [curPw, newPw, confirmPw, lb]);

  const pickEditAvatar = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission required'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled && result.assets[0]) { impactLight(); setEditAvatar(result.assets[0].uri); }
  }, []);

  const pickEditCover = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission required'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [16, 9] });
    if (!result.canceled && result.assets[0]) { impactLight(); setEditCover(result.assets[0].uri); }
  }, []);

  const handleSaveProfile = useCallback(async () => {
    if (!editName.trim()) {
      Alert.alert(lb('Name is required', 'Le nom est requis', 'الاسم مطلوب'));
      return;
    }
    if (editAvatar && editAvatar !== user?.avatar) updateUserAvatar(editAvatar);
    if (editCover && editCover !== user?.coverImage) updateUserCover(editCover);
    if (user?.id) {
      try {
        const updates: Record<string, any> = { name: editName.trim() };
        if (editPhone.trim()) updates.phone = editPhone.trim();
        const result = await updateProfile(updates);
        if (result?.error) {
          Alert.alert('Error', String(result.error));
          return;
        }
      } catch (e: any) {
        Alert.alert('Error', e?.message || 'Failed to update profile');
        return;
      }
    }
    notifySuccess();
    setShowEditProfileModal(false);
  }, [editName, editPhone, editAvatar, editCover, user?.id, user?.avatar, user?.coverImage, updateUserAvatar, updateUserCover]);

  const handleClearCache = useCallback(() => {
    Alert.alert(
      lb('Clear Cache?', 'Vider le cache?', 'مسح ذاكرة التخزين المؤقت؟'),
      lb('This will clear temporary data. Your account and listings are safe.', 'Ceci effacera les données temporaires. Votre compte et vos annonces sont en sécurité.', 'سيتم مسح البيانات المؤقتة. حسابك وإعلاناتك بأمان.'),
      [
        { text: lb('Cancel', 'Annuler', 'إلغاء'), style: 'cancel' },
        {
          text: lb('Clear', 'Vider', 'مسح'),
          style: 'destructive',
          onPress: () => { notifySuccess(); Alert.alert(lb('Cache Cleared', 'Cache vidé', 'تم المسح')); },
        },
      ],
    );
  }, [lb]);

  // ─── Blocked Sellers handlers ───
  const loadBlockedSellers = useCallback(async () => {
    setBlockedLoading(true);
    const list = await getBlockedSellers();
    setBlockedSellersList(list);
    setBlockedLoading(false);
  }, []);

  const openBlockedModal = useCallback(() => {
    selection();
    loadBlockedSellers();
    setShowBlockedModal(true);
  }, [loadBlockedSellers]);

  const handleUnblockSeller = useCallback(async (sellerId: string | number) => {
    const ok = await unblockSeller(String(sellerId));
    if (ok) {
      setBlockedSellersList(prev => prev.filter(s => String(s.seller_id) !== String(sellerId)));
      notifySuccess();
    } else {
      Alert.alert(lb('Failed to unblock', 'Échec du déblocage', 'فشل إلغاء الحظر'));
    }
  }, [lb]);

  const memberSince = useMemo(() => {
    const d = user?.created_at || (user as any)?.createdAt;
    if (!d) {
      // Fallback: estimate from numeric user id (timestamp-based IDs) or default to 1 year ago
      const numericId = parseInt(String(user?.id ?? ''), 10);
      if (!isNaN(numericId) && numericId > 1000000000) {
        // Looks like a Unix timestamp in seconds or ms
        const ts = numericId > 1e12 ? numericId : numericId * 1000;
        const date = new Date(ts);
        if (date.getFullYear() > 2000 && date.getFullYear() < 2100) {
          try {
            const locale = isAr ? 'ar' : isFr ? 'fr-FR' : 'en-US';
            return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
          } catch { return ''; }
        }
      }
      return '';
    }
    try {
      const locale = isAr ? 'ar' : isFr ? 'fr-FR' : 'en-US';
      return new Date(d).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    } catch { return ''; }
  }, [user, isAr, isFr]);

  const SettingsBlock = (
    <View style={pStyles.settingsSection}>
      <Text style={[pStyles.settingsGroupTitle, { color: colors.textTertiary }]}>{lb('General Settings', 'Paramètres généraux', 'الإعدادات العامة')}</Text>

      {/* Appearance card: language + dark mode */}
      {enabledLanguages && enabledLanguages.length > 1 ? (
      <View style={[pStyles.settingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Pressable onPress={() => { selection(); setShowLangModal(true); }} style={pStyles.settingRow}>
          <MaterialIcons name="language" size={scale(22)} color={colors.primary} />
          <Text style={[pStyles.settingLabel, { color: colors.textPrimary, flex: 1 }]}>{t('language')}</Text>
          <Text style={[pStyles.infoValue, { color: colors.textSecondary }]}>
            {SUPPORTED_LANGUAGES.find(l => l.id === language)?.nativeLabel || ''}
          </Text>
          <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={scale(22)} color={colors.textTertiary} />
        </Pressable>
      </View>
      ) : null}
      <View style={[pStyles.settingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={pStyles.settingRowFull}>
          <MaterialIcons name={isDark ? 'dark-mode' : 'light-mode'} size={scale(22)} color={colors.primary} />
          <Text style={[pStyles.settingLabel, { color: colors.textPrimary, flex: 1 }]}>{t('darkMode')}</Text>
          <Switch value={isDark} onValueChange={() => { selection(); toggleDarkMode(); }} trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#FFF" />
        </View>
      </View>

      {/* Notifications master toggle — controls all notification switches */}
      <View style={[pStyles.settingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={pStyles.settingRowFull}>
          <MaterialIcons name="notifications" size={scale(22)} color={colors.primary} />
          <Text style={[pStyles.settingLabel, { color: colors.textPrimary, flex: 1 }]}>{lb('Notifications', 'Notifications', 'الإشعارات')}</Text>
          <Switch value={notifOrders} onValueChange={(v) => { selection(); setNotifOrders(v); setNotifMessages(v); setNotifVerification(v); }} trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#FFF" />
        </View>
      </View>

      {/* Account settings list — only when logged in */}
      {isLoggedIn && user ? (
        <>
          <Text style={[pStyles.settingsGroupTitle, { color: colors.textTertiary, marginTop: scale(8) }]}>
            {lb('Account', 'Compte', 'الحساب')}
          </Text>

          {/* Edit Profile */}
          <Pressable onPress={() => { selection(); setShowEditProfileModal(true); }}
            style={({ pressed }) => [pStyles.settingListItem, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.88 : 1 }]}>
            <View style={[pStyles.settingIconWrap, { backgroundColor: colors.primary + '14' }]}>
              <MaterialIcons name="person" size={scale(20)} color={colors.primary} />
            </View>
            <Text style={[pStyles.settingListLabel, { color: colors.textPrimary, flex: 1 }]}>
              {lb('Edit Profile', 'Modifier le profil', 'تعديل الملف الشخصي')}
            </Text>
            <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={scale(22)} color={colors.textTertiary} />
          </Pressable>

          {/* Change Password */}
          <Pressable onPress={() => { selection(); setCurPw(''); setNewPw(''); setConfirmPw(''); setShowPasswordModal(true); }}
            style={({ pressed }) => [pStyles.settingListItem, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.88 : 1 }]}>
            <View style={[pStyles.settingIconWrap, { backgroundColor: colors.verified + '14' }]}>
              <MaterialIcons name="lock" size={scale(20)} color={colors.verified} />
            </View>
            <Text style={[pStyles.settingListLabel, { color: colors.textPrimary, flex: 1 }]}>
              {lb('Change Password', 'Changer le mot de passe', 'تغيير كلمة المرور')}
            </Text>
            <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={scale(22)} color={colors.textTertiary} />
          </Pressable>

          {/* Account Info */}
          <View style={[pStyles.settingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={pStyles.settingRow}>
              <View style={[pStyles.settingIconWrap, { backgroundColor: colors.textTertiary + '14' }]}>
                <MaterialIcons name="info" size={scale(20)} color={colors.textTertiary} />
              </View>
              <Text style={[pStyles.settingLabel, { color: colors.textPrimary }]}>
                {lb('Account Info', 'Informations du compte', 'معلومات الحساب')}
              </Text>
            </View>
            <View style={pStyles.infoRow}>
              <MaterialIcons name="email" size={scale(16)} color={colors.textTertiary} />
              <Text style={[pStyles.infoLabel, { color: colors.textTertiary }]}>{lb('Email', 'Email', 'البريد')}</Text>
              <Text style={[pStyles.infoValue, { color: colors.textPrimary }]} numberOfLines={1}>{user?.email || '-'}</Text>
            </View>
            <View style={pStyles.infoRow}>
              <MaterialIcons name="phone" size={scale(16)} color={colors.textTertiary} />
              <Text style={[pStyles.infoLabel, { color: colors.textTertiary }]}>{lb('Phone', 'Téléphone', 'الهاتف')}</Text>
              <Text style={[pStyles.infoValue, { color: colors.textPrimary }]} numberOfLines={1}>{user?.phone || '-'}</Text>
            </View>
            <View style={pStyles.infoRow}>
              <MaterialIcons name="event" size={scale(16)} color={colors.textTertiary} />
              <Text style={[pStyles.infoLabel, { color: colors.textTertiary }]}>{lb('Member since', 'Membre depuis', 'عضو منذ')}</Text>
              <Text style={[pStyles.infoValue, { color: colors.textPrimary }]}>{memberSince}</Text>
            </View>
          </View>
        </>
      ) : null}

      {/* ═══ Seller Settings (only for sellers) ═══ */}
      {isLoggedIn && user?.isSeller && (
        <>
          <Text style={[pStyles.settingsGroupTitle, { color: colors.textTertiary, marginTop: scale(8) }]}>
            {lb('Seller Settings', 'Paramètres vendeur', 'إعدادات البائع')}
          </Text>
          <Pressable onPress={() => { selection(); router.push('/seller' as any); }}
            style={({ pressed }) => [pStyles.settingListItem, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.88 : 1 }]}>
            <View style={[pStyles.settingIconWrap, { backgroundColor: colors.primary + '14' }]}>
              <MaterialIcons name="store" size={scale(20)} color={colors.primary} />
            </View>
            <Text style={[pStyles.settingListLabel, { color: colors.textPrimary, flex: 1 }]}>
              {lb('Store Settings', 'Paramètres boutique', 'إعدادات المتجر')}
            </Text>
            <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={scale(22)} color={colors.textTertiary} />
          </Pressable>
          <Pressable onPress={() => { selection(); router.push('/seller-payments'); }}
            style={({ pressed }) => [pStyles.settingListItem, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.88 : 1 }]}>
            <View style={[pStyles.settingIconWrap, { backgroundColor: colors.verified + '14' }]}>
              <MaterialIcons name="account-balance-wallet" size={scale(20)} color={colors.verified} />
            </View>
            <Text style={[pStyles.settingListLabel, { color: colors.textPrimary, flex: 1 }]}>
              {lb('Payment Settings', 'Paramètres de paiement', 'إعدادات الدفع')}
            </Text>
            <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={scale(22)} color={colors.textTertiary} />
          </Pressable>
          <View style={[pStyles.settingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={pStyles.notifRow}>
              <Text style={[pStyles.notifLabel, { color: colors.textSecondary }]}>{lb('Auto-accept orders', 'Acceptation automatique', 'قبول تلقائي')}</Text>
              <Switch value={autoAcceptOrders} onValueChange={(v) => { selection(); setAutoAcceptOrders(v); }} trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#FFF" />
            </View>
          </View>
        </>
      )}

      {/* ═══ Support & Help ═══ */}
      <Text style={[pStyles.settingsGroupTitle, { color: colors.textTertiary, marginTop: scale(8) }]}>
        {lb('Support & Help', 'Support et aide', 'الدعم والمساعدة')}
      </Text>
      <Pressable onPress={() => { selection(); Alert.alert(lb('Help Center', "Centre d'aide", 'مركز المساعدة'), lb('FAQ coming soon', 'FAQ bientôt', 'الأسئلة الشائعة قريباً')); }}
        style={({ pressed }) => [pStyles.settingListItem, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.88 : 1 }]}>
        <View style={[pStyles.settingIconWrap, { backgroundColor: colors.accent + '14' }]}>
          <MaterialIcons name="help-outline" size={scale(20)} color={colors.accent} />
        </View>
        <Text style={[pStyles.settingListLabel, { color: colors.textPrimary, flex: 1 }]}>
          {lb('Help Center', "Centre d'aide", 'مركز المساعدة')}
        </Text>
        <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={scale(22)} color={colors.textTertiary} />
      </Pressable>
      <Pressable onPress={() => { selection(); Alert.alert(lb('Report a Problem', 'Signaler un problème', 'الإبلاغ عن مشكلة'), lb('Send bug report', 'Envoyer rapport', 'إرسال تقرير')); }}
        style={({ pressed }) => [pStyles.settingListItem, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.88 : 1 }]}>
        <View style={[pStyles.settingIconWrap, { backgroundColor: colors.error + '14' }]}>
          <MaterialIcons name="bug-report" size={scale(20)} color={colors.error} />
        </View>
        <Text style={[pStyles.settingListLabel, { color: colors.textPrimary, flex: 1 }]}>
          {lb('Report a Problem', 'Signaler un problème', 'الإبلاغ عن مشكلة')}
        </Text>
        <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={scale(22)} color={colors.textTertiary} />
      </Pressable>
      <Pressable onPress={() => { selection(); router.push('/privacy-policy'); }}
        style={({ pressed }) => [pStyles.settingListItem, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.88 : 1 }]}>
        <View style={[pStyles.settingIconWrap, { backgroundColor: colors.primary + '14' }]}>
          <MaterialIcons name="policy" size={scale(20)} color={colors.primary} />
        </View>
        <Text style={[pStyles.settingListLabel, { color: colors.textPrimary, flex: 1 }]}>
          {lb('Privacy Policy', 'Confidentialité', 'الخصوصية')}
        </Text>
        <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={scale(22)} color={colors.textTertiary} />
      </Pressable>
      <Pressable onPress={() => { selection(); router.push('/privacy-policy'); }}
        style={({ pressed }) => [pStyles.settingListItem, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.88 : 1 }]}>
        <View style={[pStyles.settingIconWrap, { backgroundColor: colors.primary + '14' }]}>
          <MaterialIcons name="description" size={scale(20)} color={colors.primary} />
        </View>
        <Text style={[pStyles.settingListLabel, { color: colors.textPrimary, flex: 1 }]}>
          {lb('Terms of Service', "Conditions d'utilisation", 'الشروط والأحكام')}
        </Text>
        <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={scale(22)} color={colors.textTertiary} />
      </Pressable>

      {/* Clear Cache */}
      <Pressable onPress={() => { selection(); handleClearCache(); }}
        style={({ pressed }) => [pStyles.settingListItem, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.88 : 1 }]}>
        <View style={[pStyles.settingIconWrap, { backgroundColor: colors.warning + '14' }]}>
          <MaterialIcons name="cleaning-services" size={scale(20)} color={colors.warning} />
        </View>
        <Text style={[pStyles.settingListLabel, { color: colors.textPrimary, flex: 1 }]}>
          {lb('Clear Cache', 'Vider le cache', 'مسح الذاكرة المؤقتة')}
        </Text>
        <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={scale(22)} color={colors.textTertiary} />
      </Pressable>

      {/* ═══ Blocked Sellers (buyer only) ═══ */}
      {isLoggedIn && isBuyer ? (
        <Pressable onPress={openBlockedModal}
          style={({ pressed }) => [pStyles.settingListItem, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.88 : 1 }]}>
          <View style={[pStyles.settingIconWrap, { backgroundColor: colors.error + '14' }]}>
            <MaterialIcons name="block" size={scale(20)} color={colors.error} />
          </View>
          <Text style={[pStyles.settingListLabel, { color: colors.textPrimary, flex: 1 }]}>
            {lb('Blocked Sellers', 'Vendeurs bloqués', 'البائعون المحظورون')}
          </Text>
          <Text style={[pStyles.infoValue, { color: colors.textTertiary, marginRight: scale(4) }]}>
            {blockedSellersList.length > 0 ? String(blockedSellersList.length) : ''}
          </Text>
          <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={scale(22)} color={colors.textTertiary} />
        </Pressable>
      ) : null}

      {/* Logout — only for logged-in users */}
      {isLoggedIn ? (
        <Pressable onPress={() => { notifyWarning(); logout(); }}
          style={({ pressed }) => [pStyles.logoutBtnNew, { backgroundColor: colors.error + '08', borderColor: colors.error, opacity: pressed ? 0.88 : 1 }]}>
          <MaterialIcons name="logout" size={scale(20)} color={colors.error} />
          <Text style={[pStyles.logoutTextNew, { color: colors.error }]}>{t('logout')}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  // ---- Loading indicator while data loads (blank screen fix) ----
  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // ---- SELLER REDIRECT: Sellers should NEVER see this page ----
  // If user is a seller, redirect to store-profile immediately.
  // This catches any case where profile is opened by mistake (initial route, etc.)
  if (isLoggedIn && user?.isSeller) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // ---- SINGLE RETURN: Everything inside one SafeAreaView ----
  return (
    <SafeAreaView edges={['top']} style={[pStyles.safeArea, { backgroundColor: colors.background }]}>
      {showGuest ? (
        /* Guest view — compact card */
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + scale(16), paddingTop: scale(16) }} showsVerticalScrollIndicator={false}>
          <View style={[pStyles.guestCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[pStyles.guestAvatarCircle, { backgroundColor: colors.primary + '18' }]}>
              <MaterialIcons name="person" size={scale(32)} color={colors.primary} />
            </View>
            <Text style={[pStyles.guestName, { color: colors.textPrimary }]}>{t('guest')}</Text>
            <Text style={[pStyles.guestMsg, { color: colors.textSecondary }]} numberOfLines={2}>{t('loginRequiredMsg')}</Text>
            <Pressable onPress={() => { selection(); setShowLogin(true); }} style={({ pressed }) => [pStyles.guestLoginBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.88 : 1 }]}>
              <Text style={pStyles.guestLoginBtnText}>{t('login')}</Text>
            </Pressable>
            <Pressable onPress={() => { selection(); setShowLogin(true); }} hitSlop={12} style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}>
              <Text style={[pStyles.guestRegisterLink, { color: colors.primary }]}>{lb('Create Account', 'Créer un compte', 'إنشاء حساب')}</Text>
            </Pressable>
          </View>
          {SettingsBlock}
        </ScrollView>
      ) : showUserLoading || showAdminRedirect ? (
        /* User loading or admin redirect */
        <View style={pStyles.loadingFull}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.textTertiary, marginTop: scale(8), fontSize: scale(14) }}>
            {lb('Loading...', 'Chargement...', 'جاري التحميل...')}
          </Text>
        </View>
      ) : showProfile ? (
        /* Logged-in user profile */
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + scale(90) + scale(16) }} showsVerticalScrollIndicator={false}>
          <View style={{ paddingHorizontal: scale(16), paddingTop: scale(4), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <ReportButton />
            {!isSeller ? (
              <Pressable onPress={() => router.push('/settings' as any)} hitSlop={12}>
                <MaterialIcons name="settings" size={scale(22)} color={colors.textSecondary} />
              </Pressable>
            ) : null}
          </View>

          {/* Cover Banner - sellers only */}
          {isSeller ? (
            <Pressable onPress={pickCover} style={pStyles.coverContainer}>
              {user?.coverImage ? (
                <Image source={{ uri: user?.coverImage }} style={pStyles.coverImage} contentFit="cover" transition={200} />
              ) : (
                <Image source={require('@/assets/images/profile-bg.png')} style={pStyles.coverImage} contentFit="cover" transition={200} />
              )}
              <View style={pStyles.coverGradient} />
              <Pressable onPress={pickCover} style={pStyles.coverEditBtn} hitSlop={8}>
                <MaterialIcons name="camera-alt" size={scale(16)} color="#FFF" />
              </Pressable>
            </Pressable>
          ) : (
            <View style={{ height: scale(12) }} />
          )}

          {/* Profile Card */}
          <View style={[pStyles.profileCardContainer, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: isSeller ? -36 : 12 }]}>
            <View style={pStyles.profileCardTop}>
              <Pressable onPress={pickAvatar} style={pStyles.avatarPressable}>
                {user?.avatar ? (
                  <Image source={{ uri: user?.avatar }} style={[pStyles.profileAvatar, { borderColor: colors.surface }]} contentFit="cover" />
                ) : (
                  <Image source={require('@/assets/images/default-avatar.png')} style={[pStyles.profileAvatar, { borderColor: colors.surface }]} contentFit="cover" />
                )}
                <View style={[pStyles.avatarEditBadge, { backgroundColor: colors.primary }]}>
                  <MaterialIcons name="camera-alt" size={scale(11)} color="#FFF" />
                </View>
                {(user?.isVerified || user?.isVerifiedBuyer) ? (
                  <View style={[pStyles.avatarVerifiedBadge, { backgroundColor: colors.surface }]}>
                    <MaterialIcons name="verified" size={scale(16)} color={colors.verified} />
                  </View>
                ) : null}
              </Pressable>
              <View style={{ flex: 1, marginLeft: scale(14) }}>
                <View style={pStyles.nameLockRow}>
                  <Text style={[pStyles.profileName, { color: colors.textPrimary }]} numberOfLines={1}>{(user?.name && user?.name !== user?.email ? user?.name : (isAr ? 'مستخدم Sokchad' : isFr ? 'Utilisateur Sokchad' : 'Sokchad User'))}</Text>
                  {isSeller ? (
                    <View style={[pStyles.lockBadge, { backgroundColor: colors.textTertiary + '15' }]}>
                      <MaterialIcons name="lock" size={scale(10)} color={colors.textTertiary} />
                    </View>
                  ) : null}
                </View>
                <Text style={[pStyles.profileEmail, { color: colors.textSecondary }]} numberOfLines={1}>{user?.email || user?.phone || ''}</Text>
                <View style={pStyles.badgesRow}>
                  <View style={[pStyles.roleBadge, { backgroundColor: roleBadge.color + '12' }]}>
                    <MaterialIcons name={roleBadge.icon} size={scale(12)} color={roleBadge.color} />
                    <Text style={[pStyles.roleBadgeText, { color: roleBadge.color }]}>{roleBadge.label}</Text>
                  </View>
                  {user?.isVerifiedBuyer ? (
                    <View style={[pStyles.roleBadge, { backgroundColor: colors.verified + '12' }]}>
                      <MaterialIcons name="verified" size={scale(12)} color={colors.verified} />
                      <Text style={[pStyles.roleBadgeText, { color: colors.verified }]}>{lb('Verified', 'Vérifié', 'موثق')}</Text>
                    </View>
                  ) : null}
                  {!isSeller && buyerCompletedOrders.length >= 50 && (() => {
                    const finalOrders = buyerOrders.filter((o:any) => o?.status === 'completed' || o?.status === 'cancelled' || o?.status === 'disputed');
                    const rate = finalOrders.length > 0 ? Math.round((buyerCompletedOrders.length / finalOrders.length) * 100) : 0;
                    const uniqueSellers = new Set(buyerCompletedOrders.map((o:any) => o?.sellerId)).size;
                    return buyerCompletedOrders.length >= 50 && uniqueSellers >= 50 && rate >= 75 ? (
                      <View style={[pStyles.roleBadge, { backgroundColor: colors.success + '12' }]}>
                        <MaterialIcons name="verified-user" size={scale(12)} color={colors.success} />
                        <Text style={[pStyles.roleBadgeText, { color: colors.success }]}>{lb('Trusted Buyer', 'Acheteur vérifié', 'مشتري موثوق')}</Text>
                      </View>
                    ) : null;
                  })()}
                </View>
                <Pressable onPress={() => { selection(); setShowEditProfileModal(true); }}
                  style={({ pressed }) => [pStyles.editProfileBtn, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30', opacity: pressed ? 0.88 : 1 }]}>
                  <MaterialIcons name="edit" size={scale(14)} color={colors.primary} />
                  <Text style={[pStyles.editProfileBtnText, { color: colors.primary }]}>{lb('Edit Profile', 'Modifier', 'تعديل')}</Text>
                </Pressable>
              </View>
            </View>
            <View style={[pStyles.idRow, { borderTopColor: colors.borderLight }]}>
              <View style={[pStyles.idChip, { backgroundColor: colors.backgroundSecondary }]}>
                <MaterialIcons name="fingerprint" size={scale(14)} color={colors.primary} />
                <Text style={[pStyles.idChipText, { color: colors.textPrimary }]}>{'ID: ' + (user?.numericId || '---')}</Text>
              </View>
              {isSeller && user?.sellerId ? (
                <View style={[pStyles.idChip, { backgroundColor: colors.primary + '10' }]}>
                  <MaterialIcons name="badge" size={scale(14)} color={colors.primary} />
                  <Text style={[pStyles.idChipText, { color: colors.primary }]}>{user.sellerId}</Text>
                </View>
              ) : null}
              {memberSince ? (
                <View style={[pStyles.idChip, { backgroundColor: colors.backgroundSecondary }]}>
                  <MaterialIcons name="calendar-month" size={scale(14)} color={colors.textSecondary} />
                  <Text style={[pStyles.idChipText, { color: colors.textSecondary }]}>
                    {lb('Member since', 'Membre depuis', 'عضو منذ') + ' ' + memberSince}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Verification Status — sellers only */}
          {isSeller ? (
            <VerificationStatusCard verifyStatus={userVerifyStatus} colors={colors} lb={lb} onApply={openVerifyModal} />
          ) : null}

          {isSeller ? (
            <SellerVerificationCard user={user} canSellerRequestVerification={canSellerRequestVerification} colors={colors} lb={lb} />
          ) : null}

          {/* Buyer Trust Progress — buyers only, replaces paid subscription */}
          {!isSeller && isLoggedIn && user ? (
            <BuyerTrustProgress
              completedOrders={buyerCompletedOrders.length}
              totalOrders={buyerOrders.filter((o:any) => o?.status === 'completed' || o?.status === 'cancelled' || o?.status === 'disputed').length}
              uniqueSellers={new Set(buyerCompletedOrders.map((o:any) => o?.sellerId)).size}
              colors={colors}
              lb={lb}
              isAr={isAr}
            />
          ) : null}

          {isSeller ? (
            <Pressable onPress={() => router.push('/seller-payments')}
              style={[pStyles.paymentMethodsBtn, { backgroundColor: colors.surface, borderColor: colors.primary + '30' }]}>
              <View style={[pStyles.pmBtnIcon, { backgroundColor: colors.primary + '12' }]}>
                <MaterialIcons name="account-balance-wallet" size={scale(20)} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[pStyles.pmBtnTitle, { color: colors.textPrimary }]}>
                  {lb('Payment Receiving Numbers', 'Numéros de réception', 'أرقام الاستلام')}
                </Text>
                <Text style={[pStyles.pmBtnDesc, { color: colors.textTertiary }]}>
                  {lb('Set numbers so buyers can pay you', 'Configurez vos numéros de paiement', 'أعد أرقامك ليتمكن المشترون من الدفع')}
                </Text>
              </View>
              <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={scale(22)} color={colors.textTertiary} />
            </Pressable>
          ) : null}

          {/* Stats Row — compact */}
          <View style={pStyles.statsRow}>
            {[
              { value: isSeller ? userListings.length : buyerOrders.length, label: isSeller ? t('myListings') : t('myOrders'), icon: isSeller ? 'inventory-2' : 'receipt-long', color: colors.primary },
              { value: isSeller ? sellerOrders.length : favorites.length, label: isSeller ? lb('Orders', 'Commandes', 'طلبات') : t('favorites'), icon: isSeller ? 'shopping-bag' : 'favorite', color: '#EC4899' },
              { value: isSeller ? sellerReviews.length : userOrders.filter(o => o?.status === 'completed').length, label: isSeller ? lb('Reviews', 'Avis', 'التقييمات') : lb('Completed', 'Terminées', 'مكتملة'), icon: isSeller ? 'star' : 'check-circle', color: colors.success },
            ].map((stat, idx) => (
              <View key={idx} style={[pStyles.statCardCompact, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[pStyles.statIconWrapCompact, { backgroundColor: stat.color + '12' }]}>
                  <MaterialIcons name={stat.icon as any} size={scale(14)} color={stat.color} />
                </View>
                <Text style={[pStyles.statValueCompact, { color: colors.textPrimary }]}>{stat.value}</Text>
                <Text style={[pStyles.statLabelCompact, { color: colors.textTertiary }]}>{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* Seller Tabs */}
          {isSeller ? (
            <View style={[pStyles.settingsSection, { paddingBottom: insets.bottom + scale(90) + scale(16) }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={pStyles.sellerTabRow}>
                {(['products', 'orders', 'stats', 'reviews'] as const).map(tab => (
                  <Pressable key={tab} onPress={() => { selection(); setSellerTab(tab); }}
                    style={[pStyles.sellerTabChip, { backgroundColor: sellerTab === tab ? colors.primary : colors.surface, borderColor: sellerTab === tab ? colors.primary : colors.border }]}>
                    <MaterialIcons name={tab === 'products' ? 'inventory-2' : tab === 'orders' ? 'receipt-long' : tab === 'stats' ? 'bar-chart' : 'star'} size={scale(16)} color={sellerTab === tab ? '#FFF' : colors.textSecondary} />
                    <Text style={[pStyles.sellerTabText, { color: sellerTab === tab ? '#FFF' : colors.textSecondary }]}>
                      {tab === 'products' ? lb('Products', 'Produits', 'منتجات') : tab === 'orders' ? lb('Orders', 'Commandes', 'الطلبات') : tab === 'stats' ? lb('Statistics', 'Statistiques', 'إحصائيات') : lb('Reviews', 'Avis', 'التقييمات')}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {sellerTab === 'products' ? (
                userListings.length === 0 ? (
                  <View style={pStyles.emptyProducts}><MaterialIcons name="storefront" size={scale(48)} color={colors.textTertiary} /><Text style={[pStyles.emptyProductsText, { color: colors.textSecondary }]}>{lb('No products listed yet', 'Aucun produit publié', 'لا توجد منتجات منشورة')}</Text></View>
                ) : (
                  <View style={pStyles.productsGrid}>
                    {userListings.map(product => {
                      const title = product?.title?.[language] || product?.title?.en || '';
                      return (
                        <Pressable key={product.id} onPress={() => router.push(`/product/${product.id}`)}
                          style={({ pressed }) => [pStyles.myProductCard, { backgroundColor: colors.surface, borderColor: product?.isPinned ? colors.pinned : colors.borderLight, opacity: pressed ? 0.92 : 1 }, shadows.card]}>
                          <Image source={{ uri: product?.images?.[0] || '' }} style={pStyles.myProductImage} contentFit="cover" transition={200} />
                          {product?.isPinned ? (<View style={[pStyles.pinnedTag, { backgroundColor: colors.pinned }]}><MaterialIcons name="push-pin" size={scale(10)} color="#FFF" /></View>) : null}
                          <View style={pStyles.myProductInfo}>
                            <Text style={[pStyles.myProductPrice, { color: colors.primary }]}>{formatPrice(product?.price || 0)}</Text>
                            <Text style={[pStyles.myProductTitle, { color: colors.textPrimary }]} numberOfLines={1}>{title}</Text>
                            <View style={pStyles.myProductMeta}><MaterialIcons name="visibility" size={scale(11)} color={colors.textTertiary} /><Text style={[pStyles.myProductLocation, { color: colors.textTertiary }]}>{product?.views || 0}</Text></View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )
              ) : null}

              {sellerTab === 'orders' ? (
                <View>
                  {sellerOrders.length === 0 ? (
                    <View style={pStyles.emptyProducts}><MaterialIcons name="receipt-long" size={scale(48)} color={colors.textTertiary} /><Text style={[pStyles.emptyProductsText, { color: colors.textSecondary }]}>{lb('No orders yet', 'Aucune commande', 'لا توجد طلبات')}</Text></View>
                  ) : sellerOrders.map(order => {
                    if (!order?.id) return null;
                    const prod = (products || []).find(p => p?.id === order?.productId);
                    const buyerInfo = order?.buyerPhone?.split('|') || [];
                    const buyerCity = buyerInfo[0] || '';
                    const shipId = buyerInfo[1] || '';
                    const shipCompany = (shippingCompanies || []).find(s => s?.id === shipId);
                    const screenshotUri = order?.referenceId || '';
                    const hasScreenshot = screenshotUri.startsWith('file://') || screenshotUri.startsWith('content://') || screenshotUri.startsWith('ph://') || screenshotUri.includes('/');
                    return (
                      <View key={order.id} style={[pStyles.orderCard, { backgroundColor: colors.surface, borderColor: order?.status === 'pending' ? colors.warning + '40' : colors.border }]}>
                        <View style={pStyles.orderProductRow}>
                          {prod ? <Image source={{ uri: prod?.images?.[0] || '' }} style={pStyles.orderThumb} contentFit="cover" /> : null}
                          <View style={{ flex: 1 }}>
                            <View style={pStyles.orderTop}>
                              <Text style={[pStyles.orderProduct, { color: colors.textPrimary }]} numberOfLines={1}>{prod ? (prod?.title?.[language] || prod?.title?.en || '') : (order?.product_title_snapshot || order?.product_title_en || order?.product_title_fr || order?.product_title_ar || lb('Product', 'Produit', 'منتج'))}</Text>
                              <View style={[pStyles.statusBadge, { backgroundColor: getStatusColor(order?.status || '') + '20' }]}><Text style={[pStyles.statusText, { color: getStatusColor(order?.status || '') }]}>{getStatusLabel(order?.status || '')}</Text></View>
                            </View>
                            <Text style={[pStyles.orderAmount, { color: colors.primary }]}>{formatPrice(order?.amount || 0)}</Text>
                            {order?.orderNumber ? (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(6), marginTop: scale(2) }}>
                                <Text style={[pStyles.orderRef, { color: colors.textTertiary }]} numberOfLines={1}>
                                  {lb('Order #', 'Commande #', 'طلب #')}: {order.orderNumber}
                                </Text>
                                <Pressable onPress={() => {
                                  import('react-native').then(({ Clipboard }) => Clipboard.setString(order.orderNumber || ''));
                                  notifySuccess();
                                }} hitSlop={8}>
                                  <MaterialIcons name="content-copy" size={scale(14)} color={colors.primary} />
                                </Pressable>
                              </View>
                            ) : null}
                            {buyerCity ? <Text style={[pStyles.orderRef, { color: colors.textTertiary }]}>{lb('City:', 'Ville:', 'المدينة:')} {buyerCity}</Text> : null}
                            {shipCompany ? <Text style={[pStyles.orderRef, { color: colors.textTertiary }]}>{lb('Shipping:', 'Transport:', 'الشحن:')} {shipCompany.name}</Text> : null}
                          </View>
                        </View>
                        {hasScreenshot ? (
                          <View style={{ marginTop: scale(8) }}>
                            <Text style={[pStyles.orderRef, { color: colors.textSecondary, fontWeight: '600', marginBottom: scale(4) }]}>{lb('Payment Screenshot:', 'Capture de paiement:', 'لقطة شاشة الدفع:')}</Text>
                            <Image source={{ uri: screenshotUri }} style={{ width: '100%', height: scale(160), borderRadius: scale(8) }} contentFit="cover" transition={200} />
                          </View>
                        ) : null}
                        {order?.status === 'pending' ? (
                          <Pressable onPress={() => { notifySuccess(); confirmOrderReceived(order.id); }} style={[pStyles.receivedBtn, { backgroundColor: colors.success }]}>
                            <MaterialIcons name="check-circle" size={scale(16)} color="#FFF" />
                            <Text style={pStyles.receivedBtnText}>{lb('Payment Received, Will Ship', 'Paiement reçu, expédition', 'تم استلام الدفع، سيتم الشحن')}</Text>
                          </Pressable>
                        ) : null}
                        {order?.status === 'confirmed' ? (
                          <View style={[pStyles.completedRow, { backgroundColor: colors.successLight }]}>
                            <MaterialIcons name="local-shipping" size={scale(14)} color={colors.success} />
                            <Text style={[pStyles.completedText, { color: colors.success }]}>{lb('Confirmed - Shipping', 'Confirmé - En expédition', 'مؤكد - جاري الشحن')}</Text>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {sellerTab === 'stats' ? (
                <View style={pStyles.statsContent}>
                  <View style={[pStyles.revenueCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
                    <View style={[pStyles.revenueIcon, { backgroundColor: colors.primary + '20' }]}><MaterialIcons name="account-balance-wallet" size={scale(24)} color={colors.primary} /></View>
                    <Text style={[pStyles.revenueLabel, { color: colors.textSecondary }]}>{lb('Total Revenue', 'Revenus totaux', 'إجمالي الإيرادات')}</Text>
                    <Text style={[pStyles.revenueValue, { color: colors.primary }]}>{formatPrice(totalRevenue)}</Text>
                  </View>
                  <View style={pStyles.orderStatsRow}>
                    <View style={[pStyles.orderStatCard, { backgroundColor: colors.warningLight, borderColor: colors.warning + '30' }]}><MaterialIcons name="pending-actions" size={scale(18)} color={colors.warning} /><Text style={[pStyles.orderStatValue, { color: colors.warning }]}>{pendingOrders}</Text><Text style={[pStyles.orderStatLabel, { color: colors.textSecondary }]}>{lb('Pending', 'En attente', 'معلق')}</Text></View>
                    <View style={[pStyles.orderStatCard, { backgroundColor: colors.successLight, borderColor: colors.success + '30' }]}><MaterialIcons name="check-circle" size={scale(18)} color={colors.success} /><Text style={[pStyles.orderStatValue, { color: colors.success }]}>{confirmedOrders}</Text><Text style={[pStyles.orderStatLabel, { color: colors.textSecondary }]}>{lb('Confirmed', 'Confirmées', 'مؤكد')}</Text></View>
                  </View>
                  <View style={pStyles.orderStatsRow}>
                    <View style={[pStyles.orderStatCard, { backgroundColor: colors.verifiedLight, borderColor: colors.verified + '30' }]}><MaterialIcons name="group" size={scale(18)} color={colors.verified} /><Text style={[pStyles.orderStatValue, { color: colors.verified }]}>{uniqueBuyers}</Text><Text style={[pStyles.orderStatLabel, { color: colors.textSecondary }]}>{lb('Buyers', 'Acheteurs', 'مشترون')}</Text></View>
                    <View style={[pStyles.orderStatCard, { backgroundColor: colors.pinnedLight, borderColor: colors.pinned + '30' }]}><MaterialIcons name="visibility" size={scale(18)} color={colors.pinned} /><Text style={[pStyles.orderStatValue, { color: colors.pinned }]}>{totalProductViews}</Text><Text style={[pStyles.orderStatLabel, { color: colors.textSecondary }]}>{lb('Views', 'Vues', 'مشاهدات')}</Text></View>
                  </View>
                  <View style={pStyles.orderStatsRow}>
                    <View style={[pStyles.orderStatCard, { backgroundColor: colors.accentLight, borderColor: colors.accent + '30' }]}><MaterialIcons name="trending-up" size={scale(18)} color={colors.accent} /><Text style={[pStyles.orderStatValue, { color: colors.accent }]}>{formatPrice(avgOrderValue)}</Text><Text style={[pStyles.orderStatLabel, { color: colors.textSecondary }]}>{lb('Avg Order', 'Panier moyen', 'متوسط الطلب')}</Text></View>
                    <View style={[pStyles.orderStatCard, { backgroundColor: colors.secondaryLight, borderColor: colors.secondary + '30' }]}><MaterialIcons name="inventory-2" size={scale(18)} color={colors.secondary} /><Text style={[pStyles.orderStatValue, { color: colors.secondary }]}>{totalStock}</Text><Text style={[pStyles.orderStatLabel, { color: colors.textSecondary }]}>{lb('In Stock', 'Stock', 'المخزون')}</Text></View>
                  </View>
                  {categoryStats.length > 0 ? (
                    <View style={[pStyles.categoryBreakdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <Text style={[pStyles.categoryBreakdownTitle, { color: colors.textPrimary }]}>{lb('By Category', 'Par categorie', 'حسب الفئة')}</Text>
                      {categoryStats.map(cat => (
                        <View key={cat.id} style={pStyles.categoryStatRow}>
                          <View style={[pStyles.categoryDot, { backgroundColor: cat.color }]} />
                          <Text style={[pStyles.categoryStatName, { color: colors.textPrimary }]}>{cat.name}</Text>
                          <View style={[pStyles.categoryBar, { backgroundColor: colors.borderLight }]}><View style={[pStyles.categoryBarFill, { backgroundColor: cat.color, width: `${Math.max(10, (cat.count / Math.max(1, userListings.length)) * 100)}%` }]} /></View>
                          <Text style={[pStyles.categoryStatCount, { color: colors.textSecondary }]}>{cat.count}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}

              {sellerTab === 'reviews' ? (
                <View style={pStyles.statsContent}>
                  {sellerReviews.length === 0 ? (
                    <View style={pStyles.emptyProducts}><MaterialIcons name="rate-review" size={scale(48)} color={colors.textTertiary} /><Text style={[pStyles.emptyProductsText, { color: colors.textSecondary }]}>{lb('No reviews yet', 'Aucun avis', 'لا توجد تقييمات')}</Text></View>
                  ) : sellerReviews.map(rev => (
                    <View key={rev.id} style={[pStyles.reviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <View style={pStyles.reviewHeader}><Text style={[pStyles.reviewerName, { color: colors.textPrimary }]}>{rev?.buyerName || ''}</Text><View style={pStyles.starsRow}>{[1, 2, 3, 4, 5].map(s => (<MaterialIcons key={s} name={s <= (rev?.rating || 0) ? 'star' : 'star-border'} size={scale(16)} color="#F59E0B" />))}</View></View>
                      <Text style={[pStyles.reviewText, { color: colors.textSecondary }]}>{rev?.text || ''}</Text>
                      {rev?.photoUri ? (<Image source={{ uri: rev.photoUri }} style={pStyles.reviewPhoto} contentFit="cover" transition={200} />) : null}
                      <Text style={[pStyles.reviewDate, { color: colors.textTertiary }]}>{rev?.createdAt ? new Date(rev.createdAt).toLocaleDateString() : ''}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Buyer Tabs */}
          {isBuyer ? (
            <View style={[pStyles.settingsSection, { paddingBottom: 0 }]}>
              <View style={pStyles.buyerTabRow}>
                {(['orders', 'stats', 'favorites'] as const).map(tab => (
                  <Pressable key={tab} onPress={() => { selection(); setBuyerTab(tab); }}
                    style={[pStyles.buyerTabChip, { backgroundColor: buyerTab === tab ? colors.primary : colors.surface, borderColor: buyerTab === tab ? colors.primary : colors.border }]}>
                    <MaterialIcons name={tab === 'orders' ? 'receipt-long' : tab === 'stats' ? 'bar-chart' : 'favorite'} size={scale(14)} color={buyerTab === tab ? '#FFF' : colors.textSecondary} />
                    <Text style={[pStyles.buyerTabText, { color: buyerTab === tab ? '#FFF' : colors.textSecondary }]}>
                      {tab === 'orders' ? lb('Orders', 'Commandes', 'الطلبات') : tab === 'stats' ? lb('Statistics', 'Statistiques', 'الإحصائيات') : lb('Favorites', 'Favoris', 'المفضلة')}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {buyerTab === 'stats' ? (
                <View style={{ paddingBottom: insets.bottom + scale(90) + scale(16) }}>
                <BuyerStatsContent
                  buyerCompletedOrders={buyerCompletedOrders}
                  buyerOrders={buyerOrders}
                  colors={colors}
                  lb={lb}
                  isAr={isAr}
                  isFr={isFr}
                  statsPeriod={statsPeriod}
                  setStatsPeriod={setStatsPeriod}
                  customDateFrom={customDateFrom}
                  setCustomDateFrom={setCustomDateFrom}
                  customDateTo={customDateTo}
                  setCustomDateTo={setCustomDateTo}
                  sellersInteracted={sellersInteracted}
                  formatPrice={formatPrice}
                  router={router}
                  styles={pStyles}
                />
                </View>
              ) : null}

              {buyerTab === 'orders' ? (
                <View style={{ gap: scale(8), paddingBottom: insets.bottom + scale(90) + scale(16) }}>
                  {buyerOrders.length === 0 ? (
                    <View style={[pStyles.emptyProducts, { paddingVertical: scale(60), justifyContent: 'center', alignItems: 'center' }]}><MaterialIcons name="receipt-long" size={scale(48)} color={colors.textTertiary} /><Text style={[pStyles.emptyProductsText, { color: colors.textSecondary }]}>{t('noOrdersDesc')}</Text></View>
                  ) : buyerOrders.map(order => {
                    if (!order?.id) return null;
                    // Normalize fields: API orders use snake_case (product_id, order_number, created_at)
                    // while mock orders use camelCase (productId, orderNumber, createdAt).
                    const oid = String(order.id);
                    const productId = String(order.productId || order.product_id || '');
                    const sellerId = String(order.sellerId || order.seller_id || '');
                    const createdAt = order.createdAt || order.created_at || '';
                    const prod = getProductById(productId);
                    const orderNumber = order.orderNumber || order.order_number || `#SC-${new Date(createdAt).getFullYear()}-${String(order.id).padStart(6, '0')}`;
                    // Transaction number (20-digit) — displayed to user instead of order_number
                    const transactionNumber = order.transaction_number || orderNumber;
                    const productTitle = prod ? (prod?.title?.[language] || prod?.title?.en || lb('Product', 'Produit', 'منتج')) : (order.product_title_snapshot || order.product_title_en || order.product_title_fr || order.product_title_ar || lb('Product', 'Produit', 'منتج'));
                    const productImage = prod?.images?.[0] || order.product_image || order.product_image_snapshot || '';
                    const sellerName = order.sellerName || order.seller_name || order.seller_name_snapshot || '';
                    return (
                      <Pressable
                        key={order.id}
                        onPress={() => router.push(`/order/${oid}` as any)}
                        style={[pStyles.orderCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      >
                        <View style={pStyles.orderProductRow}>
                          {productImage ? <Image source={{ uri: productImage }} style={pStyles.orderThumb} contentFit="cover" /> : <View style={[pStyles.orderThumb, { backgroundColor: colors.backgroundSecondary, alignItems: 'center', justifyContent: 'center' }]}><MaterialIcons name="image" size={scale(24)} color={colors.textTertiary} /></View>}
                          <View style={{ flex: 1 }}>
                            <View style={pStyles.orderTop}>
                              <Text style={[pStyles.orderProduct, { color: colors.textPrimary }]} numberOfLines={1}>{productTitle}</Text>
                              <View style={[pStyles.statusBadge, { backgroundColor: getStatusColor(order?.status || '') + '20' }]}><Text style={[pStyles.statusText, { color: getStatusColor(order?.status || '') }]}>{getStatusLabel(order?.status || '')}</Text></View>
                            </View>
                            <Text style={[pStyles.orderAmount, { color: colors.primary }]}>{formatPrice(order?.amount || 0)}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(6), marginTop: scale(2) }}>
                              <Text style={[pStyles.orderRef, { color: colors.textTertiary }]} numberOfLines={1}>
                                {lb('Transaction #', 'Numéro de transaction', 'رقم العملية')}: {transactionNumber}
                              </Text>
                              <Pressable
                                onPress={(e) => { e.stopPropagation(); Clipboard.setStringAsync(transactionNumber); notifySuccess(); }}
                                hitSlop={8}
                              >
                                <MaterialIcons name="content-copy" size={scale(14)} color={colors.primary} />
                              </Pressable>
                            </View>
                            {createdAt ? (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(4), marginTop: scale(2) }}>
                                <MaterialIcons name="event" size={scale(12)} color={colors.textTertiary} />
                                <Text style={[pStyles.orderRef, { color: colors.textTertiary }]}>{new Date(createdAt).toLocaleDateString()}</Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                        {(order?.status === 'confirmed' || order?.status === 'delivered') ? (
                          <Pressable onPress={() => router.push(`/product/${productId}?orderId=${oid}&showReview=true`)} style={[pStyles.receivedBtn, { backgroundColor: colors.success }]}>
                            <MaterialIcons name="check-circle" size={scale(16)} color="#FFF" />
                            <Text style={pStyles.receivedBtnText}>{lb('Item Received', 'Article reçu', 'تم الاستلام')}</Text>
                          </Pressable>
                        ) : null}
                        {order?.status === 'completed' ? (
                          <View style={[pStyles.completedRow, { backgroundColor: colors.successLight }]}><MaterialIcons name="verified" size={scale(14)} color={colors.success} /><Text style={[pStyles.completedText, { color: colors.success }]}>{lb('Order Completed', 'Commande terminée', 'تم إكمال الطلب')}</Text></View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {/* Follow/Favorites sub-tabs */}
              {!isSeller && (
                <View style={{ flexDirection: 'row', gap: scale(8), marginBottom: scale(12), paddingHorizontal: scale(4) }}>
                  <Pressable
                    onPress={() => setFollowTab('favorites')}
                    style={({ pressed }) => [pStyles.subTab, { backgroundColor: followTab === 'favorites' ? colors.primary : colors.surface, borderColor: followTab === 'favorites' ? colors.primary : colors.border, opacity: pressed ? 0.85 : 1 }]}
                  >
                    <MaterialIcons name="favorite" size={scale(14)} color={followTab === 'favorites' ? '#FFF' : colors.textTertiary} />
                    <Text style={{ fontSize: scale(12), fontWeight: '700', color: followTab === 'favorites' ? '#FFF' : colors.textSecondary, fontFamily: 'Cairo-SemiBold' }}>{lb('Favorites', 'Favoris', 'المفضلة')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setFollowTab('following')}
                    style={({ pressed }) => [pStyles.subTab, { backgroundColor: followTab === 'following' ? colors.primary : colors.surface, borderColor: followTab === 'following' ? colors.primary : colors.border, opacity: pressed ? 0.85 : 1 }]}
                  >
                    <MaterialIcons name="people" size={scale(14)} color={followTab === 'following' ? '#FFF' : colors.textTertiary} />
                    <Text style={{ fontSize: scale(12), fontWeight: '700', color: followTab === 'following' ? '#FFF' : colors.textSecondary, fontFamily: 'Cairo-SemiBold' }}>{lb('Following', 'Abonnements', 'متابَعون')}</Text>
                  </Pressable>
                </View>
              )}

              {buyerTab === 'favorites' && followTab === 'following' && !isSeller ? (
                <View style={{ gap: scale(10) }}>
                  {(followedSellers?.length ?? 0) === 0 ? (
                    <View style={[pStyles.emptyProducts, { paddingVertical: scale(60), justifyContent: 'center', alignItems: 'center' }]}>
                      <MaterialIcons name="people-outline" size={scale(48)} color={colors.textTertiary} />
                      <Text style={[pStyles.emptyProductsText, { color: colors.textSecondary }]}>{lb('Not following any stores yet.', 'Aucun abonnement.', 'لا تتابع أي متاجر بعد.')}</Text>
                    </View>
                  ) : (
                    followedSellers.map((seller: any) => {
                      const sId = String(seller.seller_id || seller.id || '');
                      return (
                        <Pressable
                          key={sId}
                          onPress={() => router.push('/seller/' + sId as any)}
                          style={({ pressed }) => [pStyles.followedCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.9 : 1 }]}
                        >
                          {seller.avatar || seller.avatar_url ? (
                            <Image source={{ uri: seller.avatar || seller.avatar_url }} style={pStyles.followedAvatar} contentFit="cover" />
                          ) : (
                            <View style={[pStyles.followedAvatar, { backgroundColor: colors.primary }]}><Text style={pStyles.followedAvatarText}>{(seller.name || 'S').charAt(0)}</Text></View>
                          )}
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(4) }}>
                              <Text style={{ fontSize: scale(14), fontWeight: '700', color: colors.textPrimary, fontFamily: 'Cairo-Bold' }}>{seller.name || seller.username || ''}</Text>
                              {seller.is_verified && <MaterialIcons name="verified" size={scale(14)} color={colors.verified} />}
                            </View>
                            {seller.seller_id && <Text style={{ fontSize: scale(11), color: colors.textTertiary, fontFamily: 'Cairo-Regular' }}>{seller.seller_id}</Text>}
                          </View>
                          <Pressable
                            onPress={(e) => { e.stopPropagation(); impactLight(); toggleFollowNotifications(sId, !(seller.notifications_enabled ?? true)); }}
                            hitSlop={8}
                            style={{ padding: scale(6) }}
                          >
                            <MaterialIcons
                              name={seller.notifications_enabled ? 'notifications' : 'notifications-off'}
                              size={scale(18)}
                              color={seller.notifications_enabled ? colors.primary : colors.textTertiary}
                            />
                          </Pressable>
                        </Pressable>
                      );
                    })
                  )}
                </View>
              ) : buyerTab === 'favorites' ? (
                <View style={{ paddingBottom: insets.bottom + scale(90) + scale(16) }}>
                  {(favorites?.length ?? 0) === 0 ? (
                    <View style={[pStyles.emptyProducts, { paddingVertical: scale(60), justifyContent: 'center', alignItems: 'center' }]}><MaterialIcons name="favorite-border" size={scale(48)} color={colors.textTertiary} /><Text style={[pStyles.emptyProductsText, { color: colors.textSecondary }]}>{lb('No favorites yet.', 'Aucun favori.', 'لا توجد مفضلات.')}</Text></View>
                  ) : (
                    <View style={[pStyles.productsGrid, { marginTop: scale(8) }]}>
                      {favorites.map(favId => {
                        const product = (products || []).find(p => p?.id === favId);
                        if (!product) return null;
                        const title = product?.title?.[language] || product?.title?.en || '';
                        return (
                          <Pressable key={product.id} onPress={() => router.push(`/product/${product.id}`)}
                            style={({ pressed }) => [pStyles.myProductCard, { backgroundColor: colors.surface, borderColor: colors.borderLight, opacity: pressed ? 0.92 : 1 }, shadows.card]}>
                            <Image source={{ uri: product?.images?.[0] || '' }} style={pStyles.myProductImage} contentFit="cover" transition={200} />
                            <View style={pStyles.myProductInfo}>
                              <Text style={[pStyles.myProductPrice, { color: colors.primary }]}>{formatPrice(product?.price || 0)}</Text>
                              <Text style={[pStyles.myProductTitle, { color: colors.textPrimary }]} numberOfLines={1}>{title}</Text>
                              <View style={pStyles.myProductMeta}><MaterialIcons name="location-on" size={scale(11)} color={colors.textTertiary} /><Text style={[pStyles.myProductLocation, { color: colors.textTertiary }]}>{product?.location || ''}</Text></View>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Settings - sellers see inline; buyers navigate to /settings page */}
          {isSeller ? SettingsBlock : null}
        </ScrollView>
      ) : null}

      {/* Verification Subscription Modal */}
      <Modal visible={showVerifyModal} transparent animationType="slide" onRequestClose={() => setShowVerifyModal(false)}>
        <View style={[pStyles.verifyModalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[pStyles.verifyModalContent, { backgroundColor: colors.surface }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={pStyles.verifyModalHeader}>
                <Text style={[pStyles.verifyModalTitle, { color: colors.primary }]}>{lb('Blue Badge Subscription', 'Abonnement Badge Bleu', 'اشتراك الشارة الزرقاء')}</Text>
                <Pressable onPress={() => setShowVerifyModal(false)} hitSlop={12}><MaterialIcons name="close" size={scale(24)} color={colors.textSecondary} /></Pressable>
              </View>
              <Text style={[pStyles.verifyModalDesc, { color: colors.textSecondary }]}>
                {lb('Select a subscription plan, transfer the fee to the platform number below, and upload a screenshot of your payment.',
                  'Choisissez un plan, transferez les frais au numero ci-dessous, et telecharger une capture de votre paiement.',
                  'اختر خطة اشتراك، حوّل الرسوم إلى الرقم أدناه، وارفع لقطة شاشة لدفعك.')}
              </Text>
              <VerifyEligibilityBox canUserRequestVerification={canUserRequestVerification} colors={colors} lb={lb} />
              <View style={[pStyles.adminNumberCard, { backgroundColor: colors.verified + '08', borderColor: colors.verified + '30' }]}>
                <MaterialIcons name="account-balance" size={scale(20)} color={colors.verified} />
                <View style={{ flex: 1 }}>
                  <Text style={[pStyles.adminNumberLabel, { color: colors.textSecondary }]}>{lb('PLATFORM PAYMENT NUMBER', 'NUMERO DE PAIEMENT', 'رقم الدفع للمنصة')}</Text>
                  <Text style={[pStyles.adminNumberValue, { color: colors.verified }]}>{adminPaymentNumber}</Text>
                </View>
              </View>
              <Text style={[pStyles.verifyDocLabel, { color: colors.textSecondary }]}>{lb('SELECT PLAN *', 'CHOISIR LE PLAN *', 'اختر الخطة *')}</Text>
              {(verificationPlans || []).filter(p => p?.isActive).map(plan => (
                <Pressable key={plan.id} onPress={() => { selection(); setSelectedPlanId(plan.id); }}
                  style={[pStyles.planCard, { backgroundColor: selectedPlanId === plan.id ? colors.primary + '10' : colors.backgroundSecondary, borderColor: selectedPlanId === plan.id ? colors.primary : colors.border, borderWidth: selectedPlanId === plan.id ? 2 : 1 }]}>
                  <View style={{ flex: 1 }}><Text style={[pStyles.planName, { color: colors.textPrimary }]}>{plan.name}</Text><Text style={[pStyles.planDuration, { color: colors.textTertiary }]}>{plan.durationDays} {lb('days', 'jours', 'يوم')}</Text></View>
                  <Text style={[pStyles.planPrice, { color: colors.primary }]}>{formatPrice(plan.price)}</Text>
                  <View style={[pStyles.planRadio, { borderColor: selectedPlanId === plan.id ? colors.primary : colors.border, backgroundColor: selectedPlanId === plan.id ? colors.primary : 'transparent' }]}>{selectedPlanId === plan.id ? <MaterialIcons name="check" size={scale(14)} color="#FFF" /> : null}</View>
                </Pressable>
              ))}
              <Text style={[pStyles.verifyDocLabel, { color: colors.textSecondary, marginTop: scale(16) }]}>{lb('PAYMENT RECEIPT SCREENSHOT *', 'CAPTURE DU RECU DE PAIEMENT *', 'لقطة شاشة إيصال الدفع *')}</Text>
              <Pressable onPress={() => pickVerifyImage(setReceipt)} style={[pStyles.verifyDocPicker, { backgroundColor: colors.backgroundSecondary, borderColor: receipt ? colors.success : colors.border }]}>
                {receipt ? (<Image source={{ uri: receipt }} style={pStyles.verifyDocPreview} contentFit="cover" />) : (
                  <View style={pStyles.verifyDocPlaceholder}><MaterialIcons name="receipt-long" size={scale(32)} color={colors.textTertiary} /><Text style={[pStyles.verifyDocPlaceholderText, { color: colors.textTertiary }]}>{lb('Tap to upload receipt', 'Appuyer pour telecharger', 'اضغط لرفع الإيصال')}</Text></View>
                )}
              </Pressable>
              <View style={[pStyles.verifyInfoBox, { backgroundColor: colors.warning + '10', borderColor: colors.warning + '30' }]}>
                <MaterialIcons name="info" size={scale(16)} color={colors.warning} />
                <Text style={[pStyles.verifyInfoText, { color: colors.textSecondary }]}>
                  {lb('Transfer the plan fee to the platform number above, then upload a screenshot.',
                    'Transferez les frais au numero ci-dessus, puis telecharger une capture.',
                    'حوّل رسوم الخطة إلى الرقم أعلاه، ثم ارفع لقطة شاشة.')}
                </Text>
              </View>
              <Pressable onPress={handleSubmitVerification}
                style={({ pressed }) => [pStyles.verifySubmitBtn, { backgroundColor: canUserRequestVerification().eligible ? colors.primary : colors.textTertiary, opacity: pressed ? 0.9 : 1 }]}
                disabled={verifyLoading || !canUserRequestVerification().eligible}>
                <MaterialIcons name="send" size={scale(18)} color="#FFF" />
                <Text style={pStyles.verifySubmitBtnText}>{verifyLoading ? '...' : lb('Submit Subscription', 'Soumettre', 'إرسال الاشتراك')}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <LoginModal visible={showLogin} onClose={() => setShowLogin(false)} />

      {/* Change Password Modal */}
      <Modal visible={showPasswordModal} transparent animationType="slide" onRequestClose={() => setShowPasswordModal(false)}>
        <View style={[pStyles.verifyModalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[pStyles.verifyModalContent, { backgroundColor: colors.surface }]}>
            <View style={pStyles.verifyModalHeader}>
              <Text style={[pStyles.verifyModalTitle, { color: colors.primary }]}>
                {lb('Change Password', 'Changer le mot de passe', 'تغيير كلمة المرور')}
              </Text>
              <Pressable onPress={() => setShowPasswordModal(false)} hitSlop={12}><MaterialIcons name="close" size={scale(24)} color={colors.textSecondary} /></Pressable>
            </View>
            <Text style={[pStyles.verifyModalDesc, { color: colors.textSecondary }]}>
              {lb('Enter your current password and a new one.', 'Entrez votre mot de passe actuel et un nouveau.', 'أدخل كلمة المرور الحالية وكلمة جديدة.')}
            </Text>

            <Text style={[pStyles.verifyDocLabel, { color: colors.textSecondary }]}>{lb('CURRENT PASSWORD *', 'MOT DE PASSE ACTUEL *', 'كلمة المرور الحالية *')}</Text>
            <TextInput
              value={curPw}
              onChangeText={setCurPw}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={lb('Current password', 'Mot de passe actuel', 'كلمة المرور الحالية')}
              placeholderTextColor={colors.textTertiary}
              style={[pStyles.pwInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.textPrimary }]}
            />

            <Text style={[pStyles.verifyDocLabel, { color: colors.textSecondary, marginTop: scale(12) }]}>{lb('NEW PASSWORD *', 'NOUVEAU MOT DE PASSE *', 'كلمة المرور الجديدة *')}</Text>
            <TextInput
              value={newPw}
              onChangeText={setNewPw}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={lb('At least 6 characters', 'Au moins 6 caractères', '6 أحرف على الأقل')}
              placeholderTextColor={colors.textTertiary}
              style={[pStyles.pwInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.textPrimary }]}
            />

            <Text style={[pStyles.verifyDocLabel, { color: colors.textSecondary, marginTop: scale(12) }]}>{lb('CONFIRM NEW PASSWORD *', 'CONFIRMER LE MOT DE PASSE *', 'تأكيد كلمة المرور *')}</Text>
            <TextInput
              value={confirmPw}
              onChangeText={setConfirmPw}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={lb('Repeat new password', 'Repeter le mot de passe', 'كرر كلمة المرور')}
              placeholderTextColor={colors.textTertiary}
              style={[pStyles.pwInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.textPrimary }]}
            />

            <Pressable onPress={handleChangePassword}
              style={({ pressed }) => [pStyles.verifySubmitBtn, { backgroundColor: pwLoading ? colors.textTertiary : colors.primary, opacity: pressed ? 0.9 : 1 }]}
              disabled={pwLoading}>
              {pwLoading ? <ActivityIndicator color="#FFF" /> : <MaterialIcons name="lock-reset" size={scale(18)} color="#FFF" />}
              <Text style={pStyles.verifySubmitBtnText}>{pwLoading ? '...' : lb('Update Password', 'Mettre a jour', 'تحديث كلمة المرور')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal visible={showEditProfileModal} transparent animationType="slide" onRequestClose={() => setShowEditProfileModal(false)}>
        <View style={[pStyles.verifyModalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[pStyles.verifyModalContent, { backgroundColor: colors.surface }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={pStyles.verifyModalHeader}>
                <Text style={[pStyles.verifyModalTitle, { color: colors.primary }]}>
                  {lb('Edit Profile', 'Modifier le profil', 'تعديل الملف الشخصي')}
                </Text>
                <Pressable onPress={() => setShowEditProfileModal(false)} hitSlop={12}><MaterialIcons name="close" size={scale(24)} color={colors.textSecondary} /></Pressable>
              </View>

              {/* Avatar + Cover pickers */}
              <Text style={[pStyles.verifyDocLabel, { color: colors.textSecondary }]}>{lb('AVATAR', 'AVATAR', 'الصورة الشخصية')}</Text>
              <Pressable onPress={pickEditAvatar} style={[pStyles.verifyDocPicker, { height: scale(100), backgroundColor: colors.backgroundSecondary, borderColor: editAvatar ? colors.success : colors.border }]}>
                {editAvatar ? (
                  <Image source={{ uri: editAvatar }} style={{ width: scale(80), height: scale(80), borderRadius: scale(40) }} contentFit="cover" />
                ) : (
                  <View style={pStyles.verifyDocPlaceholder}><MaterialIcons name="account-circle" size={scale(40)} color={colors.textTertiary} /><Text style={[pStyles.verifyDocPlaceholderText, { color: colors.textTertiary }]}>{lb('Tap to choose', 'Appuyer pour choisir', 'اضغط للاختيار')}</Text></View>
                )}
              </Pressable>

              {isSeller ? (
                <>
                  <Text style={[pStyles.verifyDocLabel, { color: colors.textSecondary, marginTop: scale(12) }]}>{lb('COVER IMAGE', 'IMAGE DE COUVERTURE', 'صورة الغلاف')}</Text>
                  <Pressable onPress={pickEditCover} style={[pStyles.verifyDocPicker, { height: scale(100), backgroundColor: colors.backgroundSecondary, borderColor: editCover ? colors.success : colors.border }]}>
                    {editCover ? (
                      <Image source={{ uri: editCover }} style={{ width: '100%', height: '100%', borderRadius: scale(8) }} contentFit="cover" />
                    ) : (
                      <View style={pStyles.verifyDocPlaceholder}><MaterialIcons name="add-photo-alternate" size={scale(40)} color={colors.textTertiary} /><Text style={[pStyles.verifyDocPlaceholderText, { color: colors.textTertiary }]}>{lb('Tap to choose', 'Appuyer pour choisir', 'اضغط للاختيار')}</Text></View>
                    )}
                  </Pressable>
                </>
              ) : null}

              <Text style={[pStyles.verifyDocLabel, { color: colors.textSecondary, marginTop: scale(12) }]}>{lb('NAME *', 'NOM *', 'الاسم *')}</Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                placeholder={lb('Your name', 'Votre nom', 'اسمك')}
                placeholderTextColor={colors.textTertiary}
                style={[pStyles.pwInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.textPrimary }]}
              />

              <Text style={[pStyles.verifyDocLabel, { color: colors.textSecondary, marginTop: scale(12) }]}>{lb('PHONE', 'TELEPHONE', 'الهاتف')}</Text>
              <TextInput
                value={editPhone}
                onChangeText={setEditPhone}
                keyboardType="phone-pad"
                placeholder={lb('Phone number', 'Numero de telephone', 'رقم الهاتف')}
                placeholderTextColor={colors.textTertiary}
                style={[pStyles.pwInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.textPrimary }]}
              />

              <Pressable onPress={handleSaveProfile}
                style={({ pressed }) => [pStyles.verifySubmitBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 }]}>
                <MaterialIcons name="check" size={scale(18)} color="#FFF" />
                <Text style={pStyles.verifySubmitBtnText}>{lb('Save Changes', 'Enregistrer', 'حفظ التغييرات')}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Language Picker Modal */}
      <Modal visible={showLangModal} transparent animationType="fade" onRequestClose={() => setShowLangModal(false)}>
        <Pressable style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: scale(20) }} onPress={() => setShowLangModal(false)}>
          <View style={{ width: '100%', maxWidth: scale(340), borderRadius: borderRadius.lg, padding: scale(20), backgroundColor: colors.surface }}>
            <Text style={{ fontSize: scale(18), fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: scale(16) }}>
              {lb('Select Language', 'Choisir la langue', 'اختر اللغة')}
            </Text>
            {SUPPORTED_LANGUAGES.filter(lang => enabledLanguages.includes(lang.id)).map(lang => (
              <Pressable key={lang.id} onPress={() => { selection(); setLanguage(lang.id); setShowLangModal(false); }}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingVertical: scale(14), paddingHorizontal: scale(12), borderRadius: scale(10), marginBottom: scale(4), backgroundColor: language === lang.id ? colors.primary + '20' : 'transparent', opacity: pressed ? 0.88 : 1 })}>
                <Text style={{ fontSize: scale(22), marginRight: scale(12) }}>{lang.flag || '🌐'}</Text>
                <Text style={{ flex: 1, fontSize: scale(16), fontWeight: '500', color: colors.textPrimary }}>{lang.nativeLabel}</Text>
                {language === lang.id && <MaterialIcons name="check" size={scale(22)} color={colors.primary} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Blocked Sellers Modal */}
      <Modal visible={showBlockedModal} transparent animationType="slide" onRequestClose={() => setShowBlockedModal(false)}>
        <View style={[pStyles.verifyModalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[pStyles.verifyModalContent, { backgroundColor: colors.surface }]}>
            <View style={pStyles.verifyModalHeader}>
              <Text style={[pStyles.verifyModalTitle, { color: colors.error }]}>
                {lb('Blocked Sellers', 'Vendeurs bloqués', 'البائعون المحظورون')}
              </Text>
              <Pressable onPress={() => setShowBlockedModal(false)} hitSlop={12}>
                <MaterialIcons name="close" size={scale(24)} color={colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={[pStyles.verifyModalDesc, { color: colors.textSecondary }]}>
              {lb('Sellers you blocked cannot contact you and their products are hidden.', 'Les vendeurs bloqués ne peuvent pas vous contacter et leurs produits sont masqués.', 'البائعون المحظورون لا يمكنهم التواصل معك ومنتجاتهم مخفية.')}
            </Text>

            {blockedLoading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: scale(24) }} />
            ) : blockedSellersList.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: scale(32), gap: scale(8) }}>
                <MaterialIcons name="block" size={scale(48)} color={colors.textTertiary} />
                <Text style={{ fontSize: scale(15), fontWeight: '600', color: colors.textSecondary, textAlign: 'center' }}>
                  {lb('No blocked sellers', 'Aucun vendeur bloqué', 'لا يوجد بائعون محظورون')}
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: scale(400) }}>
                {blockedSellersList.map((seller) => (
                  <View key={String(seller.seller_id)} style={[pStyles.settingListItem, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, marginBottom: scale(8) }]}>
                    <View style={[pStyles.settingIconWrap, { backgroundColor: colors.error + '14' }]}>
                      <MaterialIcons name="storefront" size={scale(20)} color={colors.error} />
                    </View>
                    <View style={{ flex: 1, gap: scale(2) }}>
                      <Text style={{ fontSize: scale(15), fontWeight: '600', color: colors.textPrimary }} numberOfLines={1}>
                        {seller.seller_name || `#${seller.seller_id}`}
                      </Text>
                      {seller.seller_location ? (
                        <Text style={{ fontSize: scale(12), color: colors.textTertiary }} numberOfLines={1}>
                          {seller.seller_location}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={() => handleUnblockSeller(seller.seller_id)}
                      style={({ pressed }) => ({
                        flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(12), paddingVertical: scale(8),
                        borderRadius: borderRadius.full, backgroundColor: colors.success + '14', gap: scale(4), opacity: pressed ? 0.85 : 1,
                      })}>
                      <MaterialIcons name="check" size={scale(16)} color={colors.success} />
                      <Text style={{ fontSize: scale(13), fontWeight: '700', color: colors.success }}>
                        {lb('Unblock', 'Débloquer', 'إلغاء الحظر')}
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const pStyles = StyleSheet.create({
  safeArea: { flex: 1 },
  loadingFull: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // ---- Guest card ----
  guestCard: { alignItems: 'center', marginHorizontal: scale(16), paddingVertical: scale(24), paddingHorizontal: scale(24), borderRadius: borderRadius.lg, borderWidth: 0.5 },
  guestAvatarCircle: { width: scale(64), height: scale(64), borderRadius: scale(32), alignItems: 'center', justifyContent: 'center', marginBottom: scale(12) },
  guestName: { fontSize: scale(18), fontWeight: '700', marginBottom: scale(4), fontFamily: 'Cairo-Bold' },
  guestMsg: { fontSize: scale(14), textAlign: 'center', marginBottom: scale(16), lineHeight: 20, fontFamily: 'Cairo-Regular' },
  guestLoginBtn: { paddingHorizontal: scale(32), paddingVertical: scale(12), borderRadius: borderRadius.md, marginBottom: scale(12) },
  guestLoginBtnText: { color: '#FFF', fontSize: scale(15), fontWeight: '700', fontFamily: 'Cairo-SemiBold' },
  guestRegisterLink: { fontSize: scale(13), fontWeight: '600', fontFamily: 'Cairo-Regular' },
  coverContainer: { width: '100%', height: scale(110), position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  coverGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: scale(60), backgroundColor: 'rgba(0,0,0,0.15)' },
  coverEditBtn: { position: 'absolute', top: scale(12), right: scale(12), width: scale(32), height: scale(32), borderRadius: scale(16), backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  profileCardContainer: { marginHorizontal: scale(16), marginTop: scale(-36), borderRadius: borderRadius.lg, borderWidth: 0.5, padding: scale(10), shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  profileCardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: scale(6) },
  avatarPressable: { position: 'relative' },
  profileAvatar: { width: scale(56), height: scale(56), borderRadius: scale(28), borderWidth: 3 },
  avatarEditBadge: { position: 'absolute', bottom: 0, right: 0, width: scale(18), height: scale(18), borderRadius: scale(9), alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF' },
  avatarVerifiedBadge: { position: 'absolute', top: -2, right: -2, width: scale(22), height: scale(22), borderRadius: scale(11), alignItems: 'center', justifyContent: 'center' },
  nameLockRow: { flexDirection: 'row', alignItems: 'center', gap: scale(6) },
  lockBadge: { width: scale(20), height: scale(20), borderRadius: scale(10), alignItems: 'center', justifyContent: 'center' },
  profileName: { fontSize: scale(20), fontWeight: '800', flexShrink: 1, fontFamily: 'Cairo-Bold' },
  profileEmail: { fontSize: scale(13), marginTop: scale(1), fontFamily: 'Cairo-Regular' },
  badgesRow: { flexDirection: 'row', gap: scale(6), marginTop: scale(6), flexWrap: 'wrap' },
  roleBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(10), paddingVertical: scale(4), borderRadius: borderRadius.full, gap: scale(4) },
  roleBadgeText: { fontSize: scale(11), fontWeight: '700', fontFamily: 'Cairo-SemiBold' },
  editProfileBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: scale(12), paddingVertical: scale(6), borderRadius: borderRadius.full, borderWidth: 0.5, gap: scale(4), marginTop: scale(8) },
  editProfileBtnText: { fontSize: scale(12), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },
  idRow: { flexDirection: 'row', gap: scale(8), marginTop: scale(6), paddingTop: scale(6), borderTopWidth: 0.5, flexWrap: 'wrap' },
  idChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(10), paddingVertical: scale(6), borderRadius: scale(10), gap: scale(5) },
  idChipText: { fontSize: scale(12), fontWeight: '700', letterSpacing: 0.5, fontFamily: 'Cairo-SemiBold' },
  statsRow: { flexDirection: 'row', paddingHorizontal: scale(16), gap: scale(8), marginTop: scale(12), marginBottom: scale(4) },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: scale(14), borderRadius: borderRadius.lg, borderWidth: 0.5, gap: scale(4) },
  statIconWrap: { width: scale(34), height: scale(34), borderRadius: scale(17), alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: scale(22), fontWeight: '800', fontFamily: 'Cairo-Bold' },
  statLabel: { fontSize: scale(10), fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'Cairo-Regular' },
  // Compact variants — ~20-25% smaller
  statCardCompact: { flex: 1, alignItems: 'center', paddingVertical: scale(8), borderRadius: borderRadius.md, borderWidth: 0.5, gap: scale(2) },
  statIconWrapCompact: { width: scale(24), height: scale(24), borderRadius: scale(12), alignItems: 'center', justifyContent: 'center' },
  statValueCompact: { fontSize: scale(16), fontWeight: '800', fontFamily: 'Cairo-Bold' },
  statLabelCompact: { fontSize: scale(9), fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'Cairo-Regular' },
  settingsSection: { paddingHorizontal: scale(16), marginTop: scale(12) },
  settingsGroupTitle: { fontSize: scale(12), fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: scale(8), fontFamily: 'Cairo-SemiBold' },
  settingCard: { borderRadius: borderRadius.lg, borderWidth: 0.5, padding: scale(14), marginBottom: scale(8) },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: scale(10), marginBottom: scale(10) },
  settingRowFull: { flexDirection: 'row', alignItems: 'center', gap: scale(10) },
  settingLabel: { fontSize: scale(15), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },
  langRow: { flexDirection: 'row', gap: scale(8) },
  langChip: { flex: 1, paddingVertical: scale(8), borderRadius: borderRadius.sm, borderWidth: 1, alignItems: 'center' },
  langText: { fontSize: scale(13), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },
  sellerTabRow: { gap: scale(8), marginBottom: scale(14), paddingRight: scale(8) },
  sellerTabChip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: scale(16), paddingVertical: scale(10), borderRadius: borderRadius.full, borderWidth: 1, gap: scale(6) },
  sellerTabText: { fontSize: scale(13), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },
  productsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  myProductCard: { width: CARD_WIDTH, borderRadius: borderRadius.lg, borderWidth: 0.5, overflow: 'hidden', marginBottom: scale(12) },
  myProductImage: { width: '100%', height: CARD_WIDTH },
  pinnedTag: { position: 'absolute', top: scale(6), left: scale(6), width: scale(22), height: scale(22), borderRadius: scale(11), alignItems: 'center', justifyContent: 'center' },
  myProductInfo: { padding: scale(8), gap: scale(2) },
  myProductPrice: { fontSize: scale(15), fontWeight: '700', fontFamily: 'Cairo-Bold' },
  myProductTitle: { fontSize: scale(12), fontWeight: '500', fontFamily: 'Cairo-Regular' },
  myProductMeta: { flexDirection: 'row', alignItems: 'center', gap: scale(2), marginTop: scale(2) },
  myProductLocation: { fontSize: scale(10), fontWeight: '400', fontFamily: 'Cairo-Regular' },
  emptyProducts: { alignItems: 'center', paddingVertical: scale(32), gap: scale(8) },
  emptyProductsText: { fontSize: scale(16), fontWeight: '600', textAlign: 'center', fontFamily: 'Cairo-SemiBold' },
  statsContent: { gap: scale(12) },
  revenueCard: { borderRadius: borderRadius.lg, borderWidth: 0.5, padding: scale(20), alignItems: 'center', gap: scale(8) },
  revenueIcon: { width: scale(48), height: scale(48), borderRadius: scale(24), alignItems: 'center', justifyContent: 'center' },
  revenueLabel: { fontSize: scale(13), fontWeight: '500', fontFamily: 'Cairo-Regular' },
  revenueValue: { fontSize: scale(28), fontWeight: '800', fontFamily: 'Cairo-Bold' },
  orderStatsRow: { flexDirection: 'row', gap: scale(8) },
  orderStatCard: { flex: 1, alignItems: 'center', paddingVertical: scale(14), borderRadius: borderRadius.lg, borderWidth: 0.5, gap: scale(4) },
  orderStatValue: { fontSize: scale(22), fontWeight: '700', fontFamily: 'Cairo-Bold' },
  orderStatLabel: { fontSize: scale(10), fontWeight: '600', textTransform: 'uppercase', fontFamily: 'Cairo-Regular' },
  categoryBreakdown: { borderRadius: borderRadius.lg, borderWidth: 0.5, padding: scale(14), gap: scale(10) },
  categoryBreakdownTitle: { fontSize: scale(15), fontWeight: '700', marginBottom: scale(4), fontFamily: 'Cairo-SemiBold' },
  categoryStatRow: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
  categoryDot: { width: scale(10), height: scale(10), borderRadius: scale(5) },
  categoryStatName: { fontSize: scale(13), fontWeight: '500', width: scale(80), fontFamily: 'Cairo-Regular' },
  categoryBar: { flex: 1, height: scale(8), borderRadius: scale(4), overflow: 'hidden' },
  categoryBarFill: { height: '100%', borderRadius: 4 },
  categoryStatCount: { fontSize: scale(13), fontWeight: '700', width: scale(24), textAlign: 'right', fontFamily: 'Cairo-Bold' },
  reviewCard: { borderRadius: borderRadius.lg, borderWidth: 0.5, padding: scale(14), marginBottom: scale(10), gap: scale(6) },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewerName: { fontSize: scale(15), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },
  starsRow: { flexDirection: 'row' },
  reviewText: { fontSize: scale(14), lineHeight: 20, fontFamily: 'Cairo-Regular' },
  reviewPhoto: { width: '100%', height: scale(160), borderRadius: scale(8), marginTop: scale(4) },
  reviewDate: { fontSize: scale(11), fontFamily: 'Cairo-Regular' },
  orderCard: { padding: scale(14), borderRadius: borderRadius.lg, borderWidth: 0.5, marginBottom: scale(8) },
  orderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: scale(4) },
  orderProduct: { flex: 1, fontSize: scale(15), fontWeight: '600', marginRight: scale(8), fontFamily: 'Cairo-SemiBold' },
  statusBadge: { paddingHorizontal: scale(8), paddingVertical: scale(3), borderRadius: scale(6) },
  statusText: { fontSize: scale(11), fontWeight: '700', textTransform: 'uppercase', fontFamily: 'Cairo-Bold' },
  orderAmount: { fontSize: scale(18), fontWeight: '700', marginBottom: scale(2), fontFamily: 'Cairo-Bold' },
  orderRef: { fontSize: scale(12), fontFamily: 'Cairo-Regular' },
  buyerTabRow: { flexDirection: 'row', gap: scale(8), marginBottom: scale(8) },
  buyerTabChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: scale(8), paddingHorizontal: scale(10), borderRadius: borderRadius.full, borderWidth: 1, gap: scale(4) },
  buyerTabText: { fontSize: scale(12), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },
  orderProductRow: { flexDirection: 'row', gap: scale(10), alignItems: 'center' },
  orderThumb: { width: scale(52), height: scale(52), borderRadius: scale(8) },
  receivedBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: scale(10), borderRadius: borderRadius.md, gap: scale(6), marginTop: scale(8) },
  receivedBtnText: { color: '#FFF', fontSize: scale(14), fontWeight: '700', fontFamily: 'Cairo-SemiBold' },
  completedRow: { flexDirection: 'row', alignItems: 'center', gap: scale(6), paddingVertical: scale(8), paddingHorizontal: scale(12), borderRadius: borderRadius.sm, marginTop: scale(6) },
  completedText: { fontSize: scale(13), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },
  verifyProgressCard: { marginHorizontal: scale(16), marginTop: scale(12), padding: scale(14), borderRadius: borderRadius.lg, borderWidth: 0.5, gap: scale(8) },
  verifyProgressHeader: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
  verifyProgressTitle: { fontSize: scale(14), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },
  verifyBar: { height: scale(8), borderRadius: scale(4), overflow: 'hidden' },
  verifyBarFill: { height: '100%', borderRadius: 4 },
  verifyProgressText: { fontSize: scale(12), fontFamily: 'Cairo-Regular' },
  legalBtn: { flexDirection: 'row', alignItems: 'center', marginHorizontal: scale(16), marginTop: scale(16), padding: scale(14), borderRadius: borderRadius.lg, borderWidth: 0.5, gap: scale(12) },
  legalIconWrap: { width: scale(36), height: scale(36), borderRadius: scale(18), alignItems: 'center', justifyContent: 'center' },
  legalBtnText: { flex: 1, fontSize: scale(15), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: scale(16), marginTop: scale(20), marginBottom: scale(16), paddingVertical: scale(14), borderRadius: borderRadius.md, borderWidth: 1.5, gap: scale(8) },
  logoutText: { fontSize: scale(16), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },
  paymentMethodsBtn: { flexDirection: 'row', alignItems: 'center', marginHorizontal: scale(16), marginTop: scale(12), padding: scale(14), borderRadius: borderRadius.lg, borderWidth: 0.5, gap: scale(12) },
  pmBtnIcon: { width: scale(40), height: scale(40), borderRadius: scale(20), alignItems: 'center', justifyContent: 'center' },
  pmBtnTitle: { fontSize: scale(15), fontWeight: '700', fontFamily: 'Cairo-SemiBold' },
  pmBtnDesc: { fontSize: scale(12), marginTop: scale(2), fontFamily: 'Cairo-Regular' },
  verifyApplyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: scale(44), borderRadius: borderRadius.md, gap: scale(6), marginTop: scale(8) },
  verifyApplyBtnText: { color: '#FFF', fontSize: scale(14), fontWeight: '700', fontFamily: 'Cairo-SemiBold' },
  verifyModalOverlay: { flex: 1, justifyContent: 'flex-end' },
  verifyModalContent: { borderTopLeftRadius: scale(24), borderTopRightRadius: scale(24), padding: scale(24), maxHeight: '90%' },
  verifyModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: scale(8) },
  verifyModalTitle: { fontSize: scale(20), fontWeight: '700', fontFamily: 'Cairo-Bold' },
  verifyModalDesc: { fontSize: scale(14), lineHeight: 21, marginBottom: scale(16), fontFamily: 'Cairo-Regular' },
  verifyDocLabel: { fontSize: scale(11), fontWeight: '700', letterSpacing: 0.8, marginBottom: scale(6), marginTop: scale(12), fontFamily: 'Cairo-SemiBold' },
  verifyDocPicker: { borderRadius: borderRadius.md, borderWidth: 2, borderStyle: 'dashed', overflow: 'hidden', height: scale(120), alignItems: 'center', justifyContent: 'center' },
  verifyDocPreview: { width: '100%', height: '100%' },
  verifyDocPlaceholder: { alignItems: 'center', gap: scale(4) },
  verifyDocPlaceholderText: { fontSize: scale(12), fontWeight: '500', fontFamily: 'Cairo-Regular' },
  verifyInfoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: scale(8), padding: scale(12), borderRadius: borderRadius.md, borderWidth: 1, marginTop: scale(16) },
  verifyInfoText: { flex: 1, fontSize: scale(12), lineHeight: 18, fontFamily: 'Cairo-Regular' },
  verifySubmitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: scale(52), borderRadius: borderRadius.md, gap: scale(8), marginTop: scale(16), marginBottom: scale(16) },
  verifySubmitBtnText: { color: '#FFF', fontSize: scale(16), fontWeight: '700', fontFamily: 'Cairo-SemiBold' },
  adminNumberCard: { flexDirection: 'row', alignItems: 'center', gap: scale(12), padding: scale(14), borderRadius: borderRadius.md, borderWidth: 1.5, marginBottom: scale(12) },
  adminNumberLabel: { fontSize: scale(10), fontWeight: '700', letterSpacing: 0.8, fontFamily: 'Cairo-SemiBold' },
  adminNumberValue: { fontSize: scale(20), fontWeight: '800', marginTop: scale(2), fontFamily: 'Cairo-Bold' },
  planCard: { flexDirection: 'row', alignItems: 'center', gap: scale(12), padding: scale(14), borderRadius: borderRadius.md, marginBottom: scale(8) },
  planName: { fontSize: scale(16), fontWeight: '700', fontFamily: 'Cairo-SemiBold' },
  planDuration: { fontSize: scale(12), marginTop: scale(2), fontFamily: 'Cairo-Regular' },
  planPrice: { fontSize: scale(18), fontWeight: '800', fontFamily: 'Cairo-Bold' },
  planRadio: { width: scale(24), height: scale(24), borderRadius: scale(12), borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  sellerInteractRow: { flexDirection: 'row', alignItems: 'center', gap: scale(10), paddingVertical: scale(8), borderBottomWidth: 0.5, borderBottomColor: 'rgba(128,128,128,0.2)' },
  sellerInteractAvatarWrap: { position: 'relative' },
  sellerInteractAvatar: { width: scale(36), height: scale(36), borderRadius: scale(18) },
  sellerInteractOnline: { position: 'absolute', bottom: 0, right: 0, width: scale(10), height: scale(10), borderRadius: scale(5), backgroundColor: '#22C55E', borderWidth: 1.5, borderColor: '#FFF' },
  sellerInteractAvatarPlaceholder: { width: scale(36), height: scale(36), borderRadius: scale(18), alignItems: 'center', justifyContent: 'center' },
  // ---- New settings list styles ----
  settingListItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: scale(16), paddingHorizontal: scale(14), minHeight: scale(54), borderRadius: borderRadius.lg, borderWidth: 0.5, marginBottom: scale(8), gap: scale(12) },
  settingIconWrap: { width: scale(38), height: scale(38), borderRadius: scale(19), alignItems: 'center', justifyContent: 'center' },
  settingListLabel: { fontSize: scale(15), fontWeight: '600', fontFamily: 'Cairo-Regular' },
  notifRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: scale(10), borderTopWidth: 0.5, borderTopColor: 'rgba(128,128,128,0.2)' },
  notifLabel: { fontSize: scale(14), fontWeight: '500', flex: 1, fontFamily: 'Cairo-Regular' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: scale(8), paddingVertical: scale(8), borderTopWidth: 0.5, borderTopColor: 'rgba(128,128,128,0.2)' },
  infoLabel: { fontSize: scale(13), fontWeight: '600', width: scale(90), fontFamily: 'Cairo-SemiBold' },
  infoValue: { flex: 1, fontSize: scale(14), fontWeight: '500', textAlign: 'right', fontFamily: 'Cairo-Regular' },
  aboutLinkRow: { flexDirection: 'row', alignItems: 'center', gap: scale(8), paddingVertical: scale(10), borderTopWidth: 0.5, borderTopColor: 'rgba(128,128,128,0.2)' },
  logoutBtnNew: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: scale(20), marginBottom: scale(8), paddingVertical: scale(14), borderRadius: borderRadius.lg, borderWidth: 1, gap: scale(8) },
  logoutTextNew: { fontSize: scale(16), fontWeight: '700', fontFamily: 'Cairo-Bold' },
  subTab: { flexDirection: 'row', alignItems: 'center', gap: scale(4), paddingHorizontal: scale(12), paddingVertical: scale(8), borderRadius: 9999, borderWidth: 1 },
  followedCard: { flexDirection: 'row', alignItems: 'center', padding: scale(12), borderRadius: scale(12), borderWidth: 0.5, gap: scale(10) },
  followedAvatar: { width: scale(40), height: scale(40), borderRadius: scale(20), alignItems: 'center', justifyContent: 'center' },
  followedAvatarText: { fontSize: scale(16), fontWeight: '800', color: '#FFF', fontFamily: 'Cairo-Bold' },
  pwInput: { height: scale(48), borderRadius: borderRadius.md, borderWidth: 1, paddingHorizontal: scale(14), fontSize: scale(15), fontWeight: '500', fontFamily: 'Cairo-Regular' },
});
