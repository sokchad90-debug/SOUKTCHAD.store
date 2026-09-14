import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * TopBadge — ONE component for card + detail.
 * Horizontal row: trophy icon + word "Top". Fixed base size,
 * independent of price font size; never square, never vertical, never stretched.
 * Rendered ONLY when the product earns it (same rule as the card).
 */
interface Props {
  earned: boolean;
  label?: string;
}
function TopBadgeInner({ earned, label = 'Top' }: Props) {
  if (!earned) return null;
  return (
    <View style={styles.badge} testID="top-badge">
      <MaterialIcons name="workspace-premium" size={13} color="#B8860B" />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FDE68A',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 11, fontWeight: '800', color: '#B8860B', includeFontPadding: false },
});
const TopBadge = React.memo(TopBadgeInner);
export default TopBadge;