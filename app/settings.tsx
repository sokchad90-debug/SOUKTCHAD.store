import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert, Modal, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { SUPPORTED_LANGUAGES } from '@/constants/config';
import { borderRadius } from '@/constants/theme';
import { selection, notifyWarning, notifySuccess, impactLight } from '@/services/haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import * as FileSystem from 'expo-file-system';
import { changePassword, updateProfile } from '@/services/supabaseStats';
import { getBlockedSellers, unblockSeller } from '@/services/blockedSellers';
import { scale } from '@/constants/responsive';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    colors, t, language, setLanguage, isDark, themePref, setThemePref,
    isLoggedIn, user, logout, updateUserAvatar, updateUserCover,
    enabledLanguages,
  } = useApp();

  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const lb = useCallback((en: string, fr: string, ar: string) => isFr ? fr : isAr ? ar : en, [isFr, isAr]);
  const isBuyer = user?.role === 'buyer' || (!user?.isSeller);

  // Light-lavender page background (reference design); calm dark background in dark mode
  const pageBg = isDark ? colors.background : '#F1F0FB';
  const cardBg = isDark ? colors.surface : '#FFFFFF';
  const headerBg = isDark ? colors.pinnedLight : '#5B48D9';
  const iconTint = colors.primary;

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

  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifPermissionDenied, setNotifPermissionDenied] = useState(false);

  const [showLangModal, setShowLangModal] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [blockedSellersList, setBlockedSellersList] = useState<any[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<{ files: number; bytes: number } | null>(null);

  const memberSince = useMemo(() => {
    const d = user?.created_at || (user as any)?.createdAt;
    if (!d) {
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

  // ---- Real notification permission state (honest switch) ----
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { status } = await Notifications.getPermissionsAsync();
        if (!alive) return;
        setNotifEnabled(status === 'granted');
        setNotifPermissionDenied(status === 'denied');
      } catch { /* keep honest default off */ }
    })();
    return () => { alive = false; };
  }, []);

  const handleToggleNotifications = useCallback(async (v: boolean) => {
    selection();
    if (v) {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === 'granted') {
          setNotifEnabled(true);
          setNotifPermissionDenied(false);
        } else {
          setNotifEnabled(false);
          setNotifPermissionDenied(true);
          Alert.alert(
            lb('Notifications blocked', 'Notifications bloquées', 'الإشعارات مرفوضة'),
            lb('Enable notifications for Sokchad from system Settings to receive order and message alerts.', 'Activez les notifications pour Sokchad depuis les réglages du téléphone pour recevoir les alertes.', 'فعّل إشعارات Sokchad من إعدادات الهاتف لتصلك تنبيهات الطلبات والرسائل.'),
          );
        }
      } catch {
        setNotifEnabled(false);
      }
    } else {
      setNotifEnabled(false);
      Alert.alert(
        lb('Notifications off', 'Notifications désactivées', 'تم إيقاف الإشعارات'),
        lb('To turn system notifications back on, allow them for Sokchad in phone Settings.', 'Pour réactiver les notifications système, autorisez-les pour Sokchad dans les réglages du téléphone.', 'لإعادة تشغيل إشعارات النظام، فعّلها لتطبيق Sokchad من إعدادات الهاتف.'),
      );
    }
  }, [lb]);

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

  // ---- Real cache clear: expo FileSystem cacheDirectory ONLY (files, not DB) ----
  const measureCache = useCallback(async () => {
    try {
      const dir = FileSystem.cacheDirectory;
      if (!dir) { setCacheInfo(null); return; }
      const items = await FileSystem.readDirectoryAsync(dir);
      let files = 0, bytes = 0;
      for (const name of items) {
        try {
          const info = await FileSystem.getInfoAsync(dir + name);
          if (info.exists && !info.isDirectory) { files++; bytes += info.size || 0; }
          else if (info.exists && info.isDirectory) {
            const sub = await FileSystem.readDirectoryAsync(dir + name);
            files += sub.length;
            for (const f2 of sub) {
              try {
                const i2 = await FileSystem.getInfoAsync(dir + name + '/' + f2);
                if (i2.exists && !i2.isDirectory) bytes += i2.size || 0;
              } catch { /* skip */ }
            }
          }
        } catch { /* skip */ }
      }
      setCacheInfo({ files, bytes });
    } catch { setCacheInfo(null); }
  }, []);

  useEffect(() => { measureCache(); }, [measureCache]);

  const handleClearCache = useCallback(() => {
    Alert.alert(
      lb('Clear Cache?', 'Vider le cache ?', 'مسح الذاكرة المؤقتة؟'),
      lb('Temporary files only — your account, orders, chats and login are untouched.', 'Fichiers temporaires uniquement — votre compte, commandes, discussions et session ne sont pas touchés.', 'الملفات المؤقتة فقط — حسابك وطلباتك ومحادثاتك وجلسة دخولك لن تُمس.'),
      [
        { text: lb('Cancel', 'Annuler', 'إلغاء'), style: 'cancel' },
        {
          text: lb('Clear', 'Vider', 'مسح'),
          style: 'destructive',
          onPress: async () => {
            try {
              const dir = FileSystem.cacheDirectory;
              if (dir) {
                const items = await FileSystem.readDirectoryAsync(dir);
                for (const name of items) {
                  try { await FileSystem.deleteAsync(dir + name, { idempotent: true }); } catch { /* skip */ }
                }
              }
              notifySuccess();
              setCacheInfo({ files: 0, bytes: 0 });
              Alert.alert(lb('Cache Cleared', 'Cache vidé', 'تم المسح'));
            } catch {
              Alert.alert(lb('Could not clear', 'Impossible de vider', 'تعذر المسح'));
            }
          },
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

  const appearanceLabel = themePref === 'light' ? lb('Light', 'Clair', 'فاتح')
    : themePref === 'dark' ? lb('Dark', 'Sombre', 'داكن')
    : lb('Follow device', 'Selon l\u2019appareil', 'حسب إعداد الجهاز');

  const email = user?.email || '';
  const phone = user?.phone || '';
  const na = lb('Not available', 'Non renseigné', 'غير متوفر');

  const fmtBytes = (b: number) => {
    if (b >= 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
    if (b >= 1024) return `${Math.round(b / 1024)} KB`;
    return `${b} B`;
  };

  // ---- Row / card building blocks (reference design: white rounded cards on lavender) ----
  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <Text style={[st.sectionTitle, { color: isDark ? colors.textSecondary : '#5B48D9' }]}>{children}</Text>
  );

  const NavCard = ({ icon, iconBg, onPress, label, right, noChevron }: {
    icon: string; iconBg: string; onPress: () => void; label: string; right?: React.ReactNode; noChevron?: boolean;
  }) => (
    <Pressable onPress={() => { selection(); onPress(); }}
      style={({ pressed }) => [st.card, st.navRow, { backgroundColor: cardBg, opacity: pressed ? 0.88 : 1 }]}>
      <View style={[st.iconCircle, { backgroundColor: iconBg }]}>
        <MaterialIcons name={icon as any} size={scale(21)} color={iconTint} />
      </View>
      <Text style={[st.navLabel, { color: colors.textPrimary }]} numberOfLines={2}>{label}</Text>
      {right}
      {!noChevron && (
        <MaterialIcons name={isAr ? 'chevron-left' : 'chevron-right'} size={scale(22)} color={isDark ? colors.textTertiary : '#A5A3B8'} />
      )}
    </Pressable>
  );

  return (
    <SafeAreaView edges={['top']} style={[st.safeArea, { backgroundColor: headerBg }]}>
      {/* Status bar: light icons over the purple header (dark header in dark mode) */}
      <StatusBar style="light" backgroundColor={headerBg} />
      {/* ===== Compact purple bar with title + subtitle — content starts immediately below ===== */}
      <View style={st.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={st.headerBackBtn}
          accessibilityRole="button" accessibilityLabel={lb('Back', 'Retour', 'رجوع')}>
          <MaterialIcons name={isAr ? 'arrow-forward' : 'arrow-back'} size={scale(22)} color="#FFFFFF" />
        </Pressable>
        <View style={st.headerCenter}>
          <Text style={st.headerTitle}>{lb('Settings', 'Paramètres', 'الإعدادات')}</Text>
          <Text style={st.headerSubtitle}>{lb('Buyer account', 'Compte acheteur', 'حساب المشتري')}</Text>
        </View>
        <View style={st.headerBackBtn} />
      </View>

      <View style={[st.page, { backgroundColor: pageBg, paddingBottom: insets.bottom + scale(10) }]}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: scale(14), paddingTop: scale(8), flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          {/* ================= PRÉFÉRENCES ================= */}
          <SectionTitle>{lb('PREFERENCES', 'PRÉFÉRENCES', 'التفضيلات')}</SectionTitle>

          <NavCard
            icon="language" iconBg={isDark ? colors.primary + '22' : '#E7E2FD'}
            onPress={() => setShowLangModal(true)}
            label={lb('Language', 'Langue', 'اللغة')}
            right={<Text style={[st.navValue, { color: colors.textSecondary }]}>
              {SUPPORTED_LANGUAGES.find(l => l.id === language)?.nativeLabel || ''}
            </Text>}
          />

          <NavCard
            icon={themePref === 'dark' ? 'dark-mode' : themePref === 'system' ? 'brightness-auto' : 'light-mode'}
            iconBg={isDark ? colors.primary + '22' : '#E7E2FD'}
            onPress={() => setThemePref(themePref === 'light' ? 'dark' : themePref === 'dark' ? 'system' : 'light')}
            label={lb('Appearance', 'Apparence', 'المظهر')}
            right={<Text style={[st.navValue, { color: colors.textSecondary }]}>{appearanceLabel}</Text>}
          />

          <View style={[st.card, { backgroundColor: cardBg }]}>
            <View style={[st.navRow, { paddingVertical: 0 }]}>
              <View style={[st.iconCircle, { backgroundColor: isDark ? colors.primary + '22' : '#E7E2FD' }]}>
                <MaterialIcons name="notifications" size={scale(21)} color={iconTint} />
              </View>
              <Text style={[st.navLabel, { color: colors.textPrimary }]}>{lb('Notifications', 'Notifications', 'الإشعارات')}</Text>
              <Switch
                value={notifEnabled}
                onValueChange={handleToggleNotifications}
                trackColor={{ true: colors.primary, false: isDark ? colors.border : '#D9D6E8' }}
                thumbColor="#FFFFFF"
                accessibilityRole="switch"
                accessibilityLabel={lb('Notifications', 'Notifications', 'الإشعارات')}
              />
            </View>
            {notifPermissionDenied && (
              <Text style={[st.notifHint, { color: colors.warning }]}>
                {lb('Permission denied — enable notifications for Sokchad in phone Settings.', 'Permission refusée — activez les notifications pour Sokchad dans les réglages du téléphone.', 'الإذن مرفوض — فعّل إشعارات Sokchad من إعدادات الهاتف.')}
              </Text>
            )}
          </View>

          {/* ================= COMPTE ================= */}
          {isLoggedIn && user ? (
            <>
              <SectionTitle>{lb('ACCOUNT', 'COMPTE', 'الحساب')}</SectionTitle>

              <NavCard
                icon="person" iconBg={isDark ? colors.primary + '22' : '#E7E2FD'}
                onPress={() => setShowEditProfileModal(true)}
                label={lb('Edit profile', 'Modifier le profil', 'تعديل الملف الشخصي')}
              />

              <NavCard
                icon="lock" iconBg={isDark ? colors.primary + '22' : '#E7E2FD'}
                onPress={() => { setCurPw(''); setNewPw(''); setConfirmPw(''); setShowPasswordModal(true); }}
                label={lb('Change password', 'Changer le mot de passe', 'تغيير كلمة المرور')}
              />

              {/* Account info: value shown UNDER the title (no truncation), no fake chevrons */}
              <View style={[st.card, { backgroundColor: cardBg }]}>
                <View style={st.infoHead}>
                  <View style={[st.iconCircle, { backgroundColor: isDark ? colors.primary + '22' : '#E7E2FD' }]}>
                    <MaterialIcons name="info" size={scale(21)} color={iconTint} />
                  </View>
                  <Text style={[st.navLabel, { color: colors.textPrimary }]}>{lb('Account info', 'Informations du compte', 'معلومات الحساب')}</Text>
                </View>
                <View style={[st.infoRow, { borderTopColor: isDark ? colors.border : '#EEEDF6' }]}>
                  <MaterialIcons name="email" size={scale(16)} color={isDark ? colors.textTertiary : '#A5A3B8'} />
                  <View style={st.infoBody}>
                    <Text style={[st.infoLabel, { color: colors.textTertiary }]}>{lb('Email', 'Email', 'البريد الإلكتروني')}</Text>
                    {email ? (
                      <Text style={[st.infoValue, { color: colors.textPrimary }]}>{email}</Text>
                    ) : (
                      <Text style={[st.infoValue, { color: colors.textTertiary }]}>{na}</Text>
                    )}
                  </View>
                </View>
                <View style={[st.infoRow, { borderTopColor: isDark ? colors.border : '#EEEDF6' }]}>
                  <MaterialIcons name="phone" size={scale(16)} color={isDark ? colors.textTertiary : '#A5A3B8'} />
                  <View style={st.infoBody}>
                    <Text style={[st.infoLabel, { color: colors.textTertiary }]}>{lb('Phone', 'Téléphone', 'رقم الهاتف')}</Text>
                    {phone ? (
                      <Text style={[st.infoValue, { color: colors.textPrimary }]}>{phone}</Text>
                    ) : (
                      <Text style={[st.infoValue, { color: colors.textTertiary }]}>{na}</Text>
                    )}
                  </View>
                </View>
                <View style={[st.infoRow, { borderTopColor: isDark ? colors.border : '#EEEDF6' }]}>
                  <MaterialIcons name="event" size={scale(16)} color={isDark ? colors.textTertiary : '#A5A3B8'} />
                  <View style={st.infoBody}>
                    <Text style={[st.infoLabel, { color: colors.textTertiary }]}>{lb('Member since', 'Membre depuis', 'تاريخ الانضمام')}</Text>
                    {memberSince ? (
                      <Text style={[st.infoValue, { color: colors.textPrimary }]}>{memberSince}</Text>
                    ) : (
                      <Text style={[st.infoValue, { color: colors.textTertiary }]}>{na}</Text>
                    )}
                  </View>
                </View>
              </View>
            </>
          ) : null}

          {/* ================= CONFIDENTIALITÉ ================= */}
          <SectionTitle>{lb('PRIVACY', 'CONFIDENTIALITÉ', 'الخصوصية')}</SectionTitle>

          {isLoggedIn && isBuyer && (
            <NavCard
              icon="block" iconBg={isDark ? colors.errorLight : '#FDE5E5'}
              onPress={openBlockedModal}
              label={lb('Blocked sellers', 'Vendeurs bloqués', 'البائعون المحظورون')}
              right={blockedSellersList.length > 0 ? (
                <Text style={[st.navValue, { color: colors.textTertiary }]}>{String(blockedSellersList.length)}</Text>
              ) : undefined}
            />
          )}

          <NavCard
            icon="verified-user" iconBg={isDark ? colors.primary + '22' : '#E7E2FD'}
            onPress={() => router.push('/privacy-policy' as any)}
            label={lb('Privacy policy', 'Politique de confidentialité', 'سياسة الخصوصية')}
          />

          {/* ================= SUPPORT ET AIDE ================= */}
          <SectionTitle>{lb('SUPPORT & HELP', 'SUPPORT ET AIDE', 'الدعم والمساعدة')}</SectionTitle>

          <NavCard
            icon="help-outline" iconBg={isDark ? colors.accentLight : '#FDF1DC'}
            onPress={() => Alert.alert(lb('Help Center', "Centre d'aide", 'مركز المساعدة'), lb('FAQ coming soon', 'FAQ bientôt', 'الأسئلة الشائعة قريباً'))}
            label={lb("Help center", "Centre d'aide", 'مركز المساعدة')}
          />

          <NavCard
            icon="bug-report" iconBg={isDark ? colors.errorLight : '#FDE5E5'}
            onPress={() => Alert.alert(lb('Report a Problem', 'Signaler un problème', 'الإبلاغ عن مشكلة'), lb('Send bug report', 'Envoyer rapport', 'إرسال تقرير'))}
            label={lb('Report a problem', 'Signaler un problème', 'الإبلاغ عن مشكلة')}
          />

          {/* ================= APPLICATION ================= */}
          <SectionTitle>{lb('APPLICATION', 'APPLICATION', 'التطبيق')}</SectionTitle>

          <NavCard
            icon="cleaning-services" iconBg={isDark ? colors.accentLight : '#FDF1DC'}
            onPress={handleClearCache}
            label={lb('Clear cache', 'Vider le cache', 'مسح الذاكرة المؤقتة')}
            right={cacheInfo && cacheInfo.files > 0 ? (
              <Text style={[st.navValue, { color: colors.textTertiary }]}>
                {cacheInfo.files} {lb('files', 'fichiers', 'ملف')} · {fmtBytes(cacheInfo.bytes)}
              </Text>
            ) : undefined}
          />

          <NavCard
            icon="description" iconBg={isDark ? colors.primary + '22' : '#E7E2FD'}
            onPress={() => router.push('/privacy-policy' as any)}
            label={lb("Terms of use", "Conditions d'utilisation", 'شروط الاستخدام')}
          />

          {/* ================= Déconnexion ================= */}
          {isLoggedIn ? (
            <Pressable onPress={() => { notifyWarning(); logout(); }}
              style={({ pressed }) => [st.logoutBtn, { backgroundColor: isDark ? colors.errorLight : '#FBE3E7', opacity: pressed ? 0.88 : 1 }]}>
              <MaterialIcons name="logout" size={scale(20)} color={colors.error} />
              <Text style={[st.logoutText, { color: colors.error }]}>{t('logout')}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>

      {/* Change Password Modal */}
      <Modal visible={showPasswordModal} transparent animationType="slide" onRequestClose={() => setShowPasswordModal(false)}>
        <View style={[st.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[st.modalContent, { backgroundColor: colors.surface }]}>
            <View style={st.modalHeader}>
              <Text style={[st.modalTitle, { color: colors.primary }]}>
                {lb('Change Password', 'Changer le mot de passe', 'تغيير كلمة المرور')}
              </Text>
              <Pressable onPress={() => setShowPasswordModal(false)} hitSlop={12}><MaterialIcons name="close" size={scale(24)} color={colors.textSecondary} /></Pressable>
            </View>
            <Text style={[st.modalDesc, { color: colors.textSecondary }]}>
              {lb('Enter your current password and a new one.', 'Entrez votre mot de passe actuel et un nouveau.', 'أدخل كلمة المرور الحالية وكلمة جديدة.')}
            </Text>

            <Text style={[st.inputLabel, { color: colors.textSecondary }]}>{lb('CURRENT PASSWORD *', 'MOT DE PASSE ACTUEL *', 'كلمة المرور الحالية *')}</Text>
            <TextInput
              value={curPw}
              onChangeText={setCurPw}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={lb('Current password', 'Mot de passe actuel', 'كلمة المرور الحالية')}
              placeholderTextColor={colors.textTertiary}
              style={[st.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.textPrimary }]}
            />

            <Text style={[st.inputLabel, { color: colors.textSecondary, marginTop: scale(12) }]}>{lb('NEW PASSWORD *', 'NOUVEAU MOT DE PASSE *', 'كلمة المرور الجديدة *')}</Text>
            <TextInput
              value={newPw}
              onChangeText={setNewPw}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={lb('At least 6 characters', 'Au moins 6 caractères', '6 أحرف على الأقل')}
              placeholderTextColor={colors.textTertiary}
              style={[st.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.textPrimary }]}
            />

            <Text style={[st.inputLabel, { color: colors.textSecondary, marginTop: scale(12) }]}>{lb('CONFIRM NEW PASSWORD *', 'CONFIRMER LE MOT DE PASSE *', 'تأكيد كلمة المرور *')}</Text>
            <TextInput
              value={confirmPw}
              onChangeText={setConfirmPw}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={lb('Repeat new password', 'Repeter le mot de passe', 'كرر كلمة المرور')}
              placeholderTextColor={colors.textTertiary}
              style={[st.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.textPrimary }]}
            />

            <Pressable onPress={handleChangePassword}
              style={({ pressed }) => [st.submitBtn, { backgroundColor: pwLoading ? colors.textTertiary : colors.primary, opacity: pressed ? 0.9 : 1 }]}
              disabled={pwLoading}>
              {pwLoading ? <ActivityIndicator color="#FFF" /> : <MaterialIcons name="lock-reset" size={scale(18)} color="#FFF" />}
              <Text style={st.submitBtnText}>{pwLoading ? '...' : lb('Update Password', 'Mettre a jour', 'تحديث كلمة المرور')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal visible={showEditProfileModal} transparent animationType="slide" onRequestClose={() => setShowEditProfileModal(false)}>
        <View style={[st.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[st.modalContent, { backgroundColor: colors.surface }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={st.modalHeader}>
                <Text style={[st.modalTitle, { color: colors.primary }]}>
                  {lb('Edit Profile', 'Modifier le profil', 'تعديل الملف الشخصي')}
                </Text>
                <Pressable onPress={() => setShowEditProfileModal(false)} hitSlop={12}><MaterialIcons name="close" size={scale(24)} color={colors.textSecondary} /></Pressable>
              </View>

              <Text style={[st.inputLabel, { color: colors.textSecondary }]}>{lb('AVATAR', 'AVATAR', 'الصورة الشخصية')}</Text>
              <Pressable onPress={pickEditAvatar} style={[st.docPicker, { height: scale(100), backgroundColor: colors.backgroundSecondary, borderColor: editAvatar ? colors.success : colors.border }]}>
                {editAvatar ? (
                  <Image source={{ uri: editAvatar }} style={{ width: scale(80), height: scale(80), borderRadius: scale(40) }} contentFit="cover" />
                ) : (
                  <View style={st.docPlaceholder}><MaterialIcons name="account-circle" size={scale(40)} color={colors.textTertiary} /><Text style={[st.docPlaceholderText, { color: colors.textTertiary }]}>{lb('Tap to choose', 'Appuyer pour choisir', 'اضغط للاختيار')}</Text></View>
                )}
              </Pressable>

              <Text style={[st.inputLabel, { color: colors.textSecondary, marginTop: scale(12) }]}>{lb('COVER IMAGE', 'IMAGE DE COUVERTURE', 'صورة الغلاف')}</Text>
              <Pressable onPress={pickEditCover} style={[st.docPicker, { height: scale(100), backgroundColor: colors.backgroundSecondary, borderColor: editCover ? colors.success : colors.border }]}>
                {editCover ? (
                  <Image source={{ uri: editCover }} style={{ width: '100%', height: '100%', borderRadius: scale(8) }} contentFit="cover" />
                ) : (
                  <View style={st.docPlaceholder}><MaterialIcons name="add-photo-alternate" size={scale(40)} color={colors.textTertiary} /><Text style={[st.docPlaceholderText, { color: colors.textTertiary }]}>{lb('Tap to choose', 'Appuyer pour choisir', 'اضغط للاختيار')}</Text></View>
                )}
              </Pressable>

              <Text style={[st.inputLabel, { color: colors.textSecondary, marginTop: scale(12) }]}>{lb('NAME *', 'NOM *', 'الاسم *')}</Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                placeholder={lb('Your name', 'Votre nom', 'اسمك')}
                placeholderTextColor={colors.textTertiary}
                style={[st.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.textPrimary }]}
              />

              <Text style={[st.inputLabel, { color: colors.textSecondary, marginTop: scale(12) }]}>{lb('PHONE', 'TELEPHONE', 'الهاتف')}</Text>
              <TextInput
                value={editPhone}
                onChangeText={setEditPhone}
                keyboardType="phone-pad"
                placeholder={lb('Phone number', 'Numero de telephone', 'رقم الهاتف')}
                placeholderTextColor={colors.textTertiary}
                style={[st.input, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.textPrimary }]}
              />

              <Pressable onPress={handleSaveProfile}
                style={({ pressed }) => [st.submitBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 }]}>
                <MaterialIcons name="check" size={scale(18)} color="#FFF" />
                <Text style={st.submitBtnText}>{lb('Save Changes', 'Enregistrer', 'حفظ التغييرات')}</Text>
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
        <View style={[st.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[st.modalContent, { backgroundColor: colors.surface }]}>
            <View style={st.modalHeader}>
              <Text style={[st.modalTitle, { color: colors.error }]}>
                {lb('Blocked Sellers', 'Vendeurs bloqués', 'البائعون المحظورون')}
              </Text>
              <Pressable onPress={() => setShowBlockedModal(false)} hitSlop={12}>
                <MaterialIcons name="close" size={scale(24)} color={colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={[st.modalDesc, { color: colors.textSecondary }]}>
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
                  <View key={String(seller.seller_id)} style={[st.listItem, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, marginBottom: scale(8) }]}>
                    <View style={[st.iconCircle, { backgroundColor: colors.error + '14' }]}>
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

const st = StyleSheet.create({
  safeArea: { flex: 1 },
  // Header: compact purple bar (title + subtitle), content starts right below
  header: { backgroundColor: '#5B48D9', height: scale(58), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: scale(8) },
  headerBackBtn: { width: scale(40), height: scale(40), alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: scale(17), fontWeight: '700', color: '#FFFFFF', fontFamily: 'Cairo-Bold', textAlign: 'center' },
  headerSubtitle: { fontSize: scale(12), color: '#E4DFFB', fontFamily: 'Cairo-Regular', marginTop: scale(1), textAlign: 'center' },
  sectionTitle: { fontSize: scale(13), fontWeight: '700', letterSpacing: 1.2, marginBottom: scale(10), fontFamily: 'Cairo-Bold' },
  card: { borderRadius: borderRadius.lg, marginBottom: scale(10), paddingHorizontal: scale(14), paddingVertical: scale(14) },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: scale(12) },
  iconCircle: { width: scale(38), height: scale(38), borderRadius: scale(19), alignItems: 'center', justifyContent: 'center' },
  navLabel: { flex: 1, fontSize: scale(16), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },
  navValue: { fontSize: scale(14), fontWeight: '500', fontFamily: 'Cairo-Regular', textAlign: 'right' },
  notifHint: { fontSize: scale(12), fontFamily: 'Cairo-Regular', marginTop: scale(8), lineHeight: scale(17) },
  infoHead: { flexDirection: 'row', alignItems: 'center', gap: scale(12), marginBottom: scale(4) },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: scale(10), paddingVertical: scale(10), borderTopWidth: 1 },
  infoBody: { flex: 1 },
  infoLabel: { fontSize: scale(13), fontWeight: '600', fontFamily: 'Cairo-SemiBold', marginBottom: scale(2) },
  infoValue: { fontSize: scale(14), fontWeight: '500', fontFamily: 'Cairo-Regular', flexShrink: 1 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: scale(16), marginBottom: scale(8), paddingVertical: scale(15), borderRadius: borderRadius.lg, gap: scale(8) },
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
  listItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: scale(16), paddingHorizontal: scale(14), minHeight: scale(58), borderRadius: borderRadius.lg, borderWidth: 0.5, gap: scale(12) },
  page: { flex: 1 },
});