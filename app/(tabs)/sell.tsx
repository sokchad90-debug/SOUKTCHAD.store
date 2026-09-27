import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView,
  KeyboardAvoidingView, Platform, Alert, Modal, ActivityIndicator, Switch, useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
// categories come from AppContext (DB tree + fallback) so seller sees enabled branches
import { COUNTRY_CITIES } from '@/constants/countries';
import { borderRadius } from '@/constants/theme';
import LoginModal from '@/components/LoginModal';
import { impactLight, impactMedium, selection, notifySuccess, notifyWarning } from '@/services/haptics';
import { scale } from '@/constants/responsive';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

const MAX_IMAGES = 5;
const THUMB_SIZE = scale(110);

interface SelectedImage { id: string; uri: string; }

export default function SellScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ editProductId?: string }>();
  const { width: windowWidth } = useWindowDimensions();
  const { colors, t, language, isLoggedIn, user, addProduct, updateProduct, enabledCountries, managedProducts, isReady, categories: appCategories } = useApp();
  // Enabled branches for the seller picker (from DB tree; includes children)
  const sellerCategories = (appCategories || []).filter(c => c.id !== 'all');
  const [showLogin, setShowLogin] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [condition, setCondition] = useState<'new' | 'used' | 'like_new'>('new');
  const [location, setLocation] = useState('');
  const [detailedAddress, setDetailedAddress] = useState('');
  const [sameCityOnly, setSameCityOnly] = useState(true);
  const [selectedDeliveryCities, setSelectedDeliveryCities] = useState<string[]>([]);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [additionalOpen, setAdditionalOpen] = useState(true);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [activePreview, setActivePreview] = useState(0);
  const [pendingImages, setPendingImages] = useState<SelectedImage[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);

  const [stock, setStock] = useState('');
  // ─── Variants editor (optional per product) ───
  const [variantsOn, setVariantsOn] = useState(false);
  const [variantSpec1, setVariantSpec1] = useState('');   // spec label 1 (e.g. Couleur / اللون)
  const [variantSpec2, setVariantSpec2] = useState('');   // spec label 2 optional (e.g. Taille / RAM)
  const [variantItems, setVariantItems] = useState<{ id: string; image: string; value1: string; value2: string; price: string; stock: string }[]>([]);
  const [maxOrderQty, setMaxOrderQty] = useState('');
  const [editingProductId, setEditingProductId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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
  const lb = useCallback((en: string, fr: string, ar: string) => isFr ? fr : isAr ? ar : en, [isAr, isFr]);
  const selectedCategory = sellerCategories.find(cat => cat.id === selectedCat);
  const filteredCategories = useMemo(() => sellerCategories.filter(cat => (cat.name[language] || cat.name.en).toLowerCase().includes(categorySearch.trim().toLowerCase())), [sellerCategories, categorySearch, language]);
  const filteredCities = useMemo(() => availableCities.filter(city => city.toLowerCase().includes(citySearch.trim().toLowerCase())), [availableCities, citySearch]);
  const previewHeight = Math.max(scale(220), Math.min(windowWidth * 1.15, scale(520)));

  const resetForm = useCallback(() => {
    setTitle(''); setDescription(''); setPrice(''); setSelectedCat(''); setLocation(''); setDetailedAddress('');
    setStock(''); setMaxOrderQty(''); setImages([]); setActivePreview(0); setVariantsOn(false);
    setVariantSpec1(''); setVariantSpec2(''); setVariantItems([]); setEditingProductId('');
    setSameCityOnly(true); setSelectedDeliveryCities([]); setDeliveryType('none'); setDeliveryFee('');
  }, []);

  const beginEdit = useCallback((product: any) => {
    if (!product || product.sellerId !== user?.id) { notifyWarning(); return; }
    setEditingProductId(product.id);
    setTitle(product.title?.[language] || product.title?.en || '');
    setDescription(product.description?.[language] || product.description?.en || '');
    setPrice(String(product.price || '')); setStock(String(product.stock ?? '')); setMaxOrderQty(String(product.maxOrderQty ?? ''));
    setSelectedCat(product.categoryId || ''); setCondition(product.condition || 'new'); setLocation(product.location || '');
    setImages((product.images || []).slice(0, 5).map((uri: string, i: number) => ({ id: `existing_${i}`, uri })));
    setWarrantyEnabled(Boolean(product.warrantyDays)); setWarrantyDays(String(product.warrantyDays || 7));
    setDeliveryType(product.deliveryType || 'none'); setDeliveryFee(String(product.deliveryFee ?? ''));
    setSameCityOnly(product.sameCityOnly !== false); setSelectedDeliveryCities(product.deliveryCities || []);
  }, [language, user?.id]);

  useEffect(() => {
    const editProductId = Array.isArray(params.editProductId) ? params.editProductId[0] : params.editProductId;
    if (!editProductId || editingProductId === editProductId) return;
    const product = managedProducts.find(item => item.id === editProductId);
    if (product) beginEdit(product);
  }, [beginEdit, editingProductId, managedProducts, params.editProductId]);

  // Determine view state - but always use single return
  const showBuyerBlock = isReady && isLoggedIn && user?.role === 'buyer';
  const showNotLoggedIn = isReady && !isLoggedIn;
  const showSellForm = isReady && isLoggedIn && user?.role !== 'buyer';

  const pickImages = useCallback(async () => {
    if (images.length >= MAX_IMAGES) { Alert.alert(lb('Limit Reached', 'Limite atteinte', 'تم بلوغ الحد الأقصى')); return; }
    const remaining = MAX_IMAGES - images.length;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert(lb('Permission Required', 'Permission requise', 'إذن مطلوب')); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, allowsMultipleSelection: true, selectionLimit: remaining, quality: 1, exif: true });
    if (!result.canceled && result.assets.length > 0) {
      impactLight();
      const newImages: SelectedImage[] = result.assets.slice(0, remaining).map((asset, i) => ({ id: `img_${Date.now()}_${i}`, uri: asset.uri }));
      setPendingImages(newImages);
      setPreviewIndex(0);
    }
  }, [images.length, lb]);

  const takePhoto = useCallback(async () => {
    if (images.length >= MAX_IMAGES) { Alert.alert(lb('Limit Reached', 'Limite atteinte', 'تم بلوغ الحد الأقصى')); return; }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert(lb('Permission Required', 'Permission requise', 'إذن مطلوب')); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 1, exif: true });
    if (!result.canceled && result.assets.length > 0) {
      impactLight();
      const sourceUri = result.assets[0].uri;
      try {
        const normalized = await ImageManipulator.manipulateAsync(sourceUri, [], { compress: 0.85 });
        setImages(prev => [...prev, { id: `img_${Date.now()}`, uri: normalized.uri }]);
      } catch {
        setImages(prev => [...prev, { id: `img_${Date.now()}`, uri: sourceUri }]);
      }
    }
  }, [images.length, lb]);
  const commitImages = useCallback(async () => {
    const list: SelectedImage[] = [];
    for (const img of pendingImages) {
      try {
        // Empty transforms normalize EXIF orientation; compression preserves the
        // complete source frame and aspect ratio without a forced square crop.
        const normalized = await ImageManipulator.manipulateAsync(img.uri, [], { compress: 0.85 });
        list.push({ ...img, uri: normalized.uri });
      } catch { list.push(img); }
    }
    setImages(prev => [...prev, ...list].slice(0, MAX_IMAGES));
    setPendingImages([]);
  }, [pendingImages]);

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
  const [warrantyEnabled, setWarrantyEnabled] = useState(false);
  const [warrantyDays, setWarrantyDays] = useState('7');
  const [deliveryType, setDeliveryType] = useState<'none' | 'free' | 'paid'>('none');
  const [deliveryFee, setDeliveryFee] = useState('');

  const pickVariantImage = useCallback(async (idx: number) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1, exif: true });
    if (!result.canceled && result.assets.length > 0) {
      const sourceUri = result.assets[0].uri;
      let uri = sourceUri;
      try {
        const normalized = await ImageManipulator.manipulateAsync(sourceUri, [], { compress: 0.85 });
        uri = normalized.uri;
      } catch {}
      setVariantItems(prev => prev.map((x, i) => i === idx ? { ...x, image: uri } : x));
    }
  }, []);

  const addVariantItem = useCallback(() => {
    setVariantItems(prev => [...prev, { id: 'v' + Date.now(), image: '', value1: '', value2: '', price: '', stock: '' }]);
  }, []);

  // Wire the add-version button to the helper (defined here to keep deps simple)
  React.useEffect(() => { /* noop — addVariantItem used in JSX below */ }, []);

  const handlePublish = async () => {
    if (isSaving) return;
    if (!title.trim() || !price.trim() || !selectedCat || !location.trim()) {
      Alert.alert(lb('Required Fields', 'Champs requis', 'حقول مطلوبة'), lb('Please fill all required fields.', 'Veuillez remplir tous les champs.', 'يرجى ملء جميع الحقول.'));
      return;
    }
    if (images.length === 0) {
      Alert.alert(lb('Photos Required', 'Photos requises', 'الصور مطلوبة'), lb('Add at least one photo.', 'Ajoutez au moins une photo.', 'أضف صورة واحدة على الأقل.'));
      return;
    }
    setIsSaving(true);
    try {
      const payload = { title: { en: title, fr: title, ar: title }, description: { en: description, fr: description, ar: description }, price: parseInt(price) || 0, images: images.map(img => img.uri), categoryId: selectedCat, sellerId: user?.id || 'user1', condition: hideCondition ? 'new' : condition, location, stock: parseInt(stock) || 0, maxOrderQty: parseInt(maxOrderQty) || undefined, warrantyDays: warrantyEnabled ? (parseInt(warrantyDays) || 7) : undefined,
        ...(variantsOn && variantItems.length > 0 ? {
          variants: variantItems.filter(v => v.price.trim()).map((v, i) => ({
            id: 'v' + Date.now() + '_' + i,
            specs: [
              ...(variantSpec1.trim() ? [{ label: { en: variantSpec1, fr: variantSpec1, ar: variantSpec1 }, value: v.value1 || '' }] : []),
              ...(variantSpec2.trim() ? [{ label: { en: variantSpec2, fr: variantSpec2, ar: variantSpec2 }, value: v.value2 || '' }] : []),
            ],
            image: v.image || (images[i] ? images[i].uri : ''),
            price: parseInt(v.price) || 0,
            stock: parseInt(v.stock) || 0,
          })),
        } : {}), deliveryType: deliveryType !== 'none' ? deliveryType : undefined, deliveryFee: deliveryType === 'paid' ? (parseInt(deliveryFee) || 0) : undefined, sameCityOnly, deliveryCities: sameCityOnly ? [location] : selectedDeliveryCities, deliveryMethods: ['motorcycle', 'taxi'] } as any;
      if (editingProductId) {
        if (!(await updateProduct(editingProductId, payload))) throw new Error('update failed');
      } else {
        await addProduct(payload);
      }
      notifySuccess();
      Alert.alert(editingProductId ? lb('Saved', 'Modifications enregistrées', 'تم حفظ التعديلات') : lb('Published!', 'Publié!', 'تم النشر!'));
      resetForm();
    } catch {
      notifyWarning();
      Alert.alert(lb('Unable to save', 'Enregistrement impossible', 'تعذر الحفظ'));
    } finally {
      setIsSaving(false);
    }
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
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: scale(16), paddingBottom: scale(96) + insets.bottom, paddingTop: scale(8) }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.formHeader}>
            <Pressable accessibilityRole="button" accessibilityLabel={lb('Go back', 'Retour', 'رجوع')} onPress={() => router.back()} style={styles.headerBackBtn}>
              <MaterialIcons name={isAr ? 'arrow-forward' : 'arrow-back'} size={scale(24)} color={colors.textPrimary} />
            </Pressable>
            <Image source={require('@/assets/branding/sokchad-logo-header.png')} style={styles.headerLogo} contentFit="contain" />
            <View style={styles.headerSpacer} />
          </View>
          <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>{editingProductId ? lb('Edit product', 'Modifier le produit', 'تعديل المنتج') : lb('Sell a product', 'Vendre un produit', 'بيع منتج')}</Text>
          <Text style={[styles.pageSubtitle, { color: colors.textSecondary }]}>{lb('Add photos and your product details.', 'Ajouter des photos et les détails de votre produit.', 'أضف الصور وتفاصيل منتجك.')}</Text>
          {editingProductId ? (
            <Pressable accessibilityRole="button" onPress={resetForm} style={[styles.editCancelBtn, { borderColor: colors.border }]}>
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>{lb('Cancel editing', 'Annuler la modification', 'إلغاء التعديل')}</Text>
            </Pressable>
          ) : null}

          {images.length > 0 ? (
            <View style={styles.imageSection}>
              <View style={[styles.previewContainer, { height: previewHeight, backgroundColor: '#F1F0FB', borderColor: colors.border }]}>
                <Image source={{ uri: images[activePreview]?.uri }} style={[styles.previewImage, { backgroundColor: '#FFFFFF' }]} contentFit="contain" transition={200} />
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
                    <Pressable onPress={() => setActivePreview(index)} style={[styles.thumbCard, { borderColor: activePreview === index ? '#5B48D9' : colors.border, borderWidth: activePreview === index ? 2.5 : 1 }]}>
                      <Image source={{ uri: img.uri }} style={[styles.thumbImage, { backgroundColor: '#FFFFFF' }]} contentFit="contain" />
                      <View style={styles.thumbCounter}><Text style={styles.thumbCounterText}>{index + 1}/{images.length}</Text></View>
                      {index === 0 ? <View style={[styles.thumbCoverDot, { backgroundColor: colors.primary }]}><MaterialIcons name="star" size={scale(8)} color="#FFF" /></View> : null}
                    </Pressable>
                    <View style={styles.thumbActions}>
                      {index > 0 ? <Pressable onPress={() => moveImage(index, 'left')} style={[styles.thumbActionBtn, { backgroundColor: colors.surfaceElevated }]} hitSlop={scale(4)}><MaterialIcons name="chevron-left" size={scale(14)} color={colors.textSecondary} /></Pressable> : <View style={styles.thumbActionBtn} />}
                      <Pressable onPress={() => removeImage(img.id)} style={[styles.thumbActionBtn, { backgroundColor: colors.errorLight }]} hitSlop={scale(4)}><MaterialIcons name="close" size={scale(14)} color={colors.error} /></Pressable>
                      {index < images.length - 1 ? <Pressable onPress={() => moveImage(index, 'right')} style={[styles.thumbActionBtn, { backgroundColor: colors.surfaceElevated }]} hitSlop={scale(4)}><MaterialIcons name="chevron-right" size={scale(14)} color={colors.textSecondary} /></Pressable> : <View style={styles.thumbActionBtn} />}
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
                      <Text style={[styles.addMoreText, { color: colors.textTertiary }]}>+ {images.length}/{MAX_IMAGES}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </ScrollView>

              <Text style={[styles.fullPhotoHint, { color: colors.textSecondary }]}>{lb('Complete photo · No cropping.', 'Photo entière · Sans recadrage.', 'الصورة كاملة · بلا قص.')}</Text>

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

          <View style={[styles.primaryFieldsRow, windowWidth < 720 && styles.primaryFieldsStack]}>
            <View style={styles.primaryField}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{t('price')} (FCFA) *</Text>
              <TextInput accessibilityLabel={`${t('price')} (FCFA)`} style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]} placeholder="0" placeholderTextColor={colors.textTertiary} value={price} onChangeText={setPrice} keyboardType="numeric" />
            </View>
            <View style={styles.primaryField}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{t('selectCategory')} *</Text>
              <Pressable accessibilityRole="button" onPress={() => setShowCategoryPicker(true)} style={[styles.input, styles.pickerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {selectedCategory ? <MaterialIcons name={selectedCategory.icon as any} size={scale(20)} color={selectedCategory.color || colors.primary} /> : null}
                <Text style={[styles.pickerButtonText, { color: selectedCategory ? colors.textPrimary : colors.textTertiary }]} numberOfLines={1}>{selectedCategory ? (selectedCategory.name[language] || selectedCategory.name.en) : lb('Select category', 'Choisir la catégorie', 'اختر الفئة')}</Text>
                <MaterialIcons name="expand-more" size={scale(22)} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          <Pressable accessibilityRole="button" accessibilityState={{ expanded: additionalOpen }} onPress={() => setAdditionalOpen(value => !value)} style={[styles.accordionHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.accordionTitle, { color: colors.textPrimary }]}>{lb('Additional options', 'Options supplémentaires', 'خيارات إضافية')}</Text>
            <MaterialIcons name={additionalOpen ? 'expand-less' : 'expand-more'} size={scale(24)} color={colors.primary} />
          </Pressable>
          {additionalOpen ? <View style={styles.accordionBody}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{lb('Return Guarantee (optional)', 'Garantie de retour (facultatif)', 'ضمان الاسترجاع (اختياري)')}</Text>
          <View style={[styles.conditionRow, { gap: scale(8) }]}>
            <Pressable onPress={() => setWarrantyEnabled(!warrantyEnabled)} style={[styles.condChip, { backgroundColor: warrantyEnabled ? colors.primary : colors.surface, borderColor: warrantyEnabled ? colors.primary : colors.border }]}>
              <Text style={[styles.condText, { color: warrantyEnabled ? '#FFF' : colors.textPrimary }]}>{lb('Warranty enabled', 'Garantie activée', 'ضمان مُفعّل')}</Text>
            </Pressable>
            {warrantyEnabled ? (
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border, width: scale(90), height: scale(34) }]}
                placeholder="7"
                placeholderTextColor={colors.textTertiary}
                value={warrantyDays}
                onChangeText={setWarrantyDays}
                keyboardType="numeric"
              />
            ) : null}
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

          {/* ─── Variants (optional) ─── */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: scale(16), marginBottom: scale(8) }}>
            <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 0 }]}>
              {lb('PRODUCT OPTIONS (versions)', 'OPTIONS DU PRODUIT (versions)', 'خيارات المنتج (النسخ)')}
            </Text>
            <Switch value={variantsOn} onValueChange={(v: boolean) => { impactLight(); setVariantsOn(v); }} trackColor={{ true: colors.primary, false: colors.borderLight }} />
          </View>
          {variantsOn ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: scale(12), borderWidth: 1, borderColor: colors.border, padding: scale(12), gap: scale(8) }}>
              <View style={{ flexDirection: isAr ? 'row-reverse' : 'row', gap: scale(8) }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: scale(11), color: colors.textTertiary, marginBottom: scale(4) }}>
                    {lb('Spec 1 (e.g. Color)', 'Caractéristique 1 (ex: Couleur)', 'الخاصية 1 (مثال: اللون)')}
                  </Text>
                  <TextInput style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: colors.border }]} placeholder={lb('Color', 'Couleur', 'اللون')} placeholderTextColor={colors.textTertiary} value={variantSpec1} onChangeText={setVariantSpec1} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: scale(11), color: colors.textTertiary }}>
                    {lb('Spec 2 optional (Size/RAM/Storage/Weight)', 'Caractéristique 2 (Taille/RAM/Stockage/Poids)', 'الخاصية 2 (مقاس/ذاكرة/تخزين/وزن)')}
                  </Text>
                  <TextInput style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: colors.border }]} placeholder={lb('Size', 'Taille', 'المقاس')} placeholderTextColor={colors.textTertiary} value={variantSpec2} onChangeText={setVariantSpec2} />
                </View>
              </View>
              {variantItems.map((it, idx) => (
                <View key={it.id} style={{ borderWidth: 1, borderColor: colors.borderLight, borderRadius: scale(10), padding: scale(8), gap: scale(6) }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(8) }}>
                    {it.image ? (
                      <Image source={{ uri: it.image }} style={{ width: scale(44), height: scale(44), borderRadius: scale(8), backgroundColor: '#F6F6FB' }} contentFit="contain" />
                    ) : null}
                    <Pressable onPress={() => pickVariantImage(idx)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: scale(6), borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: scale(8), padding: scale(8) }}>
                      <MaterialIcons name="add-a-photo" size={scale(16)} color={colors.primary} />
                      <Text style={{ fontSize: scale(11), color: colors.textSecondary }}>
                        {lb('Variant photo (this version)', 'Photo de cette version', 'صورة هذه النسخة')}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => setVariantItems(prev => prev.filter(x => x.id !== it.id))} hitSlop={scale(8)}>
                      <MaterialIcons name="delete-outline" size={scale(20)} color={colors.error} />
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: isAr ? 'row-reverse' : 'row', gap: scale(6) }}>
                    <TextInput style={[styles.input, { flex: 1, backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: colors.border }]} placeholder={variantSpec1 || lb('Value 1', 'Valeur 1', 'القيمة 1')} placeholderTextColor={colors.textTertiary} value={it.value1} onChangeText={(t2) => setVariantItems(prev => prev.map(x => x.id === it.id ? { ...x, value1: t2 } : x))} />
                    <TextInput style={[styles.input, { flex: 1, backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: colors.border }]} placeholder={variantSpec2 || lb('Value 2 (opt.)', 'Valeur 2 (opt.)', 'القيمة 2')} placeholderTextColor={colors.textTertiary} value={it.value2} onChangeText={(t2) => setVariantItems(prev => prev.map(x => x.id === it.id ? { ...x, value2: t2 } : x))} />
                  </View>
                  <View style={{ flexDirection: isAr ? 'row-reverse' : 'row', gap: scale(6) }}>
                    <TextInput style={[styles.input, { flex: 1, backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: colors.border }]} placeholder={lb('Price FCFA', 'Prix FCFA', 'السعر FCFA')} placeholderTextColor={colors.textTertiary} value={it.price} onChangeText={(t2) => setVariantItems(prev => prev.map(x => x.id === it.id ? { ...x, price: t2 } : x))} keyboardType="numeric" />
                    <TextInput style={[styles.input, { flex: 1, backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: colors.border }]} placeholder={lb('Stock', 'Stock', 'المخزون')} placeholderTextColor={colors.textTertiary} value={it.stock} onChangeText={(t2) => setVariantItems(prev => prev.map(x => x.id === it.id ? { ...x, stock: t2 } : x))} keyboardType="numeric" />
                  </View>
                </View>
              ))}
              <Pressable onPress={() => addVariantItem()} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scale(6), padding: scale(10), borderRadius: scale(10), borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.primary }}>
                <MaterialIcons name="add" size={scale(18)} color={colors.primary} />
                <Text style={{ fontSize: scale(13), fontWeight: '700', color: colors.primary }}>
                  {lb('Add a version', 'Ajouter une version', 'إضافة نسخة')}
                </Text>
              </Pressable>
            </View>
          ) : null}
          </View> : null}

          <Pressable accessibilityRole="button" accessibilityState={{ expanded: deliveryOpen }} onPress={() => setDeliveryOpen(value => !value)} style={[styles.accordionHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.accordionTitle, { color: colors.textPrimary }]}>{lb('Delivery and location', 'Livraison et emplacement', 'التوصيل والموقع')}</Text>
            <MaterialIcons name={deliveryOpen ? 'expand-less' : 'expand-more'} size={scale(24)} color={colors.primary} />
          </Pressable>
          {deliveryOpen ? <View style={styles.accordionBody}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{lb('Delivery (optional)', 'Livraison (facultatif)', 'التوصيل (اختياري)')}</Text>
          <View style={[styles.conditionRow, { gap: scale(8) }]}>
            <Pressable onPress={() => setDeliveryType('free')} style={[styles.condChip, { backgroundColor: deliveryType === 'free' ? colors.success : colors.surface, borderColor: deliveryType === 'free' ? colors.success : colors.border }]}>
              <Text style={[styles.condText, { color: deliveryType === 'free' ? '#FFF' : colors.textPrimary }]}>{lb('Free delivery', 'Livraison gratuite', 'توصيل مجاني')}</Text>
            </Pressable>
            <Pressable onPress={() => setDeliveryType('paid')} style={[styles.condChip, { backgroundColor: deliveryType === 'paid' ? colors.primary : colors.surface, borderColor: deliveryType === 'paid' ? colors.primary : colors.border }]}>
              <Text style={[styles.condText, { color: deliveryType === 'paid' ? '#FFF' : colors.textPrimary }]}>{lb('Buyer pays', 'À la charge de l’acheteur', 'على المشتري')}</Text>
            </Pressable>
          </View>
          {deliveryType === 'paid' ? <TextInput accessibilityLabel={lb('Delivery fee (FCFA)', 'Frais de livraison (FCFA)', 'تكلفة التوصيل (FCFA)')} style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]} placeholder="0" placeholderTextColor={colors.textTertiary} value={deliveryFee} onChangeText={setDeliveryFee} keyboardType="numeric" /> : null}

          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('location')} *</Text>
          <Pressable
            onPress={() => setShowCityPicker(true)}
            style={[styles.input, styles.cityPickerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <MaterialIcons name="location-on" size={scale(20)} color={location ? colors.primary : colors.textTertiary} />
            <Text style={[styles.cityPickerText, { color: location ? colors.textPrimary : colors.textTertiary }]}>
              {location || lb('Select City', 'Choisir la ville', 'اختر المدينة')}
            </Text>
            <MaterialIcons name="expand-more" size={scale(22)} color={colors.textSecondary} />
          </Pressable>

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

          {/* ─── Delivery Options ─── */}
          <Text style={[styles.label, { color: colors.textSecondary, marginTop: scale(16) }]}>
            {lb('DELIVERY OPTIONS', 'OPTIONS DE LIVRAISON', 'خيارات التوصيل')}
          </Text>
          <Pressable
            onPress={() => { setSameCityOnly(true); setSelectedDeliveryCities([]); }}
            style={[styles.deliveryOption, { backgroundColor: sameCityOnly ? colors.primary + '12' : colors.surface, borderColor: sameCityOnly ? colors.primary : colors.border }]}
          >
            <MaterialIcons name={sameCityOnly ? 'radio-button-checked' : 'radio-button-unchecked'} size={scale(20)} color={sameCityOnly ? colors.primary : colors.textTertiary} />
            <Text style={[styles.deliveryOptionText, { color: colors.textPrimary }]}>
              {lb('Same city only', 'Même ville uniquement', 'نفس المدينة فقط')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => { setSameCityOnly(false); if (selectedDeliveryCities.length === 0) setSelectedDeliveryCities([location || "N'Djamena"]); }}
            style={[styles.deliveryOption, { backgroundColor: !sameCityOnly ? colors.primary + '12' : colors.surface, borderColor: !sameCityOnly ? colors.primary : colors.border }]}
          >
            <MaterialIcons name={!sameCityOnly ? 'radio-button-checked' : 'radio-button-unchecked'} size={scale(20)} color={!sameCityOnly ? colors.primary : colors.textTertiary} />
            <Text style={[styles.deliveryOptionText, { color: colors.textPrimary }]}>
              {lb('Specific cities', 'Villes spécifiques', 'مدن محددة')}
            </Text>
          </Pressable>
          {!sameCityOnly ? (
            <View style={styles.deliveryCitiesContainer}>
              {["N'Djamena", 'Moundou', 'Abeche', 'Sarh', 'Kelo', 'Bongor', 'Doba', 'Mongo', 'Pala'].map(city => {
                const selected = selectedDeliveryCities.includes(city);
                return (
                  <Pressable
                    key={city}
                    onPress={() => {
                      setSelectedDeliveryCities(prev => selected ? prev.filter(c => c !== city) : [...prev, city]);
                    }}
                    style={[styles.cityChip, { backgroundColor: selected ? colors.primary : colors.surface, borderColor: selected ? colors.primary : colors.border }]}
                  >
                    <Text style={{ color: selected ? '#FFF' : colors.textSecondary, fontSize: scale(12), fontWeight: '600' }}>{city}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          </View> : null}

        </ScrollView>
        <View style={[styles.stickySaveBar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, scale(8)) }]}>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: isSaving, busy: isSaving }} onPress={handlePublish} disabled={isSaving} style={({ pressed }) => [styles.publishBtn, { backgroundColor: '#5B48D9', opacity: pressed || isSaving ? 0.8 : 1 }]}>
            {isSaving ? <ActivityIndicator size="small" color="#FFF" /> : <MaterialIcons name="publish" size={scale(22)} color="#FFF" />}
            <Text style={styles.publishBtnText}>{isSaving ? lb('Saving...', 'Enregistrement...', 'جارٍ الحفظ...') : editingProductId ? lb('Save changes', 'Enregistrer les modifications', 'حفظ التعديلات') : lb('Publish listing', "Publier l'annonce", 'نشر الإعلان')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      ) : null}

      <Modal visible={showCategoryPicker} transparent animationType="slide" onRequestClose={() => setShowCategoryPicker(false)}>
        <View style={[styles.pickerOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.pickerSheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + scale(12) }]}>
            <View style={styles.pickerHandle} />
            <Text style={[styles.pickerTitle, { color: colors.textPrimary }]}>{lb('Select category', 'Choisir la catégorie', 'اختر الفئة')}</Text>
            <View style={[styles.searchBox, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <MaterialIcons name="search" size={scale(20)} color={colors.textTertiary} />
              <TextInput accessibilityLabel={lb('Search categories', 'Rechercher une catégorie', 'ابحث عن فئة')} style={[styles.searchInput, { color: colors.textPrimary }]} value={categorySearch} onChangeText={setCategorySearch} placeholder={lb('Search...', 'Rechercher...', 'بحث...')} placeholderTextColor={colors.textTertiary} returnKeyType="search" />
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.pickerList}>
              {filteredCategories.map(cat => <Pressable key={cat.id} onPress={() => { selection(); setSelectedCat(cat.id); setShowCategoryPicker(false); setCategorySearch(''); }} style={[styles.pickerRow, { borderBottomColor: colors.borderLight }]}>
                <MaterialIcons name={cat.icon as any} size={scale(22)} color={cat.color || colors.primary} />
                <Text style={[styles.pickerRowText, { color: colors.textPrimary }]}>{cat.name[language] || cat.name.en}</Text>
                {selectedCat === cat.id ? <MaterialIcons name="check" size={scale(20)} color={colors.primary} /> : null}
              </Pressable>)}
              {filteredCategories.length === 0 ? <Text style={[styles.emptyPickerText, { color: colors.textSecondary }]}>{lb('No categories found', 'Aucune catégorie trouvée', 'لا توجد فئات')}</Text> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showCityPicker} transparent animationType="slide" onRequestClose={() => setShowCityPicker(false)}>
        <View style={[styles.pickerOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.pickerSheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + scale(12) }]}>
            <View style={styles.pickerHandle} />
            <Text style={[styles.pickerTitle, { color: colors.textPrimary }]}>{lb('Select city', 'Choisir la ville', 'اختر المدينة')}</Text>
            <View style={[styles.searchBox, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <MaterialIcons name="search" size={scale(20)} color={colors.textTertiary} />
              <TextInput accessibilityLabel={lb('Search cities', 'Rechercher une ville', 'ابحث عن مدينة')} style={[styles.searchInput, { color: colors.textPrimary }]} value={citySearch} onChangeText={setCitySearch} placeholder={lb('Search...', 'Rechercher...', 'بحث...')} placeholderTextColor={colors.textTertiary} returnKeyType="search" />
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.pickerList}>
              {filteredCities.map(city => <Pressable key={city} onPress={() => { selection(); setLocation(city); setShowCityPicker(false); setCitySearch(''); }} style={[styles.pickerRow, { borderBottomColor: colors.borderLight }]}>
                <MaterialIcons name="location-on" size={scale(22)} color={colors.primary} />
                <Text style={[styles.pickerRowText, { color: colors.textPrimary }]}>{city}</Text>
                {location === city ? <MaterialIcons name="check" size={scale(20)} color={colors.primary} /> : null}
              </Pressable>)}
              {filteredCities.length === 0 ? <Text style={[styles.emptyPickerText, { color: colors.textSecondary }]}>{lb('No cities found', 'Aucune ville trouvée', 'لا توجد مدن')}</Text> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <LoginModal visible={showLogin} onClose={() => setShowLogin(false)} />

      {/* Preview the complete frame before compression/orientation normalization. */}
      <Modal visible={pendingImages.length > 0} transparent animationType="fade" onRequestClose={() => setPendingImages([])}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: scale(20) }}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: scale(16), padding: scale(14), alignItems: 'center' }}>
            <Image
              source={{ uri: pendingImages[previewIndex]?.uri || pendingImages[0]?.uri }}
              style={{ width: scale(260), height: scale(260), borderRadius: scale(12), backgroundColor: '#F1F5F9', resizeMode: 'contain' }}
              contentFit="contain"
            />
            <Text style={{ marginTop: scale(10), fontSize: scale(14), fontWeight: '800', color: '#0F172A', fontFamily: 'Cairo-Bold' }}>
              {lb('Product image preview', 'Aperçu de l\'image', 'معاينة صورة المنتج')}
            </Text>
            <Text style={{ marginTop: scale(4), fontSize: scale(12), color: '#64748B', textAlign: 'center', fontFamily: 'Cairo-Regular' }}>
              {lb('The complete photo will be kept and compressed without cropping.', 'La photo complète sera conservée et compressée sans recadrage.', 'ستُحفظ الصورة كاملة وتُضغط من دون قص.')}
            </Text>
            <View style={{ flexDirection: 'row', gap: scale(10), marginTop: scale(12) }}>
              <Pressable onPress={commitImages} style={{ paddingVertical: scale(10), paddingHorizontal: scale(16), borderRadius: scale(10), backgroundColor: '#5B48D9' }}>
                <Text style={{ color: '#FFF', fontWeight: '700', fontFamily: 'Cairo-Bold' }}>{lb('Use photos', 'Utiliser les photos', 'استخدام الصور')}</Text>
              </Pressable>
            </View>
            {pendingImages.length > 1 ? (
              <Pressable onPress={() => setPreviewIndex((i) => (i + 1) % pendingImages.length)} hitSlop={scale(8)} style={{ marginTop: scale(10) }}>
                <Text style={{ color: '#4C1CEA', fontWeight: '700', fontFamily: 'Cairo-Bold' }}>
                  {lb('Next image', 'Image suivante', 'الصورة التالية')} ({previewIndex + 1}/{pendingImages.length})
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
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
  pageSubtitle: { fontSize: scale(14), marginBottom: scale(18), marginTop: scale(-10) },
  formHeader: { minHeight: scale(52), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerBackBtn: { width: scale(48), height: scale(48), alignItems: 'center', justifyContent: 'center' },
  headerLogo: { width: scale(126), height: scale(38) },
  headerSpacer: { width: scale(48) },
  photoBox: { borderRadius: borderRadius.lg, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', paddingVertical: scale(32), paddingHorizontal: scale(24), marginBottom: scale(20), gap: scale(8) },
  photoTitle: { fontSize: scale(17), fontWeight: '700', marginTop: scale(4) },
  photoSubtitle: { fontSize: scale(13), fontWeight: '400', marginBottom: scale(8) },
  photoButtons: { flexDirection: 'row', gap: scale(10), marginTop: scale(4) },
  photoPrimaryBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(20), paddingVertical: scale(12), borderRadius: borderRadius.md, gap: scale(6) },
  photoPrimaryText: { color: '#FFF', fontSize: scale(15), fontWeight: '600' },
  photoSecondaryBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(20), paddingVertical: scale(12), borderRadius: borderRadius.md, borderWidth: 1.5, gap: scale(6) },
  photoSecondaryText: { fontSize: scale(15), fontWeight: '600' },
  imageSection: { marginBottom: scale(20), gap: scale(10) },
  previewContainer: { width: '100%', minHeight: scale(220), maxHeight: scale(520), borderRadius: scale(16), overflow: 'hidden', borderWidth: 1, position: 'relative' },
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
  thumbCounter: { position: 'absolute', bottom: scale(4), right: scale(4), backgroundColor: 'rgba(0,0,0,0.62)', borderRadius: scale(8), paddingHorizontal: scale(5), paddingVertical: scale(2) },
  thumbCounterText: { color: '#FFF', fontSize: scale(10), fontWeight: '700' },
  thumbActions: { flexDirection: 'row', gap: scale(4), alignItems: 'center', justifyContent: 'center', marginTop: scale(2) },
  thumbActionBtn: { width: scale(26), height: scale(26), borderRadius: scale(13), alignItems: 'center', justifyContent: 'center' },
  setCoverBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(8), paddingVertical: scale(3), borderRadius: borderRadius.full, gap: scale(3), marginTop: scale(2) },
  setCoverText: { fontSize: scale(10), fontWeight: '600' },
  addMoreThumb: { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: borderRadius.md, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: scale(2) },
  addMoreText: { fontSize: scale(11), fontWeight: '600' },
  imageActionsRow: { flexDirection: 'row', gap: scale(8) },
  imageActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: scale(10), borderRadius: borderRadius.md, borderWidth: 1, gap: scale(6) },
  imageActionText: { fontSize: scale(14), fontWeight: '600' },
  fullPhotoHint: { fontSize: scale(12), textAlign: 'center' },
  label: { fontSize: scale(13), fontWeight: '600', marginBottom: scale(6), marginTop: scale(12), textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { height: scale(50), borderRadius: borderRadius.md, borderWidth: 1, paddingHorizontal: scale(16), fontSize: scale(16) },
  textArea: { height: scale(100), paddingTop: scale(14) },
  primaryFieldsRow: { flexDirection: 'row', gap: scale(12), alignItems: 'flex-end' },
  primaryFieldsStack: { flexDirection: 'column', alignItems: 'stretch', gap: 0 },
  primaryField: { flex: 1, minWidth: scale(220) },
  pickerButton: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
  pickerButtonText: { flex: 1, fontSize: scale(15) },
  accordionHeader: { minHeight: scale(52), borderRadius: scale(12), borderWidth: 1, paddingHorizontal: scale(14), marginTop: scale(16), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  accordionTitle: { fontSize: scale(15), fontWeight: '700' },
  accordionBody: { paddingHorizontal: scale(2), paddingBottom: scale(8) },
  pickerOverlay: { flex: 1, justifyContent: 'flex-end' },
  pickerSheet: { maxHeight: '78%', borderTopLeftRadius: scale(20), borderTopRightRadius: scale(20), paddingHorizontal: scale(16), paddingTop: scale(8) },
  pickerHandle: { width: scale(44), height: scale(4), borderRadius: scale(2), backgroundColor: '#C7C3DD', alignSelf: 'center', marginBottom: scale(12) },
  pickerTitle: { fontSize: scale(19), fontWeight: '700', marginBottom: scale(12), textAlign: 'center' },
  searchBox: { minHeight: scale(50), flexDirection: 'row', alignItems: 'center', gap: scale(8), borderWidth: 1, borderRadius: scale(12), paddingHorizontal: scale(12), marginBottom: scale(8) },
  searchInput: { flex: 1, fontSize: scale(15), minHeight: scale(48) },
  pickerList: { maxHeight: scale(420) },
  pickerRow: { minHeight: scale(52), flexDirection: 'row', alignItems: 'center', gap: scale(12), borderBottomWidth: StyleSheet.hairlineWidth },
  pickerRowText: { flex: 1, fontSize: scale(15), fontWeight: '500' },
  emptyPickerText: { textAlign: 'center', paddingVertical: scale(28), fontSize: scale(14) },
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
  deliveryOption: {
    flexDirection: 'row', alignItems: 'center', gap: scale(10),
    paddingVertical: scale(12), paddingHorizontal: scale(14),
    borderRadius: scale(12), borderWidth: 1, marginBottom: scale(8),
  },
  deliveryOptionText: { fontSize: scale(14), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },
  deliveryCitiesContainer: {
    flexDirection: 'row', flexWrap: 'wrap', gap: scale(8),
    paddingHorizontal: scale(14), paddingBottom: scale(8),
  },
  cityChip: {
    paddingHorizontal: scale(12), paddingVertical: scale(6),
    borderRadius: scale(16), borderWidth: 1,
  },
  stickySaveBar: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: scale(16), paddingTop: scale(8) },
  publishBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: scale(54), borderRadius: borderRadius.md, gap: scale(8) },
  publishBtnText: { color: '#FFF', fontSize: scale(17), fontWeight: '700' },
  editCancelBtn: { minHeight: scale(48), borderRadius: borderRadius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: scale(12) },
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
  productMenu: { width: '100%', borderRadius: scale(16), padding: scale(16) },
  productMenuItem: { minHeight: scale(48), flexDirection: 'row', alignItems: 'center', gap: scale(12), paddingHorizontal: scale(8) },
  productMenuText: { flex: 1, fontSize: scale(15), fontWeight: '600' },
  removeDiscountAction: { minHeight: scale(48), alignItems: 'center', justifyContent: 'center', marginTop: scale(8) },
});
