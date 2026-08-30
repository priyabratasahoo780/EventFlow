import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { priorityService } from '../services/priorityService';
import { Flame, AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react-native';

interface Props {
  score: number;
}

export default function PriorityBadge({ score }: Props) {
  const prioInfo = priorityService.getPriorityInfo(score);

  const renderIcon = () => {
    switch (prioInfo.level.toLowerCase()) {
      case 'critical': return <Flame color="#FFF" size={13} strokeWidth={2.8} />;
      case 'high': return <AlertTriangle color="#FFF" size={13} strokeWidth={2.8} />;
      case 'medium': return <ShieldAlert color="#FFF" size={13} strokeWidth={2.8} />;
      default: return <CheckCircle2 color="#FFF" size={13} strokeWidth={2.8} />;
    }
  };

  return (
    <View style={[styles.badge, { backgroundColor: prioInfo.color }]}>
      {renderIcon()}
      <Text style={styles.text}>{prioInfo.level.toUpperCase()} ({score} PTS)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000',
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 11,
    color: '#FFF',
  },
});
