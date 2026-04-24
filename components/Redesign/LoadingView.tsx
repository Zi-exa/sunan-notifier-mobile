import React from 'react';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { useTheme } from './ThemeContext';

type LoadingViewProps = { text?: string };

export function LoadingView({ text = 'Memuat data SUNAN...' }: LoadingViewProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.bgBase }]}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={[styles.text, { color: colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, paddingHorizontal: 24 },
  text: { fontSize: 14, textAlign: 'center' },
});
