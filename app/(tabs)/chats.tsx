import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { getSellerById } from '@/services/mockData';
import LoginModal from '@/components/LoginModal';
import { ChatListSkeleton } from '@/components/Skeleton';
import { borderRadius } from '@/constants/theme';
import { scale } from '@/constants/responsive';

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, t, language, isLoggedIn, conversations, user, isReady, clearChatBadge, getProductById } = useApp();
  const [showLogin, setShowLogin] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    clearChatBadge();
    setTimeout(() => setRefreshing(false), 1200);
  }, [clearChatBadge]);

  const isFr = language === 'fr';
  const isAr = language === 'ar';

  const formatTime = (ts: string) => {
    if (!ts) return '';
    const date = new Date(ts);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return isAr ? 'الآن' : isFr ? "À l'instant" : 'Now';
    if (mins < 60) return isAr ? `منذ ${mins} د` : isFr ? `Il y a ${mins} min` : `${mins}m`;
    if (hours < 24) return isAr ? `منذ ${hours} س` : isFr ? `Il y a ${hours} h` : `${hours}h`;
    if (days === 1) return isAr ? 'أمس' : isFr ? 'Hier' : 'Yesterday';
    if (days < 7) return isAr ? `منذ ${days} أيام` : isFr ? `Il y a ${days} jours` : `${days}d`;
    // For older conversations, show the date
    try {
      const locale = isAr ? 'ar' : isFr ? 'fr-FR' : 'en-US';
      return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    } catch { return `${date.getDate()}/${date.getMonth() + 1}`; }
  };

  // ---- Loading indicator while data loads (blank screen fix) ----
  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      {!isLoggedIn ? (
        <View style={styles.loginPrompt}>
          <Image
            source={require('@/assets/images/empty-chat.png')}
            style={styles.emptyImage}
            contentFit="contain"
          />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{t('messages')}</Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>{t('noMessagesDesc')}</Text>
          <Pressable
            onPress={() => setShowLogin(true)}
            style={[styles.loginBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.loginBtnText}>{t('login')}</Text>
          </Pressable>
          <LoginModal visible={showLogin} onClose={() => setShowLogin(false)} onSuccess={() => setShowLogin(false)} />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('messages')}</Text>
            {(conversations?.length ?? 0) > 0 ? (
              <Text style={[styles.headerCount, { color: colors.textTertiary }]}>
                {conversations.length}
              </Text>
            ) : null}
          </View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: insets.bottom + scale(90) }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
                progressBackgroundColor={colors.surface}
              />
            }
          >
            {(conversations?.length ?? 0) === 0 ? (
              <View style={styles.loginPrompt}>
                <Image source={require('@/assets/images/empty-chat.png')} style={styles.emptyImage} contentFit="contain" />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{t('noMessages')}</Text>
                <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>{t('noMessagesDesc')}</Text>
              </View>
            ) : (
              conversations.map(conv => {
                if (!conv?.id) return null;
                const product = conv?.productId ? getProductById(conv.productId) : undefined;
                const seller = conv?.sellerId ? getSellerById(conv.sellerId) : undefined;
                const isUserSeller = user?.id === conv?.sellerId;
                const otherName = isUserSeller ? (language === 'ar' ? 'مشترٍ' : language === 'fr' ? 'Acheteur' : 'Buyer') : (seller?.name || (language === 'ar' ? 'بائع' : language === 'fr' ? 'Vendeur' : 'Seller'));
                const otherAvatar = isUserSeller ? '' : (seller?.avatar || '');

                return (
                  <Pressable
                    key={conv.id}
                    onPress={() => router.push(`/conversation/${conv.id}`)}
                    style={({ pressed }) => [
                      styles.convItem,
                      { backgroundColor: pressed ? colors.borderLight : 'transparent', borderBottomColor: colors.borderLight },
                    ]}
                  >
                    <View style={styles.avatarContainer}>
                      {otherAvatar ? (
                        <Image source={{ uri: otherAvatar }} style={styles.avatar} contentFit="cover" />
                      ) : (
                        <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primaryLight }]}>
                          <MaterialIcons name="person" size={scale(24)} color={colors.primary} />
                        </View>
                      )}
                      {seller?.isOnline ? (
                        <View style={[styles.onlineDot, { borderColor: colors.background }]} />
                      ) : seller?.isVerified ? (
                        <View style={[styles.verifiedDot, { backgroundColor: colors.verified }]}>
                          <MaterialIcons name="check" size={scale(8)} color="#FFF" />
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.convContent}>
                      <View style={styles.convTopRow}>
                        <View style={styles.nameStatusRow}>
                          <Text style={[styles.convName, { color: colors.textPrimary }]} numberOfLines={1}>
                            {otherName}
                          </Text>
                          {seller?.isOnline ? (
                            <Text style={[styles.onlineLabel, { color: '#22C55E' }]}>
                              {language === 'fr' ? 'En ligne' : language === 'ar' ? 'متصل' : 'Online'}
                            </Text>
                          ) : null}
                        </View>
                        <Text style={[styles.convTime, { color: colors.textTertiary }]}>
                          {conv?.lastMessageTime ? formatTime(conv.lastMessageTime) : ''}
                        </Text>
                      </View>
                      <Text style={[styles.convProduct, { color: colors.primary }]} numberOfLines={1}>
                        {product ? (product?.title?.[language] || product?.title?.en || '') : ''}
                      </Text>
                      <Text style={[styles.convLast, { color: colors.textSecondary }]} numberOfLines={1}>
                        {conv?.lastMessage || ''}
                      </Text>
                    </View>

                    {(conv?.unreadCount ?? 0) > 0 ? (
                      <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.unreadText}>{conv.unreadCount}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loadingFull: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(16),
    paddingVertical: scale(14),
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: scale(24),
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },
  headerCount: {
    fontSize: scale(14),
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  loginPrompt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(32),
    paddingTop: scale(80),
  },
  emptyImage: {
    width: scale(200),
    height: scale(200),
    marginBottom: scale(20),
  },
  emptyTitle: {
    fontSize: scale(20),
    fontWeight: '700',
    marginBottom: scale(8),
    fontFamily: 'Cairo-Bold',
  },
  emptyDesc: {
    fontSize: scale(15),
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: scale(24),
    fontFamily: 'Cairo-Regular',
  },
  loginBtn: {
    paddingHorizontal: scale(40),
    paddingVertical: scale(14),
    borderRadius: borderRadius.md,
  },
  loginBtnText: {
    color: '#FFF',
    fontSize: scale(16),
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: scale(14),
    borderBottomWidth: 1,
    gap: scale(12),
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: scale(52),
    height: scale(52),
    borderRadius: scale(26),
  },
  avatarPlaceholder: {
    width: scale(52),
    height: scale(52),
    borderRadius: scale(26),
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    position: 'absolute',
    bottom: scale(2),
    right: scale(2),
    width: scale(14),
    height: scale(14),
    borderRadius: scale(7),
    backgroundColor: '#22C55E',
    borderWidth: 2,
  },
  verifiedDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: scale(18),
    height: scale(18),
    borderRadius: scale(9),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  convContent: {
    flex: 1,
    gap: scale(2),
  },
  convTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nameStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: scale(6),
  },
  onlineLabel: {
    fontSize: scale(10),
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  convName: {
    fontSize: scale(16),
    fontWeight: '600',
    flex: 1,
    fontFamily: 'Cairo-SemiBold',
  },
  convTime: {
    fontSize: scale(12),
    fontWeight: '400',
    fontFamily: 'Cairo-Regular',
  },
  convProduct: {
    fontSize: scale(12),
    fontWeight: '500',
    fontFamily: 'Cairo-Regular',
  },
  convLast: {
    fontSize: scale(14),
    fontWeight: '400',
    fontFamily: 'Cairo-Regular',
  },
  unreadBadge: {
    width: scale(22),
    height: scale(22),
    borderRadius: scale(11),
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    color: '#FFF',
    fontSize: scale(11),
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },
});