import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors } from '../constants/Colors';

interface Props {
  message?: string;
}

export default function LoadingScreen({ message = 'Loading FocusFlow...' }: Props) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.light.primary} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.background,
    padding: 20,
  },
  text: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    color: '#000',
    marginTop: 14,
  },
});
