import React from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import { useTheme } from './ThemeContext';

type TypographyVariant = 'displayLg' | 'displayMd' | 'heading' | 'subheading' | 'body' | 'bodyMd' | 'label' | 'caption' | 'badge';

type TypographyProps = {
  variant?: TypographyVariant;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  children: React.ReactNode;
};

export function Typography({ variant = 'body', color, style, numberOfLines, children }: TypographyProps) {
  const { colors } = useTheme();

  const variantStyles: Record<TypographyVariant, TextStyle> = {
    displayLg: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
    displayMd: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.3 },
    heading: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
    subheading: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
    body: { fontSize: 14, fontWeight: '400', color: colors.textSecondary, lineHeight: 21 },
    bodyMd: { fontSize: 13, fontWeight: '400', color: colors.textSecondary, lineHeight: 19 },
    label: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    caption: { fontSize: 11, fontWeight: '500', color: colors.textMuted },
    badge: { fontSize: 11, fontWeight: '700' },
  };

  const base = variantStyles[variant];
  return (
    <Text numberOfLines={numberOfLines} style={[base, color ? { color } : null, style]}>
      {children}
    </Text>
  );
}
