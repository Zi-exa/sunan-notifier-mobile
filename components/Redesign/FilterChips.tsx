import React, { useMemo } from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
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
  columns?: 2 | 3;
};

export function FilterChips<T extends string>({
  options,
  selected,
  onSelect,
  columns = 3,
}: FilterChipsProps<T>) {
  const { colors } = useTheme();
  const rows = useMemo(() => {
    const chunked: FilterOption<T>[][] = [];
    for (let index = 0; index < options.length; index += columns) {
      chunked.push(options.slice(index, index + columns));
    }
    return chunked;
  }, [columns, options]);

  return (
    <View style={styles.grid}>
      {rows.map((row, rowIndex) => (
        <View
          key={`row-${rowIndex}`}
          style={[styles.gridRow, row.length < columns ? styles.gridRowCentered : null]}
        >
          {row.map((opt) => {
            const active = opt.key === selected;
            const rowWidthStyle =
              columns === 2
                ? row.length === 1
                  ? styles.chipCompactSingle
                  : styles.chipFill
                : row.length === 1
                  ? styles.chipSingle
                  : row.length === 2
                    ? styles.chipDouble
                    : styles.chipFill;

            return (
              <Pressable
                key={opt.key}
                onPress={() => onSelect(opt.key)}
                style={[
                  styles.chip,
                  rowWidthStyle,
                  { borderColor: colors.borderMuted, backgroundColor: colors.bgCard },
                  active && { backgroundColor: colors.accent, borderColor: colors.accent },
                ]}
              >
                <Text
                  numberOfLines={2}
                  style={[styles.chipText, { color: colors.textSecondary }, active && { color: '#FFFFFF' }]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: 10,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'stretch',
  },
  gridRowCentered: {
    justifyContent: 'center',
  },
  chip: {
    minHeight: 50,
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipFill: {
    flex: 1,
  },
  chipDouble: {
    width: '48%',
  },
  chipCompactSingle: {
    width: '48%',
  },
  chipSingle: {
    width: '100%',
  },
  chipText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
});
