import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/useAuthStore';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const { token, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF5EA' }}>
        <ActivityIndicator size="large" color="#FF7A00" />
      </View>
    );
  }

  if (token) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/welcome" />;
}
