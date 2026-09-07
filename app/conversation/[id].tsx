import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { getSellerById } from '@/services/mockData';
import { formatPrice } from '@/constants/config';
import { borderRadius } from '@/constants/theme';
import DisclaimerBanner from '@/components/DisclaimerBanner';
import ReportButton from '@/components/ReportButton';
import { impactLight } from '@/services/haptics';
import { scale } from '@/constants/responsive';

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, t, language, user, conversations, sendMessage, getProductById } = useApp();
  const [text, setText] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const conv = conversations.find(c => c.id === id);

  const product = conv ? getProductById(conv.productId) : undefined;
  const seller = conv ? getSellerById(conv.sellerId) : undefined;
  const isUserSeller = conv && user ? user.id === conv.sellerId : false;
  const otherName = isUserSeller ? 'Buyer' : (seller?.name || 'Seller');
  const messagesLength = conv?.messages?.length ?? 0;

  useEffect(() => {
    if (messagesLength > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [messagesLength]);

  if (!conv || !user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + scale(8), backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <MaterialIcons name="arrow-back" size={scale(24)} color={colors.textPrimary} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('chats')}</Text>
          <View style={{ width: scale(24) }} />
        </View>
        <View style={styles.centerContent}>
          <Text style={{ color: colors.textSecondary }}>Conversation not found</Text>
        </View>
      </View>
    );
  }

  const handleSend = () => {
    if (!text.trim()) return;
    impactLight();
    sendMessage(conv.id, text.trim());
    setText('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const formatTime = (ts: string) => {
    const date = new Date(ts);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const getDisplayText = (msg: typeof conv.messages[0]) => {
    // Invisible auto-translation: silently show receiver's language version
    if (msg.translatedText && msg.translatedText[language]) {
      return msg.translatedText[language];
    }
    return msg.text;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header with online status */}
      <View style={[styles.header, { paddingTop: insets.top + scale(8), backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={scale(24)} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerInfo}>
          {seller ? (
            <View style={styles.headerAvatarWrap}>
              <Image source={{ uri: seller.avatar }} style={styles.headerAvatar} contentFit="cover" />
              {seller.isOnline ? (
                <View style={styles.headerOnlineDot} />
              ) : null}
            </View>
          ) : null}
          <View style={styles.headerTextGroup}>
            <View style={styles.headerNameRow}>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{otherName}</Text>
              {seller?.isVerified ? (
                <MaterialIcons name="verified" size={scale(16)} color={colors.verified} />
              ) : null}
            </View>
            {seller?.isOnline ? (
              <Text style={styles.headerOnlineText}>
                {language === 'fr' ? 'En ligne' : language === 'ar' ? '\u0645\u062a\u0635\u0644' : 'Online'}
              </Text>
            ) : product ? (
              <Text style={[styles.headerProduct, { color: colors.primary }]} numberOfLines={1}>
                {product.title[language] || product.title.en}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={{ width: scale(24) }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Report Button pinned at top */}
          <ReportButton />

          {/* Permanent Legal Disclaimer */}
          <View style={[styles.chatDisclaimer, { backgroundColor: colors.warning + '10', borderColor: colors.warning + '30' }]}>
            <MaterialIcons name="warning-amber" size={scale(16)} color={colors.warning} />
            <Text style={[styles.chatDisclaimerText, { color: colors.textSecondary }]}>
              {language === 'fr'
                ? 'Sokchad ne gère pas les paiements et ne rembourse pas. Gardez toutes les preuves ici. Les transactions externes sont à vos risques.'
                : language === 'ar'
                ? 'سوكشاد لا يدير المدفوعات ولا يقدم استرداد الأموال. احتفظ بجميع الأدلة هنا. المعاملات الخارجية على مسؤوليتك.'
                : 'Sokchad does not handle payments or refunds. Keep all proof here. External transactions are at your own risk.'}
            </Text>
          </View>

          {/* Product Card */}
          {product ? (
            <Pressable
              onPress={() => router.push(`/product/${product.id}`)}
              style={[styles.productCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
            >
              <Image source={{ uri: product.images[0] }} style={styles.productThumb} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.productTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {product.title[language] || product.title.en}
                </Text>
                <Text style={[styles.productPrice, { color: colors.primary }]}>{formatPrice(product.price)}</Text>
              </View>
              <MaterialIcons name={language === 'ar' ? "chevron-left" : "chevron-right"} size={scale(20)} color={colors.textTertiary} />
            </Pressable>
          ) : null}

          {/* Messages — translation is completely invisible */}
          {conv.messages.filter(m => (m.type as string) !== 'voice').map(msg => {
            const isMe = msg.senderId === user.id;
            const displayText = getDisplayText(msg);

            return (
              <View key={msg.id} style={[styles.msgRow, isMe ? styles.msgRowRight : styles.msgRowLeft]}>
                <View style={[
                  styles.bubble,
                  isMe
                    ? { backgroundColor: colors.chatBubbleSent, borderBottomRightRadius: scale(4) }
                    : { backgroundColor: colors.chatBubbleReceived, borderBottomLeftRadius: scale(4) },
                ]}>
                  <Text style={[styles.msgText, { color: isMe ? '#FFF' : colors.textPrimary }]}>{displayText || msg.text}</Text>
                  <Text style={[styles.msgTime, { color: isMe ? 'rgba(255,255,255,0.6)' : colors.textTertiary }]}>
                    {formatTime(msg.timestamp)}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Input Bar */}
        <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + scale(8) }]}>
          <View style={[styles.inputWrapper, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.textPrimary }]}
              placeholder={t('typeMessage')}
              placeholderTextColor={colors.textTertiary}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={1000}
            />
          </View>
          <Pressable
            onPress={handleSend}
            style={[styles.sendBtn, { backgroundColor: text.trim() ? colors.primary : colors.textTertiary }]}
            disabled={!text.trim()}
          >
            <MaterialIcons name="send" size={scale(20)} color="#FFF" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(16), paddingBottom: scale(12), borderBottomWidth: 1, gap: scale(12),
  },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: scale(10) },
  headerAvatarWrap: { position: 'relative' },
  headerAvatar: { width: scale(40), height: scale(40), borderRadius: scale(20) },
  headerOnlineDot: { position: 'absolute', bottom: 0, right: 0, width: scale(10), height: scale(10), borderRadius: scale(5), backgroundColor: '#22C55E', borderWidth: 1.5, borderColor: '#FFF' },
  headerOnlineText: { fontSize: scale(11), fontWeight: '600', color: '#22C55E' },
  headerTextGroup: { flex: 1, flexShrink: 1, alignItems: 'flex-start' },
  headerNameRow: { flexDirection: 'row', alignItems: 'center', gap: scale(4) },
  headerTitle: { fontSize: scale(16), fontWeight: '700' },
  headerProduct: { fontSize: scale(12), fontWeight: '500' },
  messagesContainer: { padding: scale(16), paddingBottom: scale(8) },
  productCard: {
    flexDirection: 'row', alignItems: 'center', padding: scale(10), borderRadius: borderRadius.md,
    borderWidth: 1, marginBottom: scale(16), gap: scale(10),
  },
  productThumb: { width: scale(48), height: scale(48), borderRadius: scale(8) },
  productTitle: { fontSize: scale(14), fontWeight: '600' },
  productPrice: { fontSize: scale(15), fontWeight: '700', marginTop: scale(2) },
  msgRow: { marginBottom: scale(8) },
  msgRowRight: { alignItems: 'flex-end' },
  msgRowLeft: { alignItems: 'flex-start' },
  bubble: { maxWidth: '78%', paddingHorizontal: scale(16), paddingVertical: scale(12), borderRadius: scale(20) },
  msgText: { fontSize: scale(15), lineHeight: 21 },
  msgTime: { fontSize: scale(10), marginTop: scale(4), alignSelf: 'flex-end' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: scale(12), paddingTop: scale(10), borderTopWidth: 1, gap: scale(8),
  },
  inputWrapper: {
    flex: 1, borderRadius: scale(24), borderWidth: 1, paddingHorizontal: scale(16), paddingVertical: scale(8), maxHeight: scale(100),
  },
  input: { fontSize: scale(15), maxHeight: scale(80), lineHeight: 20 },
  sendBtn: {
    width: scale(46), height: scale(46), borderRadius: scale(23), alignItems: 'center', justifyContent: 'center', marginBottom: scale(1),
  },
  chatDisclaimer: {
    flexDirection: 'row', alignItems: 'flex-start', gap: scale(8),
    padding: scale(12), borderRadius: scale(10), borderWidth: 1, marginBottom: scale(12),
  },
  chatDisclaimerText: {
    fontSize: scale(11), lineHeight: 16, flex: 1, fontWeight: '500',
  },
});
