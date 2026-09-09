import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function RootIndex() {
  const router = useRouter();
  useEffect(() => {
    requestAnimationFrame(() => { router.replace('/(tabs)'); });
  }, [router]);
  return null;
}
