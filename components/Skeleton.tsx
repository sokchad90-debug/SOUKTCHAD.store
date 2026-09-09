import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';
import { useApp } from '@/contexts/AppContext';
import { borderRadius } from '@/constants/theme';
import { scale } from '@/constants/responsive';

interface SkeletonProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

function SkeletonBox({ width, height, borderRadius: br = scale(8), style }: SkeletonProps) {
  const { colors } = useApp();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius: br, backgroundColor: colors.border, opacity },
        style,
      ]}
    />
  );
}

export function ProductCardSkeleton() {
  const { colors } = useApp();
  return (
    <View style={[skStyles.productCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <SkeletonBox width="100%" height={scale(130)} borderRadius={borderRadius.md} />
      <View style={skStyles.productInfo}>
        <SkeletonBox width="60%" height={scale(18)} borderRadius={scale(4)} />
        <SkeletonBox width="90%" height={scale(14)} borderRadius={scale(4)} style={{ marginTop: scale(6) }} />
        <SkeletonBox width="40%" height={scale(12)} borderRadius={scale(4)} style={{ marginTop: scale(6) }} />
      </View>
    </View>
  );
}

export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View style={skStyles.grid}>
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </View>
  );
}

export function ChatItemSkeleton() {
  const { colors } = useApp();
  return (
    <View style={[skStyles.chatItem, { borderBottomColor: colors.borderLight }]}>
      <SkeletonBox width={scale(52)} height={scale(52)} borderRadius={scale(26)} />
      <View style={skStyles.chatContent}>
        <View style={skStyles.chatTopRow}>
          <SkeletonBox width="50%" height={scale(16)} borderRadius={scale(4)} />
          <SkeletonBox width={scale(30)} height={scale(12)} borderRadius={scale(4)} />
        </View>
        <SkeletonBox width="70%" height={scale(12)} borderRadius={scale(4)} style={{ marginTop: scale(6) }} />
        <SkeletonBox width="85%" height={scale(14)} borderRadius={scale(4)} style={{ marginTop: scale(4) }} />
      </View>
    </View>
  );
}

export function ChatListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <ChatItemSkeleton key={i} />
      ))}
    </View>
  );
}

export function BannerSkeleton() {
  return (
    <View style={skStyles.bannerWrap}>
      <SkeletonBox width="100%" height={scale(160)} borderRadius={borderRadius.lg} />
    </View>
  );
}

export function CategorySkeleton() {
  return (
    <View style={skStyles.catRow}>
      {Array.from({ length: 5 }).map((_, i) => (
        <SkeletonBox key={i} width={scale(90)} height={scale(38)} borderRadius={scale(20)} />
      ))}
    </View>
  );
}

const skStyles = StyleSheet.create({
  productCard: {
    width: '48%',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: scale(12),
  },
  productInfo: {
    padding: scale(10),
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: scale(16),
    justifyContent: 'space-between',
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: scale(14),
    borderBottomWidth: 1,
    gap: scale(12),
  },
  chatContent: {
    flex: 1,
  },
  chatTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerWrap: {
    marginHorizontal: scale(16),
    marginBottom: scale(16),
  },
  catRow: {
    flexDirection: 'row',
    paddingHorizontal: scale(16),
    gap: scale(8),
    paddingBottom: scale(4),
  },
});

export default SkeletonBox;
