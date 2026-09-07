import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, TextInput, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '@/contexts/AppContext';
import { borderRadius } from '@/constants/theme';
import { notifySuccess } from '@/services/haptics';
import { scale } from '@/constants/responsive';

export default function ReportButton() {
  const { colors, language, isLoggedIn } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [reportText, setReportText] = useState('');

  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const lb = (en: string, fr: string, ar: string) => isFr ? fr : isAr ? ar : en;

  const handleSubmit = () => {
    if (!reportText.trim()) {
      Alert.alert(
        lb('Required', 'Requis', 'مطلوب'),
        lb('Please describe the issue.', 'Veuillez decrire le probleme.', 'يرجى وصف المشكلة.')
      );
      return;
    }
    notifySuccess();
    Alert.alert(
      lb('Report Submitted', 'Signalement envoye', 'تم إرسال البلاغ'),
      lb('Our team will review your report shortly.', 'Notre equipe examinera votre signalement prochainement.', 'سيقوم فريقنا بمراجعة بلاغك قريباً.')
    );
    setReportText('');
    setShowModal(false);
  };

  return (
    <>
      <Pressable
        onPress={() => {
          if (!isLoggedIn) {
            Alert.alert(
              lb('Login Required', 'Connexion requise', 'تسجيل الدخول مطلوب'),
              lb('Please log in to submit a report.', 'Connectez-vous pour signaler.', 'يرجى تسجيل الدخول للإبلاغ.')
            );
            return;
          }
          setShowModal(true);
        }}
        style={[styles.reportBtn, { backgroundColor: colors.error + '12', borderColor: colors.error + '30' }]}
      >
        <MaterialIcons name="flag" size={scale(14)} color={colors.error} />
        <Text style={[styles.reportBtnText, { color: colors.error }]}>
          {lb('Support / Report', 'Support / Signaler', 'الدعم / إبلاغ')}
        </Text>
      </Pressable>

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <MaterialIcons name="flag" size={scale(24)} color={colors.error} />
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {lb('Report an Issue', 'Signaler un probleme', 'الإبلاغ عن مشكلة')}
              </Text>
            </View>
            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
              {lb(
                'Describe the issue: fraud, scam, inappropriate content, or any concern.',
                'Decrivez le probleme: fraude, arnaque, contenu inapproprie ou toute preoccupation.',
                'صف المشكلة: احتيال، نصب، محتوى غير لائق، أو أي مخاوف.'
              )}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.textPrimary, borderColor: colors.border }]}
              placeholder={lb('Describe the problem...', 'Decrivez le probleme...', 'صف المشكلة...')}
              placeholderTextColor={colors.textTertiary}
              value={reportText}
              onChangeText={setReportText}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.modalBtns}>
              <Pressable onPress={() => setShowModal(false)} style={[styles.cancelBtn, { borderColor: colors.border }]}>
                <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>
                  {lb('Cancel', 'Annuler', 'إلغاء')}
                </Text>
              </Pressable>
              <Pressable onPress={handleSubmit} style={[styles.submitBtn, { backgroundColor: colors.error }]}>
                <MaterialIcons name="send" size={scale(16)} color="#FFF" />
                <Text style={styles.submitBtnText}>{lb('Submit', 'Envoyer', 'إرسال')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: scale(14),
    paddingVertical: scale(7),
    borderRadius: borderRadius.full,
    borderWidth: 1,
    gap: scale(5),
    marginBottom: scale(8),
  },
  reportBtnText: { fontSize: scale(12), fontWeight: '600' },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: scale(24) },
  modal: { width: '100%', borderRadius: borderRadius.lg, padding: scale(24) },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: scale(10), marginBottom: scale(8) },
  modalTitle: { fontSize: scale(20), fontWeight: '700' },
  modalDesc: { fontSize: scale(14), lineHeight: 21, marginBottom: scale(16) },
  input: { height: scale(120), borderRadius: borderRadius.md, borderWidth: 1, paddingHorizontal: scale(16), paddingTop: scale(14), fontSize: scale(15), textAlignVertical: 'top' },
  modalBtns: { flexDirection: 'row', gap: scale(10), marginTop: scale(16) },
  cancelBtn: { flex: 1, height: scale(48), borderRadius: borderRadius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontSize: scale(15), fontWeight: '600' },
  submitBtn: { flex: 1, height: scale(48), borderRadius: borderRadius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scale(6) },
  submitBtnText: { color: '#FFF', fontSize: scale(15), fontWeight: '700' },
});
