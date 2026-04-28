import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Radius } from './theme';
import { useTheme } from './ThemeContext';

type BadgeVariant = 'pending' | 'submitted' | 'overdue' | 'unknown' | 'open' | 'closing_soon' | 'upcoming' | 'available' | 'closed' | 'accent';

type BadgeProps = {
  variant?: BadgeVariant;
  label: string;
  showDot?: boolean;
};

export function Badge({ variant = 'accent', label, showDot = false }: BadgeProps) {
  const { colors } = useTheme();

  const BADGE_CONFIG: Record<BadgeVariant, { bg: string; text: string }> = {
    pending:      { bg: colors.warningDim,  text: colors.warning  },
    submitted:    { bg: colors.successDim,  text: colors.success  },
    overdue:      { bg: colors.dangerDim,   text: colors.danger   },
    unknown:      { bg: colors.accentDim,   text: colors.accent   },
    open:         { bg: colors.successDim,  text: colors.success  },
    closing_soon: { bg: colors.warningDim,  text: colors.warning  },
    upcoming:     { bg: colors.accentDim,   text: colors.accent   },
    available:    { bg: colors.purpleDim,   text: colors.purple   },
    closed:       { bg: colors.borderSubtle, text: colors.textMuted },
    accent:       { bg: colors.accentDim,   text: colors.accent   },
  };

  const config = BADGE_CONFIG[variant];
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      {showDot ? <View style={[styles.dot, { backgroundColor: config.text }]} /> : null}
      <Text style={[styles.text, { color: config.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: { fontSize: 9, fontWeight: '700' },
});
