import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import NetInfo, { useNetInfo } from '@react-native-community/netinfo';
import { MaterialIcons } from '@expo/vector-icons';

import { useApp } from '@/contexts/AppContext';
import { scale } from '@/ui/responsive';

export type DataState = 'empty' | 'error';

type Props = {
  state: DataState;
  onRetry?: () => void | Promise<void>;
  retrying?: boolean;
  compact?: boolean;
};

/** Shared, language-aware empty/server/offline state for API-backed lists. */
export default function ConnectionStateView({ state, onRetry, retrying = false, compact = false }: Props) {
  const { colors, language } = useApp();
  const network = useNetInfo();
  const offline = network.isConnected === false || network.isInternetReachable === false;
  const isAr = language === 'ar';
  const pick = (en: string, fr: string, ar: string) => language === 'fr' ? fr : isAr ? ar : en;
  const title = offline
    ? pick('No internet connection', 'Pas de connexion internet', 'لا يوجد اتصال بالإنترنت')
    : state === 'error'
      ? pick('Could not load data', 'Impossible de charger les données', 'تعذر تحميل البيانات')
      : pick('Nothing here yet', 'Aucun élément pour le moment', 'لا توجد بيانات بعد');
  const detail = offline
    ? pick('Check your connection and try again.', 'Vérifiez votre connexion puis réessayez.', 'تحقق من اتصالك ثم أعد المحاولة.')
    : state === 'error'
      ? pick('The server did not respond. Please try again.', 'Le serveur ne répond pas. Réessayez.', 'لم يستجب الخادم. حاول مرة أخرى.')
      : pick('New items will appear here.', 'Les nouveaux éléments apparaîtront ici.', 'ستظهر العناصر الجديدة هنا.');

  const retry = async () => {
    await NetInfo.refresh();
    await onRetry?.();
  };

  return (
    <View style={[styles.root, compact && styles.compact]}>
      <MaterialIcons
        name={offline ? 'wifi-off' : state === 'error' ? 'cloud-off' : 'inbox'}
        size={scale(compact ? 36 : 48)}
        color={colors.textTertiary}
      />
      <Text style={[styles.title, { color: colors.textSecondary, textAlign: isAr ? 'right' : 'left' }]}>{title}</Text>
      <Text style={[styles.detail, { color: colors.textTertiary, textAlign: isAr ? 'right' : 'left' }]}>{detail}</Text>
      {state === 'error' && onRetry ? (
        <Pressable
          accessibilityRole="button"
          disabled={retrying}
          onPress={retry}
          style={({ pressed }) => [styles.retry, { backgroundColor: colors.primary, opacity: pressed || retrying ? 0.7 : 1 }]}
        >
          {retrying ? <ActivityIndicator size="small" color="#FFFFFF" /> : <MaterialIcons name="refresh" size={scale(18)} color="#FFFFFF" />}
          <Text style={styles.retryText}>{pick('Try again', 'Réessayer', 'إعادة المحاولة')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: scale(24), paddingVertical: scale(64), gap: scale(8) },
  compact: { paddingVertical: scale(28) },
  title: { fontSize: scale(16), lineHeight: scale(24), fontWeight: '700', fontFamily: 'Cairo-Bold' },
  detail: { fontSize: scale(13), lineHeight: scale(20), fontFamily: 'Cairo-Regular' },
  retry: { flexDirection: 'row', alignItems: 'center', gap: scale(6), minHeight: scale(42), marginTop: scale(8), paddingHorizontal: scale(18), borderRadius: scale(12) },
  retryText: { color: '#FFFFFF', fontSize: scale(14), fontWeight: '700', fontFamily: 'Cairo-Bold' },
});
