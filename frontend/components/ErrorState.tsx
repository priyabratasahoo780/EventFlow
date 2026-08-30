import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { Colors } from '../constants/Colors';

interface Props {
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({ message = 'Something went wrong.', onRetry }: Props) {
  return (
    <View style={styles.container}>
      <AlertTriangle color={Colors.light.danger} size={40} />
      <Text style={styles.title}>ERROR OCCURRED</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <Pressable style={styles.retryBtn} onPress={onRetry}>
          <Text style={styles.retryText}>RETRY</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 12,
    margin: 16,
  },
  title: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 16,
    color: '#000',
    marginTop: 8,
  },
  message: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: '#555',
    textAlign: 'center',
    marginTop: 4,
  },
  retryBtn: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000',
    marginTop: 14,
  },
  retryText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 12,
    color: '#FFF',
  },
});
