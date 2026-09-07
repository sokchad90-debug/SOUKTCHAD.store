import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useApp, CHAD_CITIES } from '@/contexts/AppContext';
import { scale } from '@/constants/responsive';
import { shadows } from '@/constants/theme';
import { selection, notifySuccess } from '@/services/haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = 'https://souktchad.shop/api';

export default function SellerSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    colors, language, user, logout, updateStoreLogo, updateStoreBanner,
    deliveryCities, updateDeliveryCities,
    fetchAvailableShippingCompanies, fetchSellerShipping, updateSellerShipping,
  } = useApp();

  const updateUserLocal = useCallback((updates: Record<string, any>) => {
    // Update AsyncStorage so changes survive restart
    AsyncStorage.getItem('sokchad_user').then(savedUser => {
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        Object.assign(parsed, updates);
        AsyncStorage.setItem('sokchad_user', JSON.stringify(parsed)).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const [availableShipping, setAvailableShipping] = useState<any[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<number[]>([]);
  const [shippingLoading, setShippingLoading] = useState(true);
  const [savingShipping, setSavingShipping] = useState(false);

  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const lb = useCallback((en: string, fr: string, ar: string) => isFr ? fr : isAr ? ar : en, [isFr, isAr]);

  const [storeName, setStoreName] = useState(user?.username || user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [bio, setBio] = useState((user as any)?.bio || '');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [selectedCities, setSelectedCities] = useState<string[]>(deliveryCities || []);
  const [saving, setSaving] = useState(false);
  const [savingCities, setSavingCities] = useState(false);

  useEffect(() => { setSelectedCities(deliveryCities || []); }, [deliveryCities]);

  useEffect(() => {
    if (user?.id) {
      Promise.all([
        fetchAvailableShippingCompanies(),
        fetchSellerShipping(Number(user.numericId || user.sellerId || 0)),
      ]).then(([available, selected]) => {
        setAvailableShipping(available || []);
        setSelectedShipping((selected || []).map((s: any) => Number(s.id)));
        setShippingLoading(false);
      }).catch(() => setShippingLoading(false));
    }
  }, [user?.id, fetchAvailableShippingCompanies, fetchSellerShipping]);

  const handleLogoUpload = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [1, 1], quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setUploadingLogo(true);
        await updateStoreLogo(result.assets[0].uri);
        notifySuccess();
      }
    } catch (e) { Alert.alert('Error', 'Failed to upload logo'); }
    setUploadingLogo(false);
  }, [updateStoreLogo]);

  const handleBannerUpload = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [16, 9], quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setUploadingBanner(true);
        await updateStoreBanner(result.assets[0].uri);
        notifySuccess();
      }
    } catch (e) { Alert.alert('Error', 'Failed to upload banner'); }
    setUploadingBanner(false);
  }, [updateStoreBanner]);

  const toggleShippingCompany = useCallback((companyId: number) => {
    selection();
    setSelectedShipping(prev => prev.includes(companyId) ? prev.filter(id => id !== companyId) : [...prev, companyId]);
  }, []);

  const handleSaveShipping = useCallback(async () => {
    setSavingShipping(true);
    await updateSellerShipping(selectedShipping);
    setSavingShipping(false);
    notifySuccess();
  }, [selectedShipping, updateSellerShipping]);

  const toggleCity = useCallback((city: string) => {
    selection();
    setSelectedCities(prev => prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]);
  }, []);

  const handleSaveCities = useCallback(async () => {
    setSavingCities(true);
    await updateDeliveryCities(selectedCities);
    setSavingCities(false);
    notifySuccess();
  }, [selectedCities, updateDeliveryCities]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('sokchad_auth_token');
      const res = await fetch(`${API_BASE}/api_profile.php`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: storeName, phone, bio }),
      });
      // Persist to AsyncStorage so changes survive restart
      updateUserLocal({ username: storeName, phone, bio, name: storeName });
      notifySuccess();
    } catch (e) { console.log('Profile update error:', e); }
    setSaving(false);
  }, [storeName, phone, bio, updateUserLocal]);

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={scale(22)} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {lb('Store Settings', 'Paramètres du magasin', 'إعدادات المتجر')}
        </Text>
        <View style={{ width: scale(28) }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: scale(16), paddingBottom: insets.bottom + scale(40) }}>
        {/* Store Info */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.borderLight }, shadows.card]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{lb('Store Information', 'Informations', 'معلومات المتجر')}</Text>
          
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.textTertiary }]}>{lb('Logo', 'Logo', 'الشعار')}</Text>
            <Pressable onPress={handleLogoUpload} style={styles.logoPicker}>
              {user?.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.logoImg} contentFit="cover" />
              ) : (
                <View style={[styles.logoPlaceholder, { backgroundColor: colors.primary + '20' }]}>
                  <MaterialIcons name="storefront" size={scale(20)} color={colors.primary} />
                </View>
              )}
              {uploadingLogo && <ActivityIndicator size="small" color={colors.primary} style={styles.uploadIndicator} />}
            </Pressable>
          </View>

          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.textTertiary }]}>{lb('Banner', 'Bannière', 'البانر')}</Text>
            <Pressable onPress={handleBannerUpload} style={styles.bannerPicker}>
              {user?.coverImage ? (
                <Image source={{ uri: user?.coverImage }} style={styles.bannerImg} contentFit="cover" />
              ) : (
                <View style={[styles.bannerPlaceholder, { backgroundColor: colors.primary + '15' }]}>
                  <MaterialIcons name="add-photo-alternate" size={scale(20)} color={colors.textTertiary} />
                </View>
              )}
              {uploadingBanner && <ActivityIndicator size="small" color={colors.primary} style={styles.uploadIndicator} />}
            </Pressable>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textTertiary }]}>{lb('Store Name', 'Nom', 'اسم المتجر')}</Text>
            <TextInput style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]} value={storeName} onChangeText={setStoreName} placeholderTextColor={colors.textTertiary} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textTertiary }]}>{lb('Phone', 'Téléphone', 'الهاتف')}</Text>
            <TextInput style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]} value={phone} onChangeText={setPhone} placeholderTextColor={colors.textTertiary} keyboardType="phone-pad" />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textTertiary }]}>{lb('Bio', 'Bio', 'نبذة')}</Text>
            <TextInput style={[styles.inputBio, { color: colors.textPrimary, backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]} value={bio} onChangeText={setBio} placeholderTextColor={colors.textTertiary} multiline numberOfLines={3} textAlignVertical="top" />
          </View>
        </View>

        {/* Payment Numbers */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.borderLight }, shadows.card]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{lb('Payment Numbers', 'Numéros de paiement', 'أرقام الدفع')}</Text>
          <Pressable onPress={() => router.push('/seller-payments' as any)} style={({ pressed }) => [styles.navBtn, { backgroundColor: colors.primary + '10', opacity: pressed ? 0.8 : 1 }]}>
            <MaterialIcons name="payments" size={scale(20)} color={colors.primary} />
            <Text style={[styles.navBtnText, { color: colors.primary }]}>{lb('Manage Payment Numbers', 'Gérer', 'إدارة أرقام الدفع')}</Text>
            <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={scale(18)} color={colors.primary} />
          </Pressable>
        </View>

        {/* Delivery Cities */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.borderLight }, shadows.card]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{lb('Delivery Cities', 'Villes de livraison', 'مدن التوصيل')}</Text>
          <View style={styles.citiesGrid}>
            {CHAD_CITIES.map(city => {
              const isSelected = selectedCities.includes(city);
              return (
                <Pressable key={city} onPress={() => toggleCity(city)} style={({ pressed }) => [styles.cityChip, { backgroundColor: isSelected ? colors.primary + '15' : colors.backgroundSecondary, borderColor: isSelected ? colors.primary : colors.border, opacity: pressed ? 0.85 : 1 }]}>
                  {isSelected && <MaterialIcons name="check" size={scale(14)} color={colors.primary} />}
                  <Text style={[styles.cityText, { color: isSelected ? colors.primary : colors.textPrimary }]}>{city}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable onPress={handleSaveCities} disabled={savingCities} style={({ pressed }) => [styles.saveBtn, { backgroundColor: colors.primary, opacity: savingCities ? 0.6 : pressed ? 0.85 : 1 }]}>
            {savingCities ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveBtnText}>{lb('Save Cities', 'Enregistrer', 'حفظ')}</Text>}
          </Pressable>
        </View>

        {/* Shipping Companies */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.borderLight }, shadows.card]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{lb('Shipping Companies', 'Compagnies de livraison', 'شركات التوصيل')}</Text>
          {shippingLoading ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: scale(16) }} />
          ) : availableShipping.length > 0 ? (
            <View style={{ gap: scale(8) }}>
              {availableShipping.map((company: any) => {
                const isSelected = selectedShipping.includes(Number(company.id));
                return (
                  <Pressable
                    key={company.id}
                    onPress={() => toggleShippingCompany(Number(company.id))}
                    style={({ pressed }) => [styles.shippingRow, { backgroundColor: isSelected ? colors.primary + '10' : colors.backgroundSecondary, borderColor: isSelected ? colors.primary : colors.border, opacity: pressed ? 0.85 : 1 }]}
                  >
                    <MaterialIcons name={isSelected ? 'check-circle' : 'radio-button-unchecked'} size={scale(20)} color={isSelected ? colors.primary : colors.textTertiary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.shippingName, { color: colors.textPrimary }]}>{company.name}</Text>
                      {company.phone ? <Text style={[styles.shippingPhone, { color: colors.textTertiary }]}>{company.phone}</Text> : null}
                    </View>
                    <MaterialIcons name="local-shipping" size={scale(18)} color={colors.textTertiary} />
                  </Pressable>
                );
              })}
              <Pressable onPress={handleSaveShipping} disabled={savingShipping} style={({ pressed }) => [styles.saveBtn, { backgroundColor: colors.primary, opacity: savingShipping ? 0.6 : pressed ? 0.85 : 1 }]}>
                {savingShipping ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveBtnText}>{lb('Save Shipping', 'Enregistrer', 'حفظ الشحن')}</Text>}
              </Pressable>
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>{lb('No shipping companies available', 'Aucune compagnie disponible', 'لا توجد شركات توصيل متاحة')}</Text>
          )}
        </View>

        {/* Save button */}
        <Pressable onPress={handleSave} disabled={saving} style={({ pressed }) => [styles.mainSaveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : pressed ? 0.85 : 1 }]}>
          {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.mainSaveBtnText}>{lb('Save Changes', 'Enregistrer', 'حفظ التغييرات')}</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: scale(12), paddingVertical: scale(10), borderBottomWidth: 1 },
  backBtn: { padding: scale(4) },
  headerTitle: { fontSize: scale(18), fontWeight: '700', fontFamily: 'Cairo-Bold' },
  section: { borderRadius: scale(16), borderWidth: 1, padding: scale(16), marginBottom: scale(14) },
  sectionTitle: { fontSize: scale(16), fontWeight: '700', marginBottom: scale(14), fontFamily: 'Cairo-Bold' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: scale(12) },
  label: { fontSize: scale(13), fontWeight: '600', fontFamily: 'Cairo-Medium' },
  logoPicker: { position: 'relative' },
  logoImg: { width: scale(56), height: scale(56), borderRadius: scale(28) },
  logoPlaceholder: { width: scale(56), height: scale(56), borderRadius: scale(28), alignItems: 'center', justifyContent: 'center' },
  uploadIndicator: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  bannerPicker: { position: 'relative' },
  bannerImg: { width: scale(120), height: scale(60), borderRadius: scale(8) },
  bannerPlaceholder: { width: scale(120), height: scale(60), borderRadius: scale(8), alignItems: 'center', justifyContent: 'center' },
  inputGroup: { gap: scale(4), marginBottom: scale(12) },
  input: { borderWidth: 1, borderRadius: scale(10), paddingHorizontal: scale(12), paddingVertical: scale(10), fontSize: scale(14), fontFamily: 'Cairo-Regular' },
  inputBio: { borderWidth: 1, borderRadius: scale(10), paddingHorizontal: scale(12), paddingVertical: scale(10), fontSize: scale(14), minHeight: scale(72), fontFamily: 'Cairo-Regular' },
  navBtn: { flexDirection: 'row', alignItems: 'center', padding: scale(14), borderRadius: scale(12), gap: scale(10) },
  navBtnText: { flex: 1, fontSize: scale(14), fontWeight: '600', fontFamily: 'Cairo-Medium' },
  citiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(8) },
  cityChip: { flexDirection: 'row', alignItems: 'center', gap: scale(4), paddingHorizontal: scale(12), paddingVertical: scale(8), borderRadius: scale(20), borderWidth: 1 },
  cityText: { fontSize: scale(12), fontWeight: '600', fontFamily: 'Cairo-Medium' },
  saveBtn: { paddingVertical: scale(12), borderRadius: scale(10), alignItems: 'center', justifyContent: 'center', marginTop: scale(12) },
  saveBtnText: { color: '#FFF', fontSize: scale(14), fontWeight: '700', fontFamily: 'Cairo-Bold' },
  mainSaveBtn: { paddingVertical: scale(14), borderRadius: scale(12), alignItems: 'center', justifyContent: 'center', marginTop: scale(8) },
  mainSaveBtnText: { color: '#FFF', fontSize: scale(16), fontWeight: '700', fontFamily: 'Cairo-Bold' },
  shippingRow: { flexDirection: 'row', alignItems: 'center', padding: scale(12), borderRadius: scale(12), borderWidth: 1, gap: scale(10) },
  shippingName: { fontSize: scale(14), fontWeight: '600', fontFamily: 'Cairo-Medium' },
  shippingPhone: { fontSize: scale(12), marginTop: scale(2), fontFamily: 'Cairo-Regular' },
  emptyText: { fontSize: scale(13), textAlign: 'center', paddingVertical: scale(16), fontFamily: 'Cairo-Regular' },
});