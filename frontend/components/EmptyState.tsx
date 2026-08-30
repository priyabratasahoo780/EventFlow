import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Inbox } from 'lucide-react-native';

interface Props {
  title?: string;
  subtitle?: string;
}

export default function EmptyState({ title = 'NO TASKS FOUND', subtitle = 'Tap + to create your first task' }: Props) {
  return (
    <View style={styles.container}>
      <Inbox color="#666" size={48} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  title: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 18,
    color: '#000',
    marginTop: 12,
  },
  subtitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
});
