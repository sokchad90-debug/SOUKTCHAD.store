import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

function formatCountdown(ms: number, language: string = 'en'): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  // Language-specific units
  const u = language === 'ar' ? { d: 'ي', h: 'س', m: 'د', s: 'ث' }
    : language === 'fr' ? { d: 'j', h: 'h', m: 'min', s: 's' }
    : { d: 'd', h: 'h', m: 'm', s: 's' };
  if (d > 0) return `${d}${u.d} ${h}${u.h} ${m}${u.m}`;
  if (h > 0) return `${h}${u.h} ${m}${u.m} ${s}${u.s}`;
  if (m > 0) return `${m}${u.m} ${s}${u.s}`;
  return `${s}${u.s}`;
}

export function FlashDealsBanner({ colors, language, router, lb, products }: any) {
  const [hasDeals, setHasDeals] = useState(false);
  const [countdown, setCountdown] = useState('0s');
  const [dealImage, setDealImage] = useState('');
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!products || products.length === 0) return;
    const now = Date.now();
    const active = products.filter((p: any) => {
      if (!p.discountPercent || p.discountPercent <= 0) return false;
      return true;
    });
    if (active.length > 0) {
      setHasDeals(true);
      setDealImage(active[0]?.images?.[0] || active[0]?.image || '');
    } else {
      setHasDeals(false);
    }
  }, [products]);

  useEffect(() => {
    if (!hasDeals) return;
    if (!products || products.length === 0) return;

    const active = products.filter((p: any) => {
      if (!p.discountPercent || p.discountPercent <= 0) return false;
      return true;
    });

    if (active.length === 0) {
      setHasDeals(false);
      return;
    }

    // Find earliest expiring deal (fallback to 24h if no valid date)
    const earliest = active.reduce((min: number, d: any) => {
      const t = d.discountUntil ? new Date(d.discountUntil).getTime() : Date.now() + 86400000;
      return (Number.isFinite(t) && t < min) ? t : min;
    }, Date.now() + 86400000);

    const tick = () => {
      const remaining = earliest - Date.now();
      if (remaining <= 0) {
        setCountdown(formatCountdown(0, language));
        return;
      }
      setCountdown(formatCountdown(remaining, language));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [hasDeals, products, language]);

  const isAr = language === 'ar';

  if (!hasDeals) return null;

  return (
    <Pressable
      onPress={() => router.push('/flash-deals' as any)}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: '#EF444433',
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      {/* Background image filling entire banner — official Sokchad promotional artwork */}
      <Image
        source={require('../assets/banners/sokchad-phone-offer.png')}
        style={styles.dealImage}
        contentFit="cover"
        transition={150}
      />

      {/* Overlay with label + timer */}
      <View style={[styles.overlay, isAr && { flexDirection: 'row-reverse' }]}>
        <View style={styles.flashBadge}>
          <MaterialIcons name="flash-on" size={10} color="#FFF" />
          <Text style={styles.flashLabel}>
            {lb('Deals', 'Offres', 'العروض')}
          </Text>
        </View>
        <View style={[styles.timerSection, isAr && { flexDirection: 'row-reverse' }]}>
          <Text style={styles.timerText}>{countdown}</Text>
          <MaterialIcons name={isAr ? "chevron-left" : "chevron-right"} size={14} color="#FFF" />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: '2.56%',
    marginBottom: 4,
    marginTop: 6,
    borderRadius: 10,
    borderWidth: 1.5,
    padding: 0,
    gap: 0,
    aspectRatio: 10 / 3,
    overflow: 'hidden',
  },
  dealImage: {
    width: '100%',
    height: '100%',
    flex: 1,
    borderRadius: 0,
  },
  labelSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  flashBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  flashLabel: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  timerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  timerText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#EF4444',
  },
});
