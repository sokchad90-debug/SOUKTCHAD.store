import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { scale } from '@/constants/responsive';

export default function DisclaimerBanner() {
  const { colors, language } = useApp();
  const pathname = usePathname();

  const message = language === 'ar'
    ? 'الدفع يتم مباشرة مع البائع عبر تحويل نقدي — Sokchad لا يتلقى مدفوعات المنتجات'
    : language === 'fr'
      ? 'Le paiement se fait directement au vendeur par transfert d’argent — Sokchad ne reçoit aucun paiement pour les produits.'
      : 'Payment is made directly to the seller by money transfer — Sokchad does not receive payments for products.';

  // This trust notice belongs exclusively to the binding checkout review.
  if (!pathname.startsWith('/checkout/')) return null;

  return (
    <View style={[
      styles.container,
      { backgroundColor: colors.warningLight, borderColor: colors.warning },
    ]}>
      <MaterialIcons name="warning" size={scale(20)} color={colors.warning} />
      <Text style={[
        styles.text,
        { color: colors.textPrimary, textAlign: language === 'ar' ? 'right' : 'left' },
      ]}>
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
  text: {
    flex: 1,
    fontSize: scale(13),
    fontWeight: '500',
    lineHeight: scale(18),
  },
});
