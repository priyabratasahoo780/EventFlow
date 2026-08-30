import React from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  GraduationCap, Briefcase, User, Stethoscope, Mic,
  Rocket, Calendar, Activity, ShoppingCart, Zap, Layers
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface CategoryChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

const getCategoryIcon = (label: string, color: string) => {
  const clean = label.replace(/[^\w\s]/gi, '').trim();
  const size = 14;
  const sw = 2.5;
  switch (clean) {
    case 'Academic':    return <GraduationCap color={color} size={size} strokeWidth={sw} />;
    case 'Work':        return <Briefcase color={color} size={size} strokeWidth={sw} />;
    case 'Personal':    return <User color={color} size={size} strokeWidth={sw} />;
    case 'Appointment': return <Stethoscope color={color} size={size} strokeWidth={sw} />;
    case 'Interview':   return <Mic color={color} size={size} strokeWidth={sw} />;
    case 'Hackathon':   return <Rocket color={color} size={size} strokeWidth={sw} />;
    case 'Meeting':     return <Calendar color={color} size={size} strokeWidth={sw} />;
    case 'Health':      return <Activity color={color} size={size} strokeWidth={sw} />;
    case 'Shopping':    return <ShoppingCart color={color} size={size} strokeWidth={sw} />;
    case 'Other':       return <Zap color={color} size={size} strokeWidth={sw} />;
    default:            return <Layers color={color} size={size} strokeWidth={sw} />;
  }
};

export default function CategoryChip({ label, selected, onPress }: CategoryChipProps) {
  const cleanLabel = label.replace(/[^\w\s]/gi, '').trim();

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={styles.container}
    >
      {selected ? (
        <LinearGradient
          colors={['#FF7A00', '#FF5C00']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.chip}
        >
          {getCategoryIcon(cleanLabel, '#FFF')}
          <Text style={[styles.text, styles.textSelected]}>{cleanLabel}</Text>
        </LinearGradient>
      ) : (
        <View style={styles.chipInactive}>
          {getCategoryIcon(cleanLabel, '#667085')}
          <Text style={styles.text}>{cleanLabel}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginRight: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    gap: 6,
    shadowColor: '#FF7A00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  chipInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E9EDF3',
  },
  text: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    color: '#667085',
  },
  textSelected: {
    color: '#FFFFFF',
    fontFamily: 'Poppins_700Bold',
  },
});
