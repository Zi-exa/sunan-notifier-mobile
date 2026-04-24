import React from 'react';
import { ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import { Radius } from './theme';
import { useTheme } from './ThemeContext';

type FilterOption<T extends string> = {
  key: T;
  label: string;
};

type FilterChipsProps<T extends string> = {
  options: FilterOption<T>[];
  selected: T;
  onSelect: (key: T) => void;
};

export function FilterChips<T extends string>({ options, selected, onSelect }: FilterChipsProps<T>) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {options.map((opt) => {
        const active = opt.key === selected;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onSelect(opt.key)}
            style={[
              styles.chip,
              { borderColor: colors.borderMuted, backgroundColor: colors.bgCard },
              active && { backgroundColor: colors.accent, borderColor: colors.accent },
            ]}
          >
            <Text style={[styles.chipText, { color: colors.textSecondary }, active && { color: '#FFFFFF' }]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 4 },
  chip: { borderRadius: Radius.full, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 12, fontWeight: '600' },
});
