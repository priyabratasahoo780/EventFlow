import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/useAuthStore';
import LoadingScreen from '../components/LoadingScreen';

export default function Index() {
  const { token, user, isLoading } = useAuthStore();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (token) {
    if (user?.role === 'admin') {
      return <Redirect href={'/admin' as any} />;
    }
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/welcome" />;
}
