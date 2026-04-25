import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Shadow, Spacing, useTheme } from '@/components/Redesign';

export type FloatingFilterOption<T extends string> = {
  key: T;
  label: string;
};

type FloatingFilterMenuProps<T extends string> = {
  title: string;
  options: FloatingFilterOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  allKey: T;
};

export function FloatingFilterMenu<T extends string>({
  title,
  options,
  selected,
  onSelect,
  allKey,
}: FloatingFilterMenuProps<T>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const isFiltered = selected !== allKey;
  const selectedLabel = useMemo(
    () => options.find((option) => option.key === selected)?.label ?? 'Semua',
    [options, selected],
  );
  const bottomOffset = Math.max(insets.bottom, 12) + 92;
  const fabActive = open || isFiltered;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {open ? (
        <Pressable
          style={styles.overlay}
          accessibilityRole="button"
          accessibilityLabel="Tutup popup filter"
          onPress={() => setOpen(false)}
        />
      ) : null}

      <View pointerEvents="box-none" style={[styles.anchor, { right: 20, bottom: bottomOffset }]}>
        {open ? (
          <View
            style={[
              styles.menu,
              Shadow.card,
              {
                backgroundColor: colors.bgSurface,
                borderColor: colors.borderSubtle,
              },
            ]}
          >
            <View style={[styles.menuHeader, { borderBottomColor: colors.borderSubtle }]}>
              <Text style={[styles.menuTitle, { color: colors.textPrimary }]}>{title}</Text>
              <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>
                Aktif: {selectedLabel}
              </Text>
            </View>

            <View style={styles.optionList}>
              {options.map((option) => {
                const active = option.key === selected;

                return (
                  <Pressable
                    key={option.key}
                    accessibilityRole="button"
                    accessibilityState={active ? { selected: true } : {}}
                    onPress={() => {
                      onSelect(option.key);
                      setOpen(false);
                    }}
                    style={[
                      styles.option,
                      {
                        backgroundColor: active ? colors.accentDim : colors.bgBase,
                        borderColor: active ? colors.borderAccent : colors.borderSubtle,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionLabel,
                        { color: active ? colors.accent : colors.textPrimary },
                      ]}
                    >
                      {option.label}
                    </Text>
                    <FontAwesome
                      name={active ? 'check-circle' : 'circle-o'}
                      size={18}
                      color={active ? colors.accent : colors.textMuted}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title}. Filter aktif ${selectedLabel}`}
          onPress={() => setOpen((value) => !value)}
          style={[
            styles.fab,
            Shadow.card,
            {
              backgroundColor: fabActive ? colors.accent : colors.bgSurface,
              borderColor: fabActive ? colors.accent : colors.tabBorder,
            },
          ]}
        >
          <FontAwesome
            name="sliders"
            size={20}
            color={fabActive ? colors.textInverse : colors.accent}
          />
          {isFiltered ? (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: fabActive ? colors.bgSurface : colors.accent,
                  borderColor: fabActive ? colors.accent : colors.bgSurface,
                },
              ]}
            />
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  anchor: {
    position: 'absolute',
    alignItems: 'flex-end',
    zIndex: 40,
  },
  menu: {
    position: 'absolute',
    right: 0,
    bottom: 72,
    width: 248,
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  menuHeader: {
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    gap: 2,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  menuSubtitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  optionList: {
    gap: Spacing.sm,
  },
  option: {
    minHeight: 46,
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  optionLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 12,
  },
  badge: {
    position: 'absolute',
    top: 11,
    right: 11,
    width: 10,
    height: 10,
    borderRadius: Radius.full,
    borderWidth: 2,
  },
});
