import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/useAuthStore';
import { View, ActivityIndicator } from 'react-native';
import LoadingScreen from '../components/LoadingScreen';

export default function Index() {
  const { token, isLoading } = useAuthStore();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (token) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/welcome" />;
}
