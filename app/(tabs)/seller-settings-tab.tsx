import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { scale } from '@/constants/responsive';
import { shadows } from '@/constants/theme';
import { selection, impactLight, notifyWarning } from '@/services/haptics';

export default function SellerSettingsTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, language, user, logout } = useApp();
  const isFr = language === 'fr';
  const isAr = language === 'ar';
  const lb = (en: string, fr: string, ar: string) => isFr ? fr : isAr ? ar : en;

  const menuItems = [
    { icon: 'store', label: lb('Store Information', 'Informations du magasin', 'معلومات المتجر'), desc: lb('Name, phone, bio, logo, banner', 'Nom, tel, bio, logo, banniere', 'الاسم، الهاتف، النبذة، الشعار، البانر'), route: '/seller-settings' },
    { icon: 'payments', label: lb('Payment Numbers', 'Numeros de paiement', 'أرقام الدفع'), desc: lb('Manage receiving numbers', 'Gerer les numeros', 'إدارة أرقام الاستلام'), route: '/seller-payments' },
    { icon: 'local-shipping', label: lb('Delivery Cities', 'Villes de livraison', 'مدن التوصيل'), desc: lb('Cities you deliver to', 'Villes de livraison', 'المدن التي توصل إليها'), route: '/seller-settings' },
    { icon: 'inventory', label: lb('Products', 'Produits', 'المنتجات'), desc: lb('Add, edit, manage products', 'Ajouter, gerer produits', 'إضافة، تعديل، إدارة المنتجات'), route: '/(tabs)/sell' },
    { icon: 'share', label: lb('Share Store', 'Partager le magasin', 'مشاركة المتجر'), desc: lb('Share your store link', 'Partager le lien', 'مشاركة رابط متجرك'), route: null },
    { icon: 'person', label: lb('Account Settings', 'Parametres du compte', 'إعدادات الحساب'), desc: lb('Language, notifications', 'Langue, notifications', 'اللغة، الإشعارات'), route: '/settings' },
  ];

  const handleLogout = () => {
    Alert.alert(
      lb('Logout', 'Deconnexion', 'تسجيل الخروج'),
      lb('Are you sure?', 'Etes-vous sur?', 'هل أنت متأكد؟'),
      [
        { text: lb('Cancel', 'Annuler', 'إلغاء'), style: 'cancel' },
        { text: lb('Logout', 'Deconnexion', 'خروج'), style: 'destructive', onPress: () => { notifyWarning(); logout(); } },
      ]
    );
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {lb('Settings', 'Parametres', 'الإعدادات')}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: scale(16), paddingBottom: insets.bottom + scale(40) }}>
        {/* Store info card */}
        <View style={[styles.storeCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }, shadows.card]}>
          {user?.avatar ? (
            <Image source={{ uri: user.avatar }} style={styles.storeAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.storeAvatarPlaceholder, { backgroundColor: colors.primary }]}>
              <Text style={styles.storeAvatarText}>{(user?.name || 'S').charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(6) }}>
              <Text style={[styles.storeName, { color: colors.textPrimary }]} numberOfLines={1}>{user?.username || user?.name || ''}</Text>
              {user?.isVerified && <MaterialIcons name="verified" size={scale(16)} color={colors.verified} />}
            </View>
            <Text style={[styles.storeId, { color: colors.textTertiary }]}>{user?.sellerId || ''}</Text>
          </View>
        </View>

        {/* Menu items */}
        <View style={[styles.menuSection, { backgroundColor: colors.surface, borderColor: colors.borderLight }, shadows.card]}>
          {menuItems.map((item, index) => (
            <Pressable
              key={index}
              onPress={() => { selection(); if (item.route) router.push(item.route as any); }}
              style={({ pressed }) => [
                styles.menuItem, { borderBottomColor: colors.border },
                index === menuItems.length - 1 && { borderBottomWidth: 0 },
                pressed && { opacity: 0.7 },
              ]}
            >
              <View style={[styles.menuIcon, { backgroundColor: colors.primary + '12' }]}>
                <MaterialIcons name={item.icon as any} size={scale(20)} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{item.label}</Text>
                <Text style={[styles.menuDesc, { color: colors.textTertiary }]}>{item.desc}</Text>
              </View>
              <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={scale(18)} color={colors.textTertiary} />
            </Pressable>
          ))}
        </View>

        {/* Logout */}
        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [styles.logoutBtn, { backgroundColor: colors.error + '08', borderColor: colors.error, opacity: pressed ? 0.85 : 1 }]}
        >
          <MaterialIcons name="logout" size={scale(20)} color={colors.error} />
          <Text style={[styles.logoutText, { color: colors.error }]}>{lb('Logout', 'Deconnexion', 'تسجيل الخروج')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: scale(16), paddingVertical: scale(14), borderBottomWidth: 1, alignItems: 'center' },
  headerTitle: { fontSize: scale(18), fontWeight: '700', fontFamily: 'Cairo-Bold' },
  storeCard: { flexDirection: 'row', alignItems: 'center', padding: scale(16), borderRadius: scale(16), borderWidth: 1, gap: scale(12), marginBottom: scale(14) },
  storeAvatar: { width: scale(48), height: scale(48), borderRadius: scale(24) },
  storeAvatarPlaceholder: { width: scale(48), height: scale(48), borderRadius: scale(24), alignItems: 'center', justifyContent: 'center' },
  storeAvatarText: { fontSize: scale(20), fontWeight: '800', color: '#FFF', fontFamily: 'Cairo-Bold' },
  storeName: { fontSize: scale(16), fontWeight: '700', fontFamily: 'Cairo-Bold' },
  storeId: { fontSize: scale(12), fontWeight: '500', marginTop: scale(2), fontFamily: 'Cairo-Regular' },
  menuSection: { borderRadius: scale(16), borderWidth: 1, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: scale(14), borderBottomWidth: 1, gap: scale(12) },
  menuIcon: { width: scale(36), height: scale(36), borderRadius: scale(18), alignItems: 'center', justifyContent: 'center' },
  menuLabel: { fontSize: scale(14), fontWeight: '600', fontFamily: 'Cairo-Medium' },
  menuDesc: { fontSize: scale(11), fontWeight: '400', marginTop: scale(2), fontFamily: 'Cairo-Regular' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: scale(20), paddingVertical: scale(14), borderRadius: scale(12), borderWidth: 1, gap: scale(8) },
  logoutText: { fontSize: scale(15), fontWeight: '700', fontFamily: 'Cairo-Bold' },
});