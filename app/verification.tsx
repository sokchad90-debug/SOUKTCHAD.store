import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Alert, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import * as ImagePicker from 'expo-image-picker';
const API_BASE_URL = 'http://10.0.2.2:8080';
import { scale } from '@/constants/responsive';

const COLORS = {
  primary: '#FF7A00',
  background: '#f5f5f5',
  surface: '#ffffff',
  text: '#1a1a2e',
  textSecondary: '#666',
  border: '#e0e0e0',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
};

export default function VerificationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, language } = useApp();
  const isAr = language === 'ar';

  const [idFront, setIdFront] = useState<string | null>(null);
  const [idBack, setIdBack] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const pickImage = useCallback(async (setter: (uri: string) => void) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setter(result.assets[0].uri);
    }
  }, []);

  const submit = useCallback(async () => {
    if (!idFront || !idBack || !selfie) {
      Alert.alert(
        isAr ? 'خطأ' : 'Erreur',
        isAr ? 'يرجى رفع جميع الصور' : 'Veuillez télécharger toutes les images'
      );
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('user_id', user?.id || '');
      formData.append('id_front', { uri: idFront, type: 'image/jpeg', name: 'id_front.jpg' } as any);
      formData.append('id_back', { uri: idBack, type: 'image/jpeg', name: 'id_back.jpg' } as any);
      formData.append('selfie', { uri: selfie, type: 'image/jpeg', name: 'selfie.jpg' } as any);

      const response = await fetch(`${API_BASE_URL}/api/verification-requests/index.php`, {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = await response.json();
      if (data.success) {
        setStatus('pending');
        Alert.alert(isAr ? 'تم الإرسال' : 'Envoyé', isAr ? 'تم إرسال طلب التوثيق' : 'Demande de vérification envoyée');
      } else {
        Alert.alert(isAr ? 'خطأ' : 'Erreur', data.error || 'Erreur');
      }
    } catch (e) {
      Alert.alert(isAr ? 'خطأ' : 'Erreur', isAr ? 'فشل الاتصال' : 'Échec de connexion');
    } finally {
      setLoading(false);
    }
  }, [idFront, idBack, selfie, user, isAr]);

  const ImageSlot = ({ uri, setter, label }: { uri: string | null; setter: (u: string) => void; label: string }) => (
    <Pressable style={styles.imageSlot} onPress={() => pickImage(setter)}>
      {uri ? (
        <Image source={{ uri }} style={styles.imagePreview} />
      ) : (
        <View style={styles.imagePlaceholder}>
          <MaterialIcons name="add-a-photo" size={scale(32)} color={COLORS.textSecondary} />
          <Text style={styles.imageLabel}>{label}</Text>
        </View>
      )}
    </Pressable>
  );

  if (status === 'pending') {
    return (
      <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: COLORS.background }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <MaterialIcons name={isAr ? 'arrow-forward' : 'arrow-back'} size={scale(24)} color={COLORS.text} />
          </Pressable>
          <Text style={styles.headerTitle}>{isAr ? 'التوثيق' : 'Vérification'}</Text>
        </View>
        <View style={styles.pendingContainer}>
          <MaterialIcons name="hourglass-empty" size={scale(64)} color={COLORS.warning} />
          <Text style={styles.pendingText}>
            {isAr ? 'طلبك قيد المراجعة' : 'Votre demande est en cours de révision'}
          </Text>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>{isAr ? 'رجوع' : 'Retour'}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: COLORS.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <MaterialIcons name={isAr ? 'arrow-forward' : 'arrow-back'} size={scale(24)} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{isAr ? 'توثيق الحساب' : 'Vérification du compte'}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: scale(16), paddingBottom: insets.bottom + scale(100) }}>
        <Text style={styles.sectionTitle}>
          {isAr ? 'ارفع صورة بطاقتك الشخصية' : 'Téléchargez votre pièce d\'identité'}
        </Text>
        <Text style={styles.sectionDesc}>
          {isAr ? 'يجب رفع 3 صور: أمام البطاقة، خلف البطاقة، وصورة شخصية مع البطاقة'
                : '3 photos requises: recto, verso, et selfie avec la pièce'}
        </Text>
        <View style={styles.imagesRow}>
          <ImageSlot uri={idFront} setter={setIdFront} label={isAr ? 'أمام' : 'Recto'} />
          <ImageSlot uri={idBack} setter={setIdBack} label={isAr ? 'خلف' : 'Verso'} />
        </View>
        <View style={styles.selfieSlot}>
          <ImageSlot uri={selfie} setter={setSelfie} label={isAr ? 'صورة مع البطاقة' : 'Selfie avec pièce'} />
        </View>
        <Pressable style={styles.submitBtn} onPress={submit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>{isAr ? 'إرسال الطلب' : 'Envoyer la demande'}</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(16), paddingVertical: scale(12), gap: scale(12) },
  headerTitle: { fontSize: scale(18), fontWeight: '700', fontFamily: 'Cairo-Bold' },
  sectionTitle: { fontSize: scale(16), fontWeight: '700', fontFamily: 'Cairo-Bold', marginBottom: scale(8) },
  sectionDesc: { fontSize: scale(13), color: '#666', fontFamily: 'Cairo-Regular', marginBottom: scale(16) },
  imagesRow: { flexDirection: 'row', gap: scale(12), marginBottom: scale(12) },
  imageSlot: { flex: 1, height: scale(180), borderRadius: scale(12), borderWidth: 2, borderColor: '#e0e0e0', borderStyle: 'dashed', overflow: 'hidden' },
  selfieSlot: { marginBottom: scale(24) },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9f9f9' },
  imageLabel: { fontSize: scale(13), color: '#666', marginTop: scale(8), fontFamily: 'Cairo-Regular' },
  imagePreview: { width: '100%', height: '100%' },
  submitBtn: { backgroundColor: '#FF7A00', borderRadius: scale(12), paddingVertical: scale(16), alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: scale(16), fontWeight: '700', fontFamily: 'Cairo-Bold' },
  pendingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: scale(32) },
  pendingText: { fontSize: scale(16), fontWeight: '600', fontFamily: 'Cairo-SemiBold', marginTop: scale(16), textAlign: 'center' },
  backBtn: { marginTop: scale(24), paddingHorizontal: scale(24), paddingVertical: scale(12), borderRadius: scale(12), backgroundColor: '#FF7A00' },
  backBtnText: { color: '#fff', fontSize: scale(14), fontWeight: '600', fontFamily: 'Cairo-SemiBold' },
});