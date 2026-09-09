import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert, Modal, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { SUPPORTED_LANGUAGES } from '@/constants/config';
import { borderRadius } from '@/constants/theme';
import { selection, notifyWarning, notifySuccess, impactLight } from '@/services/haptics';
import * as ImagePicker from 'expo-image-picker';
import { changePassword, updateProfile } from '@/services/supabaseStats';
import { getBlockedSellers, unblockSeller } from '@/services/blockedSellers';
import { scale } from '@/constants/responsive';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    colors, t, language, setLanguage, isDark, toggleDarkMode,
    isLoggedIn, user, logout, updateUserAvatar, updateUserCover,
    enabledLanguages,
  } = useApp();

  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const lb = useCallback((en: string, fr: string, ar: string) => isFr ? fr : isAr ? ar : en, [isFr, isAr]);
  const isBuyer = user?.role === 'buyer' || (!user?.isSeller);
  const isSeller = user?.isSeller === true;

  // ---- Local settings state ----
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

  const [autoAcceptOrders, setAutoAcceptOrders] = useState(false);

  const [showLangModal, setShowLangModal] = useState(false);

  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [blockedSellersList, setBlockedSellersList] = useState<any[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);

  const memberSince = useMemo(() => {
    const d = user?.created_at || (user as any)?.createdAt;
    if (!d) {
      // Fallback: estimate from numeric user id (timestamp-based IDs) or default to 1 year ago
      const numericId = parseInt(String(user?.id ?? ''), 10);
      if (!isNaN(numericId) && numericId > 1000000000) {
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

  return (
    <SafeAreaView edges={['top']} style={[sStyles.safeArea, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[sStyles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={sStyles.headerBackBtn}>
          <MaterialIcons name={isAr ? 'arrow-forward' : 'arrow-back'} size={scale(24)} color={colors.textPrimary} />
        </Pressable>
        <Text style={[sStyles.headerTitle, { color: colors.textPrimary }]}>
          {lb('Settings', 'Paramètres', 'الإعدادات')}
        </Text>
        <View style={{ width: scale(24) }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + scale(90) + scale(16), paddingHorizontal: scale(16), paddingTop: scale(12) }} showsVerticalScrollIndicator={false}>
        {/* General Settings */}
        <Text style={[sStyles.sectionTitle, { color: colors.textTertiary }]}>
          {lb('General Settings', 'Paramètres généraux', 'الإعدادات العامة')}
        </Text>

        {/* Appearance card: language + dark mode */}
        {enabledLanguages && enabledLanguages.length > 1 ? (
          <View style={[sStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pressable onPress={() => { selection(); setShowLangModal(true); }} style={sStyles.row}>
              <MaterialIcons name="language" size={scale(22)} color={colors.primary} />
              <Text style={[sStyles.rowLabel, { color: colors.textPrimary, flex: 1 }]}>{t('language')}</Text>
              <Text style={[sStyles.infoValue, { color: colors.textSecondary }]}>
                {SUPPORTED_LANGUAGES.find(l => l.id === language)?.nativeLabel || ''}
              </Text>
              <MaterialIcons name={isAr ? 'chevron-left' : 'chevron-right'} size={scale(22)} color={colors.textTertiary} />
            </Pressable>
          </View>
        ) : null}

        <View style={[sStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={sStyles.rowFull}>
            <MaterialIcons name={isDark ? 'dark-mode' : 'light-mode'} size={scale(22)} color={colors.primary} />
            <Text style={[sStyles.rowLabel, { color: colors.textPrimary, flex: 1 }]}>{t('darkMode')}</Text>
            <Switch value={isDark} onValueChange={() => { selection(); toggleDarkMode(); }} trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#FFF" />
          </View>
        </View>

        {/* Notifications master toggle */}
        <View style={[sStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={sStyles.rowFull}>
            <MaterialIcons name="notifications" size={scale(22)} color={colors.primary} />
            <Text style={[sStyles.rowLabel, { color: colors.textPrimary, flex: 1 }]}>{lb('Notifications', 'Notifications', 'الإشعارات')}</Text>
            <Switch value={notifOrders} onValueChange={(v) => { selection(); setNotifOrders(v); setNotifMessages(v); setNotifVerification(v); }} trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#FFF" />
          </View>
        </View>

        {/* Account section */}
        {isLoggedIn && user ? (
          <>
            <Text style={[sStyles.sectionTitle, { color: colors.textTertiary, marginTop: scale(8) }]}>
              {lb('Account', 'Compte', 'الحساب')}
            </Text>

            {/* Edit Profile */}
            <Pressable onPress={() => { selection(); setShowEditProfileModal(true); }}
              style={({ pressed }) => [sStyles.listItem, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.88 : 1 }]}>
              <View style={[sStyles.iconWrap, { backgroundColor: colors.primary + '14' }]}>
                <MaterialIcons name="person" size={scale(20)} color={colors.primary} />
              </View>
              <Text style={[sStyles.listLabel, { color: colors.textPrimary, flex: 1 }]}>
                {lb('Edit Profile', 'Modifier le profil', 'تعديل الملف الشخصي')}
              </Text>
              <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={scale(22)} color={colors.textTertiary} />
            </Pressable>

            {/* Change Password */}
            <Pressable onPress={() => { selection(); setCurPw(''); setNewPw(''); setConfirmPw(''); setShowPasswordModal(true); }}
              style={({ pressed }) => [sStyles.listItem, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.88 : 1 }]}>
              <View style={[sStyles.iconWrap, { backgroundColor: colors.verified + '14' }]}>
                <MaterialIcons name="lock" size={scale(20)} color={colors.verified} />
              </View>
              <Text style={[sStyles.listLabel, { color: colors.textPrimary, flex: 1 }]}>
                {lb('Change Password', 'Changer le mot de passe', 'تغيير كلمة المرور')}
              </Text>
              <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={scale(22)} color={colors.textTertiary} />
            </Pressable>

            {/* Account Info */}
            <View style={[sStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={sStyles.row}>
                <View style={[sStyles.iconWrap, { backgroundColor: colors.textTertiary + '14' }]}>
                  <MaterialIcons name="info" size={scale(20)} color={colors.textTertiary} />
                </View>
                <Text style={[sStyles.rowLabel, { color: colors.textPrimary }]}>
                  {lb('Account Info', 'Informations du compte', 'معلومات الحساب')}
                </Text>
              </View>
              <View style={sStyles.infoRow}>
                <MaterialIcons name="email" size={scale(16)} color={colors.textTertiary} />
                <Text style={[sStyles.infoLabel, { color: colors.textTertiary }]}>{lb('Email', 'Email', 'البريد')}</Text>
                <Text style={[sStyles.infoValue, { color: colors.textPrimary }]} numberOfLines={1}>{user?.email || '-'}</Text>
              </View>
              <View style={sStyles.infoRow}>
                <MaterialIcons name="phone" size={scale(16)} color={colors.textTertiary} />
                <Text style={[sStyles.infoLabel, { color: colors.textTertiary }]}>{lb('Phone', 'Téléphone', 'الهاتف')}</Text>
                <Text style={[sStyles.infoValue, { color: colors.textPrimary }]} numberOfLines={1}>{user?.phone || '-'}</Text>
              </View>
              <View style={sStyles.infoRow}>
                <MaterialIcons name="event" size={scale(16)} color={colors.textTertiary} />
                <Text style={[sStyles.infoLabel, { color: colors.textTertiary }]}>{lb('Member since', 'Membre depuis', 'عضو منذ')}</Text>
                <Text style={[sStyles.infoValue, { color: colors.textPrimary }]}>{memberSince}</Text>
              </View>
            </View>
          </>
        ) : null}

        {/* Seller Settings */}
        {isLoggedIn && user?.isSeller && (
          <>
            <Text style={[sStyles.sectionTitle, { color: colors.textTertiary, marginTop: scale(8) }]}>
              {lb('Seller Settings', 'Paramètres vendeur', 'إعدادات البائع')}
            </Text>
            <Pressable onPress={() => { selection(); router.push('/seller' as any); }}
              style={({ pressed }) => [sStyles.listItem, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.88 : 1 }]}>
              <View style={[sStyles.iconWrap, { backgroundColor: colors.primary + '14' }]}>
                <MaterialIcons name="store" size={scale(20)} color={colors.primary} />
              </View>
              <Text style={[sStyles.listLabel, { color: colors.textPrimary, flex: 1 }]}>
                {lb('Store Settings', 'Paramètres boutique', 'إعدادات المتجر')}
              </Text>
              <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={scale(22)} color={colors.textTertiary} />
            </Pressable>
            <Pressable onPress={() => { selection(); router.push('/seller-payments' as any); }}
              style={({ pressed }) => [sStyles.listItem, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.88 : 1 }]}>
              <View style={[sStyles.iconWrap, { backgroundColor: colors.verified + '14' }]}>
                <MaterialIcons name="account-balance-wallet" size={scale(20)} color={colors.verified} />
              </View>
              <Text style={[sStyles.listLabel, { color: colors.textPrimary, flex: 1 }]}>
                {lb('Payment Settings', 'Paramètres de paiement', 'إعدادات الدفع')}
              </Text>
              <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={scale(22)} color={colors.textTertiary} />
            </Pressable>
            <View style={[sStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={sStyles.notifRow}>
                <Text style={[sStyles.notifLabel, { color: colors.textSecondary }]}>{lb('Auto-accept orders', 'Acceptation automatique', 'قبول تلقائي')}</Text>
                <Switch value={autoAcceptOrders} onValueChange={(v) => { selection(); setAutoAcceptOrders(v); }} trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#FFF" />
              </View>
            </View>
          </>
        )}

        {/* Support & Help */}
        <Text style={[sStyles.sectionTitle, { color: colors.textTertiary, marginTop: scale(8) }]}>
          {lb('Support & Help', 'Support et aide', 'الدعم والمساعدة')}
        </Text>
        <Pressable onPress={() => { selection(); Alert.alert(lb('Help Center', "Centre d'aide", 'مركز المساعدة'), lb('FAQ coming soon', 'FAQ bientôt', 'الأسئلة الشائعة قريباً')); }}
          style={({ pressed }) => [sStyles.listItem, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.88 : 1 }]}>
          <View style={[sStyles.iconWrap, { backgroundColor: colors.accent + '14' }]}>
            <MaterialIcons name="help-outline" size={scale(20)} color={colors.accent} />
          </View>
          <Text style={[sStyles.listLabel, { color: colors.textPrimary, flex: 1 }]}>
            {lb('Help Center', "Centre d'aide", 'مركز المساعدة')}
          </Text>
          <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={scale(22)} color={colors.textTertiary} />
        </Pressable>
        <Pressable onPress={() => { selection(); Alert.alert(lb('Report a Problem', 'Signaler un problème', 'الإبلاغ عن مشكلة'), lb('Send bug report', 'Envoyer rapport', 'إرسال تقرير')); }}
          style={({ pressed }) => [sStyles.listItem, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.88 : 1 }]}>
          <View style={[sStyles.iconWrap, { backgroundColor: colors.error + '14' }]}>
            <MaterialIcons name="bug-report" size={scale(20)} color={colors.error} />
          </View>
          <Text style={[sStyles.listLabel, { color: colors.textPrimary, flex: 1 }]}>
            {lb('Report a Problem', 'Signaler un problème', 'الإبلاغ عن مشكلة')}
          </Text>
          <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={scale(22)} color={colors.textTertiary} />
        </Pressable>
        <Pressable onPress={() => { selection(); router.push('/privacy-policy' as any); }}
          style={({ pressed }) => [sStyles.listItem, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.88 : 1 }]}>
          <View style={[sStyles.iconWrap, { backgroundColor: colors.primary + '14' }]}>
            <MaterialIcons name="policy" size={scale(20)} color={colors.primary} />
          </View>
          <Text style={[sStyles.listLabel, { color: colors.textPrimary, flex: 1 }]}>
            {lb('Privacy Policy', 'Confidentialité', 'الخصوصية')}
          </Text>
          <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={scale(22)} color={colors.textTertiary} />
        </Pressable>
        <Pressable onPress={() => { selection(); router.push('/privacy-policy' as any); }}
          style={({ pressed }) => [sStyles.listItem, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.88 : 1 }]}>
          <View style={[sStyles.iconWrap, { backgroundColor: colors.primary + '14' }]}>
            <MaterialIcons name="description" size={scale(20)} color={colors.primary} />
          </View>
          <Text style={[sStyles.listLabel, { color: colors.textPrimary, flex: 1 }]}>
            {lb('Terms of Service', "Conditions d'utilisation", 'الشروط والأحكام')}
          </Text>
          <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={scale(22)} color={colors.textTertiary} />
        </Pressable>

        {/* Clear Cache */}
        <Pressable onPress={() => { selection(); handleClearCache(); }}
          style={({ pressed }) => [sStyles.listItem, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.88 : 1 }]}>
          <View style={[sStyles.iconWrap, { backgroundColor: colors.warning + '14' }]}>
            <MaterialIcons name="cleaning-services" size={scale(20)} color={colors.warning} />
          </View>
          <Text style={[sStyles.listLabel, { color: colors.textPrimary, flex: 1 }]}>
            {lb('Clear Cache', 'Vider le cache', 'مسح الذاكرة المؤقتة')}
          </Text>
          <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={scale(22)} color={colors.textTertiary} />
        </Pressable>

        {/* Blocked Sellers (buyer only) */}
        {isLoggedIn && isBuyer ? (
          <Pressable onPress={openBlockedModal}
            style={({ pressed }) => [sStyles.listItem, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.88 : 1 }]}>
            <View style={[sStyles.iconWrap, { backgroundColor: colors.error + '14' }]}>
              <MaterialIcons name="block" size={scale(20)} color={colors.error} />
            </View>
            <Text style={[sStyles.listLabel, { color: colors.textPrimary, flex: 1 }]}>
              {lb('Blocked Sellers', 'Vendeurs bloqués', 'البائعون المحظورون')}
            </Text>
            <Text style={[sStyles.infoValue, { color: colors.textTertiary, marginRight: scale(4) }]}>
              {blockedSellersList.length > 0 ? String(blockedSellersList.length) : ''}
            </Text>
            <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={scale(22)} color={colors.textTertiary} />
          </Pressable>
        ) : null}

        {/* Logout */}
        {isLoggedIn ? (
          <Pressable onPress={() => { notifyWarning(); logout(); }}
            style={({ pressed }) => [sStyles.logoutBtn, { backgroundColor: colors.error + '08', borderColor: colors.error, opacity: pressed ? 0.88 : 1 }]}>
            <MaterialIcons name="logout" size={scale(20)} color={colors.error} />
            <Text style={[sStyles.logoutText, { color: colors.error }]}>{t('logout')}</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {/* Change Password Modal */}
      <Modal visible={showPasswordModal} transparent animationType="slide" onRequestClose={() => setShowPasswordModal(false)}>
        <View style={[sStyles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[sStyles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={sStyles.modalHeader}>
              <Text style={[sStyles.modalTitle, { color: colors.primary }]}>
                {lb('Change Password', 'Changer le mot de passe', 'تغيير كلمة المرور')}
              </Text>
              <Pressable onPress={() => setShowPasswordModal(false)} hitSlop={12}><MaterialIcons name="close" size={scale(24)} color={colors.textSecondary} /></Pressable>
            </View>
            <Text style={[sStyles.modalDesc, { color: colors.textSecondary }]}>
              {lb('Enter your current password and a new one.', 'Entrez votre mot de passe actuel et un nouveau.', 'أدخل كلمة المرور الحالية وكلمة جديدة.')}
            </Text>

            <Text style={[sStyles.inputLabel, { color: colors.textSecondary }]}>{lb('CURRENT PASSWORD *', 'MOT DE PASSE ACTUEL *', 'كلمة المرور الحالية *')}</Text>
            <TextInput
              value={curPw}
              onChangeText={setCurPw}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={lb('Current password', 'Mot de passe actuel', 'كلمة المرور الحالية')}
              placeholderTextColor={colors.textTertiary}
              style={[sStyles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.textPrimary }]}
            />

            <Text style={[sStyles.inputLabel, { color: colors.textSecondary, marginTop: scale(12) }]}>{lb('NEW PASSWORD *', 'NOUVEAU MOT DE PASSE *', 'كلمة المرور الجديدة *')}</Text>
            <TextInput
              value={newPw}
              onChangeText={setNewPw}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={lb('At least 6 characters', 'Au moins 6 caractères', '6 أحرف على الأقل')}
              placeholderTextColor={colors.textTertiary}
              style={[sStyles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.textPrimary }]}
            />

            <Text style={[sStyles.inputLabel, { color: colors.textSecondary, marginTop: scale(12) }]}>{lb('CONFIRM NEW PASSWORD *', 'CONFIRMER LE MOT DE PASSE *', 'تأكيد كلمة المرور *')}</Text>
            <TextInput
              value={confirmPw}
              onChangeText={setConfirmPw}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={lb('Repeat new password', 'Repeter le mot de passe', 'كرر كلمة المرور')}
              placeholderTextColor={colors.textTertiary}
              style={[sStyles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.textPrimary }]}
            />

            <Pressable onPress={handleChangePassword}
              style={({ pressed }) => [sStyles.submitBtn, { backgroundColor: pwLoading ? colors.textTertiary : colors.primary, opacity: pressed ? 0.9 : 1 }]}
              disabled={pwLoading}>
              {pwLoading ? <ActivityIndicator color="#FFF" /> : <MaterialIcons name="lock-reset" size={scale(18)} color="#FFF" />}
              <Text style={sStyles.submitBtnText}>{pwLoading ? '...' : lb('Update Password', 'Mettre a jour', 'تحديث كلمة المرور')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal visible={showEditProfileModal} transparent animationType="slide" onRequestClose={() => setShowEditProfileModal(false)}>
        <View style={[sStyles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[sStyles.modalContent, { backgroundColor: colors.surface }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={sStyles.modalHeader}>
                <Text style={[sStyles.modalTitle, { color: colors.primary }]}>
                  {lb('Edit Profile', 'Modifier le profil', 'تعديل الملف الشخصي')}
                </Text>
                <Pressable onPress={() => setShowEditProfileModal(false)} hitSlop={12}><MaterialIcons name="close" size={scale(24)} color={colors.textSecondary} /></Pressable>
              </View>

              <Text style={[sStyles.inputLabel, { color: colors.textSecondary }]}>{lb('AVATAR', 'AVATAR', 'الصورة الشخصية')}</Text>
              <Pressable onPress={pickEditAvatar} style={[sStyles.docPicker, { height: scale(100), backgroundColor: colors.backgroundSecondary, borderColor: editAvatar ? colors.success : colors.border }]}>
                {editAvatar ? (
                  <Image source={{ uri: editAvatar }} style={{ width: scale(80), height: scale(80), borderRadius: scale(40) }} contentFit="cover" />
                ) : (
                  <View style={sStyles.docPlaceholder}><MaterialIcons name="account-circle" size={scale(40)} color={colors.textTertiary} /><Text style={[sStyles.docPlaceholderText, { color: colors.textTertiary }]}>{lb('Tap to choose', 'Appuyer pour choisir', 'اضغط للاختيار')}</Text></View>
                )}
              </Pressable>

              <Text style={[sStyles.inputLabel, { color: colors.textSecondary, marginTop: scale(12) }]}>{lb('COVER IMAGE', 'IMAGE DE COUVERTURE', 'صورة الغلاف')}</Text>
              <Pressable onPress={pickEditCover} style={[sStyles.docPicker, { height: scale(100), backgroundColor: colors.backgroundSecondary, borderColor: editCover ? colors.success : colors.border }]}>
                {editCover ? (
                  <Image source={{ uri: editCover }} style={{ width: '100%', height: '100%', borderRadius: scale(8) }} contentFit="cover" />
                ) : (
                  <View style={sStyles.docPlaceholder}><MaterialIcons name="add-photo-alternate" size={scale(40)} color={colors.textTertiary} /><Text style={[sStyles.docPlaceholderText, { color: colors.textTertiary }]}>{lb('Tap to choose', 'Appuyer pour choisir', 'اضغط للاختيار')}</Text></View>
                )}
              </Pressable>

              <Text style={[sStyles.inputLabel, { color: colors.textSecondary, marginTop: scale(12) }]}>{lb('NAME *', 'NOM *', 'الاسم *')}</Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                placeholder={lb('Your name', 'Votre nom', 'اسمك')}
                placeholderTextColor={colors.textTertiary}
                style={[sStyles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.textPrimary }]}
              />

              <Text style={[sStyles.inputLabel, { color: colors.textSecondary, marginTop: scale(12) }]}>{lb('PHONE', 'TELEPHONE', 'الهاتف')}</Text>
              <TextInput
                value={editPhone}
                onChangeText={setEditPhone}
                keyboardType="phone-pad"
                placeholder={lb('Phone number', 'Numero de telephone', 'رقم الهاتف')}
                placeholderTextColor={colors.textTertiary}
                style={[sStyles.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.textPrimary }]}
              />

              <Pressable onPress={handleSaveProfile}
                style={({ pressed }) => [sStyles.submitBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 }]}>
                <MaterialIcons name="check" size={scale(18)} color="#FFF" />
                <Text style={sStyles.submitBtnText}>{lb('Save Changes', 'Enregistrer', 'حفظ التغييرات')}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Language Picker Modal */}
      <Modal visible={showLangModal} transparent animationType="fade" onRequestClose={() => setShowLangModal(false)}>
        <Pressable style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: scale(20) }} onPress={() => setShowLangModal(false)}>
          <View style={{ width: '100%', maxWidth: scale(340), borderRadius: borderRadius.lg, padding: scale(20), backgroundColor: colors.surface }}>
            <Text style={{ fontSize: scale(18), fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: scale(16), fontFamily: 'Cairo-Bold' }}>
              {lb('Select Language', 'Choisir la langue', 'اختر اللغة')}
            </Text>
            {SUPPORTED_LANGUAGES.filter(lang => enabledLanguages.includes(lang.id)).map(lang => (
              <Pressable key={lang.id} onPress={() => { selection(); setLanguage(lang.id); setShowLangModal(false); }}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingVertical: scale(14), paddingHorizontal: scale(12), borderRadius: scale(10), marginBottom: scale(4), backgroundColor: language === lang.id ? colors.primary + '20' : 'transparent', opacity: pressed ? 0.88 : 1 })}>
                <Text style={{ fontSize: scale(22), marginRight: scale(12) }}>{lang.flag || '🌐'}</Text>
                <Text style={{ flex: 1, fontSize: scale(16), fontWeight: '500', color: colors.textPrimary, fontFamily: 'Cairo-Regular' }}>{lang.nativeLabel}</Text>
                {language === lang.id && <MaterialIcons name="check" size={scale(22)} color={colors.primary} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Blocked Sellers Modal */}
      <Modal visible={showBlockedModal} transparent animationType="slide" onRequestClose={() => setShowBlockedModal(false)}>
        <View style={[sStyles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[sStyles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={sStyles.modalHeader}>
              <Text style={[sStyles.modalTitle, { color: colors.error }]}>
                {lb('Blocked Sellers', 'Vendeurs bloqués', 'البائعون المحظورون')}
              </Text>
              <Pressable onPress={() => setShowBlockedModal(false)} hitSlop={12}>
                <MaterialIcons name="close" size={scale(24)} color={colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={[sStyles.modalDesc, { color: colors.textSecondary }]}>
              {lb('Sellers you blocked cannot contact you and their products are hidden.', 'Les vendeurs bloqués ne peuvent pas vous contacter et leurs produits sont masqués.', 'البائعون المحظورون لا يمكنهم التواصل معك ومنتجاتهم مخفية.')}
            </Text>

            {blockedLoading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: scale(24) }} />
            ) : blockedSellersList.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: scale(32), gap: scale(8) }}>
                <MaterialIcons name="block" size={scale(48)} color={colors.textTertiary} />
                <Text style={{ fontSize: scale(15), fontWeight: '600', color: colors.textSecondary, textAlign: 'center', fontFamily: 'Cairo-Regular' }}>
                  {lb('No blocked sellers', 'Aucun vendeur bloqué', 'لا يوجد بائعون محظورون')}
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: scale(400) }}>
                {blockedSellersList.map((seller) => (
                  <View key={String(seller.seller_id)} style={[sStyles.listItem, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, marginBottom: scale(8) }]}>
                    <View style={[sStyles.iconWrap, { backgroundColor: colors.error + '14' }]}>
                      <MaterialIcons name="storefront" size={scale(20)} color={colors.error} />
                    </View>
                    <View style={{ flex: 1, gap: scale(2) }}>
                      <Text style={{ fontSize: scale(15), fontWeight: '600', color: colors.textPrimary, fontFamily: 'Cairo-Regular' }} numberOfLines={1}>
                        {seller.seller_name || `#${seller.seller_id}`}
                      </Text>
                      {seller.seller_location ? (
                        <Text style={{ fontSize: scale(12), color: colors.textTertiary, fontFamily: 'Cairo-Regular' }} numberOfLines={1}>
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
                      <Text style={{ fontSize: scale(13), fontWeight: '700', color: colors.success, fontFamily: 'Cairo-Bold' }}>
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

const sStyles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: scale(12), paddingVertical: scale(12), borderBottomWidth: 0.5 },
  headerBackBtn: { padding: scale(4) },
  headerTitle: { fontSize: scale(18), fontWeight: '700', fontFamily: 'Cairo-Bold' },
  sectionTitle: { fontSize: scale(12), fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: scale(8), fontFamily: 'Cairo-SemiBold' },
  card: { borderRadius: borderRadius.lg, borderWidth: 0.5, padding: scale(14), marginBottom: scale(8) },
  row: { flexDirection: 'row', alignItems: 'center', gap: scale(10), marginBottom: scale(10) },
  rowFull: { flexDirection: 'row', alignItems: 'center', gap: scale(10) },
  rowLabel: { fontSize: scale(15), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },
  infoValue: { flex: 1, fontSize: scale(14), fontWeight: '500', textAlign: 'right', fontFamily: 'Cairo-Regular' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: scale(8), paddingVertical: scale(8), borderTopWidth: 0.5, borderTopColor: 'rgba(128,128,128,0.2)' },
  infoLabel: { fontSize: scale(13), fontWeight: '600', width: scale(90), fontFamily: 'Cairo-SemiBold' },
  listItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: scale(16), paddingHorizontal: scale(14), minHeight: scale(58), borderRadius: borderRadius.lg, borderWidth: 0.5, marginBottom: scale(8), gap: scale(12) },
  iconWrap: { width: scale(38), height: scale(38), borderRadius: scale(19), alignItems: 'center', justifyContent: 'center' },
  listLabel: { fontSize: scale(15), fontWeight: '600', fontFamily: 'Cairo-Regular' },
  notifRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: scale(10), borderTopWidth: 0.5, borderTopColor: 'rgba(128,128,128,0.2)' },
  notifLabel: { fontSize: scale(14), fontWeight: '500', flex: 1, fontFamily: 'Cairo-Regular' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: scale(20), marginBottom: scale(8), paddingVertical: scale(14), borderRadius: borderRadius.lg, borderWidth: 1, gap: scale(8) },
  logoutText: { fontSize: scale(16), fontWeight: '700', fontFamily: 'Cairo-Bold' },
  // Modal styles
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: scale(24), borderTopRightRadius: scale(24), padding: scale(24), maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: scale(8) },
  modalTitle: { fontSize: scale(20), fontWeight: '700', fontFamily: 'Cairo-Bold' },
  modalDesc: { fontSize: scale(14), lineHeight: 21, marginBottom: scale(16), fontFamily: 'Cairo-Regular' },
  inputLabel: { fontSize: scale(11), fontWeight: '700', letterSpacing: 0.8, marginBottom: scale(6), marginTop: scale(12), fontFamily: 'Cairo-SemiBold' },
  input: { height: scale(48), borderRadius: borderRadius.md, borderWidth: 1, paddingHorizontal: scale(14), fontSize: scale(15), fontWeight: '500', fontFamily: 'Cairo-Regular' },
  docPicker: { borderRadius: borderRadius.md, borderWidth: 2, borderStyle: 'dashed', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  docPlaceholder: { alignItems: 'center', gap: scale(4) },
  docPlaceholderText: { fontSize: scale(12), fontWeight: '500', fontFamily: 'Cairo-Regular' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: scale(52), borderRadius: borderRadius.md, gap: scale(8), marginTop: scale(16), marginBottom: scale(16) },
  submitBtnText: { color: '#FFF', fontSize: scale(16), fontWeight: '700', fontFamily: 'Cairo-SemiBold' },
});