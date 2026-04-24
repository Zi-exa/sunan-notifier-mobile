import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { View, Text, StyleSheet } from 'react-native';
import { Radius } from './theme';
import { useTheme } from './ThemeContext';

type EmptyStateProps = {
  title: string;
  description: string;
  icon?: React.ComponentProps<typeof FontAwesome>['name'];
};

export function EmptyState({ title, description, icon = 'inbox' }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle }]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.accentDim }]}>
        <FontAwesome name={icon} size={24} color={colors.accent} />
      </View>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: Radius.md, padding: 24, borderWidth: 1, alignItems: 'center', gap: 8 },
  iconWrap: { width: 56, height: 56, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  title: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  description: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
