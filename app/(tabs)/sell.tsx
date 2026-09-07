import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView,
  KeyboardAvoidingView, Platform, Alert, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '@/contexts/AppContext';
import { categories } from '@/services/mockData';
import { formatPrice } from '@/constants/config';
import { COUNTRY_CITIES } from '@/constants/countries';
import { borderRadius } from '@/constants/theme';
import LoginModal from '@/components/LoginModal';
import { impactLight, impactMedium, selection, notifySuccess, notifyWarning } from '@/services/haptics';
import { scale } from '@/constants/responsive';
import * as ImagePicker from 'expo-image-picker';

// Extracted sub-component to replace IIFE which causes "addViewAt" view tree crashes
function SellerDiscountSection({ products, userId, language, colors, lb, removeProductDiscount, setDiscountProductId, setDiscountPercent, setDiscountDays, setShowDiscountModal }: {
  products: any[]; userId?: string; language: string; colors: any;
  lb: (en: string, fr: string, ar: string) => string;
  removeProductDiscount: (id: string) => void;
  setDiscountProductId: (id: string) => void; setDiscountPercent: (v: string) => void;
  setDiscountDays: (v: string) => void; setShowDiscountModal: (v: boolean) => void;
}) {
  const myProducts = products.filter(p => p.sellerId === userId);
  if (myProducts.length === 0) return null;
  return (
    <View style={{ marginTop: scale(32) }}>
      <Text style={[localStyles.label, { color: colors.textSecondary, marginTop: 0 }]}>
        {lb('MANAGE DISCOUNTS', 'GÉRER LES REMISES', 'إدارة الخصومات')}
      </Text>
      {myProducts.map(prod => {
        const hasDiscount = (prod?.discountPercent ?? 0) > 0 && prod?.discountUntil && new Date(prod.discountUntil).getTime() > Date.now();
        const pTitle = prod?.title?.[language] || prod?.title?.en || '';
        return (
          <View key={prod.id} style={[localStyles.discountCard, { backgroundColor: colors.surface, borderColor: hasDiscount ? '#EF444440' : colors.border }]}>
            <View style={localStyles.discountCardRow}>
              <Image source={{ uri: prod?.images?.[0] || '' }} style={localStyles.discountThumb} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={[localStyles.discountCardTitle, { color: colors.textPrimary }]} numberOfLines={1}>{pTitle}</Text>
                <Text style={[localStyles.discountCardPrice, { color: colors.primary }]}>{formatPrice(prod?.price || 0)}</Text>
                {hasDiscount ? (
                  <View style={localStyles.discountActiveRow}>
                    <View style={[localStyles.discountActiveBadge, { backgroundColor: '#EF4444' }]}>
                      <Text style={localStyles.discountActiveBadgeText}>-{Math.min(30, prod?.discountPercent || 0)}%</Text>
                    </View>
                    <Text style={[localStyles.discountActivePrice, { color: '#EF4444' }]}>
                      {formatPrice(Math.round((prod?.price || 0) * (1 - Math.min(30, prod?.discountPercent || 0) / 100)))}
                    </Text>
                  </View>
                ) : null}
              </View>
              {hasDiscount ? (
                <Pressable
                  onPress={() => { notifyWarning(); removeProductDiscount(prod.id); }}
                  style={[localStyles.discountRemoveBtn, { backgroundColor: colors.errorLight }]}
                >
                  <MaterialIcons name="close" size={scale(16)} color={colors.error} />
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => { selection(); setDiscountProductId(prod.id); setDiscountPercent('10'); setDiscountDays('3'); setShowDiscountModal(true); }}
                  style={[localStyles.discountAddBtn, { backgroundColor: colors.primary + '15' }]}
                >
                  <MaterialIcons name="local-offer" size={scale(16)} color={colors.primary} />
                </Pressable>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}
const localStyles = StyleSheet.create({
  label: { fontSize: scale(13), fontWeight: '600', marginBottom: scale(6), marginTop: scale(12), textTransform: 'uppercase', letterSpacing: 0.5 },
  discountCard: { borderRadius: scale(10), borderWidth: 1, padding: scale(10), marginBottom: scale(8) },
  discountCardRow: { flexDirection: 'row', alignItems: 'center', gap: scale(10) },
  discountThumb: { width: scale(48), height: scale(48), borderRadius: scale(8) },
  discountCardTitle: { fontSize: scale(13), fontWeight: '600' },
  discountCardPrice: { fontSize: scale(14), fontWeight: '700' },
  discountActiveRow: { flexDirection: 'row', alignItems: 'center', gap: scale(6), marginTop: scale(2) },
  discountActiveBadge: { paddingHorizontal: scale(5), paddingVertical: scale(1), borderRadius: scale(4) },
  discountActiveBadgeText: { color: '#FFF', fontSize: scale(10), fontWeight: '800' },
  discountActivePrice: { fontSize: scale(13), fontWeight: '700' },
  discountRemoveBtn: { width: scale(34), height: scale(34), borderRadius: scale(17), alignItems: 'center', justifyContent: 'center' },
  discountAddBtn: { width: scale(34), height: scale(34), borderRadius: scale(17), alignItems: 'center', justifyContent: 'center' },
});

const MAX_IMAGES = 5;
const THUMB_SIZE = scale(110);

interface SelectedImage { id: string; uri: string; }

export default function SellScreen() {
  const insets = useSafeAreaInsets();
  const { colors, t, language, isLoggedIn, user, addProduct, enabledCountries, products, setProductDiscount, removeProductDiscount, isReady } = useApp();
  const [showLogin, setShowLogin] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [condition, setCondition] = useState<'new' | 'used' | 'like_new'>('new');
  const [location, setLocation] = useState('');
  const [detailedAddress, setDetailedAddress] = useState('');
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [activePreview, setActivePreview] = useState(0);
  const [showCityPicker, setShowCityPicker] = useState(false);

  const [stock, setStock] = useState('');
  const [maxOrderQty, setMaxOrderQty] = useState('');
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [deliveryCities, setDeliveryCities] = useState<string[]>([]);
  const [discountProductId, setDiscountProductId] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [discountDays, setDiscountDays] = useState('3');

  // Get cities from all enabled countries
  const availableCities = React.useMemo(() => {
    const cities: string[] = [];
    enabledCountries.forEach(code => {
      const cc = COUNTRY_CITIES[code];
      if (cc) cities.push(...cc);
    });
    return cities.length > 0 ? cities : ["N'Djamena", 'Moundou', 'Abeche', 'Sarh', 'Kelo'];
  }, [enabledCountries]);

  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const lb = (en: string, fr: string, ar: string) => isFr ? fr : isAr ? ar : en;

  // Determine view state - but always use single return
  const showBuyerBlock = isReady && isLoggedIn && user?.role === 'buyer';
  const showNotLoggedIn = isReady && !isLoggedIn;
  const showSellForm = isReady && isLoggedIn && user?.role !== 'buyer';

  const pickImages = useCallback(async () => {
    if (images.length >= MAX_IMAGES) { Alert.alert(lb('Limit Reached', 'Limite atteinte', 'تم بلوغ الحد الأقصى')); return; }
    const remaining = MAX_IMAGES - images.length;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert(lb('Permission Required', 'Permission requise', 'إذن مطلوب')); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: remaining, quality: 0.8, aspect: [1, 1] });
    if (!result.canceled && result.assets.length > 0) {
      impactLight();
      const newImages: SelectedImage[] = result.assets.slice(0, remaining).map((asset, i) => ({ id: `img_${Date.now()}_${i}`, uri: asset.uri }));
      setImages(prev => [...prev, ...newImages]);
    }
  }, [images.length]);

  const takePhoto = useCallback(async () => {
    if (images.length >= MAX_IMAGES) { Alert.alert(lb('Limit Reached', 'Limite atteinte', 'تم بلوغ الحد الأقصى')); return; }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert(lb('Permission Required', 'Permission requise', 'إذن مطلوب')); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8, aspect: [1, 1] });
    if (!result.canceled && result.assets.length > 0) {
      impactLight();
      setImages(prev => [...prev, { id: `img_${Date.now()}`, uri: result.assets[0].uri }]);
    }
  }, [images.length]);

  const removeImage = useCallback((id: string) => {
    impactMedium();
    setImages(prev => {
      const filtered = prev.filter(img => img.id !== id);
      if (activePreview >= filtered.length && filtered.length > 0) setActivePreview(filtered.length - 1);
      else if (filtered.length === 0) setActivePreview(0);
      return filtered;
    });
  }, [activePreview]);

  const moveImage = useCallback((fromIndex: number, direction: 'left' | 'right') => {
    selection();
    setImages(prev => {
      const arr = [...prev];
      const toIndex = direction === 'left' ? fromIndex - 1 : fromIndex + 1;
      if (toIndex < 0 || toIndex >= arr.length) return arr;
      const temp = arr[fromIndex]; arr[fromIndex] = arr[toIndex]; arr[toIndex] = temp;
      setActivePreview(toIndex);
      return arr;
    });
  }, []);

  const setCoverImage = useCallback((index: number) => {
    if (index === 0) return;
    notifySuccess();
    setImages(prev => { const arr = [...prev]; const [item] = arr.splice(index, 1); arr.unshift(item); setActivePreview(0); return arr; });
  }, []);

  // Categories that should hide condition selector
  const hideCondition = selectedCat === 'real_estate';

  const handlePublish = () => {
    if (!title.trim() || !price.trim() || !selectedCat || !location.trim()) {
      Alert.alert(lb('Required Fields', 'Champs requis', 'حقول مطلوبة'), lb('Please fill all required fields.', 'Veuillez remplir tous les champs.', 'يرجى ملء جميع الحقول.'));
      return;
    }
    if (images.length === 0) {
      Alert.alert(lb('Photos Required', 'Photos requises', 'الصور مطلوبة'), lb('Add at least one photo.', 'Ajoutez au moins une photo.', 'أضف صورة واحدة على الأقل.'));
      return;
    }
    notifySuccess();
    addProduct({ title: { en: title, fr: title, ar: title }, description: { en: description, fr: description, ar: description }, price: parseInt(price) || 0, images: images.map(img => img.uri), categoryId: selectedCat, sellerId: user?.id || 'user1', condition: hideCondition ? 'new' : condition, location, stock: parseInt(stock) || 0, maxOrderQty: parseInt(maxOrderQty) || undefined } as any);
    Alert.alert(lb('Published!', 'Publié!', 'تم النشر!'), lb('Your listing is now live.', 'Votre annonce est en ligne.', 'إعلانك متاح الآن.'));
    setTitle(''); setDescription(''); setPrice(''); setSelectedCat(''); setLocation(''); setDetailedAddress(''); setStock(''); setMaxOrderQty(''); setImages([]); setActivePreview(0);
  };

  const conditions: { key: 'new' | 'used' | 'like_new'; label: string }[] = [
    { key: 'new', label: t('brandNew') }, { key: 'like_new', label: t('likeNew') }, { key: 'used', label: t('used') },
  ];

  // ---- Loading indicator while data loads (blank screen fix) ----
  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // ---- SINGLE RETURN: all views inside one SafeAreaView ----
  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      {showBuyerBlock ? (
        <View style={styles.centerContent}>
          <MaterialIcons name="block" size={scale(64)} color={colors.error} />
          <Text style={[styles.loginTitle, { color: colors.textPrimary }]}>
            {lb('Buyer Account', 'Compte Acheteur', 'حساب مشتري')}
          </Text>
          <Text style={[styles.loginDesc, { color: colors.textSecondary }]}>
            {lb('Buyer accounts cannot list products. Create a seller account to start selling.', 'Les comptes acheteurs ne peuvent pas publier de produits. Créez un compte vendeur.', 'حسابات المشترين لا يمكنها نشر منتجات. أنشئ حساب بائع للبيع.')}
          </Text>
        </View>
      ) : showNotLoggedIn ? (
        <View style={styles.centerContent}>
          <MaterialIcons name="add-circle-outline" size={scale(64)} color={colors.textTertiary} />
          <Text style={[styles.loginTitle, { color: colors.textPrimary }]}>{t('sellProduct')}</Text>
          <Text style={[styles.loginDesc, { color: colors.textSecondary }]}>
            {lb('Log in with a seller account to post a listing', 'Connectez-vous avec un compte vendeur pour publier', 'سجل الدخول بحساب بائع لنشر إعلان')}
          </Text>
          <Pressable onPress={() => setShowLogin(true)} style={[styles.loginBtn, { backgroundColor: colors.primary }]}>
            <Text style={styles.loginBtnText}>{t('login')}</Text>
          </Pressable>
        </View>
      ) : showSellForm ? (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: scale(16), paddingBottom: insets.bottom + scale(24), paddingTop: scale(8) }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>{t('sellProduct')}</Text>

          {images.length > 0 ? (
            <View style={styles.imageSection}>
              <View style={[styles.previewContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Image source={{ uri: images[activePreview]?.uri }} style={styles.previewImage} contentFit="cover" transition={200} />
                {activePreview === 0 ? (
                  <View style={[styles.coverBadge, { backgroundColor: colors.primary }]}>
                    <MaterialIcons name="star" size={scale(12)} color="#FFF" />
                    <Text style={styles.coverBadgeText}>{lb('Cover', 'Couverture', 'غلاف')}</Text>
                  </View>
                ) : null}
                <View style={[styles.counterBadge, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                  <Text style={styles.counterText}>{activePreview + 1}/{images.length}</Text>
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbScroll}>
                {images.map((img, index) => (
                  <View key={img.id} style={styles.thumbWrapper}>
                    <Pressable onPress={() => setActivePreview(index)} style={[styles.thumbCard, { borderColor: activePreview === index ? colors.primary : colors.border, borderWidth: activePreview === index ? 2.5 : 1 }]}>
                      <Image source={{ uri: img.uri }} style={styles.thumbImage} contentFit="cover" />
                      {index === 0 ? <View style={[styles.thumbCoverDot, { backgroundColor: colors.primary }]}><MaterialIcons name="star" size={scale(8)} color="#FFF" /></View> : null}
                    </Pressable>
                    <View style={styles.thumbActions}>
                      {index > 0 ? <Pressable onPress={() => moveImage(index, 'left')} style={[styles.thumbActionBtn, { backgroundColor: colors.surfaceElevated }]} hitSlop={4}><MaterialIcons name="chevron-left" size={scale(14)} color={colors.textSecondary} /></Pressable> : <View style={styles.thumbActionBtn} />}
                      <Pressable onPress={() => removeImage(img.id)} style={[styles.thumbActionBtn, { backgroundColor: colors.errorLight }]} hitSlop={4}><MaterialIcons name="close" size={scale(14)} color={colors.error} /></Pressable>
                      {index < images.length - 1 ? <Pressable onPress={() => moveImage(index, 'right')} style={[styles.thumbActionBtn, { backgroundColor: colors.surfaceElevated }]} hitSlop={4}><MaterialIcons name="chevron-right" size={scale(14)} color={colors.textSecondary} /></Pressable> : <View style={styles.thumbActionBtn} />}
                    </View>
                    {index !== 0 && activePreview === index ? (
                      <Pressable onPress={() => setCoverImage(index)} style={[styles.setCoverBtn, { backgroundColor: colors.primary + '15' }]}>
                        <MaterialIcons name="star-outline" size={scale(12)} color={colors.primary} />
                        <Text style={[styles.setCoverText, { color: colors.primary }]}>{lb('Set Cover', 'Couverture', 'غلاف')}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
                {images.length < MAX_IMAGES ? (
                  <View style={styles.thumbWrapper}>
                    <Pressable onPress={pickImages} style={[styles.addMoreThumb, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                      <MaterialIcons name="add" size={scale(24)} color={colors.textTertiary} />
                      <Text style={[styles.addMoreText, { color: colors.textTertiary }]}>{images.length}/{MAX_IMAGES}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </ScrollView>

              <View style={styles.imageActionsRow}>
                <Pressable onPress={pickImages} style={[styles.imageActionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} disabled={images.length >= MAX_IMAGES}>
                  <MaterialIcons name="photo-library" size={scale(18)} color={images.length >= MAX_IMAGES ? colors.textTertiary : colors.primary} />
                  <Text style={[styles.imageActionText, { color: images.length >= MAX_IMAGES ? colors.textTertiary : colors.primary }]}>{lb('Gallery', 'Galerie', 'المعرض')}</Text>
                </Pressable>
                <Pressable onPress={takePhoto} style={[styles.imageActionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} disabled={images.length >= MAX_IMAGES}>
                  <MaterialIcons name="camera-alt" size={scale(18)} color={images.length >= MAX_IMAGES ? colors.textTertiary : colors.primary} />
                  <Text style={[styles.imageActionText, { color: images.length >= MAX_IMAGES ? colors.textTertiary : colors.primary }]}>{lb('Camera', 'Camera', 'الكاميرا')}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={[styles.photoBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MaterialIcons name="add-a-photo" size={scale(40)} color={colors.primary} />
              <Text style={[styles.photoTitle, { color: colors.textPrimary }]}>{t('addPhotos')}</Text>
              <Text style={[styles.photoSubtitle, { color: colors.textTertiary }]}>{lb(`Up to ${MAX_IMAGES} photos`, `Jusqu'a ${MAX_IMAGES} photos`, `حتى ${MAX_IMAGES} صور`)}</Text>
              <View style={styles.photoButtons}>
                <Pressable onPress={pickImages} style={({ pressed }) => [styles.photoPrimaryBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 }]}>
                  <MaterialIcons name="photo-library" size={scale(20)} color="#FFF" />
                  <Text style={styles.photoPrimaryText}>{lb('Gallery', 'Galerie', 'المعرض')}</Text>
                </Pressable>
                <Pressable onPress={takePhoto} style={({ pressed }) => [styles.photoSecondaryBtn, { borderColor: colors.primary, opacity: pressed ? 0.9 : 1 }]}>
                  <MaterialIcons name="camera-alt" size={scale(20)} color={colors.primary} />
                  <Text style={[styles.photoSecondaryText, { color: colors.primary }]}>{lb('Camera', 'Camera', 'الكاميرا')}</Text>
                </Pressable>
              </View>
            </View>
          )}

          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('title')} *</Text>
          <TextInput style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]} placeholder={lb('e.g. Samsung Galaxy A54', 'Ex: Samsung Galaxy A54', 'مثال: سامسونج جالاكسي')} placeholderTextColor={colors.textTertiary} value={title} onChangeText={setTitle} />

          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('description')}</Text>
          <TextInput style={[styles.input, styles.textArea, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]} placeholder={lb('Describe your product...', 'Décrivez votre produit...', 'وصف المنتج...')} placeholderTextColor={colors.textTertiary} value={description} onChangeText={setDescription} multiline numberOfLines={4} textAlignVertical="top" />

          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('price')} (FCFA) *</Text>
          <TextInput style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]} placeholder="0" placeholderTextColor={colors.textTertiary} value={price} onChangeText={setPrice} keyboardType="numeric" />

          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('selectCategory')} *</Text>
          <View style={styles.catGrid}>
            {categories.map(cat => (
              <Pressable key={cat.id} onPress={() => setSelectedCat(cat.id)} style={[styles.catChip, { backgroundColor: selectedCat === cat.id ? cat.color : colors.surface, borderColor: selectedCat === cat.id ? cat.color : colors.border }]}>
                <MaterialIcons name={cat.icon as any} size={scale(16)} color={selectedCat === cat.id ? '#FFF' : cat.color} />
                <Text style={[styles.catChipText, { color: selectedCat === cat.id ? '#FFF' : colors.textPrimary }]}>{cat.name[language] || cat.name.en}</Text>
              </Pressable>
            ))}
          </View>

          {!hideCondition ? (
            <>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{t('condition')}</Text>
              <View style={styles.conditionRow}>
                {conditions.map(c => (
                  <Pressable key={c.key} onPress={() => setCondition(c.key)} style={[styles.condChip, { backgroundColor: condition === c.key ? colors.primary : colors.surface, borderColor: condition === c.key ? colors.primary : colors.border }]}>
                    <Text style={[styles.condText, { color: condition === c.key ? '#FFF' : colors.textPrimary }]}>{c.label}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          <Text style={[styles.label, { color: colors.textSecondary }]}>{lb('AVAILABLE QUANTITY', 'QUANTITÉ DISPONIBLE', 'الكمية المتاحة')}</Text>
          <TextInput style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]} placeholder={lb('e.g. 10', 'Ex: 10', 'مثال: 10')} placeholderTextColor={colors.textTertiary} value={stock} onChangeText={setStock} keyboardType="numeric" />

          <Text style={[styles.label, { color: colors.textSecondary }]}>{lb('MAX ORDER QUANTITY (per buyer)', 'QTÉ MAX PAR COMMANDE', 'الحد الأقصى للطلب')}</Text>
          <TextInput style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]} placeholder={lb('e.g. 5 (leave empty = no limit)', 'Ex: 5 (vide = illimité)', 'مثال: 5 (فارغ = بلا حد)')} placeholderTextColor={colors.textTertiary} value={maxOrderQty} onChangeText={setMaxOrderQty} keyboardType="numeric" />

          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('location')} *</Text>
          <Pressable
            onPress={() => setShowCityPicker(!showCityPicker)}
            style={[styles.input, styles.cityPickerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <MaterialIcons name="location-on" size={scale(20)} color={location ? colors.primary : colors.textTertiary} />
            <Text style={[styles.cityPickerText, { color: location ? colors.textPrimary : colors.textTertiary }]}>
              {location || lb('Select City', 'Choisir la ville', 'اختر المدينة')}
            </Text>
            <MaterialIcons name={showCityPicker ? 'expand-less' : 'expand-more'} size={scale(22)} color={colors.textSecondary} />
          </Pressable>
          {showCityPicker ? (
            <View style={[styles.cityDropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: scale(180) }} showsVerticalScrollIndicator={false}>
                {availableCities.map(city => (
                  <Pressable
                    key={city}
                    onPress={() => { selection(); setLocation(city); setShowCityPicker(false); }}
                    style={[styles.cityOption, { backgroundColor: location === city ? colors.primary + '10' : 'transparent', borderBottomColor: colors.borderLight }]}
                  >
                    <Text style={[styles.cityOptionText, { color: location === city ? colors.primary : colors.textPrimary }]}>{city}</Text>
                    {location === city ? <MaterialIcons name="check" size={scale(18)} color={colors.primary} /> : null}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <Text style={[styles.label, { color: colors.textTertiary }]}>
            {lb('DETAILED ADDRESS (Optional)', 'ADRESSE DÉTAILLÉE (Optionnel)', 'العنوان التفصيلي (اختياري)')}
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
            placeholder={lb('e.g. Near Grand Market, Block 5', 'Ex: Près du Grand Marché, Bloc 5', 'مثال: بالقرب من السوق الكبير، بلوك 5')}
            placeholderTextColor={colors.textTertiary}
            value={detailedAddress}
            onChangeText={setDetailedAddress}
          />

          <Pressable onPress={handlePublish} style={({ pressed }) => [styles.publishBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 }]}>
            <MaterialIcons name="publish" size={scale(22)} color="#FFF" />
            <Text style={styles.publishBtnText}>{t('publishListing')}</Text>
          </Pressable>

          {/* Seller's Existing Products - Discount Management */}
          {isLoggedIn && user?.isSeller ? (
            <SellerDiscountSection
              products={products}
              userId={user?.id}
              language={language}
              colors={colors}
              lb={lb}
              removeProductDiscount={removeProductDiscount}
              setDiscountProductId={setDiscountProductId}
              setDiscountPercent={setDiscountPercent}
              setDiscountDays={setDiscountDays}
              setShowDiscountModal={setShowDiscountModal}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      ) : null}

      {/* Discount Modal */}
      <Modal visible={showDiscountModal} transparent animationType="fade" onRequestClose={() => setShowDiscountModal(false)}>
        <View style={[styles.discountOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.discountModalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.discountModalTitle, { color: colors.textPrimary }]}>
              {lb('Set Discount', 'Définir la remise', 'تعيين الخصم')}
            </Text>
            <Text style={[styles.discountModalSub, { color: colors.textSecondary }]}>
              {lb('Max 30% off, up to 7 days.', 'Max 30% de remise, jusqu\'à 7 jours.', 'حد أقصى 30% خصم، حتى 7 أيام.')}
            </Text>

            <Text style={[styles.label, { color: colors.textSecondary, marginTop: scale(12) }]}>
              {lb('DISCOUNT PERCENTAGE (%)', 'POURCENTAGE (%)', 'نسبة الخصم (%)')}
            </Text>
            <View style={styles.discountPresetsRow}>
              {[5, 10, 15, 20, 25, 30].map(p => (
                <Pressable
                  key={p}
                  onPress={() => { selection(); setDiscountPercent(String(p)); }}
                  style={[styles.discountPresetChip, {
                    backgroundColor: discountPercent === String(p) ? '#EF4444' : colors.backgroundSecondary,
                    borderColor: discountPercent === String(p) ? '#EF4444' : colors.border,
                  }]}
                >
                  <Text style={[styles.discountPresetText, { color: discountPercent === String(p) ? '#FFF' : colors.textPrimary }]}>{p}%</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.textSecondary, marginTop: scale(12) }]}>
              {lb('DURATION (DAYS)', 'DURÉE (JOURS)', 'المدة (أيام)')}
            </Text>
            <View style={styles.discountPresetsRow}>
              {[1, 2, 3, 5, 7].map(d => (
                <Pressable
                  key={d}
                  onPress={() => { selection(); setDiscountDays(String(d)); }}
                  style={[styles.discountPresetChip, {
                    backgroundColor: discountDays === String(d) ? colors.primary : colors.backgroundSecondary,
                    borderColor: discountDays === String(d) ? colors.primary : colors.border,
                  }]}
                >
                  <Text style={[styles.discountPresetText, { color: discountDays === String(d) ? '#FFF' : colors.textPrimary }]}>{d}{lb('d', 'j', 'ي')}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.discountModalBtns}>
              <Pressable onPress={() => setShowDiscountModal(false)} style={[styles.discountModalCancel, { borderColor: colors.border }]}>
                <Text style={[styles.discountModalCancelText, { color: colors.textSecondary }]}>{lb('Cancel', 'Annuler', 'إلغاء')}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const pct = parseInt(discountPercent) || 0;
                  const days = parseInt(discountDays) || 1;
                  if (pct < 1 || pct > 30) { Alert.alert(lb('Invalid', 'Invalide', 'غير صالح'), lb('Discount must be 1-30%', 'La remise doit être 1-30%', 'يجب أن يكون الخصم 1-30%')); return; }
                  if (days < 1 || days > 7) { Alert.alert(lb('Invalid', 'Invalide', 'غير صالح'), lb('Duration must be 1-7 days', 'La durée doit être 1-7 jours', 'المدة يجب أن تكون 1-7 أيام')); return; }
                  notifySuccess();
                  setProductDiscount(discountProductId, pct, days);
                  setShowDiscountModal(false);
                }}
                style={[styles.discountModalApply, { backgroundColor: '#EF4444' }]}
              >
                <MaterialIcons name="local-offer" size={scale(18)} color="#FFF" />
                <Text style={styles.discountModalApplyText}>{lb('Apply Discount', 'Appliquer', 'تطبيق الخصم')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <LoginModal visible={showLogin} onClose={() => setShowLogin(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: scale(32), gap: scale(12) },
  loginTitle: { fontSize: scale(22), fontWeight: '700', marginTop: scale(8) },
  loginDesc: { fontSize: scale(15), textAlign: 'center' },
  loginBtn: { paddingHorizontal: scale(40), paddingVertical: scale(14), borderRadius: borderRadius.md, marginTop: scale(8) },
  loginBtnText: { color: '#FFF', fontSize: scale(16), fontWeight: '700' },
  pageTitle: { fontSize: scale(24), fontWeight: '700', marginBottom: scale(16), marginTop: scale(8) },
  photoBox: { borderRadius: borderRadius.lg, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', paddingVertical: scale(32), paddingHorizontal: scale(24), marginBottom: scale(20), gap: scale(8) },
  photoTitle: { fontSize: scale(17), fontWeight: '700', marginTop: scale(4) },
  photoSubtitle: { fontSize: scale(13), fontWeight: '400', marginBottom: scale(8) },
  photoButtons: { flexDirection: 'row', gap: scale(10), marginTop: scale(4) },
  photoPrimaryBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(20), paddingVertical: scale(12), borderRadius: borderRadius.md, gap: scale(6) },
  photoPrimaryText: { color: '#FFF', fontSize: scale(15), fontWeight: '600' },
  photoSecondaryBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(20), paddingVertical: scale(12), borderRadius: borderRadius.md, borderWidth: 1.5, gap: scale(6) },
  photoSecondaryText: { fontSize: scale(15), fontWeight: '600' },
  imageSection: { marginBottom: scale(20), gap: scale(10) },
  previewContainer: { width: '100%', aspectRatio: 1, borderRadius: borderRadius.lg, overflow: 'hidden', borderWidth: 1, position: 'relative' },
  previewImage: { width: '100%', height: '100%' },
  coverBadge: { position: 'absolute', top: scale(12), left: scale(12), flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(10), paddingVertical: scale(5), borderRadius: borderRadius.full, gap: scale(4) },
  coverBadgeText: { color: '#FFF', fontSize: scale(11), fontWeight: '700' },
  counterBadge: { position: 'absolute', top: scale(12), right: scale(12), paddingHorizontal: scale(10), paddingVertical: scale(5), borderRadius: borderRadius.full },
  counterText: { color: '#FFF', fontSize: scale(12), fontWeight: '700' },
  thumbScroll: { paddingVertical: scale(4), gap: scale(10) },
  thumbWrapper: { alignItems: 'center', gap: scale(4) },
  thumbCard: { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: borderRadius.md, overflow: 'hidden', position: 'relative' },
  thumbImage: { width: '100%', height: '100%' },
  thumbCoverDot: { position: 'absolute', top: scale(4), left: scale(4), width: scale(16), height: scale(16), borderRadius: scale(8), alignItems: 'center', justifyContent: 'center' },
  thumbActions: { flexDirection: 'row', gap: scale(4), alignItems: 'center', justifyContent: 'center', marginTop: scale(2) },
  thumbActionBtn: { width: scale(26), height: scale(26), borderRadius: scale(13), alignItems: 'center', justifyContent: 'center' },
  setCoverBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(8), paddingVertical: scale(3), borderRadius: borderRadius.full, gap: scale(3), marginTop: scale(2) },
  setCoverText: { fontSize: scale(10), fontWeight: '600' },
  addMoreThumb: { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: borderRadius.md, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: scale(2) },
  addMoreText: { fontSize: scale(11), fontWeight: '600' },
  imageActionsRow: { flexDirection: 'row', gap: scale(8) },
  imageActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: scale(10), borderRadius: borderRadius.md, borderWidth: 1, gap: scale(6) },
  imageActionText: { fontSize: scale(14), fontWeight: '600' },
  label: { fontSize: scale(13), fontWeight: '600', marginBottom: scale(6), marginTop: scale(12), textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { height: scale(50), borderRadius: borderRadius.md, borderWidth: 1, paddingHorizontal: scale(16), fontSize: scale(16) },
  textArea: { height: scale(100), paddingTop: scale(14) },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(8) },
  catChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(12), paddingVertical: scale(8), borderRadius: borderRadius.sm, borderWidth: 1, gap: scale(6) },
  catChipText: { fontSize: scale(13), fontWeight: '500' },
  conditionRow: { flexDirection: 'row', gap: scale(8) },
  condChip: { flex: 1, paddingVertical: scale(10), borderRadius: borderRadius.sm, borderWidth: 1, alignItems: 'center' },
  condText: { fontSize: scale(13), fontWeight: '600' },
  cityPickerBtn: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
  cityPickerText: { flex: 1, fontSize: scale(16) },
  cityDropdown: { borderRadius: borderRadius.md, borderWidth: 1, marginTop: scale(-2), marginBottom: scale(4), overflow: 'hidden' },
  cityOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: scale(16), paddingVertical: scale(12), borderBottomWidth: 1 },
  cityOptionText: { fontSize: scale(15), fontWeight: '500' },
  publishBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: scale(54), borderRadius: borderRadius.md, marginTop: scale(24), gap: scale(8) },
  publishBtnText: { color: '#FFF', fontSize: scale(17), fontWeight: '700' },
  // Discount management
  discountCard: { borderRadius: borderRadius.md, borderWidth: 1, padding: scale(10), marginBottom: scale(8) },
  discountCardRow: { flexDirection: 'row', alignItems: 'center', gap: scale(10) },
  discountThumb: { width: scale(48), height: scale(48), borderRadius: scale(8) },
  discountCardTitle: { fontSize: scale(13), fontWeight: '600' },
  discountCardPrice: { fontSize: scale(14), fontWeight: '700' },
  discountActiveRow: { flexDirection: 'row', alignItems: 'center', gap: scale(6), marginTop: scale(2) },
  discountActiveBadge: { paddingHorizontal: scale(5), paddingVertical: scale(1), borderRadius: scale(4) },
  discountActiveBadgeText: { color: '#FFF', fontSize: scale(10), fontWeight: '800' },
  discountActivePrice: { fontSize: scale(13), fontWeight: '700' },
  discountRemoveBtn: { width: scale(34), height: scale(34), borderRadius: scale(17), alignItems: 'center', justifyContent: 'center' },
  discountAddBtn: { width: scale(34), height: scale(34), borderRadius: scale(17), alignItems: 'center', justifyContent: 'center' },
  // Discount Modal
  discountOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: scale(24) },
  discountModalContent: { width: '100%', borderRadius: borderRadius.lg, padding: scale(24) },
  discountModalTitle: { fontSize: scale(20), fontWeight: '700', marginBottom: scale(4) },
  discountModalSub: { fontSize: scale(13), marginBottom: scale(8) },
  discountPresetsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(8), marginTop: scale(4) },
  discountPresetChip: { paddingHorizontal: scale(14), paddingVertical: scale(10), borderRadius: borderRadius.sm, borderWidth: 1 },
  discountPresetText: { fontSize: scale(14), fontWeight: '700' },
  discountModalBtns: { flexDirection: 'row', gap: scale(10), marginTop: scale(20) },
  discountModalCancel: { flex: 1, height: scale(48), borderRadius: borderRadius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  discountModalCancelText: { fontSize: scale(15), fontWeight: '600' },
  discountModalApply: { flex: 1, height: scale(48), borderRadius: borderRadius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scale(6) },
  discountModalApplyText: { color: '#FFF', fontSize: scale(15), fontWeight: '700' },
});