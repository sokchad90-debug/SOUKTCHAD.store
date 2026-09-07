import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { borderRadius, shadows } from '@/constants/theme';
import { notifySuccess, selection, impactLight } from '@/services/haptics';
import { scale } from '@/constants/responsive';

export default function SellerPaymentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    colors, language, user, paymentMethodsList, updateSellerPaymentMethods,
  } = useApp();

  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const lb = useCallback((en: string, fr: string, ar: string) => isFr ? fr : isAr ? ar : en, [isFr, isAr]);

  // Build a map of current seller numbers keyed by methodId
  const existingMethods = useMemo(() => {
    const map: Record<string, string> = {};
    (user?.paymentMethods || []).forEach(pm => {
      map[pm.methodId] = pm.receivingNumber;
    });
    return map;
  }, [user?.paymentMethods]);

  // Local state: track number input for each payment method
  const [numbers, setNumbers] = useState<Record<string, string>>(() => ({ ...existingMethods }));
  const [hasChanges, setHasChanges] = useState(false);

  const handleNumberChange = useCallback((methodId: string, value: string) => {
    setNumbers(prev => ({ ...prev, [methodId]: value }));
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    const methods: { methodId: string; receivingNumber: string }[] = [];
    paymentMethodsList.forEach(pm => {
      const num = (numbers[pm.id] || '').trim();
      if (num) {
        methods.push({ methodId: pm.id, receivingNumber: num });
      }
    });

    if (methods.length === 0) {
      Alert.alert(
        lb('No Numbers Set', 'Aucun numéro', 'لا توجد أرقام'),
        lb(
          'You have not entered any receiving numbers. Buyers will not be able to pay you. Are you sure?',
          'Vous n\'avez saisi aucun numero. Les acheteurs ne pourront pas vous payer. Continuer?',
          'لم تدخل أي أرقام استلام. لن يتمكن المشترون من الدفع لك. هل أنت متأكد؟'
        ),
        [
          { text: lb('Cancel', 'Annuler', 'إلغاء'), style: 'cancel' },
          {
            text: lb('Save Anyway', 'Enregistrer', 'حفظ'), onPress: () => {
              updateSellerPaymentMethods(methods);
              notifySuccess();
              setHasChanges(false);
              Alert.alert(lb('Saved', 'Enregistré', 'تم الحفظ'), lb('Payment methods updated.', 'Méthodes mises à jour.', 'تم تحديث طرق الدفع.'));
            }
          },
        ]
      );
      return;
    }

    updateSellerPaymentMethods(methods);
    notifySuccess();
    setHasChanges(false);
    Alert.alert(
      lb('Saved', 'Enregistré', 'تم الحفظ'),
      lb(
        `${methods.length} payment method${methods.length > 1 ? 's' : ''} configured successfully.`,
        `${methods.length} methode${methods.length > 1 ? 's' : ''} de paiement configuree${methods.length > 1 ? 's' : ''}.`,
        `تم تكوين ${methods.length} طريقة دفع بنجاح.`
      )
    );
  }, [numbers, paymentMethodsList, updateSellerPaymentMethods, lb]);

  const handleClearMethod = useCallback((methodId: string) => {
    impactLight();
    setNumbers(prev => ({ ...prev, [methodId]: '' }));
    setHasChanges(true);
  }, []);

  const configuredCount = useMemo(() =>
    paymentMethodsList.filter(pm => (numbers[pm.id] || '').trim().length > 0).length,
    [paymentMethodsList, numbers]
  );

  if (!user?.isSeller) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: scale(32) }}>
          <MaterialIcons name="block" size={scale(56)} color={colors.textTertiary} />
          <Text style={[styles.blockTitle, { color: colors.textPrimary }]}>
            {lb('Seller Only', 'Vendeurs uniquement', 'للبائعين فقط')}
          </Text>
          <Text style={[styles.blockMsg, { color: colors.textSecondary }]}>
            {lb('This page is only available for seller accounts.', 'Cette page est réservée aux comptes vendeurs.', 'هذه الصفحة متاحة فقط لحسابات البائعين.')}
          </Text>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.primary }]}>
            <Text style={styles.backBtnText}>{lb('Go Back', 'Retour', 'رجوع')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={[styles.headerBackBtn, { backgroundColor: colors.backgroundSecondary }]}>
          <MaterialIcons name="arrow-back" size={scale(20)} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            {lb('Payment Methods', 'Méthodes de paiement', 'طرق الدفع')}
          </Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
            {lb('Set your receiving numbers', 'Configurez vos numéros', 'أدخل أرقام الاستلام')}
          </Text>
        </View>
        {hasChanges ? (
          <Pressable onPress={handleSave} style={[styles.saveBtn, { backgroundColor: colors.success }]}>
            <MaterialIcons name="check" size={scale(18)} color="#FFF" />
            <Text style={styles.saveBtnText}>{lb('Save', 'Enregistrer', 'حفظ')}</Text>
          </Pressable>
        ) : null}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: scale(16), paddingBottom: insets.bottom + scale(100) }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Info Banner */}
          <View style={[styles.infoBanner, { backgroundColor: colors.primary + '08', borderColor: colors.primary + '25' }]}>
            <MaterialIcons name="info" size={scale(20)} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              {lb(
                'Enter your phone/account number for each payment method. Buyers will see these numbers at checkout to transfer payment to you.',
                'Entrez votre numero pour chaque methode. Les acheteurs verront ces numeros lors du paiement.',
                'أدخل رقم هاتفك/حسابك لكل طريقة دفع. سيرى المشترون هذه الأرقام عند الدفع لتحويل المبلغ إليك.'
              )}
            </Text>
          </View>

          {/* Status Summary */}
          <View style={[styles.summaryRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.summaryIcon, { backgroundColor: configuredCount > 0 ? colors.success + '15' : colors.warning + '15' }]}>
              <MaterialIcons
                name={configuredCount > 0 ? 'check-circle' : 'warning'}
                size={scale(20)}
                color={configuredCount > 0 ? colors.success : colors.warning}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.summaryTitle, { color: colors.textPrimary }]}>
                {configuredCount}/{paymentMethodsList.length} {lb('configured', 'configures', 'مكوّن')}
              </Text>
              <Text style={[styles.summaryDesc, { color: colors.textTertiary }]}>
                {configuredCount === 0
                  ? lb('No payment methods set yet', 'Aucune méthode configurée', 'لم يتم تكوين طرق الدفع بعد')
                  : lb('Buyers can pay you via these methods', 'Les acheteurs peuvent vous payer', 'يمكن للمشترين الدفع لك عبر هذه الطرق')}
              </Text>
            </View>
          </View>

          {/* Payment Methods List */}
          {paymentMethodsList.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="account-balance-wallet" size={scale(48)} color={colors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                {lb('No Payment Methods', 'Aucune méthode', 'لا توجد طرق دفع')}
              </Text>
              <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                {lb(
                  'The admin has not configured any payment methods yet. Contact the admin to set up payment gateways.',
                  'L\'admin n\'a pas encore configure de methodes de paiement. Contactez l\'admin.',
                  'لم يقم المشرف بإعداد طرق الدفع بعد. تواصل مع المشرف لإعداد بوابات الدفع.'
                )}
              </Text>
            </View>
          ) : paymentMethodsList.map(method => {
            const currentNumber = numbers[method.id] || '';
            const isConfigured = currentNumber.trim().length > 0;

            return (
              <View
                key={method.id}
                style={[styles.methodCard, {
                  backgroundColor: colors.surface,
                  borderColor: isConfigured ? colors.success + '40' : colors.border,
                }, shadows.card]}
              >
                {/* Method Header */}
                <View style={styles.methodHeader}>
                  {method.logo ? (
                    <Image source={{ uri: method.logo }} style={styles.methodLogo} contentFit="cover" />
                  ) : (
                    <View style={[styles.methodIconCircle, { backgroundColor: method.color + '15' }]}>
                      <MaterialIcons name="account-balance-wallet" size={scale(22)} color={method.color} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <View style={styles.methodNameRow}>
                      <Text style={[styles.methodName, { color: colors.textPrimary }]}>{method.name}</Text>
                      {isConfigured ? (
                        <View style={[styles.configuredBadge, { backgroundColor: colors.success + '15' }]}>
                          <MaterialIcons name="check-circle" size={scale(12)} color={colors.success} />
                          <Text style={[styles.configuredBadgeText, { color: colors.success }]}>
                            {lb('Active', 'Actif', 'مفعّل')}
                          </Text>
                        </View>
                      ) : (
                        <View style={[styles.configuredBadge, { backgroundColor: colors.warning + '15' }]}>
                          <MaterialIcons name="radio-button-unchecked" size={scale(12)} color={colors.warning} />
                          <Text style={[styles.configuredBadgeText, { color: colors.warning }]}>
                            {lb('Not Set', 'Non defini', 'غير محدد')}
                          </Text>
                        </View>
                      )}
                    </View>
                    {method.instructions ? (
                      <Text style={[styles.methodInstructions, { color: colors.textTertiary }]} numberOfLines={2}>
                        {method.instructions}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Number Input */}
                <View style={styles.inputSection}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                    {lb('YOUR RECEIVING NUMBER / ACCOUNT', 'VOTRE NUMERO DE RECEPTION', 'رقم الاستلام / الحساب')}
                  </Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={[styles.numberInput, {
                        backgroundColor: colors.backgroundSecondary,
                        color: colors.textPrimary,
                        borderColor: isConfigured ? colors.success + '50' : colors.border,
                      }]}
                      placeholder={lb(
                        'e.g. +235 XX XX XX XX',
                        'Ex: +235 XX XX XX XX',
                        'مثال: +235 XX XX XX XX'
                      )}
                      placeholderTextColor={colors.textTertiary}
                      value={currentNumber}
                      onChangeText={(val) => handleNumberChange(method.id, val)}
                      keyboardType="phone-pad"
                    />
                    {isConfigured ? (
                      <Pressable
                        onPress={() => handleClearMethod(method.id)}
                        style={[styles.clearBtn, { backgroundColor: colors.errorLight }]}
                        hitSlop={8}
                      >
                        <MaterialIcons name="close" size={scale(18)} color={colors.error} />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })}

          {/* Tips */}
          <View style={[styles.tipsCard, { backgroundColor: colors.warning + '06', borderColor: colors.warning + '20' }]}>
            <View style={styles.tipsHeader}>
              <MaterialIcons name="lightbulb" size={scale(18)} color={colors.warning} />
              <Text style={[styles.tipsTitle, { color: colors.textPrimary }]}>
                {lb('Tips', 'Conseils', 'نصائح')}
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={[styles.tipBullet, { color: colors.warning }]}>{'\u2022'}</Text>
              <Text style={[styles.tipText, { color: colors.textSecondary }]}>
                {lb(
                  'Double-check your numbers to avoid payment issues.',
                  'Verifiez vos numeros pour eviter les erreurs de paiement.',
                  'تحقق من أرقامك لتجنب مشاكل الدفع.'
                )}
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={[styles.tipBullet, { color: colors.warning }]}>{'\u2022'}</Text>
              <Text style={[styles.tipText, { color: colors.textSecondary }]}>
                {lb(
                  'Configure at least one method so buyers can complete checkout.',
                  'Configurez au moins une methode pour permettre aux acheteurs de payer.',
                  'قم بتكوين طريقة واحدة على الأقل ليتمكن المشترون من إكمال عملية الشراء.'
                )}
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={[styles.tipBullet, { color: colors.warning }]}>{'\u2022'}</Text>
              <Text style={[styles.tipText, { color: colors.textSecondary }]}>
                {lb(
                  'You can update your numbers anytime from this screen.',
                  'Vous pouvez modifier vos numeros a tout moment depuis cet ecran.',
                  'يمكنك تحديث أرقامك في أي وقت من هذه الشاشة.'
                )}
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Fixed Save Button */}
      {hasChanges ? (
        <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + scale(12) }, shadows.modal]}>
          <Pressable
            onPress={handleSave}
            style={({ pressed }) => [styles.saveFullBtn, { backgroundColor: colors.success, opacity: pressed ? 0.9 : 1 }]}
          >
            <MaterialIcons name="save" size={scale(20)} color="#FFF" />
            <Text style={styles.saveFullBtnText}>
              {lb('Save Payment Methods', 'Enregistrer les méthodes', 'حفظ طرق الدفع')} ({configuredCount})
            </Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(16), paddingVertical: scale(12), borderBottomWidth: 1, gap: scale(12) },
  headerBackBtn: { width: scale(36), height: scale(36), borderRadius: scale(12), alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: scale(18), fontWeight: '800' },
  headerSub: { fontSize: scale(12), marginTop: scale(1) },
  saveBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(14), paddingVertical: scale(8), borderRadius: scale(10), gap: scale(4) },
  saveBtnText: { color: '#FFF', fontSize: scale(14), fontWeight: '700' },
  infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: scale(10), padding: scale(14), borderRadius: scale(14), borderWidth: 1, marginBottom: scale(12) },
  infoText: { flex: 1, fontSize: scale(13), lineHeight: 20 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: scale(12), padding: scale(14), borderRadius: scale(14), borderWidth: 1, marginBottom: scale(16) },
  summaryIcon: { width: scale(40), height: scale(40), borderRadius: scale(20), alignItems: 'center', justifyContent: 'center' },
  summaryTitle: { fontSize: scale(16), fontWeight: '700' },
  summaryDesc: { fontSize: scale(12), marginTop: scale(2) },
  methodCard: { borderRadius: scale(16), borderWidth: 1, padding: scale(16), marginBottom: scale(12), gap: scale(14) },
  methodHeader: { flexDirection: 'row', alignItems: 'center', gap: scale(12) },
  methodLogo: { width: scale(44), height: scale(44), borderRadius: scale(12) },
  methodIconCircle: { width: scale(44), height: scale(44), borderRadius: scale(22), alignItems: 'center', justifyContent: 'center' },
  methodNameRow: { flexDirection: 'row', alignItems: 'center', gap: scale(8), flexWrap: 'wrap' },
  methodName: { fontSize: scale(16), fontWeight: '700' },
  configuredBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(8), paddingVertical: scale(3), borderRadius: scale(20), gap: scale(4) },
  configuredBadgeText: { fontSize: scale(11), fontWeight: '700' },
  methodInstructions: { fontSize: scale(12), marginTop: scale(3), lineHeight: 16 },
  inputSection: { gap: scale(6) },
  inputLabel: { fontSize: scale(10), fontWeight: '700', letterSpacing: 0.8 },
  inputRow: { flexDirection: 'row', gap: scale(8), alignItems: 'center' },
  numberInput: { flex: 1, height: scale(50), borderRadius: scale(12), borderWidth: 1.5, paddingHorizontal: scale(16), fontSize: scale(17), fontWeight: '600', letterSpacing: 0.5 },
  clearBtn: { width: scale(38), height: scale(38), borderRadius: scale(19), alignItems: 'center', justifyContent: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: scale(48), gap: scale(8) },
  emptyTitle: { fontSize: scale(18), fontWeight: '700' },
  emptyDesc: { fontSize: scale(14), textAlign: 'center', paddingHorizontal: scale(24), lineHeight: 22 },
  tipsCard: { borderRadius: scale(14), borderWidth: 1, padding: scale(16), marginTop: scale(8), gap: scale(8) },
  tipsHeader: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
  tipsTitle: { fontSize: scale(15), fontWeight: '700' },
  tipItem: { flexDirection: 'row', gap: scale(8), paddingLeft: scale(4) },
  tipBullet: { fontSize: scale(14), fontWeight: '700', lineHeight: 20 },
  tipText: { flex: 1, fontSize: scale(13), lineHeight: 20 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: scale(16), paddingTop: scale(12), borderTopWidth: 1 },
  saveFullBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: scale(54), borderRadius: scale(14), gap: scale(8) },
  saveFullBtnText: { color: '#FFF', fontSize: scale(17), fontWeight: '700' },
  blockTitle: { fontSize: scale(22), fontWeight: '800', marginTop: scale(16), marginBottom: scale(8) },
  blockMsg: { fontSize: scale(15), textAlign: 'center', lineHeight: 22, marginBottom: scale(24) },
  backBtn: { paddingHorizontal: scale(32), paddingVertical: scale(14), borderRadius: scale(12) },
  backBtnText: { color: '#FFF', fontSize: scale(16), fontWeight: '700' },
});
