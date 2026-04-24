import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { View, Text, StyleSheet } from 'react-native';
import { Radius } from './theme';
import { useTheme } from './ThemeContext';

type KpiItem = {
  label: string;
  value: string | number;
  icon?: React.ComponentProps<typeof FontAwesome>['name'];
  accent?: string;
};

type KpiGridProps = { items: KpiItem[] };

export function KpiGrid({ items }: KpiGridProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <View key={item.label} style={[styles.item, { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle }]}>
          <View style={styles.labelRow}>
            {item.icon ? (
              <View style={[styles.iconWrap, { backgroundColor: colors.accentDim }]}>
                <FontAwesome name={item.icon} size={12} color={colors.accent} />
              </View>
            ) : null}
            <Text style={[styles.label, { color: colors.textSecondary }]}>{item.label}</Text>
          </View>
          <Text style={[styles.value, { color: item.accent ?? colors.textPrimary }]}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  item: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: 14,
    width: '47.5%',
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 5,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconWrap: { width: 22, height: 22, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, fontWeight: '500' },
  value: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
});
