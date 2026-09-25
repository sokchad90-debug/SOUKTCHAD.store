import { scale } from '@/ui/responsive';
/*
 * @Description:
 */

// Powered by Sokchad
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NotFoundScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#0a0a0a', '#1a1a1a']}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.content}>
        <MaterialIcons name="photo-camera" size={scale(80)} color="#FFD700" />
        <Text style={styles.title}>Page Not Found</Text>
        <Text style={styles.message}>
          The moment you&apos;re looking for seems to have been lost in the shadows.
        </Text>

        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => router.push('/')}
        >
          <Text style={styles.homeButtonText}>Return Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(20),
  },
  title: {
    fontSize: scale(28),
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: scale(20),
    marginBottom: scale(10),
  },
  message: {
    fontSize: scale(16),
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: scale(40),
    lineHeight: scale(22),
  },
  homeButton: {
    backgroundColor: '#FFD700',
    paddingHorizontal: scale(30),
    paddingVertical: scale(15),
    borderRadius: scale(25),
  },
  homeButtonText: {
    color: '#0a0a0a',
    fontWeight: 'bold',
    fontSize: scale(16),
  },
});
