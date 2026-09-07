import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';

/**
 * Admin index — redirects authenticated super_admin to dashboard.
 * Non-admin users are sent back to home.
 * This page is NOT a login screen; all logins go through the unified LoginModal.
 */
export default function AdminIndexScreen() {
  const router = useRouter();
  const { user, isLoggedIn, colors } = useApp();

  useEffect(() => {
    if (isLoggedIn && user?.role === 'super_admin') {
      router.replace('/admin/dashboard');
    } else {
      router.replace('/(tabs)');
    }
  }, [isLoggedIn, user]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.text, { color: colors.textSecondary }]}>Redirecting...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  text: { fontSize: 14, fontWeight: '500' },
});
