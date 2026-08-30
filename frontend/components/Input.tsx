import { useThemeStore } from '../store/useThemeStore';
import { ColorTheme } from '../constants/theme';
import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps } from 'react-native';
import { Colors } from '../constants/Colors';
import { Theme } from '../constants/theme';

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
}

export default function Input({ label, error, style, onFocus, onBlur, ...props }: InputProps) {
  const { getColors } = useThemeStore();
  const colors = getColors();
  const styles = getStyles(colors);
  const s = styles;
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <TextInput
        style={[
          styles.input,
          isFocused && styles.inputFocused,
          error && styles.inputError,
          style
        ]}
        placeholderTextColor={Colors.light.textSecondary}
        onFocus={(e) => {
          setIsFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          onBlur?.(e);
        }}
        {...props}
      />
      {error && <Text style={styles.errorText}>{error.toUpperCase()}</Text>}
    </View>
  );
}

const getStyles = (colors: ColorTheme) => StyleSheet.create({
  container: {
    marginBottom: Theme.spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.light.text,
    marginBottom: Theme.spacing.xs,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.light.card,
    borderWidth: Theme.borders.thick,
    borderColor: Colors.light.border,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    color: Colors.light.text,
    fontSize: 16,
    fontWeight: 'bold',
    height: 56,
    ...Theme.shadows.small,
  },
  inputFocused: {
    borderColor: Colors.light.primary,
  },
  inputError: {
    borderColor: Colors.light.danger,
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    color: Colors.light.danger,
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: Theme.spacing.xs,
  },
});
