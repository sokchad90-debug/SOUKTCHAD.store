import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal, Alert, Switch, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { StaffPermission, ShippingCompany, VerificationPlan, VerificationSubscription } from '@/contexts/AppContext';
import { formatPrice } from '@/constants/config';
import { borderRadius, shadows } from '@/constants/theme';
import { impactLight, impactMedium, selection, notifySuccess, notifyWarning } from '@/services/haptics';
import * as ImagePicker from 'expo-image-picker';
import {
  getStoreLogo, updateStoreLogo,
  getAllAdBanners, addAdBanner, deleteAdBanner, toggleBannerActive, reorderBanners,
  AdBanner,
} from '@/services/branding';
// Verification now handled via AppContext subscription system

import { ALL_COUNTRIES, REGIONS } from '@/constants/countries';

type Tab = 'sellers' | 'disputes' | 'payments' | 'shipping' | 'users' | 'blacklist' | 'staff' | 'countries' | 'branding' | 'verification' | 'languages';

const TAB_CONFIG: { key: Tab; icon: string; label: string; labelFr: string; labelAr: string; permission?: StaffPermission }[] = [
  { key: 'sellers', icon: 'storefront', label: 'Sellers', labelFr: 'Vendeurs', labelAr: 'البائعون', permission: 'manage_sellers' },
  { key: 'verification', icon: 'verified', label: 'Verification', labelFr: 'Verification', labelAr: 'التوثيق' },
  { key: 'disputes', icon: 'gavel', label: 'Disputes', labelFr: 'Litiges', labelAr: 'النزاعات', permission: 'manage_disputes' },
  { key: 'payments', icon: 'account-balance-wallet', label: 'Payments', labelFr: 'Paiements', labelAr: 'المدفوعات', permission: 'manage_payments' },
  { key: 'shipping', icon: 'local-shipping', label: 'Shipping', labelFr: 'Transport', labelAr: 'الشحن' },
  { key: 'users', icon: 'people', label: 'Users', labelFr: 'Utilisateurs', labelAr: 'المستخدمون', permission: 'manage_users' },
  { key: 'branding', icon: 'palette', label: 'Branding', labelFr: 'Image de marque', labelAr: 'العلامة التجارية' },
  { key: 'languages', icon: 'language', label: 'Languages', labelFr: 'Langues', labelAr: 'اللغات' },
  { key: 'countries', icon: 'public', label: 'Countries', labelFr: 'Pays', labelAr: 'الدول' },
  { key: 'blacklist', icon: 'block', label: 'Blacklist', labelFr: 'Liste noire', labelAr: 'القائمة السوداء', permission: 'view_blacklist' },
  { key: 'staff', icon: 'admin-panel-settings', label: 'Staff', labelFr: 'Personnel', labelAr: 'الموظفون' },
];

const BAN_DURATIONS = [
  { label: '1 Week', labelFr: '1 Semaine', labelAr: '1 اسبوع', days: 7 },
  { label: '1 Month', labelFr: '1 Mois', labelAr: '1 شهر', days: 30 },
  { label: '1 Year', labelFr: '1 An', labelAr: '1 سنة', days: 365 },
  { label: '4 Years', labelFr: '4 Ans', labelAr: '4 سنوات', days: 1460 },
  { label: 'Permanent', labelFr: 'Permanent', labelAr: 'دائم', days: 99999 },
];

const VERIFY_DURATIONS = [
  { label: '1 Month', labelFr: '1 Mois', labelAr: '1 شهر', days: 30 },
  { label: '3 Months', labelFr: '3 Mois', labelAr: '3 اشهر', days: 90 },
  { label: '6 Months', labelFr: '6 Mois', labelAr: '6 اشهر', days: 180 },
  { label: '1 Year', labelFr: '1 An', labelAr: '1 سنة', days: 365 },
];

const PAYMENT_COLORS = ['#E4002B', '#0066CC', '#059669', '#8B5CF6', '#F59E0B', '#EC4899'];

const ALL_PERMISSIONS: { key: StaffPermission; label: string; labelFr: string; labelAr: string; icon: string }[] = [
  { key: 'manage_sellers', label: 'Manage Sellers', labelFr: 'Gerer les vendeurs', labelAr: 'إدارة البائعين', icon: 'storefront' },
  { key: 'manage_disputes', label: 'Manage Disputes', labelFr: 'Gerer les litiges', labelAr: 'إدارة النزاعات', icon: 'gavel' },
  { key: 'manage_payments', label: 'Manage Payments', labelFr: 'Gerer les paiements', labelAr: 'إدارة المدفوعات', icon: 'account-balance-wallet' },
  { key: 'manage_users', label: 'Manage Users', labelFr: 'Gerer les utilisateurs', labelAr: 'إدارة المستخدمين', icon: 'people' },
  { key: 'view_blacklist', label: 'View Blacklist', labelFr: 'Voir la liste noire', labelAr: 'عرض القائمة السوداء', icon: 'block' },
];

