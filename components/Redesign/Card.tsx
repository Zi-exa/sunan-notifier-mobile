import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Radius, Shadow } from './theme';
import { useTheme } from './ThemeContext';

type CardProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'elevated' | 'highlight';
};

export function Card({ children, style, variant = 'default' }: CardProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.base,
        { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle },
        variant === 'elevated' && { borderColor: colors.borderMuted, ...Shadow.card },
        variant === 'highlight' && { borderColor: colors.borderAccent, backgroundColor: colors.accentDim },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 14,
    gap: 8,
    ...Shadow.card,
  },
});
