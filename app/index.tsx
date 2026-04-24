import { Redirect } from 'expo-router';
import { useAuthStore } from '@/lib/stores/authStore';

export default function EntryScreen() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const status = useAuthStore((state) => state.status);

  if (!hydrated || status === 'loading') {
    return null;
  }

  if (status !== 'authenticated') {
    return <Redirect href="/login" />;
  }

  return <Redirect href="/(tabs)" />;
}
