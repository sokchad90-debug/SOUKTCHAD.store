import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '@/contexts/AppContext';
import { scale } from '@/constants/responsive';

interface DisclaimerBannerProps {
  compact?: boolean;
}

export default function DisclaimerBanner({ compact = false }: DisclaimerBannerProps) {
  const { colors, language } = useApp();

  // Localised disclaimer text. Keep keys short so the compact banner stays on ≤2 lines.
  const message = compact
    ? (language === 'ar'
        ? 'تنبيه: لا يتولى Sokchad معالجة المدفوعات أو عمليات الاسترداد. تحقق من المنتج قبل الدفع.'
        : language === 'fr'
          ? 'Sokchad ne traite pas les paiements et ne propose pas de remboursement. Vérifiez le produit avant de payer.'
          : 'Warning: Sokchad does not handle payments or refunds. Verify the product before paying.')
    : (language === 'ar'
        ? 'تنبيه: لا يتولى Sokchad معالجة المدفوعات أو عمليات الاسترداد. تحقق من المنتج قبل الدفع.'
        : language === 'fr'
          ? 'Sokchad ne traite pas les paiements et ne propose pas de remboursement. Vérifiez le produit avant de payer.'
          : 'Sokchad is a display platform only. We do not handle payments or offer refunds. Please verify items before paying. All external transfers are at your own risk.');

  return (
    <View style={[
      styles.container,
      { backgroundColor: colors.warningLight, borderColor: colors.warning },
      compact && styles.compact,
    ]}>
      <MaterialIcons name="warning" size={compact ? scale(16) : scale(20)} color={colors.warning} />
      <Text style={[
        styles.text,
        { color: colors.textPrimary, textAlign: language === 'ar' ? 'right' : 'left' },
        compact && styles.compactText,
      ]} numberOfLines={compact ? 2 : undefined}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: scale(12),
    borderRadius: scale(12),
    borderWidth: 1,
    gap: scale(10),
    marginBottom: scale(12),
  },
  compact: {
    padding: scale(8),
    borderRadius: scale(8),
    gap: scale(8),
    marginBottom: scale(8),
  },
  text: {
    flex: 1,
    fontSize: scale(13),
    fontWeight: '500',
    lineHeight: 18,
  },
  compactText: {
    fontSize: scale(11),
    lineHeight: 15,
  },
});
