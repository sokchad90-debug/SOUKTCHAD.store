import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
}

function ProductImageInner({ uri, frameWidth, frameRatio = 1 / DS.imageRatios.product, neutralBg = '#FFFFFF', failedText, loadingText }: Props) {
  const [failed, setFailed] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const height = Math.round(frameWidth / frameRatio);
  React.useEffect(() => { setFailed(false); setLoading(true); }, [uri]);

  const innerPad = Math.min(Math.max(Math.round(frameWidth * 0.04), 6), 12);
  return (
    <View style={[styles.frame, { width: frameWidth, height, backgroundColor: neutralBg, padding: innerPad }]}
      testID="product-image-frame"
    >
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={styles.image}
          contentFit="contain"
          transition={150}
          recyclingKey={uri}
          onLoadEnd={() => setLoading(false)}
          onError={() => { setFailed(true); setLoading(false); }}
        />
      ) : (
        <View style={styles.fallback}>
          <MaterialIcons name={failed ? 'image-not-supported' : 'shopping-bag'} size={Math.round(frameWidth * 0.16)} color="#94A3B8" />
          {failed && failedText ? (
            <Text style={styles.fallbackText}>{failedText}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const ProductImage = React.memo(ProductImageInner);
export default ProductImage;

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  fallback: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  fallbackText: { fontSize: 10, color: DS.colors.textTertiary, fontFamily: DS.fontFamily.regular },
});