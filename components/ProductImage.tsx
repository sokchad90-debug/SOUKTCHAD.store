import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { scale } from '@/constants/responsive';

/**
 * Unified product image: fills the fixed-ratio product frame without stretching.
 * The source is cropped only at its edges, matching the marketplace reference.
 */
interface Props {
  uri?: string;
  frameWidth: number;
  frameRatio?: number; // width / height of the FRAME (e.g. 1.1 => square-ish)
  neutralBg?: string;
  failedText?: string;
}

function ProductImageInner({ uri, frameWidth, frameRatio = 1.1, neutralBg = '#F1F5F9', failedText }: Props) {
  const [failed, setFailed] = React.useState(false);
  const height = Math.round(frameWidth / frameRatio);
  React.useEffect(() => { setFailed(false); }, [uri]);

  return (
    <View style={[styles.frame, { width: frameWidth, height, backgroundColor: neutralBg }]}>
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={styles.image}
          contentFit="cover"
          transition={200}
          recyclingKey={uri}
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={styles.fallback}>
          <MaterialIcons name={failed ? 'image-not-supported' : 'shopping-bag'} size={scale(26)} color="#94A3B8" />
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
  fallbackText: { fontSize: scale(10), color: '#64748B', fontFamily: 'Cairo-Regular' },
});
