import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { View, Text, StyleSheet } from 'react-native';
import { Radius } from './theme';
import { useTheme } from './ThemeContext';

type KpiItem = {
  label: string;
  value: string | number;
  icon?: React.ComponentProps<typeof FontAwesome>['name'];
  valueColor?: string;
  iconColor?: string;
  iconBackground?: string;
};

type KpiGridProps = { items: KpiItem[] };

export function KpiGrid({ items }: KpiGridProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <View
          key={item.label}
          style={[
            styles.item,
            { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle },
          ]}
        >
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: item.iconBackground ?? colors.accentDim },
            ]}
          >
            {item.icon ? (
              <FontAwesome
                name={item.icon}
                size={28}
                color={item.iconColor ?? colors.accent}
              />
            ) : null}
          </View>
          <View style={styles.copy}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{item.label}</Text>
            <Text style={[styles.value, { color: item.valueColor ?? colors.textPrimary }]}>
              {item.value}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: 16,
    paddingHorizontal: 14,
    width: '48.2%',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 6,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  copy: { flex: 1, gap: 4 },
  label: { fontSize: 13.5, fontWeight: '500', lineHeight: 18 },
  value: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, lineHeight: 30 },
});
