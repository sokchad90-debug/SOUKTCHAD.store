import { scale } from '@/ui/responsive';
import React from 'react';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { DS } from '@/ui/designSystem';

/**
 * Unified product image — FULL image always visible (contentFit="contain"),
 * fixed frame held during load AND failure (no list jump), neutral gap when
 * the image ratio differs from the frame. No server-crop dependency.
 * Never stretched, never blurred, never flipped in RTL.
 */
interface Props {
  uri?: string;
  frameWidth: number;
  frameRatio?: number; // width / height of the FRAME
  neutralBg?: string;
  failedText?: string;
  loadingText?: string;
  accessibilityLabel?: string;
}

function ProductImageInner({ uri, frameWidth, frameRatio = 1 / DS.imageRatios.product, neutralBg = '#FFFFFF', failedText, accessibilityLabel }: Props) {
  const [failed, setFailed] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [retryCount, setRetryCount] = React.useState(0);
  const retryTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const height = Math.round(frameWidth / frameRatio);
  React.useEffect(() => {
    setFailed(false);
    setLoading(true);
    setRetryCount(0);
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [uri]);

  const retryUri = uri && retryCount > 0
    ? `${uri}${uri.includes('?') ? '&' : '?'}r=${retryCount}`
    : uri;

  const handleError = () => {
    if (retryCount < 2) {
      setLoading(true);
      retryTimer.current = setTimeout(() => {
        setRetryCount((count) => count + 1);
        retryTimer.current = null;
      }, 1200);
      return;
    }
    setFailed(true);
    setLoading(false);
  };

  const innerPad = Math.min(Math.max(Math.round(frameWidth * 0.04), 6), 12);
  return (
    <View style={[styles.frame, { width: frameWidth, height, backgroundColor: neutralBg, padding: innerPad }]}
      testID="product-image-frame"
    >
      {uri && !failed ? (
        <Image
          key={retryCount}
          source={{ uri: retryUri }}
          style={styles.image}
          contentFit="contain"
          transition={150}
          cachePolicy="disk"
          recyclingKey={uri}
          accessibilityLabel={accessibilityLabel}
          onLoadEnd={() => setLoading(false)}
          onError={handleError}
        />
      ) : (
        <View style={styles.fallback}>
          <MaterialIcons name={failed ? 'image-not-supported' : 'shopping-bag'} size={Math.round(frameWidth * 0.16)} color="#94A3B8" />
          {failed && failedText ? (
            <Text style={styles.fallbackText}>{failedText}</Text>
          ) : null}
        </View>
      )}
      {loading && uri && !failed ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color="#5B48D9" />
        </View>
      ) : null}
    </View>
  );
}

const ProductImage = React.memo(ProductImageInner);
export default ProductImage;

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  fallback: { alignItems: 'center', justifyContent: 'center', gap: scale(6) },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  fallbackText: { fontSize: scale(10), color: '#475569', fontFamily: DS.fontFamily.regular },
});