export default function AdminDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    colors, language, products, sellers, orders, logout, user,
    updateOrderStatus, togglePinProduct, toggleSellerVerified,
    toggleBanSeller, banUserWithDuration, permanentBanUser, addPaymentMethod, updatePaymentMethodLogo, removePaymentMethod,
    paymentMethodsList, blacklist, canSellerRequestVerification,
    staffMembers, addStaffMember, removeStaffMember, updateStaffPermissions, toggleStaffActive,
    enabledCountries, toggleCountryEnabled,
    shippingCompanies, addShippingCompany, removeShippingCompany, toggleShippingCompanyActive,
    confirmOrderReceived,
    verificationPlans, verificationSubscriptions, addVerificationPlan, removeVerificationPlan, toggleVerificationPlanActive,
    approveVerificationSubscription, rejectVerificationSubscription, changeUserNumericId, adminPaymentNumber,
    realUsers, usersLoading, refreshUsers,
    enabledLanguages, toggleLanguageEnabled,
  } = useApp();

  const isSuperAdmin = user?.role === 'super_admin';
  const isStaff = user?.role === 'staff';
  const staffPermissions = user?.staffPermissions || [];

  const [activeTab, setActiveTab] = useState<Tab>('sellers');
  const [sellerSearch, setSellerSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState('');
  const [selectedVerifyDuration, setSelectedVerifyDuration] = useState(30);

  const [showBanModal, setShowBanModal] = useState(false);
  const [banTarget, setBanTarget] = useState('');
  const [banTargetName, setBanTargetName] = useState('');
  const [selectedBanDuration, setSelectedBanDuration] = useState(30);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [newPaymentName, setNewPaymentName] = useState('');
  const [newPaymentColor, setNewPaymentColor] = useState('#E4002B');
  const [newPaymentInstructions, setNewPaymentInstructions] = useState('');
  const [newPaymentLogo, setNewPaymentLogo] = useState('');

  const [showStaffModal, setShowStaffModal] = useState(false);
  // Branding state
  const [storeLogo, setStoreLogo] = useState('');
  const [logoLoading, setLogoLoading] = useState(false);
  const [adBanners, setAdBanners] = useState<AdBanner[]>([]);
  const [bannersLoading, setBannersLoading] = useState(false);
  const [showAddBannerModal, setShowAddBannerModal] = useState(false);
  const [newBannerTitle, setNewBannerTitle] = useState('');
  const [newBannerImage, setNewBannerImage] = useState('');
  const [newBannerLink, setNewBannerLink] = useState('');

  // Verification subscription state
  const [verifyFilter, setVerifyFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [showVerifyImageModal, setShowVerifyImageModal] = useState(false);
  const [verifyImageUrl, setVerifyImageUrl] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState('');
  // Plan management
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanDays, setNewPlanDays] = useState('');
  const [newPlanPrice, setNewPlanPrice] = useState('');
  // Vanity ID
  const [showVanityModal, setShowVanityModal] = useState(false);
  const [vanityTargetId, setVanityTargetId] = useState('');
  const [vanityTargetName, setVanityTargetName] = useState('');
  const [vanityNewId, setVanityNewId] = useState('');

  const [expandedRegions, setExpandedRegions] = useState<Record<string, boolean>>({ africa: true });

  // Shipping state
  const [showShippingModal, setShowShippingModal] = useState(false);
  const [newShipName, setNewShipName] = useState('');
  const [newShipPhone, setNewShipPhone] = useState('');
  const [newShipDesc, setNewShipDesc] = useState('');

  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPermissions, setNewStaffPermissions] = useState<StaffPermission[]>([]);

  // Load branding data on mount
  useEffect(() => {
    if (isSuperAdmin) {
      loadBranding();
    }
  }, [isSuperAdmin]);

  const loadBranding = useCallback(async () => {
    try {
      const [logo, banners] = await Promise.all([getStoreLogo(), getAllAdBanners()]);
      setStoreLogo(logo);
      setAdBanners(banners);
    } catch (e) {
      console.log('Branding load error:', e);
    }
  }, []);



  const isFr = language === 'fr';
  const isAr = language === 'ar';

  const lb = useCallback((en: string, fr: string, ar: string) => isFr ? fr : isAr ? ar : en, [isFr, isAr]);

  // Filter tabs based on staff permissions
  const visibleTabs = useMemo(() => {
    if (isSuperAdmin) return TAB_CONFIG;
    return TAB_CONFIG.filter(tab => {
      if (tab.key === 'staff' || tab.key === 'countries') return false;
      if (!tab.permission) return false;
      return staffPermissions.includes(tab.permission);
    });
  }, [isSuperAdmin, staffPermissions]);

  const canAccess = useCallback((permission: StaffPermission) => {
    if (isSuperAdmin) return true;
    return staffPermissions.includes(permission);
  }, [isSuperAdmin, staffPermissions]);

  const onlineUsers = useMemo(() => {
    const userList = realUsers.length > 0 ? realUsers : sellers;
    const count = Math.floor(userList.length * 0.4) + 1;
    return Math.min(count, userList.length);
  }, [realUsers.length, sellers.length]);
  const offlineUsers = (realUsers.length > 0 ? realUsers.length : sellers.length) - onlineUsers;

  const adminSellers = useMemo(() => realUsers.length > 0 ? realUsers : sellers, [realUsers, sellers]);

  const filteredSellers = useMemo(() => {
    const userList = adminSellers;
    if (!sellerSearch.trim()) return userList;
    const q = sellerSearch.toLowerCase();
    return userList.filter((s: any) =>
      (s.sellerId || '').toLowerCase().includes(q) ||
      (s.name || '').toLowerCase().includes(q) ||
      (s.phone || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.id || '').toLowerCase().includes(q)
    );
  }, [adminSellers, sellerSearch]);

  const filteredUsers = useMemo(() => {
    const userList = adminSellers;
    if (!userSearch.trim()) return userList;
    const q = userSearch.toLowerCase();
    return userList.filter((s: any) =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.phone || '').toLowerCase().includes(q) ||
      (s.sellerId || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.id || '').toLowerCase().includes(q)
    );
  }, [adminSellers, userSearch]);

  const disputes = useMemo(() => orders.filter(o => o.status === 'disputed'), [orders]);

  const stats = useMemo(() => {
    const userList = realUsers.length > 0 ? realUsers : sellers;
    return [
    { icon: 'storefront', lbl: lb('Sellers', 'Vendeurs', 'البائعون'), value: userList.filter((u: any) => u.role === 'seller').length, color: '#3B82F6' },
    { icon: 'shopping-bag', lbl: lb('Orders', 'Commandes', 'الطلبات'), value: orders.length, color: '#10B981' },
    { icon: 'gavel', lbl: lb('Disputes', 'Litiges', 'النزاعات'), value: disputes.length, color: '#EF4444' },
    { icon: 'admin-panel-settings', lbl: lb('Staff', 'Personnel', 'الموظفون'), value: staffMembers.length, color: '#8B5CF6' },
    ];
  }, [realUsers.length, sellers.length, orders.length, disputes.length, staffMembers.length, lb]);

  const isSellerOnline = useCallback((idx: number) => idx < onlineUsers, [onlineUsers]);

  const handleVerifySeller = useCallback((sellerId: string) => {
    const seller = sellers.find(s => s.id === sellerId);
    if (seller && seller.isVerified) {
      impactMedium();
      toggleSellerVerified(sellerId, 0);
    } else {
      const check = canSellerRequestVerification(sellerId);
      if (!check.eligible) {
        Alert.alert(lb('Not Eligible', 'Non éligible', 'غير مؤهل'), check.reason || '');
        return;
      }
      setVerifyTarget(sellerId);
      setSelectedVerifyDuration(30);
      setShowVerifyModal(true);
    }
  }, [sellers, toggleSellerVerified, canSellerRequestVerification, lb]);

  const confirmVerify = useCallback(() => {
    notifySuccess();
    toggleSellerVerified(verifyTarget, selectedVerifyDuration);
    setShowVerifyModal(false);
  }, [verifyTarget, selectedVerifyDuration, toggleSellerVerified]);

  const openBanModal = useCallback((sellerId: string) => {
    const seller = sellers.find(s => s.id === sellerId);
    if (!seller) return;
    if (seller.isBanned) { notifyWarning(); toggleBanSeller(sellerId); return; }
    setBanTarget(sellerId);
    setBanTargetName(seller.name);
    setSelectedBanDuration(30);
    setShowBanModal(true);
  }, [sellers, toggleBanSeller]);

  const confirmBan = useCallback(() => {
    notifyWarning();
    banUserWithDuration(banTarget, selectedBanDuration);
    setShowBanModal(false);
  }, [banTarget, selectedBanDuration, banUserWithDuration]);

  const pickPaymentLogo = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission required'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled && result.assets[0]) {
      setNewPaymentLogo(result.assets[0].uri);
    }
  }, []);

  const handleAddPayment = useCallback(() => {
    if (!newPaymentName.trim()) { Alert.alert(lb('Name required', 'Nom requis', 'الاسم مطلوب')); return; }
    if (!newPaymentInstructions.trim()) { Alert.alert(lb('Instructions required', 'Instructions requises', 'التعليمات مطلوبة')); return; }
    notifySuccess();
    addPaymentMethod(newPaymentName.trim(), newPaymentColor, newPaymentInstructions.trim(), newPaymentLogo);
    setNewPaymentName('');
    setNewPaymentColor('#E4002B');
    setNewPaymentInstructions('');
    setNewPaymentLogo('');
    setShowPaymentModal(false);
  }, [newPaymentName, newPaymentColor, newPaymentInstructions, newPaymentLogo, addPaymentMethod, lb]);

  const handleRemovePayment = useCallback((pmId: string, pmName: string) => {
    Alert.alert(lb('Remove', 'Supprimer', 'حذف'), lb('Remove', 'Supprimer', 'حذف') + ' "' + pmName + '"?', [
      { text: lb('Cancel', 'Annuler', 'إلغاء'), style: 'cancel' },
      { text: lb('Remove', 'Supprimer', 'حذف'), style: 'destructive', onPress: () => { impactMedium(); removePaymentMethod(pmId); } },
    ]);
  }, [removePaymentMethod, lb]);

  const handleAddStaff = useCallback(() => {
    if (!newStaffEmail.trim() || !newStaffPassword.trim() || !newStaffName.trim()) {
      Alert.alert(lb('All fields required', 'Tous les champs requis', 'جميع الحقول مطلوبة'));
      return;
    }
    if (newStaffPermissions.length === 0) {
      Alert.alert(lb('Select at least one permission', 'Selectionnez au moins une permission', 'اختر صلاحية واحدة على الأقل'));
      return;
    }
    const result = addStaffMember(newStaffEmail.trim(), newStaffPassword.trim(), newStaffName.trim(), newStaffPermissions);
    if (!result.success) {
      if (result.error === 'email_taken') {
        Alert.alert(lb('Email already in use', 'Email deja utilise', 'البريد مستخدم بالفعل'));
      } else if (result.error === 'reserved_email') {
        Alert.alert(lb('This email is reserved', 'Cet email est reserve', 'هذا البريد محجوز'));
      }
      return;
    }
    notifySuccess();
    setNewStaffEmail('');
    setNewStaffPassword('');
    setNewStaffName('');
    setNewStaffPermissions([]);
    setShowStaffModal(false);
  }, [newStaffEmail, newStaffPassword, newStaffName, newStaffPermissions, addStaffMember, lb]);

  const togglePermission = useCallback((perm: StaffPermission) => {
    setNewStaffPermissions(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  }, []);

  const getRemainingTime = (until?: string) => {
    if (!until) return '';
    const diff = new Date(until).getTime() - Date.now();
    if (diff <= 0) return lb('Expired', 'Expire', 'منتهي');
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days > 365) return Math.floor(days / 365) + lb('y', ' an', ' سنة');
    if (days > 30) return Math.floor(days / 30) + lb('mo', ' mois', ' شهر');
    return days + lb('d', ' jours', ' يوم');
  };

  const getTabLabel = (tab: typeof TAB_CONFIG[0]) => isFr ? tab.labelFr : isAr ? tab.labelAr : tab.label;

  const renderSellersTab = () => (
    <View style={styles.tabContent}>
      {usersLoading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{lb('Loading users...', 'Chargement...', 'جار التحميل...')}</Text>
        </View>
      ) : null}
      <Pressable onPress={() => refreshUsers()} style={[styles.addBtn, { backgroundColor: colors.primary, marginBottom: 8 }]}>
        <MaterialIcons name="refresh" size={22} color="#FFF" />
        <Text style={styles.addBtnText}>{lb('Refresh Users', 'Rafraîchir', 'تحديث المستخدمين')}</Text>
      </Pressable>
      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <MaterialIcons name="search" size={22} color={colors.textTertiary} />
        <TextInput style={[styles.searchInput, { color: colors.textPrimary }]} placeholder={lb('Search by ID, name, phone, email...', 'Rechercher...', 'بحث...')} placeholderTextColor={colors.textTertiary} value={sellerSearch} onChangeText={setSellerSearch} />
        {sellerSearch ? <Pressable onPress={() => setSellerSearch('')} hitSlop={8}><MaterialIcons name="close" size={20} color={colors.textTertiary} /></Pressable> : null}
      </View>
      {filteredSellers.length === 0 ? (
        <View style={styles.emptyState}><MaterialIcons name="search-off" size={48} color={colors.textTertiary} /><Text style={[styles.emptyText, { color: colors.textSecondary }]}>{lb('No sellers found', 'Aucun vendeur trouvé', 'لم يتم العثور على بائع')}</Text></View>
      ) : filteredSellers.map((seller: any, idx: number) => {
        const sellerProducts = products.filter(p => p.sellerId === seller.id);
        const online = isSellerOnline(idx);
        const eligibility = canSellerRequestVerification(seller.id);
        return (
          <View key={seller.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: seller.isBanned ? colors.error : colors.border }]}>
            <View style={styles.cardHeader}>
              <View style={styles.avatarWrapper}>
                <Image source={{ uri: seller.avatar }} style={styles.avatar} contentFit="cover" />
                <View style={[styles.onlineDot, { backgroundColor: online ? '#10B981' : '#9CA3AF', borderColor: colors.surface }]} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={[styles.cardName, { color: colors.textPrimary }]}>{seller.name}</Text>
                  {seller.isVerified ? <MaterialIcons name="verified" size={16} color={colors.verified} /> : null}
                  {seller.isBanned ? <View style={[styles.bannedBadge, { backgroundColor: colors.errorLight }]}><Text style={[styles.bannedText, { color: colors.error }]}>BANNED</Text></View> : null}
                </View>
                <Text style={[styles.sellerId, { color: colors.primary }]}>{seller.sellerId || '—'}</Text>
                {seller.email ? <Text style={[styles.cardMeta, { color: colors.textTertiary, fontSize: 12 }]}>{seller.email}</Text> : null}
                <Text style={[styles.cardMeta, { color: colors.textTertiary }]}>{seller.location || '—'} - {sellerProducts.length} {lb('products', 'produits', 'منتج')}</Text>
                <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                  {lb('Sales:', 'Ventes:', 'مبيعات:')} {seller.totalSales || 0}/50 | {lb('Rating:', 'Note:', 'تقييم:')} {((seller.rating || 0) / 5 * 100).toFixed(0)}%
                </Text>
                {seller.role ? (
                  <View style={[styles.bannedBadge, { backgroundColor: seller.role === 'super_admin' ? colors.error + '15' : seller.role === 'seller' ? colors.primary + '15' : colors.secondary + '15', marginTop: 4 }]}>
                    <Text style={[styles.bannedText, { color: seller.role === 'super_admin' ? colors.error : seller.role === 'seller' ? colors.primary : colors.secondary, fontSize: 9 }]}>{seller.role.toUpperCase()}</Text>
                  </View>
                ) : null}
                {!seller.isVerified && !eligibility.eligible ? (
                  <Text style={[styles.timerText, { color: colors.warning }]}>{eligibility.reason}</Text>
                ) : null}
                {seller.isVerified && seller.verifiedUntil ? (
                  <Text style={[styles.timerText, { color: colors.verified }]}>{lb('Verified:', 'Vérifié:', 'موثق:')} {getRemainingTime(seller.verifiedUntil)}</Text>
                ) : null}
                {seller.isBanned && seller.bannedUntil ? (
                  <Text style={[styles.timerText, { color: colors.error }]}>{lb('Ban expires:', 'Fin du ban:', 'ينتهي الحظر:')} {getRemainingTime(seller.bannedUntil)}</Text>
                ) : seller.isBanned ? (
                  <Text style={[styles.timerText, { color: colors.error }]}>{lb('Permanent Ban', 'Ban permanent', 'حظر دائم')}</Text>
                ) : null}
              </View>
            </View>
            <View style={styles.cardActions}>
              <Pressable onPress={() => handleVerifySeller(seller.id)} style={[styles.actionBtn, { backgroundColor: seller.isVerified ? colors.verified + '15' : colors.surface, borderColor: seller.isVerified ? colors.verified : colors.border }]}>
                <MaterialIcons name={seller.isVerified ? 'verified' : 'verified-user'} size={16} color={seller.isVerified ? colors.verified : colors.textSecondary} />
                <Text style={[styles.actionText, { color: seller.isVerified ? colors.verified : colors.textSecondary }]}>{seller.isVerified ? lb('Revoke', 'Révoquer', 'إلغاء') : lb('Verify', 'Vérifier', 'توثيق')}</Text>
              </Pressable>
              <Pressable onPress={() => openBanModal(seller.id)} style={[styles.actionBtn, { backgroundColor: seller.isBanned ? colors.successLight : colors.errorLight, borderColor: seller.isBanned ? colors.success : colors.error }]}>
                <MaterialIcons name={seller.isBanned ? 'lock-open' : 'block'} size={16} color={seller.isBanned ? colors.success : colors.error} />
                <Text style={[styles.actionText, { color: seller.isBanned ? colors.success : colors.error }]}>{seller.isBanned ? lb('Unban', 'Débannir', 'إلغاء الحظر') : lb('Ban', 'Bannir', 'حظر')}</Text>
              </Pressable>
              {!seller.isBanned ? (
                <Pressable onPress={() => {
                  Alert.alert(
                    lb('PERMANENT BAN', 'BAN PERMANENT', 'حظر دائم'),
                    lb(`Permanently ban "${seller.name}"? This cannot be undone.`, `Bannir définitivement "${seller.name}" ? Irréversible.`, `حظر "${seller.name}" نهائياً؟ لا يمكن التراجع.`),
                    [
                      { text: lb('Cancel', 'Annuler', 'إلغاء'), style: 'cancel' },
                      { text: lb('PERMANENT BAN', 'BAN PERMANENT', 'حظر دائم'), style: 'destructive', onPress: () => { notifyWarning(); permanentBanUser(seller.id); } },
                    ]
                  );
                }} style={[styles.actionBtn, { backgroundColor: '#7F1D1D', borderColor: '#991B1B' }]}>
                  <MaterialIcons name="gavel" size={16} color="#FFF" />
                  <Text style={[styles.actionText, { color: '#FFF' }]}>{lb('Perm Ban', 'Ban Perm', 'حظر نهائي')}</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => {
                setVanityTargetId(seller.id);
                setVanityTargetName(seller.name);
                setVanityNewId('');
                setShowVanityModal(true);
              }} style={[styles.actionBtn, { backgroundColor: '#F59E0B15', borderColor: '#F59E0B' }]}>
                <MaterialIcons name="star" size={16} color="#F59E0B" />
                <Text style={[styles.actionText, { color: '#F59E0B' }]}>ID</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );

  const renderDisputesTab = () => {
    const allDisputed = orders.filter(o => o.status === 'disputed' || o.status === 'pending');
    return (
      <View style={styles.tabContent}>
        {allDisputed.length === 0 ? (
          <View style={styles.emptyState}><MaterialIcons name="check-circle" size={48} color={colors.success} /><Text style={[styles.emptyText, { color: colors.textSecondary }]}>{lb('No active disputes', 'Aucun litige en cours', 'لا توجد نزاعات نشطة')}</Text></View>
        ) : allDisputed.map(order => {
          const product = products.find(p => p.id === order.productId);
          const seller = sellers.find(s => s.id === order.sellerId);
          return (
            <View key={order.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: order.status === 'disputed' ? colors.error : colors.border }]}>
              <View style={styles.disputeHeader}>
                <View style={[styles.statusPill, { backgroundColor: order.status === 'disputed' ? colors.errorLight : colors.warningLight }]}>
                  <Text style={[styles.statusPillText, { color: order.status === 'disputed' ? colors.error : colors.warning }]}>{order.status.toUpperCase()}</Text>
                </View>
                <Text style={[styles.orderId, { color: colors.textTertiary }]}>#{order.id.slice(-6)}</Text>
              </View>
              <Text style={[styles.disputeProduct, { color: colors.textPrimary }]}>{product ? (product.title[language] || product.title.en) : 'Unknown'}</Text>
              <Text style={[styles.disputeAmount, { color: colors.primary }]}>{formatPrice(order.amount)}</Text>
              <View style={styles.disputeParties}>
                <View style={styles.partyRow}><MaterialIcons name="person" size={14} color={colors.textTertiary} /><Text style={[styles.partyLabel, { color: colors.textTertiary }]}>{lb('Buyer:', 'Acheteur:', 'المشتري:')}</Text><Text style={[styles.partyValue, { color: colors.textPrimary }]}>{order.buyerPhone}</Text></View>
                <View style={styles.partyRow}><MaterialIcons name="store" size={14} color={colors.textTertiary} /><Text style={[styles.partyLabel, { color: colors.textTertiary }]}>{lb('Seller:', 'Vendeur:', 'البائع:')}</Text><Text style={[styles.partyValue, { color: colors.textPrimary }]}>{seller ? seller.name : 'N/A'}</Text></View>
              </View>
              <View style={styles.cardActions}>
                <Pressable onPress={() => { impactLight(); updateOrderStatus(order.id, 'confirmed'); }} style={[styles.actionBtn, { backgroundColor: colors.successLight, borderColor: colors.success }]}>
                  <MaterialIcons name="check" size={16} color={colors.success} /><Text style={[styles.actionText, { color: colors.success }]}>{lb('Confirm', 'Confirmer', 'تأكيد')}</Text>
                </Pressable>
                {order.status !== 'disputed' ? (
                  <Pressable onPress={() => { impactMedium(); updateOrderStatus(order.id, 'disputed'); }} style={[styles.actionBtn, { backgroundColor: colors.errorLight, borderColor: colors.error }]}>
                    <MaterialIcons name="gavel" size={16} color={colors.error} /><Text style={[styles.actionText, { color: colors.error }]}>{lb('Dispute', 'Disputer', 'نزاع')}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderPaymentsTab = () => (
    <View style={styles.tabContent}>
      <Pressable onPress={() => { setNewPaymentLogo(''); setShowPaymentModal(true); }} style={[styles.addBtn, { backgroundColor: colors.primary }]}>
        <MaterialIcons name="add" size={22} color="#FFF" />
        <Text style={styles.addBtnText}>{lb('Add Payment Method', 'Ajouter une methode', 'إضافة طريقة دفع')}</Text>
      </Pressable>
      {paymentMethodsList.map(method => (
        <View key={method.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.paymentRow}>
            {method.logo ? (
              <Image source={{ uri: method.logo }} style={styles.paymentLogoImg} contentFit="cover" />
            ) : (
              <View style={[styles.paymentIcon, { backgroundColor: method.color + '20' }]}>
                <MaterialIcons name="account-balance-wallet" size={24} color={method.color} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardName, { color: colors.textPrimary }]}>{method.name}</Text>
              {method.instructions ? (
                <Text style={[styles.cardMeta, { color: colors.textSecondary }]} numberOfLines={2}>{method.instructions}</Text>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Pressable onPress={async () => {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') return;
                const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
                if (!result.canceled && result.assets[0]) {
                  updatePaymentMethodLogo(method.id, result.assets[0].uri);
                  notifySuccess();
                }
              }} style={[styles.smallIconBtn, { backgroundColor: colors.verified + '15' }]} hitSlop={8}>
                <MaterialIcons name="image" size={18} color={colors.verified} />
              </Pressable>
              <Pressable onPress={() => handleRemovePayment(method.id, method.name)} style={[styles.smallIconBtn, { backgroundColor: colors.errorLight }]} hitSlop={8}>
                <MaterialIcons name="delete-outline" size={18} color={colors.error} />
              </Pressable>
            </View>
          </View>
        </View>
      ))}
    </View>
  );

  const renderShippingTab = () => (
    <View style={styles.tabContent}>
      <Pressable onPress={() => { setNewShipName(''); setNewShipPhone(''); setNewShipDesc(''); setShowShippingModal(true); }} style={[styles.addBtn, { backgroundColor: '#8B5CF6' }]}>
        <MaterialIcons name="add" size={22} color="#FFF" />
        <Text style={styles.addBtnText}>{lb('Add Shipping Company', 'Ajouter un transporteur', 'إضافة شركة شحن')}</Text>
      </Pressable>
      {shippingCompanies.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="local-shipping" size={48} color={colors.textTertiary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{lb('No shipping companies', 'Aucun transporteur', 'لا توجد شركات شحن')}</Text>
        </View>
      ) : shippingCompanies.map(ship => (
        <View key={ship.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: ship.isActive ? colors.border : colors.error + '40' }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.statIcon, { backgroundColor: '#8B5CF620' }]}>
              <MaterialIcons name="local-shipping" size={20} color="#8B5CF6" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={[styles.cardName, { color: colors.textPrimary }]}>{ship.name}</Text>
                <View style={[styles.statusDot, { backgroundColor: ship.isActive ? '#10B981' : '#EF4444' }]} />
              </View>
              <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>{ship.phone}</Text>
              {ship.description ? <Text style={[styles.cardMeta, { color: colors.textTertiary }]}>{ship.description}</Text> : null}
            </View>
          </View>
          <View style={styles.cardActions}>
            <Pressable onPress={() => toggleShippingCompanyActive(ship.id)} style={[styles.actionBtn, { backgroundColor: ship.isActive ? colors.warningLight : colors.successLight, borderColor: ship.isActive ? colors.warning : colors.success }]}>
              <MaterialIcons name={ship.isActive ? 'pause-circle' : 'play-circle'} size={16} color={ship.isActive ? colors.warning : colors.success} />
              <Text style={[styles.actionText, { color: ship.isActive ? colors.warning : colors.success }]}>{ship.isActive ? lb('Disable', 'Desactiver', 'تعطيل') : lb('Enable', 'Activer', 'تفعيل')}</Text>
            </Pressable>
            <Pressable onPress={() => {
              Alert.alert(lb('Remove', 'Supprimer', 'حذف'), `"${ship.name}"?`, [
                { text: lb('Cancel', 'Annuler', 'إلغاء'), style: 'cancel' },
                { text: lb('Remove', 'Supprimer', 'حذف'), style: 'destructive', onPress: () => { impactMedium(); removeShippingCompany(ship.id); } },
              ]);
            }} style={[styles.actionBtn, { backgroundColor: colors.errorLight, borderColor: colors.error }]}>
              <MaterialIcons name="delete" size={16} color={colors.error} />
              <Text style={[styles.actionText, { color: colors.error }]}>{lb('Remove', 'Supprimer', 'حذف')}</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );

  const renderUsersTab = () => (
    <View style={styles.tabContent}>
      <View style={[styles.onlineOfflineRow, { marginBottom: 8 }]}>
        <View style={[styles.onlineCard, { backgroundColor: '#10B98115', borderColor: '#10B98130' }]}>
          <View style={[styles.onlineIndicator, { backgroundColor: '#10B981' }]} />
          <Text style={[styles.onlineCardValue, { color: '#10B981' }]}>{onlineUsers}</Text>
          <Text style={[styles.onlineCardLabel, { color: colors.textSecondary }]}>{lb('Online', 'En ligne', 'متصلون')}</Text>
        </View>
        <View style={[styles.onlineCard, { backgroundColor: '#9CA3AF15', borderColor: '#9CA3AF30' }]}>
          <View style={[styles.onlineIndicator, { backgroundColor: '#9CA3AF' }]} />
          <Text style={[styles.onlineCardValue, { color: '#9CA3AF' }]}>{offlineUsers}</Text>
          <Text style={[styles.onlineCardLabel, { color: colors.textSecondary }]}>{lb('Offline', 'Hors ligne', 'غير متصلون')}</Text>
        </View>
      </View>
      <Pressable onPress={() => refreshUsers()} style={[styles.addBtn, { backgroundColor: colors.primary, marginBottom: 8 }]}>
        <MaterialIcons name="refresh" size={22} color="#FFF" />
        <Text style={styles.addBtnText}>{lb('Refresh', 'Rafraîchir', 'تحديث')}</Text>
      </Pressable>
      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <MaterialIcons name="search" size={22} color={colors.textTertiary} />
        <TextInput style={[styles.searchInput, { color: colors.textPrimary }]} placeholder={lb('Search by ID, name, email...', 'Rechercher...', 'بحث...')} placeholderTextColor={colors.textTertiary} value={userSearch} onChangeText={setUserSearch} />
        {userSearch ? <Pressable onPress={() => setUserSearch('')} hitSlop={8}><MaterialIcons name="close" size={20} color={colors.textTertiary} /></Pressable> : null}
      </View>
      {filteredUsers.map((seller: any) => {
        const sIdx = adminSellers.indexOf(seller);
        const online = isSellerOnline(sIdx);
        return (
          <View key={seller.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: seller.isBanned ? colors.error : colors.border }]}>
            <View style={styles.cardHeader}>
              <View style={styles.avatarWrapper}>
                <Image source={{ uri: seller.avatar }} style={styles.avatar} contentFit="cover" />
                <View style={[styles.onlineDot, { backgroundColor: online ? '#10B981' : '#9CA3AF', borderColor: colors.surface }]} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={[styles.cardName, { color: colors.textPrimary }]}>{seller.name}</Text>
                  {seller.isBanned ? <View style={[styles.bannedBadge, { backgroundColor: colors.errorLight }]}><Text style={[styles.bannedText, { color: colors.error }]}>BANNED</Text></View> : null}
                </View>
                {seller.email ? <Text style={[styles.cardMeta, { color: colors.textTertiary, fontSize: 12 }]}>{seller.email}</Text> : null}
                <Text style={[styles.cardMeta, { color: colors.textTertiary }]}>{seller.location || '—'} - {seller.phone || '—'}</Text>
                {seller.role ? (
                  <View style={[styles.bannedBadge, { backgroundColor: seller.role === 'super_admin' ? colors.error + '15' : seller.role === 'seller' ? colors.primary + '15' : colors.secondary + '15', marginTop: 4 }]}>
                    <Text style={[styles.bannedText, { color: seller.role === 'super_admin' ? colors.error : seller.role === 'seller' ? colors.primary : colors.secondary, fontSize: 9 }]}>{seller.role.toUpperCase()}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={styles.cardActions}>
              <Pressable onPress={() => openBanModal(seller.id)} style={[styles.actionBtn, { backgroundColor: seller.isBanned ? colors.successLight : colors.errorLight, borderColor: seller.isBanned ? colors.success : colors.error }]}>
                <MaterialIcons name={seller.isBanned ? 'lock-open' : 'block'} size={16} color={seller.isBanned ? colors.success : colors.error} />
                <Text style={[styles.actionText, { color: seller.isBanned ? colors.success : colors.error }]}>{seller.isBanned ? lb('Unban', 'Débannir', 'إلغاء الحظر') : lb('Ban', 'Bannir', 'حظر')}</Text>
              </Pressable>
              {!seller.isBanned ? (
                <Pressable onPress={() => {
                  Alert.alert(
                    lb('PERMANENT BAN', 'BAN PERMANENT', 'حظر دائم'),
                    lb(`Permanently ban "${seller.name}"?`, `Bannir définitivement "${seller.name}" ?`, `حظر "${seller.name}" نهائياً؟`),
                    [
                      { text: lb('Cancel', 'Annuler', 'إلغاء'), style: 'cancel' },
                      { text: lb('PERMANENT BAN', 'BAN PERMANENT', 'حظر دائم'), style: 'destructive', onPress: () => { notifyWarning(); permanentBanUser(seller.id); } },
                    ]
                  );
                }} style={[styles.actionBtn, { backgroundColor: '#7F1D1D', borderColor: '#991B1B' }]}>
                  <MaterialIcons name="gavel" size={16} color="#FFF" />
                  <Text style={[styles.actionText, { color: '#FFF' }]}>{lb('Perm Ban', 'Ban Perm', 'حظر نهائي')}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );

  const renderBlacklistTab = () => (
    <View style={styles.tabContent}>
      {blacklist.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="verified-user" size={48} color={colors.success} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{lb('No blacklisted users', 'Aucun utilisateur en liste noire', 'لا يوجد مستخدمون في القائمة السوداء')}</Text>
        </View>
      ) : blacklist.map((entry, idx) => (
        <View key={idx} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.error + '40' }]}>
          <View style={styles.blacklistHeader}>
            <MaterialIcons name="block" size={20} color={colors.error} />
            <Text style={[styles.cardName, { color: colors.error }]}>{entry.username}</Text>
          </View>
          <View style={styles.blacklistDetails}>
            <View style={styles.blacklistRow}>
              <MaterialIcons name="email" size={14} color={colors.textTertiary} />
              <Text style={[styles.blacklistValue, { color: colors.textSecondary }]}>{entry.email}</Text>
            </View>
            <View style={styles.blacklistRow}>
              <MaterialIcons name="phone" size={14} color={colors.textTertiary} />
              <Text style={[styles.blacklistValue, { color: colors.textSecondary }]}>{entry.phone}</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );

  const renderStaffTab = () => (
    <View style={styles.tabContent}>
      <Pressable onPress={() => { setNewStaffPermissions([]); setShowStaffModal(true); }} style={[styles.addBtn, { backgroundColor: '#8B5CF6' }]}>
        <MaterialIcons name="person-add" size={22} color="#FFF" />
        <Text style={styles.addBtnText}>{lb('Add Staff Member', 'Ajouter un employe', 'إضافة موظف')}</Text>
      </Pressable>
      {staffMembers.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="group-add" size={48} color={colors.textTertiary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{lb('No staff members yet', 'Aucun employe', 'لا يوجد موظفون بعد')}</Text>
        </View>
      ) : staffMembers.map(member => (
        <View key={member.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: member.isActive ? colors.border : colors.error + '40' }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.staffAvatar, { backgroundColor: member.isActive ? '#8B5CF620' : colors.errorLight }]}>
              <MaterialIcons name="admin-panel-settings" size={24} color={member.isActive ? '#8B5CF6' : colors.error} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={[styles.cardName, { color: colors.textPrimary }]}>{member.name}</Text>
                <View style={[styles.statusDot, { backgroundColor: member.isActive ? '#10B981' : '#EF4444' }]} />
              </View>
              <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>{member.email}</Text>
              <View style={styles.permissionTags}>
                {member.permissions.map(p => {
                  const pInfo = ALL_PERMISSIONS.find(ap => ap.key === p);
                  return (
                    <View key={p} style={[styles.permTag, { backgroundColor: '#8B5CF610', borderColor: '#8B5CF630' }]}>
                      <Text style={[styles.permTagText, { color: '#8B5CF6' }]}>{pInfo ? (isFr ? pInfo.labelFr : isAr ? pInfo.labelAr : pInfo.label) : p}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
          <View style={styles.cardActions}>
            <Pressable onPress={() => toggleStaffActive(member.id)} style={[styles.actionBtn, { backgroundColor: member.isActive ? colors.warningLight : colors.successLight, borderColor: member.isActive ? colors.warning : colors.success }]}>
              <MaterialIcons name={member.isActive ? 'pause-circle' : 'play-circle'} size={16} color={member.isActive ? colors.warning : colors.success} />
              <Text style={[styles.actionText, { color: member.isActive ? colors.warning : colors.success }]}>{member.isActive ? lb('Disable', 'Desactiver', 'تعطيل') : lb('Enable', 'Activer', 'تفعيل')}</Text>
            </Pressable>
            <Pressable onPress={() => {
              Alert.alert(lb('Remove Staff', 'Supprimer', 'حذف الموظف'), lb(`Remove "${member.name}"?`, `Supprimer "${member.name}"?`, `حذف "${member.name}"؟`), [
                { text: lb('Cancel', 'Annuler', 'إلغاء'), style: 'cancel' },
                { text: lb('Remove', 'Supprimer', 'حذف'), style: 'destructive', onPress: () => { impactMedium(); removeStaffMember(member.id); } },
              ]);
            }} style={[styles.actionBtn, { backgroundColor: colors.errorLight, borderColor: colors.error }]}>
              <MaterialIcons name="delete" size={16} color={colors.error} />
              <Text style={[styles.actionText, { color: colors.error }]}>{lb('Remove', 'Supprimer', 'حذف')}</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );

  const toggleRegion = useCallback((regionId: string) => {
    setExpandedRegions(prev => ({ ...prev, [regionId]: !prev[regionId] }));
  }, []);

  const countriesByRegion = useMemo(() => {
    const map: Record<string, typeof ALL_COUNTRIES> = {};
    ALL_COUNTRIES.forEach(c => {
      if (!map[c.region]) map[c.region] = [];
      map[c.region].push(c);
    });
    return map;
  }, []);

  const handlePickStoreLogo = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission required'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled && result.assets[0]) {
      setLogoLoading(true);
      const uploadResult = await updateStoreLogo(result.assets[0].uri);
      setLogoLoading(false);
      if (uploadResult.success && uploadResult.url) {
        notifySuccess();
        setStoreLogo(uploadResult.url);
      } else {
        Alert.alert('Error', uploadResult.error || 'Upload failed');
      }
    }
  }, []);

  const handleDeleteBanner = useCallback(async (id: string, title: string) => {
    Alert.alert(lb('Delete Banner', 'Supprimer', '\u062d\u0630\u0641 \u0627\u0644\u0628\u0627\u0646\u0631'), `"${title}"?`, [
      { text: lb('Cancel', 'Annuler', '\u0625\u0644\u063a\u0627\u0621'), style: 'cancel' },
      { text: lb('Delete', 'Supprimer', '\u062d\u0630\u0641'), style: 'destructive', onPress: async () => {
        impactMedium();
        const result = await deleteAdBanner(id);
        if (result.success) loadBranding();
        else Alert.alert('Error', result.error || 'Failed');
      }},
    ]);
  }, [lb, loadBranding]);

  const handleToggleBanner = useCallback(async (id: string, currentState: boolean) => {
    selection();
    const result = await toggleBannerActive(id, !currentState);
    if (result.success) loadBranding();
  }, [loadBranding]);

  const handleApproveSubscription = useCallback((subId: string) => {
    Alert.alert(
      lb('Approve', 'Approuver', 'موافقة'),
      lb('Approve this subscription and grant Blue Badge?', 'Approuver cet abonnement et accorder le Badge Bleu?', 'الموافقة على الاشتراك ومنح الشارة الزرقاء؟'),
      [
        { text: lb('Cancel', 'Annuler', 'إلغاء'), style: 'cancel' },
        { text: lb('Approve', 'Approuver', 'موافقة'), onPress: () => {
          notifySuccess();
          approveVerificationSubscription(subId);
        }},
      ]
    );
  }, [lb, approveVerificationSubscription]);

  const handleOpenRejectModal = useCallback((subId: string) => {
    setRejectTargetId(subId);
    setRejectNotes('');
    setShowRejectModal(true);
  }, []);

  const handleConfirmReject = useCallback(() => {
    notifyWarning();
    rejectVerificationSubscription(rejectTargetId, rejectNotes.trim() || 'Rejected by admin');
    setShowRejectModal(false);
  }, [rejectTargetId, rejectNotes, rejectVerificationSubscription]);

  const handleAddPlan = useCallback(() => {
    if (!newPlanName.trim()) { Alert.alert(lb('Name required', 'Nom requis', 'الاسم مطلوب')); return; }
    const days = parseInt(newPlanDays) || 0;
    const price = parseInt(newPlanPrice) || 0;
    if (days < 1) { Alert.alert(lb('Invalid duration', 'Duree invalide', 'مدة غير صالحة')); return; }
    if (price < 1) { Alert.alert(lb('Invalid price', 'Prix invalide', 'سعر غير صالح')); return; }
    notifySuccess();
    addVerificationPlan(newPlanName.trim(), days, price);
    setShowPlanModal(false);
    setNewPlanName(''); setNewPlanDays(''); setNewPlanPrice('');
  }, [newPlanName, newPlanDays, newPlanPrice, addVerificationPlan, lb]);

  const handleChangeVanityId = useCallback(() => {
    if (!vanityNewId.trim()) { Alert.alert(lb('ID required', 'ID requis', 'المعرف مطلوب')); return; }
    if (!/^\d+$/.test(vanityNewId.trim())) { Alert.alert(lb('Numeric only', 'Chiffres uniquement', 'أرقام فقط'), lb('Vanity ID must be numeric only.', 'L ID premium doit etre numerique.', 'المعرف المميز يجب أن يكون أرقاماً فقط.')); return; }
    const result = changeUserNumericId(vanityTargetId, vanityNewId.trim());
    if (result.success) {
      notifySuccess();
      setShowVanityModal(false);
      Alert.alert(lb('Success', 'Succès', 'نجاح'), lb('Vanity ID assigned successfully!', 'ID premium attribué avec succès!', 'تم تعيين المعرف المميز بنجاح!'));
    } else {
      Alert.alert(lb('Error', 'Erreur', 'خطأ'), result.error || 'Failed');
    }
  }, [vanityTargetId, vanityNewId, changeUserNumericId, lb]);

  const handleMoveBanner = useCallback(async (index: number, direction: 'up' | 'down') => {
    const newBanners = [...adBanners];
    const swapIdx = direction === 'up' ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= newBanners.length) return;
    selection();
    const temp = newBanners[index];
    newBanners[index] = newBanners[swapIdx];
    newBanners[swapIdx] = temp;
    setAdBanners(newBanners);
    await reorderBanners(newBanners.map(b => b.id));
  }, [adBanners]);

  const renderBrandingTab = () => (
    <View style={styles.tabContent}>
      {/* Store Logo Section */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.primary + '30' }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.statIcon, { backgroundColor: colors.primary + '15' }]}>
            <MaterialIcons name="storefront" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardName, { color: colors.textPrimary }]}>
              {lb('Store Logo', 'Logo du magasin', '\u0634\u0639\u0627\u0631 \u0627\u0644\u0645\u062a\u062c\u0631')}
            </Text>
            <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
              {lb('Displayed in app header for all users', 'Affiche dans le header pour tous les utilisateurs', '\u064a\u0638\u0647\u0631 \u0641\u064a \u0631\u0623\u0633 \u0627\u0644\u062a\u0637\u0628\u064a\u0642 \u0644\u062c\u0645\u064a\u0639 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u064a\u0646')}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: 'center', gap: 12, marginTop: 8 }}>
          {storeLogo ? (
            <View style={{ alignItems: 'center', gap: 8 }}>
              <Image source={{ uri: storeLogo }} style={{ width: 80, height: 80, borderRadius: 16 }} contentFit="cover" />
              <Text style={[styles.cardMeta, { color: colors.success }]}>{lb('Logo active', 'Logo actif', '\u0627\u0644\u0634\u0639\u0627\u0631 \u0645\u0641\u0639\u0644')}</Text>
            </View>
          ) : (
            <View style={{ alignItems: 'center', gap: 4 }}>
              <MaterialIcons name="image-not-supported" size={40} color={colors.textTertiary} />
              <Text style={[styles.cardMeta, { color: colors.textTertiary }]}>{lb('No logo uploaded', 'Aucun logo', '\u0644\u0645 \u064a\u062a\u0645 \u0631\u0641\u0639 \u0634\u0639\u0627\u0631')}</Text>
            </View>
          )}
          <Pressable onPress={handlePickStoreLogo} style={[styles.addBtn, { backgroundColor: colors.primary, height: 44 }]}>
            <MaterialIcons name={storeLogo ? 'edit' : 'add-a-photo'} size={18} color="#FFF" />
            <Text style={[styles.addBtnText, { fontSize: 14 }]}>{logoLoading ? '...' : storeLogo ? lb('Change Logo', 'Changer le logo', '\u062a\u063a\u064a\u064a\u0631 \u0627\u0644\u0634\u0639\u0627\u0631') : lb('Upload Logo', 'Telecharger le logo', '\u0631\u0641\u0639 \u0627\u0644\u0634\u0639\u0627\u0631')}</Text>
          </Pressable>
        </View>
      </View>

      {/* Ad Banners Section */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <Text style={[styles.cardName, { color: colors.textPrimary }]}>
          {lb('Ad Banners', 'Bannieres publicitaires', '\u0628\u0627\u0646\u0631\u0627\u062a \u0625\u0639\u0644\u0627\u0646\u064a\u0629')} ({adBanners.length})
        </Text>
      </View>
      <Pressable onPress={() => { setNewBannerTitle(''); setNewBannerImage(''); setNewBannerLink(''); setShowAddBannerModal(true); }} style={[styles.addBtn, { backgroundColor: '#F59E0B' }]}>
        <MaterialIcons name="add-photo-alternate" size={22} color="#FFF" />
        <Text style={styles.addBtnText}>{lb('Add Banner', 'Ajouter une banniere', '\u0625\u0636\u0627\u0641\u0629 \u0628\u0627\u0646\u0631')}</Text>
      </Pressable>

      {adBanners.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="image" size={48} color={colors.textTertiary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{lb('No banners yet', 'Aucune banniere', '\u0644\u0627 \u062a\u0648\u062c\u062f \u0628\u0627\u0646\u0631\u0627\u062a')}</Text>
        </View>
      ) : adBanners.map((banner, idx) => (
        <View key={banner.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: banner.is_active ? colors.border : colors.error + '40' }]}>
          <Image source={{ uri: banner.image_url }} style={{ width: '100%', height: 100, borderRadius: 8 }} contentFit="cover" />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardName, { color: colors.textPrimary }]}>{banner.title}</Text>
              <Text style={[styles.cardMeta, { color: banner.is_active ? colors.success : colors.error }]}>
                {banner.is_active ? lb('Active', 'Actif', '\u0645\u0641\u0639\u0644') : lb('Hidden', 'Masque', '\u0645\u062e\u0641\u064a')}
                {banner.link ? ` \u2022 ${lb('Has link', 'Avec lien', '\u0645\u0639 \u0631\u0627\u0628\u0637')}` : ''}
              </Text>
            </View>
            <Text style={[styles.cardMeta, { color: colors.textTertiary }]}>#{idx + 1}</Text>
          </View>
          <View style={styles.cardActions}>
            {idx > 0 ? (
              <Pressable onPress={() => handleMoveBanner(idx, 'up')} style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border, flex: 0, paddingHorizontal: 12 }]}>
                <MaterialIcons name="arrow-upward" size={16} color={colors.textSecondary} />
              </Pressable>
            ) : null}
            {idx < adBanners.length - 1 ? (
              <Pressable onPress={() => handleMoveBanner(idx, 'down')} style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border, flex: 0, paddingHorizontal: 12 }]}>
                <MaterialIcons name="arrow-downward" size={16} color={colors.textSecondary} />
              </Pressable>
            ) : null}
            <Pressable onPress={() => handleToggleBanner(banner.id, banner.is_active)} style={[styles.actionBtn, { backgroundColor: banner.is_active ? colors.warningLight : colors.successLight, borderColor: banner.is_active ? colors.warning : colors.success }]}>
              <MaterialIcons name={banner.is_active ? 'visibility-off' : 'visibility'} size={16} color={banner.is_active ? colors.warning : colors.success} />
              <Text style={[styles.actionText, { color: banner.is_active ? colors.warning : colors.success }]}>{banner.is_active ? lb('Hide', 'Masquer', '\u0625\u062e\u0641\u0627\u0621') : lb('Show', 'Afficher', '\u0625\u0638\u0647\u0627\u0631')}</Text>
            </Pressable>
            <Pressable onPress={() => handleDeleteBanner(banner.id, banner.title)} style={[styles.actionBtn, { backgroundColor: colors.errorLight, borderColor: colors.error }]}>
              <MaterialIcons name="delete" size={16} color={colors.error} />
              <Text style={[styles.actionText, { color: colors.error }]}>{lb('Delete', 'Supprimer', '\u062d\u0630\u0641')}</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );

  const filteredVerifyRequests = useMemo(() => {
    if (verifyFilter === 'all') return verificationSubscriptions;
    return verificationSubscriptions.filter(r => r.status === verifyFilter);
  }, [verificationSubscriptions, verifyFilter]);

  const pendingVerifyCount = useMemo(() => verificationSubscriptions.filter(r => r.status === 'pending').length, [verificationSubscriptions]);

  const renderVerificationTab = () => (
    <View style={styles.tabContent}>
      {/* Subscription Plans Management */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.primary + '30' }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.statIcon, { backgroundColor: colors.primary + '15' }]}>
            <MaterialIcons name="card-membership" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardName, { color: colors.textPrimary }]}>
              {lb('Subscription Plans', 'Plans d abonnement', 'خطط الاشتراك')} ({verificationPlans.length})
            </Text>
            <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
              {lb('Platform Number:', 'Numero de la plateforme:', 'رقم المنصة:')} {adminPaymentNumber}
            </Text>
          </View>
        </View>
        {verificationPlans.map(plan => (
          <View key={plan.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
            <View style={[styles.statIcon, { backgroundColor: plan.isActive ? colors.success + '15' : colors.error + '15' }]}>
              <MaterialIcons name="verified" size={16} color={plan.isActive ? colors.success : colors.error} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardName, { color: colors.textPrimary, fontSize: 14 }]}>{plan.name}</Text>
              <Text style={[styles.cardMeta, { color: colors.textTertiary }]}>{plan.durationDays} {lb('days', 'jours', 'يوم')}</Text>
            </View>
            <Text style={[styles.cardName, { color: colors.primary }]}>{formatPrice(plan.price)}</Text>
            <Pressable onPress={() => toggleVerificationPlanActive(plan.id)} style={[styles.smallIconBtn, { backgroundColor: plan.isActive ? colors.warningLight : colors.successLight }]} hitSlop={8}>
              <MaterialIcons name={plan.isActive ? 'pause' : 'play-arrow'} size={18} color={plan.isActive ? colors.warning : colors.success} />
            </Pressable>
            <Pressable onPress={() => {
              Alert.alert(lb('Remove Plan', 'Supprimer', 'حذف'), `"${plan.name}"?`, [
                { text: lb('Cancel', 'Annuler', 'إلغاء'), style: 'cancel' },
                { text: lb('Remove', 'Supprimer', 'حذف'), style: 'destructive', onPress: () => { impactMedium(); removeVerificationPlan(plan.id); } },
              ]);
            }} style={[styles.smallIconBtn, { backgroundColor: colors.errorLight }]} hitSlop={8}>
              <MaterialIcons name="delete-outline" size={18} color={colors.error} />
            </Pressable>
          </View>
        ))}
        <Pressable onPress={() => { setNewPlanName(''); setNewPlanDays(''); setNewPlanPrice(''); setShowPlanModal(true); }} style={[styles.addBtn, { backgroundColor: colors.verified, height: 44, marginTop: 8 }]}>
          <MaterialIcons name="add" size={20} color="#FFF" />
          <Text style={[styles.addBtnText, { fontSize: 14 }]}>{lb('Add Plan', 'Ajouter un plan', 'إضافة خطة')}</Text>
        </Pressable>
      </View>

      {/* Filter chips */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4, marginTop: 8 }}>
        {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
          <Pressable key={f} onPress={() => { selection(); setVerifyFilter(f); }}
            style={[styles.tabChip, {
              backgroundColor: verifyFilter === f ? (f === 'pending' ? colors.warning : f === 'approved' ? colors.success : f === 'rejected' ? colors.error : colors.primary) : colors.surface,
              borderColor: verifyFilter === f ? 'transparent' : colors.border,
            }]}>
            <Text style={[styles.tabChipText, { color: verifyFilter === f ? '#FFF' : colors.textSecondary }]}>
              {f === 'pending' ? lb('Pending', 'En attente', 'معلق')
                : f === 'approved' ? lb('Approved', 'Approuve', 'موافق')
                : f === 'rejected' ? lb('Rejected', 'Refuse', 'مرفوض')
                : lb('All', 'Tous', 'الكل')}
              {f === 'pending' && pendingVerifyCount > 0 ? ` (${pendingVerifyCount})` : ''}
            </Text>
          </Pressable>
        ))}
      </View>

      {filteredVerifyRequests.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="verified" size={48} color={colors.textTertiary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {lb('No verification subscriptions', 'Aucun abonnement de verification', 'لا توجد اشتراكات توثيق')}
          </Text>
        </View>
      ) : filteredVerifyRequests.map(sub => {
        const statusColor = sub.status === 'pending' ? colors.warning : sub.status === 'approved' ? colors.success : colors.error;
        const statusIcon = sub.status === 'pending' ? 'hourglass-top' : sub.status === 'approved' ? 'check-circle' : 'cancel';
        return (
          <View key={sub.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: statusColor + '40' }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.statIcon, { backgroundColor: statusColor + '15' }]}>
                <MaterialIcons name={statusIcon as any} size={20} color={statusColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardName, { color: colors.textPrimary }]}>{sub.userName || 'Unknown'}</Text>
                <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>{sub.userEmail || ''}</Text>
                <Text style={[styles.cardMeta, { color: colors.textTertiary }]}>
                  {lb('Role:', 'Role:', 'الدور:')} {sub.userRole} | {lb('Plan:', 'Plan:', 'الخطة:')} {sub.planName}
                </Text>
                <Text style={[styles.cardMeta, { color: colors.primary, fontWeight: '700' }]}>
                  {formatPrice(sub.amount)} - {sub.durationDays} {lb('days', 'jours', 'يوم')}
                </Text>
                <Text style={[styles.cardMeta, { color: colors.textTertiary }]}>
                  {new Date(sub.createdAt).toLocaleDateString()} {new Date(sub.createdAt).toLocaleTimeString()}
                </Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: statusColor + '15' }]}>
                <Text style={[styles.statusPillText, { color: statusColor }]}>{sub.status.toUpperCase()}</Text>
              </View>
            </View>

            {/* Payment Screenshot */}
            {sub.screenshotUri ? (
              <View>
                <Text style={[styles.cardMeta, { color: colors.textSecondary, fontWeight: '600', marginBottom: 4 }]}>
                  {lb('Payment Receipt:', 'Recu de paiement:', 'إيصال الدفع:')}
                </Text>
                <Pressable onPress={() => { setVerifyImageUrl(sub.screenshotUri); setShowVerifyImageModal(true); }}>
                  <Image source={{ uri: sub.screenshotUri }} style={{ width: '100%', height: 140, borderRadius: 8 }} contentFit="cover" transition={200} />
                </Pressable>
              </View>
            ) : null}

            {sub.adminNotes ? (
              <View style={{ paddingHorizontal: 8, paddingVertical: 6, backgroundColor: colors.backgroundSecondary, borderRadius: 6 }}>
                <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>{lb('Notes:', 'Notes:', 'ملاحظات:')} {sub.adminNotes}</Text>
              </View>
            ) : null}

            {sub.status === 'pending' ? (
              <View style={styles.cardActions}>
                <Pressable onPress={() => handleApproveSubscription(sub.id)}
                  style={[styles.actionBtn, { backgroundColor: colors.successLight, borderColor: colors.success }]}>
                  <MaterialIcons name="check-circle" size={16} color={colors.success} />
                  <Text style={[styles.actionText, { color: colors.success }]}>{lb('Approve', 'Approuver', 'موافقة')}</Text>
                </Pressable>
                <Pressable onPress={() => handleOpenRejectModal(sub.id)}
                  style={[styles.actionBtn, { backgroundColor: colors.errorLight, borderColor: colors.error }]}>
                  <MaterialIcons name="cancel" size={16} color={colors.error} />
                  <Text style={[styles.actionText, { color: colors.error }]}>{lb('Reject', 'Refuser', 'رفض')}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );

  const renderLanguagesTab = () => {
    const LANG_LIST = [
      { id: 'ar', name: 'العربية', flag: '🇸🇦', desc: 'Arabic', descFr: 'Arabe' },
      { id: 'fr', name: 'Français', flag: '🇫🇷', desc: 'French', descFr: 'Français' },
      { id: 'en', name: 'English', flag: '🇬🇧', desc: 'English', descFr: 'Anglais' },
    ];
    return (
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textSecondary, marginBottom: 4 }}>
          {language === 'fr' ? 'Gestion des langues' : 'إدارة اللغات'}
        </Text>
        <Text style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 8 }}>
          {language === 'fr'
            ? 'Activez ou désactivez les langues visibles par les utilisateurs.'
            : 'تفعيل أو إخفاء اللغات الظاهرة للمستخدمين.'}
        </Text>
        {LANG_LIST.map(lang => {
          const isEnabled = enabledLanguages.includes(lang.id);
          const canToggle = enabledLanguages.length > 1 || !isEnabled;
          return (
            <View key={lang.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 12 }}>
              <Text style={{ fontSize: 24 }}>{lang.flag}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>{lang.name}</Text>
                <Text style={{ fontSize: 12, color: colors.textTertiary }}>{lang.desc} / {lang.descFr}</Text>
              </View>
              <Pressable
                onPress={() => canToggle && toggleLanguageEnabled(lang.id)}
                disabled={!canToggle}
                style={{ opacity: canToggle ? 1 : 0.4 }}
              >
                <View style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: isEnabled ? colors.success : colors.border }}>
                  <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>
                    {isEnabled ? (language === 'fr' ? 'Activé' : 'مفعّل') : (language === 'fr' ? 'Désactivé' : 'معطّل')}
                  </Text>
                </View>
              </Pressable>
            </View>
          );
        })}
        <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 4 }}>
          {language === 'fr'
            ? 'Vous ne pouvez pas désactiver toutes les langues en même temps.'
            : 'لا يمكن تعطيل جميع اللغات في نفس الوقت.'}
        </Text>
      </View>
    );
  };

  const renderCountriesTab2 = () => {
    const totalEnabled = enabledCountries.length;
    return (
      <View style={styles.tabContent}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.primary + '30' }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.statIcon, { backgroundColor: colors.primary + '15' }]}>
              <MaterialIcons name="public" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardName, { color: colors.textPrimary }]}>
                {lb(`${totalEnabled} Countries Enabled`, `${totalEnabled} Pays actives`, `${totalEnabled} دول مفعلة`)}
              </Text>
              <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                {lb('Toggle countries to control where users can register from', 'Activez les pays pour la registration', 'فعل الدول للتسجيل والسوق')}
              </Text>
            </View>
          </View>
        </View>
        {REGIONS.map(region => {
          const regionCountries = countriesByRegion[region.id] || [];
          const enabledInRegion = regionCountries.filter(c => enabledCountries.includes(c.code)).length;
          const isExpanded = expandedRegions[region.id] || false;
          const regionName = isFr ? region.name.fr : isAr ? region.name.ar : region.name.en;
          return (
            <View key={region.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Pressable onPress={() => toggleRegion(region.id)} style={styles.regionHeader}>
                <MaterialIcons name="public" size={20} color={colors.primary} />
                <Text style={[styles.regionTitle, { color: colors.textPrimary }]}>{regionName}</Text>
                <View style={[styles.regionBadge, { backgroundColor: colors.primary + '15' }]}>
                  <Text style={[styles.regionBadgeText, { color: colors.primary }]}>{enabledInRegion}/{regionCountries.length}</Text>
                </View>
                <MaterialIcons name={isExpanded ? 'expand-less' : 'expand-more'} size={24} color={colors.textSecondary} />
              </Pressable>
              {isExpanded ? (
                <View style={styles.countryList}>
                  {regionCountries.map(country => {
                    const isEnabled = enabledCountries.includes(country.code);
                    const countryName = isFr ? country.name.fr : isAr ? country.name.ar : country.name.en;
                    return (
                      <View key={country.code} style={[styles.countryRow, { borderBottomColor: colors.borderLight }]}>
                        <Text style={styles.countryFlag}>{country.flag}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.countryName, { color: colors.textPrimary }]}>{countryName}</Text>
                          <Text style={[styles.countryMeta, { color: colors.textTertiary }]}>{country.dialCode} - {country.phoneLength} {lb('digits', 'chiffres', 'أرقام')}</Text>
                        </View>
                        <Switch
                          value={isEnabled}
                          onValueChange={() => { selection(); toggleCountryEnabled(country.code); }}
                          trackColor={{ true: colors.primary, false: colors.border }}
                          thumbColor="#FFF"
                        />
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    );
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'sellers': return canAccess('manage_sellers') ? renderSellersTab() : null;
      case 'disputes': return canAccess('manage_disputes') ? renderDisputesTab() : null;
      case 'payments': return canAccess('manage_payments') ? renderPaymentsTab() : null;
      case 'shipping': return isSuperAdmin ? renderShippingTab() : null;
      case 'users': return canAccess('manage_users') ? renderUsersTab() : null;
      case 'branding': return isSuperAdmin ? renderBrandingTab() : null;
      case 'verification': return isSuperAdmin ? renderVerificationTab() : null;
      case 'countries': return isSuperAdmin ? renderCountriesTab2() : null;
      case 'languages': return isSuperAdmin ? renderLanguagesTab() : null;
      case 'blacklist': return canAccess('view_blacklist') ? renderBlacklistTab() : null;
      case 'staff': return isSuperAdmin ? renderStaffTab() : null;
      default: return null;
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={[styles.headerBackBtn, { backgroundColor: colors.backgroundSecondary }]}><MaterialIcons name="arrow-back" size={20} color={colors.textPrimary} /></Pressable>
          <View>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{lb('Admin Panel', 'Panneau Admin', 'لوحة الإدارة')}</Text>
            <Text style={[styles.headerSub, { color: colors.primary }]}>{isSuperAdmin ? 'Super Admin' : lb('Staff', 'Personnel', 'موظف')}</Text>
          </View>
        </View>
        <Pressable onPress={() => { logout(); router.replace('/(tabs)'); }} style={[styles.adminBadge, { backgroundColor: colors.error + '12' }]} hitSlop={8}><MaterialIcons name="logout" size={18} color={colors.error} /></Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        {isSuperAdmin ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsScroll}>
            {stats.map((stat, i) => (
              <View key={i} style={[styles.statCard, { backgroundColor: colors.surface, borderColor: stat.color + '30', borderWidth: 1 }, shadows.card]}>
                <View style={[styles.statIcon, { backgroundColor: stat.color + '15' }]}><MaterialIcons name={stat.icon as any} size={24} color={stat.color} /></View>
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stat.value}</Text>
                <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{stat.lbl}</Text>
              </View>
            ))}
          </ScrollView>
        ) : null}

        {/* Total Users Banner */}
        {isSuperAdmin ? (
          <View style={[styles.totalBanner, { backgroundColor: colors.primary + '08', borderColor: colors.primary + '20' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.bannerIcon, { backgroundColor: colors.primary + '15' }]}>
                <MaterialIcons name="groups" size={26} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.bannerTitle, { color: colors.textPrimary }]}>
                  {lb('Registered Users', 'Utilisateurs Inscrits', 'المستخدمون المسجلون')}
                </Text>
                <Text style={[styles.bannerSub, { color: colors.textSecondary }]}>
                  {realUsers.length > 0 ? `${realUsers.length} ${lb('users', 'utilisateurs', 'مستخدم')}` : lb('Loading from database...', 'Chargement...', 'جارٍ التحميل...')}
                </Text>
              </View>
              <Pressable onPress={() => refreshUsers()} style={[styles.refreshBtn, { backgroundColor: colors.primary }]} hitSlop={8}>
                <MaterialIcons name="refresh" size={18} color="#FFF" />
              </Pressable>
            </View>
          </View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {visibleTabs.map(tab => (
            <Pressable key={tab.key} onPress={() => { selection(); setActiveTab(tab.key); }} style={[styles.tabChip, { backgroundColor: activeTab === tab.key ? colors.primary : colors.surface, borderColor: activeTab === tab.key ? colors.primary : colors.border }]}>
              <MaterialIcons name={tab.icon as any} size={18} color={activeTab === tab.key ? '#FFF' : colors.textSecondary} />
              <Text style={[styles.tabChipText, { color: activeTab === tab.key ? '#FFF' : colors.textSecondary }]}>{getTabLabel(tab)}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {renderActiveTab()}
      </ScrollView>

      {/* Add Banner Modal */}
      <Modal visible={showAddBannerModal} transparent animationType="fade" onRequestClose={() => setShowAddBannerModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{lb('Add Banner', 'Ajouter une banniere', 'إضافة بانر')}</Text>

            <Text style={[styles.formLabel, { color: colors.textSecondary }]}>{lb('BANNER IMAGE *', 'IMAGE *', 'صورة البانر *')}</Text>
            <Pressable onPress={async () => {
              const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (status !== 'granted') return;
              const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, aspect: [16, 9], allowsEditing: true });
              if (!result.canceled && result.assets[0]) setNewBannerImage(result.assets[0].uri);
            }} style={[styles.logoPickerBtn, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, height: 140 }]}>
              {newBannerImage ? (
                <Image source={{ uri: newBannerImage }} style={styles.logoPreview} contentFit="cover" />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <MaterialIcons name="add-photo-alternate" size={36} color={colors.textTertiary} />
                  <Text style={[styles.logoPlaceholderText, { color: colors.textTertiary }]}>{lb('Select Banner Image (16:9)', 'Choisir une image', 'اختر صورة البانر')}</Text>
                </View>
              )}
            </Pressable>

            <Text style={[styles.formLabel, { color: colors.textSecondary }]}>{lb('TITLE *', 'TITRE *', 'العنوان *')}</Text>
            <TextInput style={[styles.modalInput, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: colors.border }]} placeholder={lb('e.g. Summer Sale', 'Ex: Soldes', 'مثال: عروض الصيف')} placeholderTextColor={colors.textTertiary} value={newBannerTitle} onChangeText={setNewBannerTitle} />

            <Text style={[styles.formLabel, { color: colors.textSecondary }]}>{lb('LINK (Optional)', 'LIEN (Optionnel)', 'رابط (اختياري)')}</Text>
            <TextInput style={[styles.modalInput, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: colors.border }]} placeholder="https://..." placeholderTextColor={colors.textTertiary} value={newBannerLink} onChangeText={setNewBannerLink} autoCapitalize="none" />

            <View style={styles.modalBtns}>
              <Pressable onPress={() => setShowAddBannerModal(false)} style={[styles.modalBtnCancel, { borderColor: colors.border }]}><Text style={[styles.modalBtnCancelText, { color: colors.textSecondary }]}>{lb('Cancel', 'Annuler', 'إلغاء')}</Text></Pressable>
              <Pressable onPress={async () => {
                if (!newBannerTitle.trim() || !newBannerImage) { Alert.alert(lb('Required', 'Requis', 'مطلوب'), lb('Title and image required', 'Titre et image requis', 'العنوان والصورة مطلوبان')); return; }
                setBannersLoading(true);
                const result = await addAdBanner(newBannerTitle.trim(), newBannerImage, newBannerLink.trim());
                setBannersLoading(false);
                if (result.success) { notifySuccess(); setNewBannerTitle(''); setNewBannerImage(''); setNewBannerLink(''); setShowAddBannerModal(false); loadBranding(); }
                else { Alert.alert('Error', result.error || 'Failed'); }
              }} style={[styles.modalBtnConfirm, { backgroundColor: colors.primary }]}><Text style={styles.modalBtnConfirmText}>{bannersLoading ? '...' : lb('Upload', 'Telecharger', 'رفع')}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Shipping Company Modal */}
      <Modal visible={showShippingModal} transparent animationType="fade" onRequestClose={() => setShowShippingModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: '#8B5CF6' }]}>{lb('New Shipping Company', 'Nouveau transporteur', 'شركة شحن جديدة')}</Text>
            <Text style={[styles.formLabel, { color: colors.textSecondary }]}>{lb('COMPANY NAME *', 'NOM *', 'اسم الشركة *')}</Text>
            <TextInput style={[styles.modalInput, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: colors.border }]} placeholder={lb('e.g. Express Tchad', 'Ex: Express Tchad', 'مثال: إكسبرس تشاد')} placeholderTextColor={colors.textTertiary} value={newShipName} onChangeText={setNewShipName} />
            <Text style={[styles.formLabel, { color: colors.textSecondary }]}>{lb('PHONE NUMBER *', 'TELEPHONE *', 'رقم الهاتف *')}</Text>
            <TextInput style={[styles.modalInput, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: colors.border }]} placeholder="+235 XX XX XX XX" placeholderTextColor={colors.textTertiary} value={newShipPhone} onChangeText={setNewShipPhone} keyboardType="phone-pad" />
            <Text style={[styles.formLabel, { color: colors.textSecondary }]}>{lb('DESCRIPTION', 'DESCRIPTION', 'الوصف')}</Text>
            <TextInput style={[styles.modalInput, styles.textAreaInput, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: colors.border }]} placeholder={lb('Service areas, delivery times...', 'Zones desservies, delais...', 'مناطق الخدمة، مواعيد التسليم...')} placeholderTextColor={colors.textTertiary} value={newShipDesc} onChangeText={setNewShipDesc} multiline numberOfLines={3} textAlignVertical="top" />
            <View style={styles.modalBtns}>
              <Pressable onPress={() => setShowShippingModal(false)} style={[styles.modalBtnCancel, { borderColor: colors.border }]}><Text style={[styles.modalBtnCancelText, { color: colors.textSecondary }]}>{lb('Cancel', 'Annuler', 'إلغاء')}</Text></Pressable>
              <Pressable onPress={() => {
                if (!newShipName.trim() || !newShipPhone.trim()) { Alert.alert(lb('Required', 'Requis', 'مطلوب')); return; }
                notifySuccess();
                addShippingCompany(newShipName.trim(), newShipPhone.trim(), newShipDesc.trim());
                setShowShippingModal(false);
              }} style={[styles.modalBtnConfirm, { backgroundColor: '#8B5CF6' }]}><Text style={styles.modalBtnConfirmText}>{lb('Add', 'Ajouter', 'إضافة')}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Verify Duration Modal */}
      <Modal visible={showVerifyModal} transparent animationType="fade" onRequestClose={() => setShowVerifyModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{lb('Verification Duration', 'Duree de verification', 'مدة التوثيق')}</Text>
            {VERIFY_DURATIONS.map(d => (
              <Pressable key={d.days} onPress={() => setSelectedVerifyDuration(d.days)} style={[styles.durationOption, { backgroundColor: selectedVerifyDuration === d.days ? colors.verified + '15' : colors.backgroundSecondary, borderColor: selectedVerifyDuration === d.days ? colors.verified : colors.border }]}>
                <Text style={[styles.durationText, { color: selectedVerifyDuration === d.days ? colors.verified : colors.textPrimary }]}>{isFr ? d.labelFr : isAr ? d.labelAr : d.label}</Text>
                {selectedVerifyDuration === d.days ? <MaterialIcons name="check-circle" size={20} color={colors.verified} /> : null}
              </Pressable>
            ))}
            <View style={styles.modalBtns}>
              <Pressable onPress={() => setShowVerifyModal(false)} style={[styles.modalBtnCancel, { borderColor: colors.border }]}><Text style={[styles.modalBtnCancelText, { color: colors.textSecondary }]}>{lb('Cancel', 'Annuler', 'إلغاء')}</Text></Pressable>
              <Pressable onPress={confirmVerify} style={[styles.modalBtnConfirm, { backgroundColor: colors.verified }]}><Text style={styles.modalBtnConfirmText}>{lb('Grant Badge', 'Verifier', 'توثيق')}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Ban Duration Modal */}
      <Modal visible={showBanModal} transparent animationType="fade" onRequestClose={() => setShowBanModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.error }]}>{lb('Ban User', 'Bannir utilisateur', 'حظر المستخدم')}</Text>
            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>{lb(`Ban "${banTargetName}"?`, `Bannir "${banTargetName}"?`, `حظر "${banTargetName}"؟`)}</Text>
            {BAN_DURATIONS.map(d => (
              <Pressable key={d.days} onPress={() => setSelectedBanDuration(d.days)} style={[styles.durationOption, { backgroundColor: selectedBanDuration === d.days ? colors.error + '15' : colors.backgroundSecondary, borderColor: selectedBanDuration === d.days ? colors.error : colors.border }]}>
                <Text style={[styles.durationText, { color: selectedBanDuration === d.days ? colors.error : colors.textPrimary }]}>{isFr ? d.labelFr : isAr ? d.labelAr : d.label}</Text>
                {selectedBanDuration === d.days ? <MaterialIcons name="check-circle" size={20} color={colors.error} /> : null}
              </Pressable>
            ))}
            <View style={styles.modalBtns}>
              <Pressable onPress={() => setShowBanModal(false)} style={[styles.modalBtnCancel, { borderColor: colors.border }]}><Text style={[styles.modalBtnCancelText, { color: colors.textSecondary }]}>{lb('Cancel', 'Annuler', 'إلغاء')}</Text></Pressable>
              <Pressable onPress={confirmBan} style={[styles.modalBtnConfirm, { backgroundColor: colors.error }]}><Text style={styles.modalBtnConfirmText}>{lb('Ban + Blacklist', 'Bannir + Liste noire', 'حظر + قائمة سوداء')}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Payment Method Modal */}
      <Modal visible={showPaymentModal} transparent animationType="fade" onRequestClose={() => setShowPaymentModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }} showsVerticalScrollIndicator={false}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{lb('New Payment Method', 'Nouvelle methode de paiement', 'طريقة دفع جديدة')}</Text>

              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>{lb('LOGO IMAGE', 'IMAGE DU LOGO', 'صورة الشعار')}</Text>
              <Pressable onPress={pickPaymentLogo} style={[styles.logoPickerBtn, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                {newPaymentLogo ? (
                  <Image source={{ uri: newPaymentLogo }} style={styles.logoPreview} contentFit="cover" />
                ) : (
                  <View style={styles.logoPlaceholder}>
                    <MaterialIcons name="add-photo-alternate" size={28} color={colors.textTertiary} />
                    <Text style={[styles.logoPlaceholderText, { color: colors.textTertiary }]}>{lb('Upload Logo', 'Telecharger le logo', 'رفع الشعار')}</Text>
                  </View>
                )}
              </Pressable>

              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>{lb('NAME *', 'NOM *', 'الاسم *')}</Text>
              <TextInput style={[styles.modalInput, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: colors.border }]} placeholder="e.g. Airtel Money" placeholderTextColor={colors.textTertiary} value={newPaymentName} onChangeText={setNewPaymentName} />

              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>{lb('TRANSFER INSTRUCTIONS *', 'INSTRUCTIONS *', 'تعليمات التحويل *')}</Text>
              <TextInput style={[styles.modalInput, styles.textAreaInput, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: colors.border }]}
                placeholder={lb('e.g. Dial *222# > Send Money...', 'Ex: Composez *222#...', 'مثال: اطلب *222#...')}
                placeholderTextColor={colors.textTertiary} value={newPaymentInstructions} onChangeText={setNewPaymentInstructions} multiline numberOfLines={3} textAlignVertical="top" />

              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>{lb('COLOR', 'COULEUR', 'اللون')}</Text>
              <View style={styles.colorRow}>
                {PAYMENT_COLORS.map(c => (
                  <Pressable key={c} onPress={() => setNewPaymentColor(c)} style={[styles.colorDot, { backgroundColor: c, borderColor: newPaymentColor === c ? colors.textPrimary : 'transparent' }]}>
                    {newPaymentColor === c ? <MaterialIcons name="check" size={16} color="#FFF" /> : null}
                  </Pressable>
                ))}
              </View>
              <View style={styles.modalBtns}>
                <Pressable onPress={() => setShowPaymentModal(false)} style={[styles.modalBtnCancel, { borderColor: colors.border }]}><Text style={[styles.modalBtnCancelText, { color: colors.textSecondary }]}>{lb('Cancel', 'Annuler', 'إلغاء')}</Text></Pressable>
                <Pressable onPress={handleAddPayment} style={[styles.modalBtnConfirm, { backgroundColor: colors.primary }]}><Text style={styles.modalBtnConfirmText}>{lb('Add', 'Ajouter', 'إضافة')}</Text></Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Add Staff Modal */}
      <Modal visible={showStaffModal} transparent animationType="fade" onRequestClose={() => setShowStaffModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }} showsVerticalScrollIndicator={false}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: '#8B5CF6' }]}>{lb('New Staff Member', 'Nouvel employe', 'موظف جديد')}</Text>

              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>{lb('FULL NAME *', 'NOM COMPLET *', 'الاسم الكامل *')}</Text>
              <TextInput style={[styles.modalInput, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: colors.border }]} placeholder={lb('Staff member name', 'Nom du membre', 'اسم الموظف')} placeholderTextColor={colors.textTertiary} value={newStaffName} onChangeText={setNewStaffName} />

              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>{lb('EMAIL *', 'E-MAIL *', 'البريد الإلكتروني *')}</Text>
              <TextInput style={[styles.modalInput, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: colors.border }]} placeholder="staff@sokchad.td" placeholderTextColor={colors.textTertiary} value={newStaffEmail} onChangeText={setNewStaffEmail} keyboardType="email-address" autoCapitalize="none" />

              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>{lb('PASSWORD *', 'MOT DE PASSE *', 'كلمة المرور *')}</Text>
              <TextInput style={[styles.modalInput, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: colors.border }]} placeholder="******" placeholderTextColor={colors.textTertiary} value={newStaffPassword} onChangeText={setNewStaffPassword} secureTextEntry />

              <Text style={[styles.formLabel, { color: colors.textSecondary }]}>{lb('PERMISSIONS *', 'PERMISSIONS *', 'الصلاحيات *')}</Text>
              {ALL_PERMISSIONS.map(perm => {
                const isSelected = newStaffPermissions.includes(perm.key);
                return (
                  <Pressable key={perm.key} onPress={() => togglePermission(perm.key)}
                    style={[styles.permissionRow, { backgroundColor: isSelected ? '#8B5CF610' : colors.backgroundSecondary, borderColor: isSelected ? '#8B5CF640' : colors.border }]}>
                    <MaterialIcons name={perm.icon as any} size={18} color={isSelected ? '#8B5CF6' : colors.textTertiary} />
                    <Text style={[styles.permissionLabel, { color: isSelected ? '#8B5CF6' : colors.textPrimary }]}>
                      {isFr ? perm.labelFr : isAr ? perm.labelAr : perm.label}
                    </Text>
                    <MaterialIcons name={isSelected ? 'check-box' : 'check-box-outline-blank'} size={22} color={isSelected ? '#8B5CF6' : colors.textTertiary} />
                  </Pressable>
                );
              })}

              <View style={[styles.modalBtns, { marginTop: 12 }]}>
                <Pressable onPress={() => setShowStaffModal(false)} style={[styles.modalBtnCancel, { borderColor: colors.border }]}><Text style={[styles.modalBtnCancelText, { color: colors.textSecondary }]}>{lb('Cancel', 'Annuler', 'إلغاء')}</Text></Pressable>
                <Pressable onPress={handleAddStaff} style={[styles.modalBtnConfirm, { backgroundColor: '#8B5CF6' }]}><Text style={styles.modalBtnConfirmText}>{lb('Create', 'Creer', 'إنشاء')}</Text></Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Image Preview Modal */}
      <Modal visible={showVerifyImageModal} transparent animationType="fade" onRequestClose={() => setShowVerifyImageModal(false)}>
        <Pressable style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.85)' }]} onPress={() => setShowVerifyImageModal(false)}>
          <View style={{ width: '90%', aspectRatio: 3/4, borderRadius: 12, overflow: 'hidden' }}>
            {verifyImageUrl ? (
              <Image source={{ uri: verifyImageUrl }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name="image-not-supported" size={48} color="#999" />
              </View>
            )}
          </View>
          <Pressable onPress={() => setShowVerifyImageModal(false)} style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#FFF', borderRadius: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: '600' }}>{lb('Close', 'Fermer', 'إغلاق')}</Text>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Reject Verification Modal */}
      <Modal visible={showRejectModal} transparent animationType="fade" onRequestClose={() => setShowRejectModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.error }]}>{lb('Reject Subscription', 'Refuser l abonnement', 'رفض الاشتراك')}</Text>
            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
              {lb('Provide a reason for rejection (optional).', 'Indiquez une raison pour le refus (optionnel).', 'أدخل سبب الرفض (اختياري).')}
            </Text>
            <TextInput
              style={[styles.modalInput, styles.textAreaInput, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: colors.border }]}
              placeholder={lb('e.g. Invalid receipt', 'Ex: Recu invalide', 'مثال: إيصال غير صالح')}
              placeholderTextColor={colors.textTertiary}
              value={rejectNotes}
              onChangeText={setRejectNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <View style={styles.modalBtns}>
              <Pressable onPress={() => setShowRejectModal(false)} style={[styles.modalBtnCancel, { borderColor: colors.border }]}>
                <Text style={[styles.modalBtnCancelText, { color: colors.textSecondary }]}>{lb('Cancel', 'Annuler', 'إلغاء')}</Text>
              </Pressable>
              <Pressable onPress={handleConfirmReject} style={[styles.modalBtnConfirm, { backgroundColor: colors.error }]}>
                <Text style={styles.modalBtnConfirmText}>{lb('Reject', 'Refuser', 'رفض')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Verification Plan Modal */}
      <Modal visible={showPlanModal} transparent animationType="fade" onRequestClose={() => setShowPlanModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.verified }]}>{lb('New Subscription Plan', 'Nouveau plan', 'خطة اشتراك جديدة')}</Text>
            <Text style={[styles.formLabel, { color: colors.textSecondary }]}>{lb('PLAN NAME *', 'NOM DU PLAN *', 'اسم الخطة *')}</Text>
            <TextInput style={[styles.modalInput, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: colors.border }]} placeholder={lb('e.g. 1 Month', 'Ex: 1 Mois', 'مثال: شهر واحد')} placeholderTextColor={colors.textTertiary} value={newPlanName} onChangeText={setNewPlanName} />
            <Text style={[styles.formLabel, { color: colors.textSecondary }]}>{lb('DURATION (DAYS) *', 'DUREE (JOURS) *', 'المدة (أيام) *')}</Text>
            <TextInput style={[styles.modalInput, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: colors.border }]} placeholder="30" placeholderTextColor={colors.textTertiary} value={newPlanDays} onChangeText={setNewPlanDays} keyboardType="numeric" />
            <Text style={[styles.formLabel, { color: colors.textSecondary }]}>{lb('PRICE (FCFA) *', 'PRIX (FCFA) *', 'السعر (FCFA) *')}</Text>
            <TextInput style={[styles.modalInput, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: colors.border }]} placeholder="5000" placeholderTextColor={colors.textTertiary} value={newPlanPrice} onChangeText={setNewPlanPrice} keyboardType="numeric" />
            <View style={styles.modalBtns}>
              <Pressable onPress={() => setShowPlanModal(false)} style={[styles.modalBtnCancel, { borderColor: colors.border }]}><Text style={[styles.modalBtnCancelText, { color: colors.textSecondary }]}>{lb('Cancel', 'Annuler', 'إلغاء')}</Text></Pressable>
              <Pressable onPress={handleAddPlan} style={[styles.modalBtnConfirm, { backgroundColor: colors.verified }]}><Text style={styles.modalBtnConfirmText}>{lb('Create', 'Creer', 'إنشاء')}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Vanity ID Modal */}
      <Modal visible={showVanityModal} transparent animationType="fade" onRequestClose={() => setShowVanityModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: '#F59E0B' }]}>{lb('Premium Vanity ID', 'ID Premium', 'معرف مميز')}</Text>
            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
              {lb(`Assign a custom numeric ID to "${vanityTargetName}". The new ID must be unique and numeric-only.`,
                `Attribuer un ID personnalise a "${vanityTargetName}". L ID doit etre unique et numerique.`,
                `تعيين معرف رقمي مخصص لـ "${vanityTargetName}". يجب أن يكون المعرف فريداً ورقمياً فقط.`)}
            </Text>
            <Text style={[styles.formLabel, { color: colors.textSecondary }]}>{lb('NEW VANITY ID *', 'NOUVEL ID PREMIUM *', 'المعرف المميز الجديد *')}</Text>
            <TextInput style={[styles.modalInput, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: colors.border, fontSize: 22, fontWeight: '800', textAlign: 'center', letterSpacing: 4 }]} placeholder={lb('e.g. 11, 222, 5555', 'Ex: 11, 222, 5555', 'مثال: 11, 222, 5555')} placeholderTextColor={colors.textTertiary} value={vanityNewId} onChangeText={setVanityNewId} keyboardType="numeric" maxLength={10} />
            <View style={[styles.modalBtns, { marginTop: 16 }]}>
              <Pressable onPress={() => setShowVanityModal(false)} style={[styles.modalBtnCancel, { borderColor: colors.border }]}><Text style={[styles.modalBtnCancelText, { color: colors.textSecondary }]}>{lb('Cancel', 'Annuler', 'إلغاء')}</Text></Pressable>
              <Pressable onPress={handleChangeVanityId} style={[styles.modalBtnConfirm, { backgroundColor: '#F59E0B' }]}><Text style={styles.modalBtnConfirmText}>{lb('Assign ID', 'Attribuer', 'تعيين')}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerBackBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  headerSub: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  adminBadge: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statsScroll: { paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  statCard: { width: 120, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, alignItems: 'center', gap: 4 },
  statIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 24, fontWeight: '800', marginTop: 2 },
  statLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  tabScroll: { paddingHorizontal: 16, gap: 6, paddingBottom: 14 },
  tabChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, gap: 6 },
  tabChipText: { fontSize: 13, fontWeight: '700' },
  tabContent: { paddingHorizontal: 16, gap: 12 },
  searchBar: { flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: borderRadius.md, paddingHorizontal: 14, borderWidth: 1, gap: 10 },
  searchInput: { flex: 1, fontSize: 15, height: '100%' },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  cardHeader: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  avatarWrapper: { position: 'relative' },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  cardName: { fontSize: 16, fontWeight: '700' },
  sellerId: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  cardMeta: { fontSize: 12, marginTop: 2 },
  timerText: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  bannedBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  bannedText: { fontSize: 10, fontWeight: '700' },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, gap: 6 },
  actionText: { fontSize: 12, fontWeight: '700' },
  disputeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.full },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  orderId: { fontSize: 12, fontWeight: '500' },
  disputeProduct: { fontSize: 15, fontWeight: '600' },
  disputeAmount: { fontSize: 20, fontWeight: '800' },
  disputeParties: { gap: 4 },
  partyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  partyLabel: { fontSize: 12, fontWeight: '500' },
  partyValue: { fontSize: 13, fontWeight: '600' },
  paymentRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  paymentIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  paymentLogoImg: { width: 48, height: 48, borderRadius: 12 },
  smallIconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 50, borderRadius: borderRadius.md, gap: 8 },
  addBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  onlineOfflineRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  onlineCard: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, borderRadius: borderRadius.md, borderWidth: 1, gap: 10 },
  onlineIndicator: { width: 10, height: 10, borderRadius: 5 },
  onlineCardValue: { fontSize: 22, fontWeight: '800' },
  onlineCardLabel: { fontSize: 12, fontWeight: '500' },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 16, fontWeight: '500' },
  blacklistHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  blacklistDetails: { gap: 6, marginLeft: 28 },
  blacklistRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  blacklistValue: { fontSize: 13 },
  // Staff
  staffAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  permissionTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  permTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  permTagText: { fontSize: 10, fontWeight: '600' },
  permissionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderRadius: borderRadius.sm, borderWidth: 1, marginBottom: 6, gap: 10 },
  permissionLabel: { flex: 1, fontSize: 14, fontWeight: '500' },
  // Modals
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '100%', borderRadius: borderRadius.lg, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 6 },
  modalDesc: { fontSize: 14, lineHeight: 21, marginBottom: 16 },
  durationOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderRadius: borderRadius.sm, borderWidth: 1, marginBottom: 8 },
  durationText: { fontSize: 15, fontWeight: '600' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalBtnCancel: { flex: 1, height: 48, borderRadius: borderRadius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  modalBtnCancelText: { fontSize: 15, fontWeight: '600' },
  modalBtnConfirm: { flex: 1, height: 48, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center' },
  modalBtnConfirmText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  formLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 6, marginTop: 12 },
  modalInput: { height: 52, borderRadius: borderRadius.md, borderWidth: 1, paddingHorizontal: 16, fontSize: 16 },
  textAreaInput: { height: 90, paddingTop: 14, textAlignVertical: 'top' },
  colorRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  colorDot: { width: 36, height: 36, borderRadius: 18, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  logoPickerBtn: { borderRadius: borderRadius.md, borderWidth: 2, borderStyle: 'dashed', overflow: 'hidden', height: 100, alignItems: 'center', justifyContent: 'center' },
  logoPreview: { width: '100%', height: '100%' },
  logoPlaceholder: { alignItems: 'center', gap: 4 },
  logoPlaceholderText: { fontSize: 13, fontWeight: '500' },
  // Countries
  regionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  regionTitle: { flex: 1, fontSize: 16, fontWeight: '700' },
  regionBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  regionBadgeText: { fontSize: 12, fontWeight: '700' },
  countryList: { marginTop: 10, gap: 0 },
  countryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, gap: 10 },
  countryFlag: { fontSize: 24 },
  countryName: { fontSize: 14, fontWeight: '600' },
  countryMeta: { fontSize: 11, marginTop: 1 },
  // Verification
  verifyThumb: { flex: 1, height: 64, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', gap: 2 },
  verifyThumbImg: { width: '100%', height: 46 },
  verifyThumbLabel: { fontSize: 9, fontWeight: '600', paddingHorizontal: 2 },
  // New banner styles
  totalBanner: { marginHorizontal: 16, marginVertical: 8, borderRadius: 18, borderWidth: 1.5, padding: 16 },
  bannerIcon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { fontSize: 17, fontWeight: '800' },
  bannerSub: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  refreshBtn: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
